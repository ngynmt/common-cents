# Budget Data Updater ✅

> **Status: Complete** — Implemented 2026-03-13

## Problem

`src/data/budget.ts` contains federal spending data by category and subcategory for each supported fiscal year. When CBO publishes updated projections (typically January/February), someone must manually look up ~14 category totals and ~60 subcategory amounts, cross-reference them against OMB Historical Tables, and update the TypeScript file. This is the most labor-intensive manual update in the app.

## Goal

A CLI script that fetches CBO/OMB spending data for a new fiscal year, maps it to our category structure, and generates a ready-to-review update for `budget.ts`. The human validates the mapping and applies the changes.

## Data Sources

| Source | URL | Format | What it provides |
|--------|-----|--------|-----------------|
| **OMB Historical Tables** | `whitehouse.gov/omb/budget/historical-tables/` | Excel (`.xls`) | Actual spending by function/subfunction for completed fiscal years |
| **CBO Budget Projections** | `cbo.gov/data/budget-economic-data` | Excel (`.xlsx`) | Projected spending by function for future fiscal years |

**Primary source**: OMB Table 3.2 ("Outlays by Function and Subfunction") — the gold standard for federal spending by category. Downloaded and parsed automatically.

## CLI

```bash
# Generate new fiscal year data
npm run budget:update -- --year 2026

# Use a local Excel file instead of downloading
npm run budget:update -- --year 2026 --file ./data/omb-table-3-2.xlsx

# Show summary table with prior-year comparisons
npm run budget:update -- --year 2026 --summary

# Output as JSON
npm run budget:update -- --year 2026 --json

# Validate existing data in budget.ts
npm run budget:validate -- --year 2025
```

## Implementation

### Files

| File | Purpose |
|---|---|
| `scripts/update-budget-data.ts` | CLI entry point — orchestrates download, parse, map, validate, generate |
| `scripts/lib/omb-parser.ts` | Downloads + parses OMB Historical Table 3.2 Excel |
| `scripts/lib/budget-mapper.ts` | Maps OMB function codes → our 14 category IDs, aggregates amounts |
| `scripts/lib/budget-validator.ts` | Validation rules + prior-year comparison + outlier flagging |
| `scripts/lib/budget-updater.test.ts` | Tests for all three library modules + end-to-end pipeline |

### OMB → Our categories mapping

| OMB Function | Code | Our Category ID |
|---|---|---|
| National Defense | 050 | `defense` |
| International Affairs | 150 | `international` |
| General Science, Space, and Technology | 250 | `science` |
| Energy + Natural Resources + Environment | 270+300 | `science` (partial) |
| Agriculture | 350 | `agriculture` |
| Commerce and Housing Credit + Transportation + Community Dev | 370+400+450 | `infrastructure` |
| Education, Training, Employment, Social Services | 500 | `education` |
| Health | 550 | `healthcare` (partial) |
| Medicare | 570 | `healthcare` (partial) |
| Income Security | 600 | `income-security` |
| Social Security | 650 | `social-security` |
| Veterans Benefits and Services | 700 | `veterans` |
| Administration of Justice | 750 | `justice` |
| General Government | 800 | `government` |
| Net Interest | 900 | `interest` |
| Allowances + Undistributed Offsetting Receipts | 920+950 | `government` (partial) |

### Parsing details

- Header row located dynamically (scans for "Function" text or rows with year-like numbers)
- Fiscal year column matched by header cells
- Function codes detected via `(NNN)` suffix pattern in row labels
- Functions (multiples of 50) vs subfunctions (other 3-digit codes) distinguished automatically
- Amounts converted from millions → billions
- Edge cases: `"..."` treated as 0 with warning, negative values preserved (offsetting receipts)

### Subcategory strategy

1. **Category totals**: derived directly from OMB function sums (high confidence)
2. **Subcategory amounts**: scaled proportionally from prior year (same approach as `generateFY2025Data()` in budget.ts)
3. **Rounding adjustment**: applied to largest subcategory to ensure subcategory sum matches parent exactly

### Immigration handling

`immigration` has no OMB function code. It is estimated from:
- Known immigration-related subfunctions (751 partial, 753 partial)
- Prior year immigration amount (inflated ~5%)
- Blended estimate when both sources available
- Always flagged for manual review

### Validation rules (6 checks)

- All 14 category IDs present
- Category sum within 5% of total spending
- Total spending within 20% of prior year
- No category decreased >20% year-over-year
- Subcategory amounts sum to parent (within 2% for rounding)
- Immigration estimate flagged if >30% different from prior year

### Dependencies

- `xlsx` (SheetJS) for Excel parsing — dev dependency

## Verified against

- **FY2025**: `npm run budget:validate -- --year 2025` — all checks pass against existing `budget.ts` data

## What stays manual

- **Running the script** — once per year after CBO/OMB publishes new data (Jan/Feb)
- **Reviewing the output** — category totals may need adjustment based on policy changes
- **Subcategory overrides** — for major policy changes (e.g., PACT Act ramp-up), the script flags large changes but a human decides the right number
- **Category descriptions and legislation arrays** — editorial content, not data
- **`immigration` category** — always flagged for manual review since it has no direct OMB function

## Out of scope

- Automatic file modification (human review required)
- GitHub Actions / cron automation (annual cadence doesn't justify it)
- Monthly or quarterly updates (federal budget is annual)
- State/local budget data
- Deficit/debt projections
