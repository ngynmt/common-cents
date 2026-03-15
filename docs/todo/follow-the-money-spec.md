# Follow the Money Feature

## Problem

Users can see *what* the government spends money on (via the tax receipt) and *who voted* for spending bills (via rep voting records), but there's no way to see the influence pipeline connecting spending decisions to private interests. Who benefits from a contract? Who lobbied for a bill? Which representatives received donations from the contractors who won the work?

This is the kind of analysis investigative journalists do manually by stitching together 5-6 federal datasets. No public tool does it automatically.

## Goal

A "follow the money" layer that traces the influence chain:

```
Spending decision (bill or contract)
  → Contractors/recipients benefiting
    → Lobbying activity by those contractors
      → Campaign donations to members of Congress
        → How those members voted on related bills
```

This builds on top of the Recent Expenditures feature and the existing campaign finance + voting infrastructure.

## Data Sources

### Already integrated in Common Cents

| Source | Current use | Location |
|--------|------------|----------|
| **FEC / Campaign Finance** | Rep fundraising data, top donors | `/api/campaign-finance` |
| **Congressional Votes** | How reps voted on tracked bills | `/api/votes`, `tracked-votes.ts` |
| **Representatives** | Rep lookup by ZIP | `/api/representatives` |

### New sources needed

| Source | API | Auth | What it provides |
|--------|-----|------|-----------------|
| **USASpending.gov Awards** | `api.usaspending.gov/api/v2/search/spending_by_award/` | None | Who received federal contracts/grants — contractor name, amount, agency, description |
| **USASpending.gov Subawards (FSRS)** | `api.usaspending.gov/api/v2/subawards/` | None | Where prime contractors send money — subcontractor chains |
| **Senate Lobbying Disclosures (LDA)** | `lda.senate.gov` | None | Who lobbied for what — client, issues, bills targeted, spending |
| **OpenSecrets API** | `opensecrets.org/api/` | API key (free) | Aggregated influence data — industry donations, lobbying totals, top recipients |
| **FEC Individual Contributions** | `api.open.fec.gov/v1/schedules/schedule_a/` | API key (free) | Individual donations filtered by employer — e.g., all Lockheed Martin employee donations |
| **FPDS (Federal Procurement)** | Via USASpending | None | Contract competition status — reveals no-bid/sole-source awards |
| **Congressional Earmarks** | House/Senate Appropriations committees | None | Member-directed spending — which rep requested which project |

### Supplementary / future sources

| Source | What it provides | Difficulty |
|--------|-----------------|------------|
| **Revolving Door (OpenSecrets)** | Former gov officials now lobbying for contractors | Medium — scrape or API |
| **Congressional Stock Trades (Quiver Quantitative)** | Reps owning stock in companies receiving contracts | Medium — API available |
| **DOD J-Books** | Per-weapon-system cost breakdowns | Hard — PDFs |
| **Inspector General Reports** | Fraud/waste investigations on contracts | Hard — unstructured |
| **White House Visitor Logs** | Who meets with executive officials before spending decisions | Hard — availability varies by administration |

## Architecture

### Data flow

```
USER'S TAX RECEIPT
       │
       ▼
RECENT EXPENDITURE (bill or contract)
       │
       ├── Who benefits? ──────── USASpending awards + subawards
       │
       ├── Who lobbied for it? ── Senate LDA + OpenSecrets
       │
       ├── Who donated? ────────── FEC contributions by employer
       │                          (already partially integrated)
       │
       ├── Who voted for it? ──── Congress votes
       │                          (already integrated)
       │
       └── Conflicts? ─────────── Stock trades, revolving door,
                                   no-bid contracts, earmarks
```

### Influence chain example

Starting from a contract in the Recent Expenditures feed:

```
$2B missile contract → Raytheon
  → Raytheon spent $3.4M lobbying defense appropriations
    → Raytheon employees donated $1.2M to Armed Services Committee members
      → Those members voted YES on the defense spending bill
        → 3 committee staffers later became Raytheon lobbyists
```

## Two Entry Points

Follow the Money surfaces in two places, querying the same underlying data in different directions:

### Entry Point A: Bill/Contract-level (inline on expenditure cards)

"Should I support this bill?" / "Where did this contract money go?"

Starting from a bill or contract in the Recent Spending or Pending Bills tab, the user expands "Follow the Money" to see:
- Which contractors/organizations benefit
- Whether those contractors donated to the bill's sponsors
- Whether those contractors lobbied on related issues
- Whether the contract was competitively bid

This helps users form opinions on *policy*.

### Entry Point B: Rep-level (enhancement to existing rep card)

"Should I vote for this person?"

Starting from a representative in the existing rep modal, the user sees an additional section connecting their donors to federal spending. This builds on what's already shown:

**Already on the rep card:**
- Total raised + election cycle
- Outside PAC spending (support/oppose bar chart)
- Top 5 donor employers (bar chart)
- Voting record on 8 tracked bills
- Contact info

**New "Follow the Money" addition:**
- Under the existing "Top donor employers" chart, add a sub-section:
  "Federal contracts received by top donors"
- For each donor employer already shown, query USASpending for contracts that company received
- Display as a compact list beneath the employer bar chart

