# International Comparison Feature

## Problem

The tax receipt shows users how their federal taxes are allocated across 14 budget categories, but there's no context for whether that allocation is typical. Users have no way to see how US spending priorities compare to other developed nations. Questions like "Does the US spend more on defense than other countries?" or "How does our healthcare spending compare?" require external research.

## Goal

A feature that takes the user's existing US tax receipt and shows how the same dollar amount would be distributed if the US spent like another country. Using OECD spending data, re-allocate the user's tax contribution according to each comparison country's spending ratios — giving an immediate, personalized sense of how priorities differ.

### Phased approach

**Phase 1** (this spec): Take the user's US tax amount and redistribute it using another country's spending ratios. "If the US allocated spending like Germany, your $X in taxes would break down as..."

**Phase 2** (future): Estimate what the user would actually pay in taxes in that country (based on income level and filing status), then show that country's spending breakdown applied to the estimated tax amount.

## Data Sources

| Source | URL | Format | What it provides |
|--------|-----|--------|-----------------|
| **OECD COFOG Data** | `sdmx.oecd.org/public/rest/data/OECD.SDD.NAD,DSD_NAAG@DF_NAAG_I,1.1/...` | XML/JSON (SDMX) | Government spending by COFOG category as % of GDP or % of total expenditure |

**Key details:**
- Free, no API key required
- SDMX REST API returns structured data by country, year, and COFOG division
- ~1 year data lag (2024 data available ~late 2025)
- Use **% of total expenditure** (not % of GDP) for apples-to-apples redistribution

### Countries

**Launch set (2 countries)** — chosen for best COFOG sub-division coverage:

| Country | Code | Why included |
|---------|------|-------------|
| United Kingdom | GBR | Anglosphere, NHS model, excellent COFOG reporting |
| Germany | DEU | Largest EU economy, full sub-division data |

**Future additions** (once pipeline is proven):

| Country | Code | Why included | Expected difficulty |
|---------|------|-------------|---------------------|
| France | FRA | High social spending model | Easy — strong COFOG coverage |
| Sweden | SWE | Nordic/high-tax model | Easy — strong COFOG coverage |
| Canada | CAN | Neighbor, similar economy | Medium — occasional sub-division gaps |
| Australia | AUS | Anglosphere, different region | Medium — occasional sub-division gaps |
| Japan | JPN | Major non-Western economy | Harder — longer data lag, some gaps |
| South Korea | KOR | Fast-growing OECD member | Harder — spottier sub-division data |

Adding a country is a config change (add code to the country list) + a data review (verify COFOG coverage, adjust splits if sub-divisions are missing).

## CLI

```bash
# Fetch OECD data and generate static JSON for all comparison countries
npm run intl:update

# Fetch data for a specific year
npm run intl:update -- --year 2023

# Fetch data for specific countries only
npm run intl:update -- --countries GBR,DEU,SWE

# Validate existing international data against OECD source
npm run intl:validate

# Show mapping summary (COFOG → our categories, coverage per country)
npm run intl:update -- --summary
```

## Implementation

### Files

| File | Purpose |
|---|---|
| `scripts/update-intl-data.ts` | CLI entry point — orchestrates OECD fetch, parse, map, validate, generate |
| `scripts/lib/oecd-fetcher.ts` | Fetches COFOG spending data from OECD SDMX API |
| `scripts/lib/cofog-mapper.ts` | Maps COFOG divisions → our 14 category IDs, computes spending ratios |
| `scripts/lib/intl-validator.ts` | Validates completeness and sanity of international data |
| `scripts/lib/intl-data.test.ts` | Tests for fetcher, mapper, validator |
| `src/data/international.json` | Generated static JSON — spending ratios by country and category |
| `src/components/InternationalComparison.tsx` | UI component — country selector + side-by-side or overlay comparison |
| `src/hooks/useInternationalComparison.ts` | Hook — applies selected country's ratios to user's tax amount |

### COFOG → Our categories mapping

| COFOG Division | Code | Our Category ID | Notes |
|---|---|---|---|
| General public services | 01 | `government` + `interest` | COFOG includes debt interest in 01; split using sub-division 01.7 (public debt transactions) for `interest`, remainder → `government` |
| Defence | 02 | `defense` | Direct 1:1 mapping |
| Public order and safety | 03 | `justice` | Includes police, courts, prisons |
| Economic affairs | 04 | `infrastructure` (70%) + `agriculture` (30%) | Proportional split — 04.2 (agriculture) → `agriculture`, remainder (transport, communication, etc.) → `infrastructure` |
| Environmental protection | 05 | `science` (partial) | Merged into `science` alongside R&D |
| Housing and community amenities | 06 | `infrastructure` (partial) | Added to `infrastructure` total |
| Health | 07 | `healthcare` | Direct 1:1 mapping |
| Recreation, culture, and religion | 08 | `education` (partial) | Small category; merged into `education` |
| Education | 09 | `education` | Direct mapping, combined with 08 share |
| Social protection | 10 | `social-security` + `income-security` + `veterans` | Split using sub-divisions: 10.2 (old age) → `social-security`, 10.7 (survivors/disability) → `income-security`, remainder → `income-security` |

