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

## Data Maintenance

Several data sources in this app require periodic manual updates. They are listed below in order of how quickly they go stale.

### Ongoing — as Congress acts

| Data | File(s) | Trigger | What to update |
|------|---------|---------|----------------|
| Pending bills | `src/data/pending-bills.ts` | Bills pass, die, or new ones are introduced | `status`, `lastActionDate`, `passageLikelihood`, `cosponsors`; add/remove bills as the legislative landscape shifts |
| Tracked roll call votes | `src/data/tracked-votes.ts` | When you want to track votes on a newly enacted bill | Add the roll call number and bill metadata |
| Vote context descriptions | `src/components/RepresentativeCard.tsx` → `VOTE_CONTEXT` | When new tracked votes are added | Add a `yesEffect` / `noEffect` entry for each new bill title |
| Per-category legislation | `src/data/budget.ts` → `legislation` arrays | When a major new law is enacted that affects a spending category | Update the relevant category's `legislation` array |

### Annual — every tax season (Oct–Jan)

| Data | File(s) | Trigger | What to update |
|------|---------|---------|----------------|
| Tax brackets & standard deduction | `src/lib/tax.ts` → `TAX_YEAR_CONFIG` | IRS publishes Rev. Proc. each fall (usually Oct/Nov) for the next tax year | Add a new entry to `TAX_YEAR_CONFIG`, update the `TaxYear` union type, and add to `SUPPORTED_TAX_YEARS` |
| FICA Social Security wage base | `src/lib/tax.ts` → `socialSecurityWageBase` | SSA announces the new wage base each Oct | Update the value in the new year's config |
| Federal budget category amounts | `src/data/budget.ts` → `FY20XX_AMOUNTS` | CBO releases updated projections (usually Jan/Feb) | Add new fiscal year amounts and subcategory overrides; update `TOTAL_FEDERAL_SPENDING` |

### Rarely

| Data | File(s) | Trigger | What to update |
|------|---------|---------|----------------|
| Senate class-to-state map | `src/data/senate-classes.ts` | Never — classes are permanent per seat | Nothing unless a new state is admitted |
| FICA tax rates | `src/lib/tax.ts` → `SOCIAL_SECURITY_RATE`, `MEDICARE_RATE` | Congressional action (last changed in 1990) | Update the constants |
| Budget category definitions | `src/data/budget.ts` → category `id`, `name`, `color` | Only if you want to restructure how spending is categorized | Update the category objects and any references in `pending-bills.ts` |

### Automation status

| Data | Status | Details |
|------|--------|---------|
| Tracked roll call votes | **Automated** | `scripts/discover-bills.ts` + `scripts/draft-bill.ts` discover new enacted bills via Congress.gov API and generate draft `TrackedVote` entries. See `docs/bill-tracker-cli-spec.md`. |
| Pending bill statuses | **Spec'd** | `scripts/refresh-bill-status.ts` (planned) — refreshes `status`, `lastActionDate`, `cosponsors` in `pending-bills.ts` via Congress.gov API. See `docs/bill-status-refresher-spec.md`. |
| Tax brackets | **Spec'd** | `scripts/update-tax-brackets.ts` (planned) — fetches new-year bracket data and generates a config entry. See `docs/tax-bracket-updater-spec.md`. |
| Budget data | **Spec'd** | `scripts/update-budget-data.ts` (planned) — parses CBO historical tables and generates fiscal year amounts. See `docs/budget-data-updater-spec.md`. |
| Live vote records | **Live** | Already fetched at runtime from House Clerk / Senate XML — no script needed. |

## Key Architectural Constraints

- **No database** beyond Redis counters — all substantive data is client-side or from external APIs
- **No user accounts** — privacy-first, zero friction
- **Mostly static** — the core receipt experience works with zero API calls (tax calc + budget data are bundled)
- **API routes only exist to hide keys** — no business logic on the server beyond proxying and caching
- **Vercel free tier compatible** — serverless functions, edge caching, no persistent compute
