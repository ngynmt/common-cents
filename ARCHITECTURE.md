# Architecture

## System Overview

```
┌───────────────────────────────────────────────────────────────────┐
│                        Browser (Client)                           │
│                                                                   │
│  ┌──────────┐  ┌───────────┐  ┌────────────┐  ┌─────────────┐     │
│  │ TaxForm  │→ │ Tax Calc  │→ │ Spending   │→ │ TaxReceipt  │     │
│  │ (input)  │  │ (lib/tax) │  │ Allocation │  │ (output)    │     │
│  └──────────┘  └───────────┘  │(lib/spend) │  └─────────────┘     │
│                               └────────────┘         │            │
│                                                      ▼            │
│                                              ┌──────────────┐     │
│                                              │ SpendingChart│     │
│                                              │ ReceiptLine  │     │
│                                              │ BillsPanel   │     │
│                                              │ RepsModal    │     │
│                                              └──────────────┘     │
└──────────────────────┬──────────────┬─────────────────┬───────────┘
                       │ fetch        │ fetch           │ fetch
                       ▼              ▼                 ▼
              ┌───────────────┐ ┌─────────────┐ ┌────────────────────┐
              │/api/engagement│ │ /api/votes  │ │/api/representatives│
              │               │ │             │ │                    │
              │GET: read cnts │ │ House XML + │ │ ZIP → Geocodio API │
              │POST: incr     │ │ Senate XML  │ │ Returns senators + │
              │               │ │ → VoteRecs  │ │ house rep(s)       │
              └──────┬────────┘ └─────────────┘ └────────────────────┘
                     │
                     ▼
              ┌─────────────────┐
              │  Upstash Redis  │
              │  (or in-memory  │
              │   Map fallback) │
              └─────────────────┘
```

## Data Flow

### 1. Tax Calculation (client-side, no API)

```
User input (income, filing status)
  → estimateFederalTax() in lib/tax.ts
  → Returns: income tax + Social Security + Medicare + effective rate
  → calculatePersonalSpending() in lib/spending.ts
  → Maps total tax to 14 budget categories by federal spending proportions
```

Tax brackets, standard deductions, and FICA rates are from IRS data (2024 and 2025), stored in `lib/tax.ts`. The `estimateFederalTax()` function accepts a `TaxYear` parameter (defaults to 2025). No network request needed.

### 2. Spending Allocation (client-side, no API)

Budget category proportions come from `data/budget.ts` (FY2024 and FY2025 OMB/CBO data). The `getBudgetData(year)` function returns category data for the requested year. The user's total federal tax is distributed across categories proportionally:

```
User's $15,000 tax × (Defense 13.2% of federal budget) = $1,980 toward defense
```

Each category has subcategories, agencies, and linked legislation for drill-down.

### 3. Representative Lookup (server-side API route)

```
ZIP code → /api/representatives → Geocodio API → legislators for that ZIP
```

Geocodio resolves the ZIP to congressional district(s) and returns the exact legislators (2 senators + 1 house rep). For ZIPs spanning multiple districts, it returns all matching house reps with proportion data (e.g., "~77% of ZIP").

The API route exists to keep the Geocodio key server-side. Responses are cached for 24 hours (`revalidate: 86400`).

**Fallback:** If no API key is configured or the lookup fails, representatives are `null` and the reps section is not shown.

### 4. Engagement Counters (server-side API route + Redis)

```
User clicks Support/Oppose/Contacted → POST /api/engagement → Redis INCR
Page load → GET /api/engagement?bills=id1,id2 → Redis pipelined GET
```

Counters are atomic (Redis INCR) and use pipelined reads for efficiency. The `useEngagement` hook handles optimistic updates on the client.

**Fallback:** When `UPSTASH_REDIS_REST_URL` is not set, an in-memory `Map` stores counters (resets on server restart).

### 5. Vote Records (server-side API route)

```
Rep bioguide IDs + senator LIS IDs → /api/votes
  → Fetches House XML (clerk.house.gov) + Senate XML (senate.gov)
  → Parses individual votes for requested legislators
  → Returns VoteRecord[] with yes/no/abstain/not_voting
```

The app tracks 8 landmark bills defined in `data/tracked-votes.ts`. For each bill, the API fetches roll call XML from the official House Clerk and Senate websites, matching by bioguide ID (house) or LIS member ID (senate).

Responses are cached 24h (`revalidate: 86400`). An in-memory cache also prevents re-parsing the same XML within a serverless function lifetime.

**Fallback:** If XML fetches fail, vote data is simply empty (no sample votes shown for live reps).

### 6. Bill Data (static, curated)

`data/pending-bills.ts` contains 8 curated active bills with:
- CBO-sourced spending impacts
- Champion info
- Passage likelihood estimates
- Category mappings

`data/budget.ts` contains enacted legislation linked to each spending category.

## URL Persistence

The app stores state in URL search params for shareability:

```
/?income=75000&filing=single&zip=10001
```

On mount, `page.tsx` checks for these params and auto-generates the receipt if present. This means receipts survive refresh and can be shared as links.

## Key Architectural Constraints

- **No database** beyond Redis counters — all substantive data is client-side or from external APIs
- **No user accounts** — privacy-first, zero friction
- **Mostly static** — the core receipt experience works with zero API calls (tax calc + budget data are bundled)
- **API routes only exist to hide keys** — no business logic on the server beyond proxying and caching
- **Vercel free tier compatible** — serverless functions, edge caching, no persistent compute
