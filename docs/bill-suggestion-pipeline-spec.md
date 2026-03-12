# Pending Bill Suggestion Pipeline

## Problem

Adding new bills to `pending-bills.ts` is entirely manual — someone has to notice a bill gaining traction, look up its details, write a summary, estimate spending impacts, and add the entry. The bill status refresher keeps *existing* bills current, but there's no pipeline for surfacing *new candidates*.

## Goal

A weekly GitHub Actions workflow that surfaces high-signal pending bills and opens a draft PR with skeleton entries pre-filled from the Congress.gov API. The human reviewer fills in editorial fields (`summary`, `shortTitle`, `spendingImpacts`) and approves — turning a research task into a review task.

## What "high-signal" means

Not every introduced bill is worth tracking. The pipeline filters for bills that:

1. **Have momentum** — reported out of committee, OR ≥50 cosponsors (House) / ≥15 cosponsors (Senate)
2. **Touch our budget categories** — committee assignment maps to an existing `categoryId` (reuse `suggestCategory` from `lib/category-suggester.ts`)
3. **Aren't already tracked** — not in `pending-bills.ts` or `tracked-votes.ts`

These thresholds are configurable via CLI flags and should start conservative (fewer, higher-quality suggestions) rather than noisy.

## Proposed CLI

```bash
# Run locally — preview suggestions
npm run bills:suggest -- --dry-run

# Run with custom thresholds
npm run bills:suggest -- --min-cosponsors 30 --congress 119

# Target a specific category
npm run bills:suggest -- --category defense
```

## Pipeline flow

```
┌─────────────────────────────────────┐
│  GitHub Actions (weekly, Monday)    │
│                                     │
│  1. Fetch recent active bills from  │
│     Congress.gov API                │
│  2. Filter by momentum + category   │
│  3. Deduplicate against existing    │
│     pending-bills + tracked-votes   │
│  4. Generate skeleton entries       │
│  5. Open draft PR if any found      │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Draft PR (human review)            │
│                                     │
│  Pre-filled:                        │
│  ✓ billNumber, title, congressUrl   │
│  ✓ champion (lead sponsor)          │
│  ✓ cosponsors, bipartisan flag      │
│  ✓ status, lastAction, lastActionDate│
│  ✓ impactedCategories (suggested)   │
│  ✓ cboScoreUrl (if available)       │
│                                     │
│  Human fills in:                    │
│  ☐ shortTitle                       │
│  ☐ summary                          │
│  ☐ spendingImpacts[]                │
│  ☐ totalAnnualImpact                │
│  ☐ passageLikelihood override       │
│                                     │
│  Human decides:                     │
│  ☐ Keep or remove each suggestion   │
│  ☐ Merge when ready                 │
└─────────────────────────────────────┘
```

## Skeleton entry format

Fields the script can fill automatically:

```typescript
{
  id: "hr-1234-placeholder",               // generated from bill number
  title: "Full Title From API",             // from bill detail endpoint
  shortTitle: "NEEDS EDIT",                 // placeholder — human writes this
  billNumber: "H.R. 1234",
  summary: "NEEDS EDIT — see congressUrl",  // placeholder — human writes this
  status: "in_committee",                   // from latest action mapping
  passageLikelihood: "medium",              // from heuristic (same as refresher)
  champion: {
    name: "Rep. Jane Smith",                // from sponsors endpoint
    party: "D",
    chamber: "house",
    state: "CA",
    title: "Representative",
  },
  cosponsors: 67,                           // from cosponsors endpoint
  bipartisan: true,                         // from cosponsor party analysis
  impactedCategories: ["defense"],          // from category-suggester
  spendingImpacts: [],                      // NEEDS EDIT — human writes this
  totalAnnualImpact: 0,                     // NEEDS EDIT — human writes this
  cboScoreUrl: "",                          // filled if CBO link found in actions
  congressUrl: "https://www.congress.gov/bill/119th-congress/house-bill/1234",
  lastAction: "Reported by committee",
  lastActionDate: "2026-03-01",
}
```

Placeholder fields are marked with `// NEEDS EDIT` comments to make them easy to find in the PR diff.

## Data sources

### Bill discovery

Congress.gov API's bill listing endpoint with filters:

```
GET /v3/bill/{congress}?sort=updateDate+desc&limit=250
```

The API doesn't support filtering by cosponsor count, so the flow is:
1. Fetch recent bills (sorted by update date, paginated)
2. For each, fetch cosponsors count
3. Filter locally by thresholds

