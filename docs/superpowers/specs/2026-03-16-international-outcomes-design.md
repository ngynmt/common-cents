# International Outcome Context — Design Spec

## Problem

The international comparison feature shows how US spending ratios differ from other countries, but provides no context about what those countries *get* for their spending. When users see that the UK spends 19% on healthcare vs. the US at 26%, it looks like the US spends more — but there's no indication that the UK achieves universal coverage, higher life expectancy, and lower infant mortality with that smaller share. Without outcome data, the comparison inadvertently suggests the US is more generous, when the reality is the opposite.

## Goal

Add factual outcome indicators and editorial callouts to the international comparison so users can see not just *how much* countries spend, but *what citizens get* for that spending. The framing is style-B: factual data with pointed juxtaposition that lets the numbers make the argument.

## Approach

Two new pipeline steps, following the existing separation between data-fetching scripts and AI-enrichment scripts:

1. **Fetch outcome indicators from the World Bank Open Data API** — added to `update-intl-data.ts` (data-fetching layer), writes raw indicators to `international-outcomes.json`
2. **Generate editorial callouts via Claude Haiku** — added to `enrich-data.ts` (AI-enrichment layer, reusing `ai-enricher.ts`), reads indicators and writes callouts back to the same file

Output goes to a new file `src/data/international-outcomes.json` alongside the existing `international.json`.

## Data Sources

| Source | URL | Auth | What it provides |
|--------|-----|------|-----------------|
| World Bank Open Data | `api.worldbank.org/v2/` | None (free) | Country-level development indicators (health, education, inequality, infrastructure) |
| Static lookup (in-script) | N/A | N/A | Healthcare system type per country (universal/single-payer/etc.) — 7 stable values |

### World Bank indicators

| Indicator code | Name | Maps to category |
|---|---|---|
| `SP.DYN.LE00.IN` | Life expectancy at birth | healthcare |
| `SP.DYN.IMRT.IN` | Infant mortality rate (per 1,000 live births) | healthcare |
| `SH.XPD.OOPC.CH.ZS` | Out-of-pocket health expenditure (% of health spending) | healthcare |
| `SE.XPD.TOTL.GD.ZS` | Education expenditure (% of GDP) | education |
| `SE.TER.ENRR` | Tertiary enrollment rate | education |
| `SI.POV.GINI` | Gini index (income inequality) | income-security |
| `SI.POV.NAHC` | Poverty headcount ratio (national poverty line) | income-security |
| `SI.DST.FRST.20` | Income share held by lowest 20% | income-security |
| `per_si_allsi.cov_pop_tot` | Coverage of social insurance programs (% of population) | social-security |
| `IT.NET.BBND.P2` | Fixed broadband subscriptions (per 100 people) | infrastructure |
| `MS.MIL.XPND.GD.ZS` | Military expenditure (% of GDP) | defense |
| `GB.XPD.RSDV.GD.ZS` | R&D expenditure (% of GDP) | science |

**Coverage by category:**

| Category | Indicator depth | Callout quality |
|---|---|---|
| Healthcare | Rich (3+ indicators) | Strong — most impactful narratively |
| Education | Good (2 indicators) | Strong |
| Income Security | Good (3 indicators) | Strong — inequality story |
| Social Security | Light (1 indicator — pension coverage) | Adequate |
| Infrastructure | Light (1 indicator) | Adequate |
| Defense | Light (1 indicator) | Adequate — more factual than editorial |
| Science | Light (1 indicator) | Adequate |
| Veterans, Justice, Agriculture, Immigration, Government, Interest, International | None | No callout — silent skip |

### World Bank API details

- **Endpoint pattern:** `https://api.worldbank.org/v2/country/USA;GBR;DEU;AUS;JPN;KOR;FRA/indicator/{indicator}?format=json&date=2019:2023&per_page=100`
- **Batching:** All 7 countries in one request per indicator (semicolon-separated). 12 indicators = 12 total API calls.
- **Rate limit:** 50 req/min — use 300ms delay between requests
- **Year handling:** Use a date range query (`date=2019:2023`) and pick the most recent non-null value per country. For distributional indicators (`SI.POV.GINI`, `SI.DST.FRST.20`) which lag more, extend the range to `date=2016:2023` (up to 7 years).
- **Missing data:** If a country has no data for an indicator within the range, omit that indicator from the country's data (do not store `null`). The callout generator gracefully skips countries with insufficient indicators for a category.
- **Response format:** JSON array with `[metadata, data[]]` — data entries have `country.id`, `value`, `date`. Multiple years may be returned; pick the latest with a non-null `value`.

### Healthcare system type lookup

Static map in the fetch script — not from an API since these change on a decades timescale:

```typescript
const HEALTHCARE_SYSTEMS: Record<string, { type: string; covered: string }> = {
  USA: { type: "mixed private/public", covered: "~92% (27M uninsured)" },
  GBR: { type: "universal (NHS)", covered: "100%" },
  DEU: { type: "universal (multi-payer)", covered: "100%" },
  AUS: { type: "universal (Medicare)", covered: "100%" },
  JPN: { type: "universal (NHI)", covered: "100%" },
  KOR: { type: "universal (NHI)", covered: "100%" },
  FRA: { type: "universal (statutory)", covered: "100%" },
};
```

