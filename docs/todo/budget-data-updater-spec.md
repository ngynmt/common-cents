# Budget Data Updater

## Problem

`src/data/budget.ts` contains federal spending data by category and subcategory for each supported fiscal year. When CBO publishes updated projections (typically January/February), someone must manually look up ~14 category totals and ~60 subcategory amounts, cross-reference them against OMB Historical Tables, and update the TypeScript file. This is the most labor-intensive manual update in the app.

## Goal

A CLI script that fetches CBO/OMB spending data for a new fiscal year, maps it to our category structure, and generates a ready-to-review update for `budget.ts`. The human validates the mapping and applies the changes.

## Data Sources

| Source | URL | Format | What it provides |
|--------|-----|--------|-----------------|
| **OMB Historical Tables** | `whitehouse.gov/omb/budget/historical-tables/` | Excel (`.xls`) | Actual spending by function/subfunction for completed fiscal years |
| **CBO Budget Projections** | `cbo.gov/data/budget-economic-data` | Excel (`.xlsx`) | Projected spending by function for future fiscal years |
| **CBO Budget & Economic Outlook** | `cbo.gov/publication/...` | PDF + supplemental Excel | Detailed projections with subfunctional breakdowns |

**Primary source**: OMB Table 3.2 ("Outlays by Function and Subfunction") — this is the gold standard for federal spending by category. Available as downloadable Excel.

**For projection years**: CBO "Budget Projections" supplemental data, which provides functional category projections in Excel format.

### OMB → Our categories mapping

OMB uses "budget functions" (050, 150, 250, etc.) that map to our category IDs:

| OMB Function | Code | Our Category ID |
|---|---|---|
| National Defense | 050 | `defense` |
| International Affairs | 150 | `international` |
| General Science, Space, and Technology | 250 | `science` |
| Energy + Natural Resources + Environment | 270+300+300 | `science` (partial) |
| Agriculture | 350 | `agriculture` |
| Commerce and Housing Credit + Transportation + Community Development | 370+400+450 | `infrastructure` |
| Education, Training, Employment, Social Services | 500 | `education` |
| Health | 550 | `healthcare` (partial — Medicare is 570) |
| Medicare | 570 | `healthcare` (partial) |
| Income Security | 600 | `income-security` |
| Social Security | 650 | `social-security` |
| Veterans Benefits and Services | 700 | `veterans` |
| Administration of Justice | 750 | `justice` |
| General Government | 800 | `government` |
| Net Interest | 900 | `interest` |
| Allowances + Undistributed Offsetting Receipts | 920+950 | `government` (partial) |

Some of our categories aggregate multiple OMB functions (e.g., `infrastructure` = Transportation + Community Development). The mapping is defined once in the script config and reused each year.

## Proposed CLI

```bash
# Generate new fiscal year data
npm run budget:update -- --year 2026

# Use a local Excel file instead of downloading
npm run budget:update -- --year 2026 --file ./data/omb-table-3-2.xlsx

# Dry run — show category totals without generating code
npm run budget:update -- --year 2026 --summary

# Validate current data against source
npm run budget:validate -- --year 2025
```

### Example output

```
Parsing OMB Historical Table 3.2 for FY2026...

Category totals (billions):
  social-security:  $1,612  (+4.7% vs FY2025)
  healthcare:       $1,892  (+4.5% vs FY2025)
  defense:          $916    (+2.3% vs FY2025)
  interest:         $1,015  (+6.6% vs FY2025)
  income-security:  $678    (+2.7% vs FY2025)
  veterans:         $198    (+4.2% vs FY2025)
  education:        $272    (+2.6% vs FY2025)
  infrastructure:   $182    (+4.0% vs FY2025)
  immigration:      $72     (+5.9% vs FY2025)
  science:          $78     (+4.0% vs FY2025)
  international:    $62     (-4.6% vs FY2025)
  justice:          $86     (+4.9% vs FY2025)
  agriculture:      $40     (-4.8% vs FY2025)
  government:       $187    (+3.3% vs FY2025)

Total: $7,290B (TOTAL_FEDERAL_SPENDING)

Subcategories with >5% change flagged for review:
  ⚠ interest / Interest on Treasury Securities: +8.1%
  ⚠ international / Foreign Aid & Development: -12.3%

Generated code written to: scripts/output/fy2026-budget.ts

To apply:
  1. Review the generated file for accuracy
  2. Add FY2026_AMOUNTS to src/data/budget.ts
  3. Add subcategory overrides for categories with notable changes
  4. Update TOTAL_FEDERAL_SPENDING with the new year entry
  5. Update the TaxYear type if not already done
  6. Run `npm test` to verify spending allocation math
```