To avoid burning API quota, the script should:
- Start with bills updated in the last 30 days (configurable via `--since`)
- Stop pagination once bills are older than the cutoff
- Cache results when possible (write a `.bill-suggestions-cache.json` for repeat runs)

### Sponsor data

```
GET /v3/bill/{congress}/{type}/{number}/cosponsors
```

Returns cosponsor list with party affiliation — used to compute the `bipartisan` flag (has cosponsors from both parties).

### Lead sponsor

```
GET /v3/bill/{congress}/{type}/{number}
```

The bill detail endpoint includes `sponsors[0]` with name, party, state, and district.

## Implementation plan

### Files

| File | Purpose |
|---|---|
| `scripts/suggest-bills.ts` | CLI entry point |
| `scripts/lib/bill-suggester.ts` | Core logic: discover, filter, generate skeletons |
| `scripts/lib/congress-api.ts` | Add `fetchBillSponsors`, `fetchRecentBills` (paginated) |
| `scripts/lib/category-suggester.ts` | **Existing** — reuse for category mapping |
| `scripts/lib/bill-refresher.ts` | **Existing** — reuse `mapActionToStatus`, `computeLikelihood`, `parseBillNumber` |
| `.github/workflows/bill-suggester.yml` | Weekly GitHub Actions workflow |

### New API functions needed in `congress-api.ts`

```typescript
// Paginated bill listing with date cutoff
fetchRecentBills(congress: number, opts: { since?: string; limit?: number }): AsyncGenerator<BillSummary[]>

// Full sponsor list with party info (for bipartisan detection)
fetchBillSponsors(congress: number, billType: string, billNumber: number): Promise<Sponsor[]>
```

### Algorithm

1. Fetch bills updated in the last 30 days (paginated)
2. For each bill:
   a. Skip if already in `pending-bills.ts` or `tracked-votes.ts` (match by bill number)
   b. Fetch cosponsors — skip if below threshold
   c. Fetch committees — run through `suggestCategory()` — skip if no category match
   d. Fetch sponsor details
   e. Map latest action to status (reuse `mapActionToStatus`)
   f. Compute likelihood (reuse `computeLikelihood`)
   g. Generate skeleton entry
3. Sort suggestions by cosponsor count (highest signal first)
4. If not `--dry-run`, append skeletons to `pending-bills.ts` with `// NEEDS EDIT` markers

### File update strategy

Same pattern as `auto-track-bills.ts`: find `];` at the end of the `pendingBills` array and insert before it. Each skeleton entry includes `// NEEDS EDIT` comments on placeholder fields.

### GitHub Actions workflow

```yaml
name: Bill Suggestions

on:
  schedule:
    - cron: "0 9 * * 1"  # Monday 9am UTC (same cadence as bill-tracker)
  workflow_dispatch:
    inputs:
      congress:
        description: "Congress number"
        required: false
        default: "119"
      min_cosponsors:
        description: "Minimum cosponsor count to suggest"
        required: false
        default: "50"

permissions:
  contents: write
  pull-requests: write

jobs:
  suggest:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci

      - name: Run bill suggester
        env:
          CONGRESS_API_KEY: ${{ secrets.CONGRESS_API_KEY }}
        run: |
          congress="${{ github.event.inputs.congress || '119' }}"
          min="${{ github.event.inputs.min_cosponsors || '50' }}"
          npx tsx scripts/suggest-bills.ts \
            --congress "$congress" \
            --min-cosponsors "$min"

      - name: Check for changes
        id: changes
        run: |
          if git diff --quiet src/data/pending-bills.ts; then
            echo "has_changes=false" >> "$GITHUB_OUTPUT"
          else
            echo "has_changes=true" >> "$GITHUB_OUTPUT"
          fi

      - name: Create draft PR
        if: steps.changes.outputs.has_changes == 'true'
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          branch="bill-suggestions/$(date +%Y-%m-%d)"
          git checkout -b "$branch"
          git add src/data/pending-bills.ts
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git commit -m "draft: suggested pending bills for review"
          git push -u origin "$branch"

          body=$(cat .bill-suggestions-summary.md 2>/dev/null \
            || echo "New pending bill suggestions. Fill in NEEDS EDIT fields before merging.")

          gh pr create \
            --title "Draft: new pending bill suggestions" \
            --body "$body" \
            --draft \
            --base main \
            --head "$branch"
```

### PR summary file

The script writes `.bill-suggestions-summary.md`, which becomes the PR body. It includes the suggested bills, criteria for deciding what to keep, and field-by-field instructions for completing each entry.