### Categories without direct COFOG equivalents

| Our Category | Handling |
|---|---|
| `immigration` | No COFOG equivalent. Excluded from comparison with explanatory note in UI. |
| `veterans` | COFOG has no veterans-specific division. Estimated as fixed share of social protection (10) based on country-specific data where available, otherwise excluded with note. |
| `international` | Partially captured in COFOG 01 (general public services) sub-divisions for foreign aid. Where sub-division data is available, extract; otherwise exclude with note. |

### Data format (`international.json`)

```json
{
  "lastUpdated": "2026-03-15",
  "dataYear": 2023,
  "source": "OECD COFOG via SDMX",
  "countries": {
    "GBR": {
      "name": "United Kingdom",
      "totalExpenditurePctGDP": 44.5,
      "ratios": {
        "defense": 0.052,
        "healthcare": 0.193,
        "social-security": 0.261,
        "education": 0.112,
        "...": "..."
      }
    }
  }
}
```

Each country's `ratios` object sums to 1.0 (100% of that country's total expenditure). To compute the comparison: multiply the user's US tax amount by each ratio.

### OECD SDMX API details

- **Endpoint pattern**: `https://sdmx.oecd.org/public/rest/data/OECD.SDD.NAD,DSD_NAAG@DF_NAAG_I,1.1/{country}.A.{cofog_code}.EXP.PT_TOT_EXP`
- **Response**: JSON (request with `Accept: application/json` header)
- **Rate limiting**: Be polite — sequential requests with 500ms delay
- **Fallback**: If a country is missing a COFOG sub-division, use top-level division and note reduced granularity

### UI behavior (Phase 1)

#### Entry point

- Section below the main tax receipt, introduced with a heading like "How does US spending compare?"
- Only appears after the user has generated a receipt (requires tax amount)
- Collapsed by default with a preview teaser (e.g., "See how your taxes would be spent in the UK or Germany")

#### Country selector

- Pill-style toggle buttons (not a dropdown) — with only 2 countries, buttons are faster and more discoverable
- "United States" is always shown as the baseline (not selectable, visually distinct)
- Selected country highlighted; clicking toggles the comparison view
- Scale to a dropdown when the country list exceeds ~5

#### Comparison view

- **Layout**: Side-by-side horizontal bar chart — US on the left, selected country on the right, shared category labels in the middle
- **Mobile**: Stacked vertical — US bars on top, country bars below, category labels as row headers
- **Each bar** shows: category name, dollar amount, percentage of total
- **Dollar amounts**: Same total for both sides (user's US tax amount redistributed by country ratios)
- **Sorting**: By US dollar amount descending (keeps US receipt order familiar)
- **Color**: US bars use existing category colors; comparison country uses a single accent color (e.g., muted blue) to visually separate

#### Unmappable categories

- Categories without COFOG equivalents (`immigration`, partially `veterans`, `international`) show a subtle "—" instead of a bar
- Tooltip on hover/tap: "This category doesn't have a direct equivalent in [Country]'s budget classification"
- Unmappable amounts are noted at the bottom: "X% of US spending doesn't have a direct comparison"

#### Interactions and transitions

- Switching countries animates bars resizing (Framer Motion `layout` transition)
- Hover/tap on any bar shows a tooltip with the full dollar amount and percentage
- No additional click-through or drill-down in Phase 1

#### States

- **Loading**: Skeleton bars while country data loads (though data is static JSON, so near-instant)
- **No receipt**: Section hidden entirely
- **Data unavailable**: If a country's data fails validation, that country's button is disabled with tooltip "Data not available"

#### URL params

- Add `&compare=GBR` to existing URL param scheme so comparisons are shareable
- Omitting the param shows the section collapsed

### Dependencies

- No new runtime dependencies (data is static JSON, UI uses existing Recharts + Framer Motion)
- `xml2js` or similar for SDMX XML parsing — dev dependency (only if JSON response is insufficient)

## What stays manual

- **Running the update script** — once per year after OECD publishes new COFOG data (~mid-year for prior year)
- **Reviewing the mapping** — COFOG sub-division splits (especially economic affairs and social protection) may need adjustment per country
- **Adding new countries** — adding a country to the list and verifying its COFOG data coverage
- **Excluded categories** — deciding whether to show "N/A" or attempt an estimate for `immigration`, `veterans`, `international`

## Out of scope

- **Phase 2** (estimating taxes in another country) — requires tax code modeling per country, separate spec
- **Sub-national comparisons** — e.g., comparing to a specific EU member state's regional spending
- **Per-capita or PPP adjustments** — Phase 1 is purely ratio-based redistribution
- **Historical trends** — comparing how a country's spending changed over time
- **Non-OECD countries** — data availability and quality too inconsistent
- **Real-time data** — annual static updates are sufficient given data lag