## Output data format

**File:** `src/data/international-outcomes.json`

```json
{
  "lastUpdated": "2026-03-16",
  "source": "World Bank Open Data + Claude editorial",
  "primaryYear": 2022,
  "countries": {
    "USA": {
      "name": "United States",
      "indicators": {
        "life_expectancy": { "value": 77.5, "year": 2022, "unit": "years" },
        "infant_mortality": { "value": 5.4, "year": 2022, "unit": "per 1,000 live births" },
        "out_of_pocket_health": { "value": 11.3, "year": 2022, "unit": "% of health spending" },
        "education_spending_gdp": { "value": 5.0, "year": 2022, "unit": "% of GDP" },
        "tertiary_enrollment": { "value": 87.6, "year": 2022, "unit": "%" },
        "gini_index": { "value": 39.8, "year": 2021, "unit": "index (0=equal, 100=unequal)" },
        "poverty_rate": { "value": 11.5, "year": 2022, "unit": "%" },
        "income_share_bottom_20": { "value": 5.2, "year": 2021, "unit": "%" },
        "broadband_per_100": { "value": 37.2, "year": 2022, "unit": "per 100 people" },
        "military_spending_gdp": { "value": 3.5, "year": 2022, "unit": "% of GDP" },
        "rd_spending_gdp": { "value": 3.5, "year": 2022, "unit": "% of GDP" }
      },
      "healthcareSystem": { "type": "mixed private/public", "covered": "~92% (27M uninsured)" }
    },
    "GBR": { "..." : "..." }
  },
  "callouts": {
    "healthcare": {
      "GBR": {
        "text": "The UK spends 19% of its budget on healthcare and covers every resident. The US spends 26% and leaves 27M uninsured — while its citizens live 3.5 fewer years on average.",
        "indicatorValuesAtEnrichment": {
          "life_expectancy_usa": 77.5,
          "life_expectancy_country": 81.0,
          "infant_mortality_usa": 5.4,
          "infant_mortality_country": 3.8
        },
        "enrichedAt": "2026-03-16"
      }
    },
    "education": { "...": "..." },
    "income-security": { "...": "..." }
  }
}
```

Key design choices:
- Raw indicators stored separately from callouts — indicators can be used for future UI (tooltips, charts) even without AI
- Callouts store `indicatorValuesAtEnrichment` for staleness detection (same pattern as `enriched-trends.ts`)
- USA is always included in `countries` as the baseline for comparison
- Callouts keyed by `category → countryCode` for O(1) lookup in the component

### TypeScript types

Define in `src/data/international-outcomes.ts` (wrapper file, same pattern as `enriched-trends.ts`):

```typescript
export interface OutcomeIndicator {
  value: number;
  year: number;
  unit: string;
}

export interface HealthcareSystem {
  type: string;
  covered: string;
}

export interface CountryOutcomes {
  name: string;
  indicators: Record<string, OutcomeIndicator>;
  healthcareSystem?: HealthcareSystem;
}

export interface OutcomeCallout {
  text: string;
  indicatorValuesAtEnrichment: Record<string, number>;
  enrichedAt: string;
}

export interface InternationalOutcomes {
  lastUpdated: string;
  source: string;
  /** Target year for indicators — individual indicators may differ due to data lag */
  primaryYear: number;
  countries: Record<string, CountryOutcomes>;
  callouts: Record<string, Record<string, OutcomeCallout>>;
}
```

The generated JSON is imported and cast to `InternationalOutcomes` at the usage site.

## Pipeline integration

The pipeline follows the existing codebase separation: data-fetching scripts handle API calls, enrichment scripts handle AI generation.

### Step 1: Data fetching (in `update-intl-data.ts`)

```
1. Parse CLI args (existing — extend Args interface with --skip-outcomes flag)
2. Fetch OECD COFOG ratios → write international.json (existing)
3. If not --skip-outcomes:
   a. Fetch World Bank indicators for all countries + USA (NEW)
   b. Write international-outcomes.json with indicators only (no callouts)
   c. Log indicator summary
```

### Step 2: AI enrichment (in `enrich-data.ts`)

```
1. Parse CLI args (existing — extend with --outcomes-only scope flag)
2. Enrich contracts (existing)
3. Enrich spending trends (existing)
4. Enrich outcome callouts (NEW):
   a. Load international-outcomes.json (raw indicators)
   b. Load international.json (spending ratios — needed for prompt context)
   c. For each category with indicators, for each country:
      - Check staleness (>5% drift in any indicator value)
      - If stale or new: generate callout via Haiku using callClaude() from ai-enricher.ts
   d. Write callouts back into international-outcomes.json
```

This means:
- `npm run intl:update` fetches raw data (no API key needed)
- `npm run enrich` generates AI callouts (requires `ANTHROPIC_API_KEY`)
- Running both in sequence produces the full output

### CLI

