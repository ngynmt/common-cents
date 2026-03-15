# Recent Government Expenditures Feature

## Problem

The tax receipt shows users a static annual budget breakdown, but doesn't surface recent government spending decisions. Users can't see what the government just spent money on this week or month, or understand how much of their personal tax contribution went toward a specific expenditure. Questions like "How much of my taxes went to that military operation?" or "What did the latest spending bill cost me personally?" require external research and manual math.

## Goal

A feature that shows recent, notable government expenditures and translates each into a personal cost — "The government spent $X on Y, which cost you $Z." This bridges the gap between news headlines about government spending and the user's personal tax receipt.

## Three Categories of Expenditures

Government spending falls into three distinct categories, each with different data sources and automation potential:

### 1. Enacted legislation (bills signed into law)

Appropriations bills, supplemental spending, and authorizations that Congress passes and the President signs. These have structured data via Congress.gov API + CBO cost estimates.

**Examples:** NDAA, Infrastructure Act, CHIPS Act, annual appropriations bills
**Automation:** Fully automatable via Congress.gov API
**Maps to our categories:** Yes, via existing `spendingImpacts` model in `pending-bills.ts`

### 2. Federal contracts and awards

Large procurements funded from existing agency budgets. A $2B Raytheon missile contract draws from the defense category — it's not *new* spending, but a granular view of *how* category money gets spent.

**Examples:** Weapons procurement, infrastructure construction, IT contracts, research grants
**Automation:** Fully automatable via USASpending.gov API
**Maps to our categories:** Yes, via awarding agency → budget category mapping

### 3. Executive/discretionary spending

Spending from already-appropriated funds under executive authority. Military operations, emergency declarations, executive orders directing agency spending. This is the hardest to track — no structured real-time API exists.

**Examples:** Military operations (war in Iran), FEMA disaster response, foreign aid disbursements
**Automation:** Partially automatable (Treasury daily data shows agency-level anomalies, Federal Register shows executive orders), but specific operation costs require manual curation
**Maps to our categories:** Yes, spending draws from existing appropriations

## Data Sources (Verified)

All APIs below have been tested and confirmed working as of March 2026.

### Stream 1: Enacted Legislation

| Source | Endpoint | Auth | Status |
|--------|----------|------|--------|
| **Congress.gov API** | `api.congress.gov/v3/bill` | API key (free) | Confirmed — requires key, returns JSON |
| **CBO Cost Estimates** | `cbo.gov/cost-estimates` | None | RSS/HTML scrape — no structured API |

**Congress.gov API:**
- Requires free API key (get at api.congress.gov)
- 1000 requests/hour rate limit
- Filter by `billType=law` for enacted legislation
- Returns bill metadata, summaries, sponsors, committees, actions
- Does NOT include CBO cost estimates — those must be cross-referenced separately

### Stream 2: Federal Contracts & Awards

| Source | Endpoint | Auth | Status |
|--------|----------|------|--------|
| **USASpending.gov** | `api.usaspending.gov/api/v2/search/spending_by_award/` | None | **Confirmed working** |
| **USASpending.gov** | `api.usaspending.gov/api/v2/spending/` | None | **Confirmed working** |

**USASpending.gov verified response — contract search:**
```json
{
  "Award ID": "W9126G24C0004",
  "Recipient Name": "CLARK CONSTRUCTION GROUP LLC",
  "Award Amount": 616053942.0,
  "Description": "DESIGN-BUILD CONSTRUCTION OF THE VETERANS AFFAIRS HEALTH CARE CENTER, EL PASO, TX",
  "Awarding Agency": "Department of Defense"
}
```

**USASpending.gov verified response — agency spending (FY2026 Q1):**
```json
{ "total": 2601156378042.11,
  "results": [
    { "name": "Department of Defense", "amount": 750169801359.65 },
    { "name": "Department of Health and Human Services", "amount": 700039633788.10 },
    { "name": "Department of the Treasury", "amount": 462896029886.86 },
    { "name": "Social Security Administration", "amount": 446209062616.34 },
    { "name": "Department of Veterans Affairs", "amount": 118742674733.49 }
  ]
}
```