```
┌─────────────────────────────────────────────────┐
│ TOP DONOR EMPLOYERS                              │
│ [existing bar chart: Lockheed, Boeing, ...]      │
│                                                  │
│ CONTRACTS RECEIVED BY THESE DONORS               │
│ Lockheed Martin                                  │
│   $2.1B — F-35 sustainment (DOD)                │
│   $890M — missile defense systems (DOD)          │
│ Boeing                                           │
│   $1.4B — KC-46 tanker program (DOD)            │
│                                                  │
│ These companies' employees donated $127K to      │
│ this representative.          Source: FEC + USAs  │
└─────────────────────────────────────────────────┘
```

This is a **small enhancement** — one additional API call per employer, displayed beneath existing UI. No new components needed, just extending `FinanceCard.tsx` or `RepresentativeCard.tsx`.

## Implementation Phases

### Phase 1: Bill/Contract-level influence (Entry Point A)

The primary new feature. Inline expandable on expenditure and bill cards.

**For each large contract or enacted bill:**
1. Identify the primary contractor/beneficiary (USASpending)
2. Look up FEC donations from that contractor's employees (FEC API — extends existing `/api/campaign-finance`)
3. Show which representatives received those donations
4. Cross-reference with how those reps voted on related bills (existing `/api/votes`)

**Files:**
| File | Purpose |
|---|---|
| `src/app/api/contractor-influence/route.ts` | New — given a contractor name, fetch donations + lobbying |
| `src/components/InfluenceChain.tsx` | New — visual chain from spending → contractor → donations → votes |
| `src/lib/influence.ts` | New — contractor name normalization, influence chain assembly |

**UI:** Expandable "Follow the Money" section on expenditure cards in the Recent Spending tab and bill cards in the Pending Bills tab.

```
┌──────────────────────────────────────────────┐
│ $2.1B DOD Contract — Raytheon                │
│ Cost you: $12.43                             │
│                                              │
│ [▸ Follow the Money]                         │
│                                              │
│   Raytheon employees donated $847K           │
│   to members of Congress                     │
│     ↓                                        │
│   Top recipients:                            │
│     Rep. Smith (R-TX) — $42K — Voted YES ✓   │
│     Sen. Jones (D-CA) — $38K — Voted YES ✓   │
│     Rep. Lee (R-FL) — $31K — Voted NO ✗      │
│                                              │
│   Raytheon spent $3.4M lobbying              │
│   defense appropriations                     │
└──────────────────────────────────────────────┘
```

### Phase 2: Rep-level donor contracts (Entry Point B)

Enhancement to the existing rep card — small lift since most infrastructure exists.

**Changes:**
1. For each top donor employer already displayed on the rep card, query USASpending for federal contracts received by that company
2. Display contract list beneath the existing "Top donor employers" bar chart
3. One new API call: `/api/contractor-contracts?name=LOCKHEED+MARTIN` → returns recent large contracts

**Files:**
| File | Purpose |
|---|---|
| `src/app/api/contractor-contracts/route.ts` | New — given a contractor name, return their federal contracts from USASpending |
| `src/components/FinanceCard.tsx` | Extend — add "Contracts received by these donors" section below employer chart |

**Size:** M — one new API route + extending an existing component. No new UI patterns.

### Phase 3: Add Lobbying Data

1. Integrate Senate LDA or OpenSecrets for lobbying activity
2. Show which bills/issues the contractor lobbied on (Entry Point A)
3. Show lobbying by donor employers (Entry Point B)
4. Connect lobbying to specific spending outcomes

### Phase 4: Deeper Connections

1. Subcontractor chains (FSRS)
2. Congressional earmarks tied to contractor donations
3. No-bid contract flagging (FPDS competition data)
4. Revolving door connections

### Phase 5: Congressional Stock Trades

1. Integrate Quiver Quantitative or Capitol Trades API
2. Flag reps who own stock in companies receiving contracts
3. Show timeline: stock purchase → vote → contract award
4. Surface on rep card as a conflict-of-interest indicator

## UI Concepts

### Influence graph (future — full page view)

Interactive visualization showing the network:
- Nodes: bills, contractors, PACs, members of Congress
- Edges: money flow (donations, contracts, lobbying spend)
- Filterable by category, party, amount

This is ambitious — Phase 4/5 territory. Could live as a fourth tab in SecondaryTabs or as a standalone page.

## Environment variables

```
CONGRESS_API_KEY=          # Already needed for recent expenditures
OPENSECRETS_API_KEY=       # Free from opensecrets.org
FEC_API_KEY=               # Free from api.open.fec.gov (may already have for campaign-finance)
```

## Open questions

1. **Editorial framing?** "Follow the money" implies wrongdoing. Need neutral framing — "spending connections" or "influence transparency"?
2. **How to handle false positives?** A contractor donating to a rep doesn't mean corruption. Need clear disclaimers.
3. **Performance?** Each influence chain requires 3-4 API calls. Cache aggressively, compute async.
4. **Scope creep risk?** This feature could grow indefinitely. Define clear phase boundaries.
5. **Legal/liability?** Presenting donation→vote connections could invite pushback. Stick to public data + factual presentation.

## Dependencies on other features

- **Recent Expenditures** — provides the starting point (bills + contracts)
- **Campaign Finance** — already partially integrated, needs extension
- **Voting Records** — already integrated

## Out of scope

- State/local influence tracking
- International lobbying (FARA)
- Dark money / 501(c)(4) tracking (data not reliably available)
- Predictive modeling ("this rep will likely vote YES based on donations")
- Automated corruption scoring or risk ratings