```bash
# Fetch OECD ratios + World Bank indicators (no API key needed)
npm run intl:update

# Fetch OECD only, skip World Bank
npm run intl:update -- --skip-outcomes

# Generate AI callouts for outcomes (+ existing contracts/trends)
npm run enrich

# Generate only outcome callouts
npm run enrich -- --outcomes-only

# Regenerate all callouts even if indicators haven't changed
npm run enrich -- --outcomes-only --force

# Dry run: show what would be generated
npm run enrich -- --outcomes-only --dry-run
```

### New files

| File | Purpose |
|---|---|
| `scripts/lib/worldbank-fetcher.ts` | Fetch indicators from World Bank API, normalize response, pick latest non-null value per country |
| `src/data/international-outcomes.ts` | TypeScript type definitions for outcomes data (see Types section above) |

### Modified files

| File | Change |
|---|---|
| `scripts/update-intl-data.ts` | Add World Bank fetch step; extend `Args` interface with `skipOutcomes` flag |
| `scripts/enrich-data.ts` | Add outcomes enrichment scope; load indicators, generate callouts, write back |
| `scripts/lib/ai-enricher.ts` | Add `enrichOutcomeCallout()` function (reuses existing `callClaude()` helper) |
| `scripts/lib/intl-validator.ts` | Add validation for outcomes data (optional — warn if indicators missing) |

## AI editorial generation

### Prompt template

```
You are writing factual editorial callouts for a civic transparency app that
shows US taxpayers how their money is spent compared to other countries.

Category: {categoryName}
Country: {countryName}
US spending ratio: {usRatio}% of budget
{countryName} spending ratio: {countryRatio}% of budget

Indicators:
{formattedIndicators}

Write a 1-2 sentence callout that contrasts the spending ratio with the
outcomes. Lead with what {countryName} achieves, then contrast with the US.
Use specific numbers. Be factual and precise — let the numbers make the
argument. Do not editorialize beyond the data. No hedging language.
```

### Staleness detection

On re-run, for each existing callout:
- Compare current indicator values to `indicatorValuesAtEnrichment`
- If any value drifts >5%, regenerate the callout
- Otherwise skip (save API cost)

### Cost estimate

- 12 World Bank API calls (1 per indicator, all 7 countries batched per request)
- ~6 categories x 6 countries = 36 Haiku calls max per full run
- Haiku cost: ~$0.01 per run (trivial)
- Subsequent runs: most callouts skipped due to staleness check

## UI integration

### Single-country view (`ComparisonRow`)

For categories with a callout for the selected country, render a `<p>` below the bar pair:

```
[Healthcare bar — US: $2,600 (26%)]
[Healthcare bar — UK: $1,900 (19%)]
"The UK covers every resident and achieves 81yr life expectancy.
 The US spends 37% more and leaves 27M uninsured — with a life
 expectancy of 77.5 years."
```

**Styling:** `text-xs text-slate-400 mt-1.5 leading-relaxed` (12px — consistent with the project's minimum readable size established in the text-size triage) — subtle but readable, doesn't compete with the bars.

### All-countries view (header insight)

Too noisy to show per-row callouts with 6 countries. Instead, show a single category-agnostic insight in the section header:

> "Every country shown here provides universal healthcare coverage. The US does not."

This comes from a small static array of "all-countries insights" stored in the component file. Not AI-generated (too important to get right). Deferred to implementation — the exact lines require editorial judgment and should be reviewed in the PR, not locked into the spec.

### No callout available

Nothing renders. No placeholder, no empty state. Categories without outcome data show the existing bar comparison unchanged.

### Data import

```typescript
import outcomes from "@/data/international-outcomes.json";
import type { InternationalOutcomes } from "@/data/international-outcomes";

const typedOutcomes = outcomes as InternationalOutcomes;

// In ComparisonRow (local function component inside InternationalComparison.tsx):
const callout = typedOutcomes.callouts?.[item.categoryId]?.[countryCode]?.text;
```

Static import, no runtime fetch, no loading state. `ComparisonRow` already receives `countryCode` as a prop, so no interface changes needed.

## Documentation updates

### `docs/todo/international-comparison-spec.md`

Add "Phase 1.5: Outcome Context" section between Phase 1 and Phase 2 describing:
- World Bank integration
- Indicator list and category mapping
- Editorial callout format
- Extended pipeline steps

### `CLAUDE.md`

- Add `international-outcomes.json` to the data files description
- Add World Bank to the APIs list
- Update `npm run intl:update` description to mention outcome data

### `docs/LAUNCH-CHECKLIST.md`

- Add outcomes data freshness check to pre-launch and periodic update steps

## Out of scope

- **Interactive indicator explorer** — future: let users click into indicators per category. This spec only covers the callout text.
- **Historical trends** — showing how outcomes changed over time
- **Non-World-Bank indicators** — WHO, UNICEF, etc. Could be added later but World Bank is sufficient for launch
- **Per-state US comparisons** — subnational outcome data is a different feature
- **Automatic CI pipeline** — running the update on a schedule via GitHub Actions (natural follow-up, separate spec)