**Key capabilities:**
- No API key required
- Filter by agency, time period, award amount, award type
- Includes contractor name, description, amount, awarding agency
- Can filter for large awards ($100M+)
- Data goes back to FY 2008

### Stream 3: Executive/Discretionary Spending

| Source | Endpoint | Auth | Status |
|--------|----------|------|--------|
| **Treasury Fiscal Data** | `api.fiscaldata.treasury.gov/.../deposits_withdrawals_operating_cash` | None | **Confirmed working** |
| **Federal Register** | `federalregister.gov/api/v1/documents` | None | **Confirmed working** |
| **FEMA Disaster Declarations** | `fema.gov/api/open/v2/DisasterDeclarations` | None | API exists but returned error on test |

**Treasury Fiscal Data verified response (Daily Treasury Statement):**
```json
{
  "record_date": "2026-03-12",
  "transaction_today_amt": "15",
  "transaction_mtd_amt": "194",
  "transaction_fytd_amt": "1916",
  "transaction_catg": "Dept of Agriculture (USDA) - misc"
}
```
- Daily withdrawals by agency — can detect spending spikes
- No auth required
- Categories map to agencies, which map to our budget categories

**Federal Register verified response:**
```json
{
  "title": "Combating Cybercrime, Fraud, and Predatory Schemes Against American Citizens",
  "type": "Presidential Document",
  "publication_date": "2026-03-11",
  "document_number": "2026-04826",
  "html_url": "https://www.federalregister.gov/documents/2026/03/11/..."
}
```
- No auth required
- Filter by presidential document type (executive orders)
- Early signal for spending directives — but no dollar amounts in API response

### Agency → Category Mapping

Federal contracts and Treasury data use agency names. Mapping to our 14 budget categories:

| Agency | Our Category |
|--------|-------------|
| Department of Defense | `defense` |
| Department of Health and Human Services | `healthcare` |
| Department of the Treasury | `interest` / `government` |
| Social Security Administration | `social-security` |
| Department of Veterans Affairs | `veterans` |
| Department of Homeland Security | `immigration` / `justice` |
| Department of Education | `education` |
| Department of Agriculture | `agriculture` |
| Department of Transportation | `infrastructure` |
| Department of Energy | `science` / `infrastructure` |
| NASA | `science` |
| Department of Justice | `justice` |
| Department of State | `international` |
| Department of Housing and Urban Development | `income-security` |

## What we already have

- **`pending-bills.ts`** — `PendingBill` interface with spending impacts, CBO URLs, category mapping, champion info. 5 pending bills tracked.
- **`budget.ts`** — 14 budget categories with enacted legislation metadata per category (1-2 per category).
- **`tracked-votes.ts`** — Maps 8 major bills to roll call votes.
- **`/api/campaign-finance`** — FEC data for representative fundraising (relevant to future "follow the money" spec).
- **Engagement infrastructure** — Redis-backed counters, optimistic UI updates.

## Implementation

### Phase 1: Enacted Legislation + Contracts (fully automated)

#### Data model — extend existing `PendingBill`

Extend the existing `PendingBill` interface in `src/data/pending-bills.ts`:

```typescript
export interface PendingBill {
  // ... all existing fields unchanged ...
  status: "passed_house" | "passed_senate" | "in_committee" | "introduced"
        | "floor_vote_scheduled"
        | "enacted";              // ← new status
  passageLikelihood: "high" | "medium" | "low" | "enacted";
  enactedDate?: string;           // ← ISO date when signed into law
  publicLawNumber?: string;       // ← e.g., "P.L. 118-63"
}
```

For contracts, introduce a lightweight model:

```typescript
export interface FederalContract {
  id: string;
  awardId: string;
  recipientName: string;
  description: string;
  amount: number;
  awardingAgency: string;
  categoryId: string;             // mapped from agency
  startDate: string;
  url: string;                    // USASpending award page
}
```

Both feed into a unified display:

```typescript
type RecentExpenditure =
  | { type: "bill"; data: PendingBill }
  | { type: "contract"; data: FederalContract };
```

