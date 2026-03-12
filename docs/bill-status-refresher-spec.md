# Pending Bill Status Refresher

**Status:** ✅ Complete (2026-03-12)

## Problem

`src/data/pending-bills.ts` contains curated active bills with fields that go stale quickly: `status`, `lastActionDate`, `cosponsors`, and `passageLikelihood`. These require manual monitoring of Congress.gov to keep current. Stale data (e.g., showing "In Committee" for a bill that already passed) is a credibility risk for a civic app.

This is distinct from the bill *discovery* pipeline (`scripts/discover-bills.ts`), which finds newly enacted laws for `tracked-votes.ts`. This script refreshes metadata on bills we're *already tracking* in `pending-bills.ts`.

## Goal

A CLI script that fetches current status for each bill in `pending-bills.ts` and updates the file in place, reducing manual monitoring to a quick diff review.

## Data Sources

- **Congress.gov API** (`api.congress.gov/v3`) — bill detail, actions, and cosponsors endpoints
  - Key: `CONGRESS_API_KEY` (already in `.env.local`)
  - Rate limit: 5,000 req/hr with real key, 40/hr with DEMO_KEY
  - Cosponsor count: read from `pagination.count` (not the array itself) for efficiency
- **Existing bill data** — `pending-bills.ts` has `billNumber` (e.g., "H.R. 1234") and `congress` (e.g., 119) which map to the API

## CLI

```bash
# Refresh all pending bills
npm run bills:refresh

# Dry run — show what would change without writing
npm run bills:refresh -- --dry-run

# Refresh a specific bill
npm run bills:refresh -- --bill hr8070
```

### Fields refreshed

| Field | Source | Notes |
|-------|--------|-------|
| `status` | `latestAction.text` from bill detail endpoint | Map action text to our status enum |
| `lastAction` | `latestAction.text` | Full action text |
| `lastActionDate` | `latestAction.actionDate` | ISO date string |
| `cosponsors` | Cosponsors endpoint `pagination.count` | Single API call with `limit=1` |
| `passageLikelihood` | Heuristic | Based on status + cosponsor count + bipartisan flag |

### Status mapping

Map Congress.gov action text patterns to our `PendingBill["status"]` enum:

| Action text pattern | Our status |
|---|---|
| "Became Public Law" / "Signed by President" | Flags as enacted — remove from pending-bills |
| "Passed House" / "Received in Senate" | `passed_house` |
| "Passed Senate" / "Received in House" | `passed_senate` |
| "Placed on calendar" / "Cloture invoked" | `floor_vote_scheduled` |
| "Referred to committee" / "Reported by committee" | `in_committee` |
| Default | `introduced` |

### Likelihood heuristic

```
if status is passed_house or passed_senate → "high"
if status is floor_vote_scheduled → "medium"
if cosponsors >= 100 (House) or >= 30 (Senate) → "medium"
if bipartisan → bump one level
default → "low"
```

### Congress expiration check

Each `PendingBill` has a `congress` field (e.g., 119). Before making any API calls, the refresher compares this against the current Congress number (computed from the current date). Bills from a prior Congress are flagged as expired — they died when that Congress ended and can never advance.

```
⚠ 3 bill(s) expired with a prior Congress — remove from pending-bills and find 119th Congress replacements.
```

This prevents the silent staleness that occurred when the 118th Congress bills sat in the data for 14 months after expiring.

### Example output

```
Refreshing 6 pending bills...

  S. 770 — Social Security Expansion
    cosponsors: 10 → 12

  H.R. 6166 — Lower Drug Costs
    No changes.

  H.R. 318 — Border Safety Act
    status: introduced → in_committee
    lastActionDate: 2025-01-09 → 2025-04-15
    cosponsors: 46 → 58

Updated 2 of 6 bills in pending-bills.ts.
```

## Implementation

### Files

| File | Purpose |
|---|---|
| `scripts/refresh-bill-status.ts` | CLI entry point — arg parsing, diff printing, file writing |
| `scripts/lib/bill-refresher.ts` | Core logic — bill number parsing, status mapping, likelihood heuristic, diff computation, Congress expiration check |
| `scripts/lib/congress-api.ts` | **Shared** — `fetchBillDetail`, `fetchBillCosponsors` (added), `fetchBillActions` |
| `src/data/pending-bills.ts` | Data file — `PendingBill` interface includes `congress` field |

### Algorithm

1. For each bill, check if its `congress` < current Congress → flag as expired, skip API calls
2. Fetch bill detail + cosponsor count in parallel from Congress.gov API
3. Map latest action text to our status enum (flag enacted bills)
4. Compute likelihood heuristic from (potentially updated) status + cosponsors + bipartisan
5. Build a diff of changed fields
6. If `--dry-run`, print diffs. Otherwise, apply targeted string replacements to `pending-bills.ts`

### File update strategy

Targeted string replacement per field, preserving manual content (`summary`, `shortTitle`, `spendingImpacts`):
1. Find each bill's object in the source by its `billNumber` string
2. Locate the enclosing `{ }` block via brace-matching parser
3. Regex-replace each changed field's value within that block
4. Write the modified source back

## What stays manual

- **Adding new pending bills** — editorial decision (see [bill-suggestion-pipeline-spec](./bill-suggestion-pipeline-spec.md) for automation)
- **`summary`** — requires human judgment
- **`shortTitle`** — the API title is often too long or formal
- **`spendingImpacts`** — CBO score interpretation is manual
- **`passageLikelihood` overrides** — political judgment may override the heuristic
- **Removing enacted/expired bills** — script flags them but a human decides

## Out of scope

- Automatic commits or PRs (could be added as a GitHub Action wrapper later)
- CBO score fetching (CBO doesn't have a public API)
- Sponsor/champion updates (rarely changes)
- Adding new bills to the pending list (see [bill-suggestion-pipeline-spec](./bill-suggestion-pipeline-spec.md))
