# Pending Bill Status Refresher

**Status:** ✅ Complete (2026-03-12)

## Problem

`src/data/pending-bills.ts` contains curated active bills with fields that go stale quickly: `status`, `lastActionDate`, `cosponsors`, and `passageLikelihood`. These require manual monitoring of Congress.gov to keep current. Stale data (e.g., showing "In Committee" for a bill that already passed) is a credibility risk for a civic app.

This is distinct from the bill *discovery* pipeline (`scripts/discover-bills.ts`), which finds newly enacted laws for `tracked-votes.ts`. This script refreshes metadata on bills we're *already tracking* in `pending-bills.ts`.

## Goal

A CLI script that fetches current status for each bill in `pending-bills.ts` and updates the file in place, reducing manual monitoring to a quick diff review.

## Data Sources

- **Congress.gov API** (`api.congress.gov/v3`) — bill detail and actions endpoints
  - Key: `CONGRESS_API_KEY` (already in `.env.local`)
  - Rate limit: 5,000 req/hr with real key, 40/hr with DEMO_KEY
- **Existing bill data** — `pending-bills.ts` already has `billNumber` (e.g., "H.R. 1234") which maps to the API

## Proposed CLI

```bash
# Refresh all pending bills
npm run bills:refresh

# Dry run — show what would change without writing
npm run bills:refresh -- --dry-run

# Refresh a specific bill
npm run bills:refresh -- --bill hr8070
```

### Fields to refresh

| Field | Source | Notes |
|-------|--------|-------|
| `status` | `latestAction.text` from actions endpoint | Map action text to our status enum (`passed_house`, `passed_senate`, `in_committee`, etc.) |
| `lastActionDate` | `latestAction.actionDate` | ISO date string |
| `cosponsors` | Cosponsors endpoint count | Direct count |
| `passageLikelihood` | Heuristic (see below) | Based on status + cosponsor count + bipartisan flag |

### Status mapping

Map Congress.gov action text patterns to our `PendingBill["status"]` enum:

| Action text pattern | Our status |
|---|---|
| "Became Public Law" / "Signed by President" | Remove from pending-bills (it's enacted now) |
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

This is explicitly a heuristic — the script should log when it changes likelihood so a human can review.

### Example output

```
Refreshing 8 pending bills...

  H.R. 8070 — NDAA FY2025
    status: in_committee → passed_house
    lastActionDate: 2024-06-15 → 2025-01-14
    cosponsors: 12 → 18
    passageLikelihood: medium → high

  S. 2372 — Border Act
    No changes.

  H.R. 1234 — Example Act
    ⚠ Bill was signed into law on 2025-03-01 — consider removing from pending-bills

Updated 3 of 8 bills. Run without --dry-run to apply.
```

## Implementation Plan

### Files

| File | Purpose |
|---|---|
| `scripts/refresh-bill-status.ts` | CLI entry point |
| `scripts/lib/bill-refresher.ts` | Core refresh logic: fetch status, compute diffs |
| `scripts/lib/congress-api.ts` | **Existing** — reuse `fetchBillDetail`, `fetchBillActions`. Add `fetchBillCosponsors` if needed. |

### Algorithm

1. Parse `pending-bills.ts` to get the list of `billNumber` values
2. Convert `billNumber` ("H.R. 8070") to API format ("hr8070")
3. For each bill, fetch detail + actions from Congress.gov API
4. Map the latest action to our status enum
5. Compute a diff against current values
6. If `--dry-run`, print the diff. Otherwise, update `pending-bills.ts` in place.

### File update strategy

Rather than regex-replacing values in the TypeScript source (brittle), the script should:
1. Import the current `pendingBills` array
2. Build a map of `billId → updated fields`
3. Use `ts-morph` or a simple string-replace for each changed field value
4. Alternatively, regenerate the entire `pendingBills` array (simpler but loses manual formatting/comments)

**Recommended**: targeted string replacement per field, preserving manual content like `summary`, `shortTitle`, and `spendingImpacts` which the API can't provide.

## Estimated effort

~1.5 days:
- 0.5 day: bill number parsing + Congress.gov API calls (mostly reusing existing `congress-api.ts`)
- 0.5 day: status mapping heuristic + likelihood heuristic + diff computation
- 0.5 day: file update logic + dry-run mode + CLI flags + testing

## What stays manual

- **Adding new pending bills** — editorial decision about what's worth tracking
- **`summary`** — requires human judgment to write a useful plain-English summary
- **`shortTitle`** — the API title is often too long or formal
- **`spendingImpacts`** — CBO score interpretation is manual
- **`passageLikelihood` overrides** — the heuristic is a starting point; political judgment may override
- **Removing enacted bills** — script flags them but a human decides whether to remove or move to `tracked-votes.ts`

## Out of scope

- Automatic commits or PRs (could be added as a GitHub Action wrapper later)
- CBO score fetching (CBO doesn't have a public API)
- Sponsor/champion updates (rarely changes)
- Adding new bills to the pending list (editorial)
