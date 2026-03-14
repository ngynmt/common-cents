# Campaign Finance per Representative

**Status:** ✅ Complete (2026-03-13)

## Problem

Users can see how their tax dollars are spent and how their representatives voted, but have no visibility into **who funds those representatives**. Without this context, it's hard to assess whether a rep's votes align with constituent interests or donor interests.

## Goal

Show campaign finance data inline on each representative's card — specifically:

1. **Outside spending (Super PACs)** — independent expenditures supporting or opposing the candidate, color-coded green/red
2. **Top donor employers** — personal contributions from employees aggregated by employer
3. **"No outside spending" callout** — a positive signal when no Super PAC money was spent for or against a candidate

This lets users draw their own conclusions about whether funding influences votes.

## Data Sources

| Source | Endpoint | Auth | Rate Limit |
|--------|----------|------|------------|
| FEC API | `api.open.fec.gov/v1` | API key via `FEC_API_KEY` | 1,000 req/hr (personal key) |
| unitedstates/congress-legislators | GitHub YAML | None | N/A |

### FEC Endpoints Used

- `/candidate/{id}/` — candidate details (name, party, office, state)
- `/candidate/{id}/totals/` — fundraising totals per cycle
- `/candidate/{id}/committees/` — principal campaign committee
- `/schedules/schedule_a/by_employer/` — individual contributions aggregated by employer
- `/schedules/schedule_e/by_candidate/` — independent expenditures (Super PAC spending)
- `/candidates/search/` — name-based candidate lookup (fallback)

## Implementation

### Files Created

| File | Purpose |
|------|---------|
| `src/data/campaign-finance.ts` | TypeScript interfaces (`CampaignFinanceSummary`, `DonorEmployer`, `OutsideSpender`) |
| `src/data/fec-candidate-ids.ts` | Static `bioguideId → fecCandidateId` map (538 entries, auto-generated) |
| `src/app/api/campaign-finance/route.ts` | Server-side FEC API proxy (hides API key, caches 24h) |
| `src/components/FinanceCard.tsx` | Per-rep finance charts (outside spending + donor employers) |
| `scripts/update-fec-ids.ts` | Script to regenerate the bioguide→FEC ID mapping from upstream |
| `.github/workflows/fec-id-updater.yml` | Monthly GitHub Action to keep FEC IDs current |

### Files Modified

| File | Change |
|------|--------|
| `src/components/RepresentativeCard.tsx` | Added optional `finance` prop, renders `FinanceChart` |
| `src/components/RepresentativesModal.tsx` | Added `financeData` prop, passes to each `RepresentativeCard` |
| `src/components/TaxReceipt.tsx` | Added `financeData` prop, passes to `RepresentativesModal` |
| `src/app/page.tsx` | Added non-blocking finance data fetch after votes load |
| `.env.example` | Added `FEC_API_KEY` entry |

### Data Flow

1. User submits ZIP → reps fetched from Geocodio
2. Votes fetched from Congress XML (blocking)
3. Campaign finance fetched from FEC API (non-blocking, 20s timeout)
4. `page.tsx` → `TaxReceipt` → `RepresentativesModal` → `RepresentativeCard` → `FinanceChart`

### API Route Logic (`/api/campaign-finance`)

For each bioguide ID:

1. Look up FEC candidate ID from static map (538 entries)
2. If no static mapping, fall back to FEC name search (scoped by state + chamber)
3. If full name fails, retry with last name only (handles nickname mismatches)
4. Fetch totals per cycle (2026, 2024, 2022) — pick most recent with receipts > 0
5. Fetch principal committee → top donor employers (filtered for junk: N/A, NULL, etc.)
6. Fetch outside spending across all cycles in parallel → merge by committee + support/oppose
7. Return `CampaignFinanceSummary` per rep (null on failure — never blocks)

### Outside Spending Data Model

- Queries schedule_e across cycles 2026, 2024, 2022 in parallel
- Merges by `committee_name + support_oppose_indicator`
- Keeps larger total per PAC across cycles (no double-counting)
- Returns `null` (not `[]`) when all FEC queries fail — prevents false "no outside spending" callout
- Tracks `outsideSpendingCycle` separately from fundraising cycle for accurate labeling

### Chart Component (`FinanceCard.tsx`)

- Uses `ResizeObserver` hook instead of Recharts `ResponsiveContainer` to avoid blank charts during modal animations
- Outside spending chart: horizontal bars, green = supporting, red = opposing, with legend
- Donor employer chart: horizontal bars, neutral blue (avoids party color confusion with support/oppose)
- Dollar value labels on each bar (replaces x-axis ticks) — makes scale differences immediately visible
- Tooltip on hover shows full name, exact dollar amount, and context
- "No outside spending" green callout only shown when data was successfully fetched and confirmed empty

### FEC ID Mapping (`scripts/update-fec-ids.ts`)

- Fetches `legislators-current.yaml` from `unitedstates/congress-legislators` (GitHub)
- Parses via Python/PyYAML (avoids adding a YAML dependency to the TS project)
- Picks the correct FEC ID per chamber (S-prefix for senators, H-prefix for House)
- Supports `--audit` (compare without writing) and `--dry-run` (preview)
- GitHub Action runs monthly, creates a PR if any changes detected

### Caching

- FEC API responses cached 24h via `{ next: { revalidate: 86400 } }` — same as representatives
- Static FEC ID map eliminates lookup calls for all 538 members

## What Stays Manual

- **Reviewing FEC ID update PRs** — auto-generated monthly but not auto-merged
- **Adding `FEC_API_KEY`** to deployment environment

## Out of Scope

- Lobbying data per budget category (Senate LDA API)
- Cross-referencing donors with voting records ("money trail" synthesis)
- Historical cycle comparison charts
- Dedicated `/follow-the-money` page (decided against — inline in rep card is better UX)
- Comparison search against other reps