## Implementation Plan

### Files

| File | Purpose |
|---|---|
| `scripts/update-budget-data.ts` | CLI entry point |
| `scripts/lib/omb-parser.ts` | Parses OMB Historical Table 3.2 Excel into structured data |
| `scripts/lib/budget-mapper.ts` | Maps OMB function codes to our category IDs, aggregates |
| `scripts/lib/budget-validator.ts` | Validates totals, flags outliers, compares with prior year |

### Parsing strategy

1. Download OMB Table 3.2 Excel file (or accept a local file path)
2. Parse using `xlsx` (SheetJS) — a lightweight Excel parser
3. Locate the correct fiscal year column by header row
4. Extract spending amounts by function code (rows) and subfunction
5. Map OMB functions → our category IDs using the config table above
6. Sum subfunctions into category totals
7. Generate TypeScript output

### Subcategory handling

Our subcategories don't map 1:1 to OMB subfunctions (e.g., our "Medicare" subcategory under healthcare includes parts of OMB function 570). Strategy:

1. **Category totals**: derived directly from OMB function sums (high confidence)
2. **Subcategory amounts**: for categories where OMB subfunctions align well, map directly. For others, scale proportionally from the prior year (same approach as the current `generateFY2025Data()` function in `budget.ts`)
3. **Override mechanism**: output a `FY20XX_SUBCATEGORY_OVERRIDES` object for subcategories that need manual adjustment (same pattern as existing `FY2025_SUBCATEGORY_OVERRIDES`)

### Validation rules

- Total spending is within 20% of prior year (sanity check)
- No category decreased more than 20% year-over-year without a flag
- All 14 category IDs are present
- Category amounts sum to approximately `TOTAL_FEDERAL_SPENDING` (within 5%, since rounding and our category groupings may not match OMB exactly)
- Subcategory amounts sum to their parent category amount

### Dependencies

- `xlsx` (SheetJS) for Excel parsing — add as a dev dependency

## Estimated effort

~2–3 days:
- 0.5 day: OMB Excel download + parsing with `xlsx`
- 0.5 day: OMB function → category mapping config + aggregation logic
- 0.5 day: Subcategory handling (direct mapping + proportional scaling)
- 0.5 day: Validation rules + prior-year comparison + outlier flagging
- 0.5 day: TypeScript code generation + CLI flags + testing
- 0.5 day: testing with real OMB data (FY2024/2025) to validate accuracy

## What stays manual

- **Running the script** — once per year after CBO/OMB publishes new data (Jan/Feb)
- **Reviewing the output** — category totals may need adjustment based on policy changes not yet reflected in projections
- **Subcategory overrides** — for major policy changes (e.g., PACT Act ramp-up for veterans), the script flags large changes but a human decides the right number
- **Category descriptions and legislation arrays** — these are editorial content, not data
- **`immigration` category** — OMB doesn't have a single function for immigration; our category is assembled from parts of several functions. This mapping needs manual review each year.

## Out of scope

- Automatic file modification (human review required for budget data accuracy)
- Monthly or quarterly updates (federal budget is annual)
- State/local budget data
- Deficit/debt projections (we only track spending, not revenue)
- Downloading CBO PDFs or parsing CBO narrative text
