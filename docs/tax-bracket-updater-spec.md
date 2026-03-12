# Tax Bracket Updater ✅

> **Status: Complete** — Implemented 2026-03-12

## Problem

`src/lib/tax.ts` contains hardcoded tax brackets, standard deductions, and FICA thresholds for each supported tax year. When the IRS publishes inflation-adjusted values for a new year (typically October/November via Revenue Procedure), someone must manually transcribe ~30 values into the config. This is error-prone — a single typo in a bracket boundary changes every calculation downstream.

## Goal

A CLI script that fetches new tax year data from a structured source, validates it, and generates a ready-to-paste `TaxYearConfig` entry for `tax.ts`. The human reviews the output, adds it to the file, and updates the `TaxYear` union type.

## Data Sources

| Source | Format | What it provides |
|--------|--------|-----------------|
| **Tax Foundation** (`taxfoundation.org/data/all/federal/YYYY-tax-brackets/`) | HTML tables | Brackets × 3 filing statuses, standard deductions |
| **IRS Topic 751** (`irs.gov/taxtopics/tc751`) | HTML text | Social Security wage base for the current year |

The SS wage base is auto-fetched from IRS Topic 751. If the requested year isn't on the page yet, the `--ss-wage-base` flag provides a manual fallback.

## CLI

```bash
# Generate a new tax year config entry (SS wage base auto-fetched)
npm run tax:update -- --year 2026

# Provide SS wage base manually if auto-fetch fails
npm run tax:update -- --year 2026 --ss-wage-base 184500

# Output as JSON instead of TypeScript
npm run tax:update -- --year 2026 --json

# Validate only — exits 0 if all checks pass, 1 otherwise
npm run tax:update -- --year 2025 --validate
```

## Implementation

### Files

| File | Purpose |
|---|---|
| `scripts/update-tax-brackets.ts` | CLI entry point — orchestrates fetch, validate, format |
| `scripts/lib/tax-data-fetcher.ts` | Scrapes Tax Foundation bracket/deduction tables + IRS Topic 751 for SS wage base |
| `scripts/lib/tax-data-validator.ts` | 21 structural validation checks |
| `.github/workflows/tax-bracket-updater.yml` | `workflow_dispatch` — runs script, opens draft PR (or issue if SS wage base missing) |
| `.github/workflows/tax-bracket-reminder.yml` | Cron (Nov 1) — opens a GitHub Issue reminding to run the updater |

### Parsing details

- **Brackets**: Parsed from the first table on the Tax Foundation page with "Rate" + "Single" headers. Column order is detected dynamically.
- **Range normalization**: Tax Foundation inconsistently uses contiguous ranges ("$0–$11,925", "$11,925–$48,475") or $1-gap ranges ("$0–$12,400", "$12,401–$50,400"). The parser normalizes $1 gaps to contiguous boundaries to match `tax.ts` format.
- **Standard deduction**: Parsed from a separate table identified by "standard deduction" text.
- **SS wage base**: Fetched from IRS Topic 751 with year-specific regex matching to avoid returning the wrong year's value.

### Validation rules (21 checks)

- 7 brackets per filing status (×3)
- Bracket boundaries are contiguous (×3)
- Rates match [10%, 12%, 22%, 24%, 32%, 35%, 37%] (×3)
- Top bracket max is `Infinity` (×3)
- All bracket boundaries are positive integers (×3)
- Standard deduction: married ≈ 2× single (within $200)
- Standard deduction: head_of_household between single and married
- Standard deduction: each is a positive integer (×3)
- SS wage base in reasonable range (>$100k)
- SS wage base > prior year (when prior year provided)

### GitHub Actions

**Tax Bracket Updater** (`workflow_dispatch`):
- Inputs: `year` (required), `ss_wage_base` (optional — blank = auto-fetch)
- Happy path: runs script → opens draft PR with generated config
- SS wage base missing: opens a GitHub Issue with links to SSA + workflow re-run

**Tax Bracket Reminder** (cron, Nov 1):
- Opens a GitHub Issue titled "Update tax brackets for YYYY"
- Includes links to Tax Foundation, SSA wage base page, and the workflow trigger
- Skips if an open issue for that year already exists

### Dependencies

- `cheerio` (^1.2.0) — HTML parsing (dev dependency)

## Verified against

- **2024**: All 21 checks pass, output matches existing `tax.ts` config exactly
- **2025**: All 21 checks pass, output matches existing `tax.ts` config exactly
- **2026**: All 21 checks pass, SS wage base auto-fetched ($184,500)

## What stays manual

- **Pasting the output** into `tax.ts` and updating the `TaxYear` type
- **FICA rate changes** — SS and Medicare *rates* almost never change (last changed 1990)
- **Medicare surtax threshold** — changes very rarely
- **Reviewing the output** — the script generates + validates, the human confirms