#### Personal cost calculation

```
personalCost = (expenditureAmount / totalFederalRevenue) * userFederalTax
```

Where `totalFederalRevenue` is ~$4.9T (FY 2025). For bills, use `totalAnnualImpact * 1e9`. For contracts, use `amount` directly.

#### Files

| File | Change |
|---|---|
| `src/data/pending-bills.ts` | Extend `PendingBill` with `"enacted"` status + new fields |
| `src/lib/expenditures.ts` | New — `FederalContract` type, agency→category mapping, personal cost calc |
| `src/app/api/bills/route.ts` | New — fetch enacted bills from Congress.gov API |
| `src/app/api/contracts/route.ts` | New — fetch large contracts from USASpending.gov |
| `src/components/SecondaryTabs.tsx` | New — tabbed container replacing standalone BillsPanel + InternationalComparison |
| `src/components/RecentExpenditures.tsx` | New — unified feed of recent bills + contracts with personal cost |
| `src/components/TaxReceipt.tsx` | Replace BillsPanel + InternationalComparison with SecondaryTabs |
| `src/components/InternationalComparison.tsx` | Remove built-in collapse/expand (tab handles visibility) |

#### API routes

**`GET /api/bills?status=enacted&days=90`**
1. Fetch recently enacted bills from Congress.gov API
2. Pull summaries, sponsors, CBO cost estimates where available
3. Map to `PendingBill` shape with `status: "enacted"`
4. Cache with 24h ISR
5. Fallback to static data in `pending-bills.ts`

**`GET /api/contracts?days=30&min_amount=100000000`**
1. POST to USASpending.gov `/api/v2/search/spending_by_award/`
2. Filter: award amount > $100M, within date range
3. Map awarding agency to our budget categories
4. Return as `FederalContract[]`
5. Cache with 24h ISR

### Phase 1b: Spending Anomaly Detection (supplementary, automated)

**`GET /api/spending-summary`**
1. Fetch daily Treasury data for agency withdrawals
2. Compare current period to historical baseline
3. Flag significant spikes (e.g., DOD spending 2x normal)
4. Return anomalies with context

This gives a signal for executive/discretionary spending without manual curation. "DOD spending spiked 200% this week" — users can infer context from the news.

### Phase 2: Executive/Discretionary Spending (AI-assisted curation via GitHub Actions)

For specific operation costs (e.g., "war in Iran costs $11B so far"), there's no single structured API. But we can automate the discovery and drafting process using the same CI workflow pattern as `bill-tracker.yml` and `bill-suggester.yml`, enhanced with an LLM curation step.

#### Workflow: `expenditure-curator.yml`

```yaml
name: Expenditure Curator

on:
  schedule:
    - cron: "0 10 * * *"  # Daily at 10am UTC
  workflow_dispatch:
    inputs:
      lookback_days:
        description: "Days to look back"
        default: "7"
```

#### Pipeline: `scripts/curate-expenditures.ts`

The script runs three data fetches, then uses Claude to synthesize notable spending events.

**Step 1 — Gather signals (automated, no LLM)**

```
┌─────────────────────────────────────────────────┐
│ Treasury Fiscal Data API                         │
│ → Daily withdrawals by agency                    │
│ → Compare to 30-day rolling average              │
│ → Flag agencies with >50% spending deviation     │
├─────────────────────────────────────────────────┤
│ Federal Register API                             │
│ → Recent executive orders                        │
│ → Agency rules with cost estimates               │
│ → Emergency declarations                         │
├─────────────────────────────────────────────────┤
│ USASpending.gov                                  │
│ → Non-competitive (no-bid) contracts > $50M      │
│ → Contracts with "urgent" or "emergency" in desc │
└─────────────────────────────────────────────────┘
```

**Step 2 — LLM synthesis (Claude API)**

Feed the gathered signals into Claude with a structured prompt:

