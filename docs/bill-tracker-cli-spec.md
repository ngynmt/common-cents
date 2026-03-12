# Semi-Automated Bill Tracking CLI

## Problem

`src/data/tracked-votes.ts` is manually curated. When Congress passes a significant bill, someone has to look up the roll call numbers, map it to a spending category, and write effect descriptions. This is infrequent (~5-10 bills/year) but tedious.

## Goal

A CLI script that discovers new roll call votes and generates a draft entry for `tracked-votes.ts`, reducing manual work to just review and approval.

## Data Sources

- **Congress.gov API** (`api.congress.gov/v3`) — bill actions endpoint returns roll call vote events with vote numbers
  - Key: `CONGRESS_API_KEY` (already in `.env.local`)
  - Rate limit: 5,000 req/hr with real key
- **House Clerk XML** (`clerk.house.gov/evs/{year}/roll{number}.xml`) — vote totals and individual votes
- **Senate XML** (`senate.gov/.../vote_{congress}_{session}_{number}.xml`) — vote totals and individual votes

## Proposed CLI

```bash
# Discover recent final passage votes
npm run bills:discover

# Discover votes for a specific congress
npm run bills:discover -- --congress 119

# Generate a draft entry for a specific bill
npm run bills:draft -- --bill hr1234-119
```

### `bills:discover`

1. Query Congress.gov for recent bills with `actionType=BecameLaw` or `actionType=PassedBoth`
2. For each bill, extract roll call vote numbers from the actions list
3. Filter out bills already in `tracked-votes.ts` (match by legislation title or roll call numbers)
4. Output a table of new bills with: title, date, House roll call, Senate roll call, vote totals

Example output:
```
Found 3 new bills not yet tracked:

  HR 1234 - Water Infrastructure Act of 2025
    House: Roll 312 (2025) — 389-42
    Senate: Vote 198 (119-1) — 87-11
    Signed: 2025-09-15

  S 567 - Veterans Mental Health Act
    House: Roll 445 (2025) — 412-15
    Senate: Vote 223 (119-1) — 95-3
    Signed: 2025-10-02

Run `npm run bills:draft -- --bill hr1234-119` to generate a tracked-votes entry.
```

### `bills:draft`

1. Fetch the bill details from Congress.gov
2. Fetch both House and Senate XML to verify vote data is accessible
3. Generate a `TrackedVote` object with all fields pre-filled except:
   - `categoryId` — suggest based on committee (e.g., Armed Services → "defense") but flag for review
   - `yesEffect` / `noEffect` — generate a first draft from the bill title and summary, flag for review

Example output:
```typescript
// DRAFT — review categoryId, yesEffect, and noEffect before adding
{
  legislationTitle: "Water Infrastructure Act of 2025",
  categoryId: "infrastructure", // suggested — verify
  congress: 119,
  houseVote: { year: 2025, rollCall: 312 },
  senateVote: { session: 1, rollCall: 198 },
  date: "2025-09-15",
  yesEffect: "Voted to authorize $X in water infrastructure improvements", // draft — edit
  noEffect: "Voted against water infrastructure funding", // draft — edit
}
```

## Implementation Plan

### Files

| File | Purpose |
|---|---|
| `scripts/discover-bills.ts` | CLI entry point for `bills:discover` |
| `scripts/draft-bill.ts` | CLI entry point for `bills:draft` |
| `scripts/lib/congress-api.ts` | Congress.gov API client (bill search, actions, details) |
| `scripts/lib/category-suggester.ts` | Maps bill committees/keywords to spending category IDs |

### Category Suggestion Heuristic

Map from congressional committee names to our category IDs:

| Committee | Suggested Category |
|---|---|
| Armed Services | `defense` |
| Appropriations — Defense | `defense` |
| Energy and Commerce — Health | `healthcare` |
| Finance — Health | `healthcare` |
| Ways and Means — Social Security | `social-security` |
| Veterans' Affairs | `veterans` |
| Education and the Workforce | `education` |
| Transportation and Infrastructure | `infrastructure` |
| Judiciary | `justice` |
| Agriculture | `agriculture` |
| Science, Space, and Technology | `science` |
| Foreign Affairs / Foreign Relations | `international` |
| Homeland Security | `immigration` |

Fallback: flag as `"unknown"` for manual assignment.

### Package.json Scripts

```json
{
  "bills:discover": "npx tsx scripts/discover-bills.ts",
  "bills:draft": "npx tsx scripts/draft-bill.ts"
}
```

Requires adding `tsx` as a dev dependency for running TypeScript scripts directly.

## What Stays Manual

- **Final approval** of categoryId, yesEffect, noEffect
- **Deciding whether a bill is worth tracking** — not every signed law is relevant to the tax receipt
- **Adding the entry** to `tracked-votes.ts` (copy-paste from CLI output)

## Out of Scope

- Automatic commits or PRs
- Scheduled cron (unnecessary given ~5-10 bills/year)
- Tracking amendments, procedural votes, or committee votes
- AI-generated effect descriptions (could be added later)