```markdown
## Suggested pending bills

| Bill | Title | Cosponsors | Category | Why suggested |
|------|-------|-----------|----------|---------------|
| H.R. 1234 | Full Title | 67 (bipartisan) | `defense` | Reported by committee + 67 cosponsors |
| S. 567 | Full Title | 42 | `healthcare` | 42 cosponsors, bipartisan |

---

## Should I keep this bill?

A bill belongs in pending-bills if it meets **all three** criteria:

1. **Spending relevance** — the bill would meaningfully change spending in one of our
   budget categories. A post office renaming doesn't qualify; a $10B infrastructure
   package does.
2. **Realistic trajectory** — it has committee activity, significant cosponsors, or
   leadership support suggesting it could actually move. Bills introduced as messaging
   vehicles with no cosponsors aren't worth tracking.
3. **User value** — a Common Cents user would find it interesting to see how this bill
   would change their tax receipt. Ask: "would someone share this?"

If a bill doesn't meet all three, delete its entry from the diff before merging.

---

## How to fill in each field

### `shortTitle`
A 2-5 word name users will see in the UI. Keep it informal and recognizable.
- ✅ `"NDAA FY2025"`, `"Child Tax Credit Expansion"`
- ❌ `"National Defense Authorization Act for Fiscal Year 2025"`

### `summary`
1-2 sentences explaining what the bill does in plain English. Focus on what changes
for taxpayers, not legislative procedure. Write at an 8th-grade reading level.
- ✅ `"Increases military spending by $9B, including a 4.5% pay raise for troops and
  new cybersecurity programs."`
- ❌ `"Authorizes appropriations for fiscal year 2025 for military activities of the
  Department of Defense and for military construction..."`

**Where to find this:** Read the bill summary on Congress.gov (linked in `congressUrl`)
and the CBO cost estimate (linked in `cboScoreUrl` if available).

### `spendingImpacts`
An array of per-category spending changes in **billions per year**. Each entry needs:
- `categoryId` — must match an existing category in the app
- `annualChange` — positive = spending increase, negative = decrease
- `description` — 1 sentence explaining the impact

**Where to find this:** CBO cost estimate for the bill. Look for the "estimated
budgetary effects" table. Convert 10-year totals to annual by dividing by 10
(rough but sufficient).

Example:
```typescript
spendingImpacts: [
  {
    categoryId: "defense",
    annualChange: 9,
    description: "Increases military pay by 4.5% and adds $3.4B for Pacific deterrence.",
  },
],
```

### `totalAnnualImpact`
Sum of all `annualChange` values in `spendingImpacts`. If a bill increases defense
by $9B and decreases other spending by $2B, this is `7`.

### `passageLikelihood`
The script sets this with a heuristic, but override it if you know better:
- `"high"` — passed one chamber, or strong bipartisan support + leadership backing
- `"medium"` — committee activity + significant cosponsors
- `"low"` — introduced but no real momentum

### `cboScoreUrl`
Link to the CBO cost estimate page. Search [cbo.gov](https://www.cbo.gov) for the
bill number. Leave empty string if no score exists yet.

---

### Checklist

For **each** suggested bill, complete these steps:

- [ ] **Keep or remove** — does it meet all three criteria above?
- [ ] Fill in `shortTitle` (2-5 word informal name)
- [ ] Write `summary` (1-2 plain-English sentences)
- [ ] Add `spendingImpacts` from CBO cost estimate
- [ ] Set `totalAnnualImpact` (sum of annualChange values)
- [ ] Review `passageLikelihood` — override heuristic if needed
- [ ] Add `cboScoreUrl` if available
- [ ] Run `npm run build` to verify no type errors
```

## API rate budget

Worst case per run (assuming 250 recently updated bills):
- 1 request for bill listing page
- 250 requests for cosponsors (filter step)
- ~10-20 requests for detail + sponsors (only for bills that pass filters)
- **Total: ~270 requests** — well within the 5,000/hr limit

With DEMO_KEY (40/hr), the script should detect the key type and reduce the listing page size, or bail early with a warning.

## What stays manual

- **Deciding to keep or remove** each suggestion from the PR
- **`shortTitle`** — the API title is too formal
- **`summary`** — plain-English description of what the bill does
- **`spendingImpacts`** and **`totalAnnualImpact`** — requires reading CBO scores
- **`passageLikelihood` overrides** — political judgment

## Out of scope

- CBO score fetching (no public API)
- Auto-writing summaries (LLM integration could be a future enhancement)
- Cross-referencing with news/political analysis for likelihood
- Automatically merging PRs (always draft, always human-reviewed)