```
You are a federal spending analyst. Given the following data signals,
identify notable government expenditure events worth surfacing to
taxpayers. For each event:

1. Write a clear, neutral title and 1-2 sentence description
2. Estimate the total cost (cite your source)
3. Map to budget category: [list of 14 categories]
4. Estimate annual cost for personal tax calculation
5. Rate confidence: high / medium / low
6. Provide source URLs

Signals:
- Treasury anomalies: [anomaly data]
- Executive orders: [EO data]
- Emergency contracts: [contract data]

Rules:
- Only surface events with estimated cost > $100M
- Be factual and neutral — no political commentary
- Mark anything uncertain as confidence: low
- If an event maps to an existing enacted bill, skip it (already tracked)
```

**Step 3 — Generate skeleton entries + draft PR**

```typescript
// Output: src/data/curated-expenditures.ts
export interface CuratedExpenditure {
  id: string;
  title: string;
  description: string;
  estimatedCost: number;            // dollars
  costTimeframe: "one-time" | "annual" | "ongoing";
  annualizedCost: number;           // normalized for personal cost calc
  categoryId: string;
  date: string;                     // ISO date
  confidence: "high" | "medium" | "low";
  sources: { label: string; url: string }[];
  triggerSignal: "treasury_anomaly" | "executive_order" | "emergency_contract";
  aiGenerated: true;                // always true — transparency marker
}
```

Each entry is marked with `// AI-SUGGESTED — verify` comments. The draft PR includes:
- Summary table of discovered events
- Confidence ratings
- Source links for verification
- Review checklist (same pattern as `bill-suggester.yml`)

**Step 4 — Human review**

The draft PR body follows the existing pattern:

```markdown
## Expenditure events discovered

| Event | Est. Cost | Category | Confidence | Signal |
|-------|-----------|----------|------------|--------|
| DOD spending spike — likely Iran operations | ~$2.1B/week | `defense` | medium | treasury_anomaly |
| EO 14XXX: Border security ad campaign | $220M | `immigration` | high | executive_order |
| Emergency no-bid contract: missile restock | $890M | `defense` | high | emergency_contract |

## Review checklist

- [ ] Verify cost estimates against primary sources
- [ ] Confirm category mappings
- [ ] Remove any low-confidence entries that can't be verified
- [ ] Edit descriptions for clarity and neutrality
- [ ] Run `npm run build` to verify no type errors
```

#### Why this works

This mirrors the existing workflows:

| Existing workflow | What it automates | Human reviews |
|---|---|---|
| `bill-tracker.yml` | Discovers enacted bills → drafts `tracked-votes.ts` entries | Vote data, effect descriptions |
| `bill-suggester.yml` | Discovers high-signal bills → drafts `pending-bills.ts` skeletons | Summaries, spending impacts, keep/remove |
| `fec-id-updater.yml` | Audits FEC ID mappings → fixes mismatches | Spot-check |
| **`expenditure-curator.yml`** (new) | Gathers spending signals → LLM drafts expenditure entries | Cost verification, neutrality, keep/remove |

The LLM step is the key differentiator — it bridges the gap between raw data signals (Treasury anomalies, emergency contracts) and human-readable expenditure descriptions. But the human always has final say via the draft PR review.

#### Environment variables (CI)

```
ANTHROPIC_API_KEY=      # For Claude API synthesis step
CONGRESS_API_KEY=       # Already in CI secrets
# Treasury + Federal Register + USASpending — no keys needed
```

#### Safeguards

- **`aiGenerated: true` flag** — every LLM-generated entry is permanently marked, surfaced in UI
- **Confidence ratings** — low-confidence entries flagged prominently in PR
- **No auto-merge** — always draft PR, always human review
- **Neutrality prompt** — LLM instructed to be factual, cite sources, no editorializing
- **Deduplication** — script checks against existing enacted bills and prior curated entries
- **Cost thresholds** — only surface events > $100M to avoid noise

### UI behavior

#### Tabbed secondary content (new layout)

The current page stacks BillsPanel + InternationalComparison vertically below the receipt, which is getting crowded. Replace this with a tabbed section:

```
┌──────────────────────────────────────────────────────────┐
│  [Chart]              │  [Receipt Card]                  │
│                       │    Spending Breakdown             │
│                       │    ...receipt lines...            │
│                       │    [See How Your Reps Voted]      │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  [Recent Spending]  [Pending Bills]  [Global Comparison] │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  (active tab content renders here)                       │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Tabs:**

| Tab | Component | Content |
|-----|-----------|---------|
| **Pending Bills** (default) | `BillsPanel.tsx` (existing) | Bills that could change your receipt — support/oppose, contact reps. Most actionable. |
| **Recent Spending** | `RecentExpenditures.tsx` (new) | Chronological feed of enacted bills + large contracts + curated events with personal cost |
| **Global Comparison** | `InternationalComparison.tsx` (existing) | How your taxes compare to other countries |

**Behavior:**
- Default active tab: "Pending Bills" (most actionable — users can engage, contact reps, influence outcomes)
- Tab state preserved in URL params: `&tab=spending|bills|compare`
- Selecting a receipt category still filters the Pending Bills tab (existing behavior)
- Tabs are pill-style buttons, consistent with existing UI patterns (filing status buttons)
- Tab content animates in/out with Framer Motion (consistent with existing transitions)
- Mobile: tabs scroll horizontally if needed, content stacks full-width

**Future-proof:** Adding "Follow the Money" later is just a fourth tab.

#### Implementation: `SecondaryTabs.tsx`

New wrapper component that manages tab state and renders the active tab's content:

```typescript
type TabId = "spending" | "bills" | "compare";

interface SecondaryTabsProps {
  // Props passed through to child components
  activeCategoryId: string | null;
  activeCategoryName: string | null;
  totalFederalTax: number;
  representatives: Representative[] | null;
  spending: PersonalSpending[];
  grossIncome: number;
  filingStatus: FilingStatus;
  compareCountry: string | null;
  onCompareCountryChange: (code: string | null) => void;
}
```

This replaces the current standalone `<BillsPanel>` and `<InternationalComparison>` blocks in `TaxReceipt.tsx` with a single `<SecondaryTabs>` component.

#### Expenditure cards (within Recent Spending tab)

**Enacted bill card** (reuses BillsPanel patterns):
- Personal cost prominently displayed (e.g., "Cost you: $3.47/year")
- Total cost, enacted date, public law number
- Budget category badges
- Expandable spending impact bars (already built)

**Contract card:**
- Contractor name and description
- Award amount + personal cost
- Awarding agency → budget category badge
- Link to USASpending.gov award page

#### Integration with existing components

- **RecentExpenditures** lives inside the "Recent Spending" tab
- **BillsPanel** moves into the "Pending Bills" tab (no changes to component itself)
- **InternationalComparison** moves into the "Global Comparison" tab (remove its built-in collapse/expand since the tab handles visibility)
- **ReceiptLine** already shows enacted legislation per category — no changes needed
- **ReceiptLine** expanded view could link to relevant contracts ("See recent DOD contracts")

### Environment variables

```
CONGRESS_API_KEY=       # Free from api.congress.gov
# USASpending.gov — no key needed
# Treasury Fiscal Data — no key needed
# Federal Register — no key needed
```

### Dependencies

No new runtime dependencies.

## Open questions

1. **How far back is "recent"?** 90 days for bills, 30 days for contracts?
2. **Contract threshold?** $100M+ seems reasonable. Thousands of small contracts would be noise.
3. **How to handle 10-year CBO scores?** Show annualized as primary, total as context?
4. **Rename `PendingBill` → `Bill`?** Since it now covers enacted bills too.
5. **Should enacted bills support engagement?** Existing support/oppose flow doesn't make sense post-enactment. Maybe "share" or "see impact" instead.

## Out of scope (separate specs)

- **"Follow the money" layer** — Connecting spending → contractors → lobbying → campaign donations → congressional votes. See `docs/todo/follow-the-money-spec.md`.
- **Real-time spending tracking** — Phase 2
- **Push notifications** — Phase 2
- **Historical spending timeline** — Separate feature
- **State/local spending** — Federal only
- **Political commentary** — Present facts and numbers, no editorializing
