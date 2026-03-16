# International Outcome Context — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add World Bank outcome indicators and AI-generated editorial callouts to the international comparison, so users see what citizens in other countries actually *get* for their spending — not just how much is spent.

**Architecture:** Two-phase pipeline matching the existing codebase separation: (1) `update-intl-data.ts` fetches World Bank indicators and writes raw data to `international-outcomes.json`, (2) `enrich-data.ts` reads those indicators and generates editorial callouts via Claude Haiku, writing them back to the same file. The UI reads the static JSON and conditionally renders callouts below comparison bar charts.

**Tech Stack:** World Bank Open Data API (free, no auth), Claude Haiku via `ai-enricher.ts`, TypeScript, React (existing InternationalComparison component)

**Spec:** `docs/superpowers/specs/2026-03-16-international-outcomes-design.md`

---

## Chunk 1: TypeScript Types + World Bank Fetcher

### Task 1: Create TypeScript type definitions

**Files:**
- Create: `src/data/international-outcomes.ts`

- [ ] **Step 1: Create the type definitions file**

```typescript
// src/data/international-outcomes.ts

/**
 * TypeScript types for international outcome indicators and editorial callouts.
 * Generated data lives in international-outcomes.json — these types are for
 * compile-time safety when consuming that data.
 */

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

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit src/data/international-outcomes.ts`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/data/international-outcomes.ts
git commit -m "feat(intl-outcomes): add TypeScript types for outcome indicators and callouts"
```

---

### Task 2: Create World Bank fetcher

**Files:**
- Create: `scripts/lib/worldbank-fetcher.ts`

This module fetches indicators from the World Bank Open Data API. All 7 countries are batched into a single request per indicator. It picks the most recent non-null value for each country.

- [ ] **Step 1: Write the failing test**

Create `scripts/lib/worldbank-fetcher.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import {
  fetchIndicator,
  fetchAllIndicators,
  INDICATORS,
  type WorldBankIndicatorResult,
} from "./worldbank-fetcher";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a World Bank API response for one indicator + multiple countries. */
function makeWBResponse(
  entries: Array<{ countryCode: string; value: number | null; year: string }>
): [{ page: number; pages: number; total: number }, Array<{ country: { id: string }; value: number | null; date: string }>] {
  return [
    { page: 1, pages: 1, total: entries.length },
    entries.map((e) => ({
      country: { id: e.countryCode },
      value: e.value,
      date: e.year,
    })),
  ];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("worldbank-fetcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("INDICATORS", () => {
    it("has 12 indicator definitions", () => {
      expect(INDICATORS).toHaveLength(12);
    });

    it("each indicator has code, key, unit, and category", () => {
      for (const ind of INDICATORS) {
        expect(ind.code).toBeTruthy();
        expect(ind.key).toBeTruthy();
        expect(ind.unit).toBeTruthy();
        expect(ind.category).toBeTruthy();
      }
    });
  });

  describe("fetchIndicator", () => {
    it("returns the most recent non-null value per country", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () =>
          makeWBResponse([
            { countryCode: "USA", value: null, year: "2023" },
            { countryCode: "USA", value: 77.5, year: "2022" },
            { countryCode: "USA", value: 77.2, year: "2021" },
            { countryCode: "GBR", value: 81.0, year: "2023" },
            { countryCode: "GBR", value: 80.8, year: "2022" },
          ]),
      });

      const result = await fetchIndicator("SP.DYN.LE00.IN", ["USA", "GBR"]);

      expect(result.get("USA")).toEqual({ value: 77.5, year: 2022 });
      expect(result.get("GBR")).toEqual({ value: 81.0, year: 2023 });
    });

    it("omits countries with no non-null data", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () =>
          makeWBResponse([
            { countryCode: "USA", value: 77.5, year: "2022" },
            { countryCode: "GBR", value: null, year: "2023" },
            { countryCode: "GBR", value: null, year: "2022" },
          ]),
      });

      const result = await fetchIndicator("SP.DYN.LE00.IN", ["USA", "GBR"]);

      expect(result.has("USA")).toBe(true);
      expect(result.has("GBR")).toBe(false);
    });

    it("throws on API error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      await expect(
        fetchIndicator("SP.DYN.LE00.IN", ["USA"])
      ).rejects.toThrow("World Bank API error");
    });

    it("handles empty response data", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ page: 1, pages: 1, total: 0 }, null],
      });

      const result = await fetchIndicator("SP.DYN.LE00.IN", ["USA"]);
      expect(result.size).toBe(0);
    });
  });

  describe("fetchAllIndicators", () => {
    it("fetches all indicators and builds country outcomes map", async () => {
      // Mock 12 fetch calls (one per indicator)
      for (let i = 0; i < 12; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () =>
            makeWBResponse([
              { countryCode: "USA", value: 10 + i, year: "2022" },
              { countryCode: "GBR", value: 20 + i, year: "2022" },
            ]),
        });
      }

      const result = await fetchAllIndicators(["USA", "GBR"]);

      expect(result.has("USA")).toBe(true);
      expect(result.has("GBR")).toBe(true);

      const usa = result.get("USA")!;
      expect(Object.keys(usa).length).toBeGreaterThan(0);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/lib/worldbank-fetcher.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the World Bank fetcher**

Create `scripts/lib/worldbank-fetcher.ts`:

```typescript
/**
 * Fetches development indicators from the World Bank Open Data API.
 * Batches all countries into a single request per indicator.
 * Picks the most recent non-null value per country.
 */

import type { OutcomeIndicator } from "../../src/data/international-outcomes";

// ---------------------------------------------------------------------------
// Indicator registry
// ---------------------------------------------------------------------------

export interface IndicatorDef {
  /** World Bank indicator code */
  code: string;
  /** Key used in our output JSON (e.g., "life_expectancy") */
  key: string;
  /** Human-readable unit */
  unit: string;
  /** Budget category this maps to */
  category: string;
  /** Date range for query — distributional indicators need wider windows */
  dateRange: string;
}

export const INDICATORS: IndicatorDef[] = [
  // Healthcare
  { code: "SP.DYN.LE00.IN", key: "life_expectancy", unit: "years", category: "healthcare", dateRange: "2019:2023" },
  { code: "SP.DYN.IMRT.IN", key: "infant_mortality", unit: "per 1,000 live births", category: "healthcare", dateRange: "2019:2023" },
  { code: "SH.XPD.OOPC.CH.ZS", key: "out_of_pocket_health", unit: "% of health spending", category: "healthcare", dateRange: "2019:2023" },
  // Education
  { code: "SE.XPD.TOTL.GD.ZS", key: "education_spending_gdp", unit: "% of GDP", category: "education", dateRange: "2019:2023" },
  { code: "SE.TER.ENRR", key: "tertiary_enrollment", unit: "%", category: "education", dateRange: "2019:2023" },
  // Income Security
  { code: "SI.POV.GINI", key: "gini_index", unit: "index (0=equal, 100=unequal)", category: "income-security", dateRange: "2016:2023" },
  { code: "SI.POV.NAHC", key: "poverty_rate", unit: "%", category: "income-security", dateRange: "2016:2023" },
  { code: "SI.DST.FRST.20", key: "income_share_bottom_20", unit: "%", category: "income-security", dateRange: "2016:2023" },
  // Social Security
  { code: "per_si_allsi.cov_pop_tot", key: "social_insurance_coverage", unit: "% of population", category: "social-security", dateRange: "2016:2023" },
  // Infrastructure
  { code: "IT.NET.BBND.P2", key: "broadband_per_100", unit: "per 100 people", category: "infrastructure", dateRange: "2019:2023" },
  // Defense
  { code: "MS.MIL.XPND.GD.ZS", key: "military_spending_gdp", unit: "% of GDP", category: "defense", dateRange: "2019:2023" },
  // Science
  { code: "GB.XPD.RSDV.GD.ZS", key: "rd_spending_gdp", unit: "% of GDP", category: "science", dateRange: "2019:2023" },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorldBankIndicatorResult {
  value: number;
  year: number;
}

const WB_BASE_URL = "https://api.worldbank.org/v2";
const REQUEST_DELAY_MS = 300;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Fetch a single indicator for all countries
// ---------------------------------------------------------------------------

export async function fetchIndicator(
  indicatorCode: string,
  countryCodes: string[],
  dateRange: string = "2019:2023"
): Promise<Map<string, WorldBankIndicatorResult>> {
  const codes = countryCodes.join(";");
  const url = `${WB_BASE_URL}/country/${codes}/indicator/${indicatorCode}?format=json&date=${dateRange}&per_page=500`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `World Bank API error: ${response.status} ${response.statusText} for indicator ${indicatorCode}`
    );
  }

  const json = await response.json();
  const data = json[1]; // [metadata, data[]]

  if (!data || !Array.isArray(data)) {
    return new Map();
  }

  // Group by country, pick most recent non-null value
  const byCountry = new Map<string, WorldBankIndicatorResult>();

  // Sort by year descending so first non-null hit per country is the latest
  const sorted = [...data].sort(
    (a: { date: string }, b: { date: string }) =>
      parseInt(b.date, 10) - parseInt(a.date, 10)
  );

  for (const entry of sorted) {
    const countryCode = entry.country.id;
    if (entry.value == null) continue;
    if (byCountry.has(countryCode)) continue; // already have a more recent value

    byCountry.set(countryCode, {
      value: entry.value,
      year: parseInt(entry.date, 10),
    });
  }

  return byCountry;
}

// ---------------------------------------------------------------------------
// Fetch all indicators for all countries
// ---------------------------------------------------------------------------

export async function fetchAllIndicators(
  countryCodes: string[]
): Promise<Map<string, Record<string, OutcomeIndicator>>> {
  const countryData = new Map<string, Record<string, OutcomeIndicator>>();

  for (let i = 0; i < INDICATORS.length; i++) {
    const ind = INDICATORS[i];
    const results = await fetchIndicator(ind.code, countryCodes, ind.dateRange);

    for (const [code, result] of results) {
      if (!countryData.has(code)) {
        countryData.set(code, {});
      }
      countryData.get(code)![ind.key] = {
        value: result.value,
        year: result.year,
        unit: ind.unit,
      };
    }

    // Polite delay between requests
    if (i < INDICATORS.length - 1) {
      await sleep(REQUEST_DELAY_MS);
    }
  }

  return countryData;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run scripts/lib/worldbank-fetcher.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/worldbank-fetcher.ts scripts/lib/worldbank-fetcher.test.ts
git commit -m "feat(intl-outcomes): add World Bank API fetcher with tests"
```

---

### Task 3: Integrate World Bank fetch into update-intl-data.ts

**Files:**
- Modify: `scripts/update-intl-data.ts`

This task adds the World Bank fetch as step 3 of the existing pipeline, writing `international-outcomes.json` with raw indicators only (no callouts yet).

- [ ] **Step 1: Add the --skip-outcomes flag and World Bank fetch to update-intl-data.ts**

In `scripts/update-intl-data.ts`, make these changes:

1. Add to imports at top:
```typescript
import { fetchAllIndicators } from "./lib/worldbank-fetcher";
import type { InternationalOutcomes, CountryOutcomes } from "../src/data/international-outcomes";
```

2. Extend the `Args` interface:
```typescript
interface Args {
  year: number;
  countries: string[];
  summary: boolean;
  validate: boolean;
  skipOutcomes: boolean; // NEW
}
```

3. In `parseArgs()`, add `let skipOutcomes = false;` alongside the other local variable declarations, handle the flag in the for loop, and add `skipOutcomes` to the return object:
```typescript
// Add with other let declarations:
let skipOutcomes = false;

// Add in the for loop:
} else if (args[i] === "--skip-outcomes") {
  skipOutcomes = true;
}

// Add to the return statement:
return { year, countries, summary, validate, skipOutcomes };
```

4. Add the `COUNTRY_NAMES` map (extends existing `COUNTRIES` with USA):
```typescript
const ALL_COUNTRY_CODES = ["USA", ...Object.keys(COUNTRIES)];
```

5. Add the `HEALTHCARE_SYSTEMS` static map (from spec lines 71-79):
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

6. Add the outcomes output path:
```typescript
const OUTCOMES_OUTPUT_PATH = path.resolve(__dirname, "../src/data/international-outcomes.json");
```

7. After the existing OECD fetch + write section in `main()`, add the World Bank fetch step:

```typescript
  // --- World Bank Outcome Indicators ---
  if (!skipOutcomes) {
    console.log("\nFetching World Bank outcome indicators...\n");

    try {
      const indicatorData = await fetchAllIndicators(ALL_COUNTRY_CODES);

      const countryNames: Record<string, string> = {
        USA: "United States",
        ...COUNTRIES,
      };

      const countries: Record<string, CountryOutcomes> = {};
      for (const [code, indicators] of indicatorData) {
        countries[code] = {
          name: countryNames[code] ?? code,
          indicators,
          ...(HEALTHCARE_SYSTEMS[code] ? { healthcareSystem: HEALTHCARE_SYSTEMS[code] } : {}),
        };
      }

      // Load existing outcomes to preserve callouts (written by enrich-data.ts)
      let existingCallouts: Record<string, Record<string, unknown>> = {};
      try {
        const existing = JSON.parse(fs.readFileSync(OUTCOMES_OUTPUT_PATH, "utf-8"));
        existingCallouts = existing.callouts ?? {};
      } catch { /* file doesn't exist yet */ }

      const outcomesOutput: InternationalOutcomes = {
        lastUpdated: new Date().toISOString().split("T")[0],
        source: "World Bank Open Data + Claude editorial",
        primaryYear: year,
        countries,
        callouts: existingCallouts as InternationalOutcomes["callouts"],
      };

      fs.writeFileSync(OUTCOMES_OUTPUT_PATH, JSON.stringify(outcomesOutput, null, 2) + "\n");
      console.log(`  Generated: ${OUTCOMES_OUTPUT_PATH}`);
      console.log(`  Countries with indicators: ${Object.keys(countries).length}`);

      // Print indicator coverage summary
      for (const [code, data] of Object.entries(countries)) {
        const count = Object.keys(data.indicators).length;
        console.log(`    ${code} (${data.name}): ${count} indicators`);
      }
    } catch (err) {
      console.error(`\nWorld Bank fetch failed: ${(err as Error).message}`);
      console.error("Continuing without outcome data.");
    }
  }
```

- [ ] **Step 4: Verify the build compiles**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add scripts/update-intl-data.ts scripts/lib/intl-data.test.ts
git commit -m "feat(intl-outcomes): integrate World Bank fetch into update-intl-data pipeline"
```

---

## Chunk 2: AI Enrichment (Callout Generation)

### Task 4: Add enrichOutcomeCallout to ai-enricher.ts

**Files:**
- Modify: `scripts/lib/ai-enricher.ts`

Add a new exported function that generates editorial callouts. It calls the existing private `callClaude()` helper.

- [ ] **Step 1: Add the enrichOutcomeCallout function**

Append to `scripts/lib/ai-enricher.ts`, before the final `delay` export:

```typescript
/**
 * Generates an editorial callout comparing a country's outcomes to the US.
 * Returns null on failure.
 */
export async function enrichOutcomeCallout(
  categoryName: string,
  countryName: string,
  usRatio: number,
  countryRatio: number,
  formattedIndicators: string,
  apiKey: string,
): Promise<string | null> {
  const system = `You are writing factual editorial callouts for a civic transparency app that shows US taxpayers how their money is spent compared to other countries.

Write a 1-2 sentence callout that contrasts the spending ratio with the outcomes. Lead with what the other country achieves, then contrast with the US. Use specific numbers. Be factual and precise — let the numbers make the argument. Do not editorialize beyond the data. No hedging language.`;

  const user = `Category: ${categoryName}
Country: ${countryName}
US spending ratio: ${(usRatio * 100).toFixed(1)}% of budget
${countryName} spending ratio: ${(countryRatio * 100).toFixed(1)}% of budget

Indicators:
${formattedIndicators}`;

  return callClaude(system, user, apiKey);
}
```

- [ ] **Step 2: Verify the build compiles**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add scripts/lib/ai-enricher.ts
git commit -m "feat(intl-outcomes): add enrichOutcomeCallout function to ai-enricher"
```

---

### Task 5: Add outcomes enrichment scope to enrich-data.ts

**Files:**
- Modify: `scripts/enrich-data.ts`

Add a new `--outcomes-only` scope and the outcome callout generation logic that reads `international-outcomes.json` + `international.json`, generates callouts via Haiku, and writes callouts back.

- [ ] **Step 1: Add the category-to-indicators mapping and helper**

This maps budget category IDs to the indicator keys used in the outcomes JSON, plus human-readable category names for the prompt.

Add these constants near the top of `enrich-data.ts`, after the existing path constants:

Add `enrichOutcomeCallout` to the existing import from `./lib/ai-enricher` (which already imports `enrichContractDescription`, `enrichSpendingAnomaly`, and `delay`):

```typescript
// MODIFY the existing import line (do NOT add a new import):
import {
  enrichContractDescription,
  enrichSpendingAnomaly,
  enrichOutcomeCallout,
  delay,
} from "./lib/ai-enricher";

// Add these NEW imports:
import type {
  InternationalOutcomes,
  OutcomeCallout,
  OutcomeIndicator,
} from "../src/data/international-outcomes";

const OUTCOMES_PATH = path.resolve(__dirname, "../src/data/international-outcomes.json");
const INTL_PATH = path.resolve(__dirname, "../src/data/international.json");

/** Maps budget category IDs to the indicator keys that inform their callouts. */
const CATEGORY_INDICATORS: Record<string, { name: string; keys: string[] }> = {
  healthcare: { name: "Healthcare", keys: ["life_expectancy", "infant_mortality", "out_of_pocket_health"] },
  education: { name: "Education", keys: ["education_spending_gdp", "tertiary_enrollment"] },
  "income-security": { name: "Income Security", keys: ["gini_index", "poverty_rate", "income_share_bottom_20"] },
  "social-security": { name: "Social Security", keys: ["social_insurance_coverage"] },
  infrastructure: { name: "Infrastructure", keys: ["broadband_per_100"] },
  defense: { name: "Defense", keys: ["military_spending_gdp"] },
  science: { name: "Science & R&D", keys: ["rd_spending_gdp"] },
};

const STALENESS_THRESHOLD = 0.05; // 5% drift triggers re-enrichment
```

- [ ] **Step 2: Extend Options, parseArgs, and add scope guards**

This step modifies the existing code structure before adding the new outcomes section.

**2a. Extend `Options` interface:**
```typescript
// Add to the Options interface:
outcomesOnly: boolean;
```

**2b. Extend `parseArgs`:**
```typescript
// Add to defaults:
outcomesOnly: false,

// Add to switch block:
case "--outcomes-only":
  opts.outcomesOnly = true;
  break;
```

**2c. Replace existing scope guards in `main()`.**

The existing code has `if (!opts.trendsOnly)` around the contracts section and `if (!opts.contractsOnly)` around the trends section. **Replace** (not wrap) these guards:

- Replace `if (!opts.trendsOnly)` with `if (!opts.outcomesOnly && !opts.trendsOnly)`
- Replace `if (!opts.contractsOnly)` with `if (!opts.outcomesOnly && !opts.contractsOnly)`

- [ ] **Step 3: Add the outcomes enrichment section to main()**

After the existing spending trends section and before the summary section, add:

```typescript
  // --- Outcome Callouts ---
  if (!opts.contractsOnly && !opts.trendsOnly) {
    console.log("--- Outcome Callouts ---");

    if (!fs.existsSync(OUTCOMES_PATH)) {
      console.log("  No international-outcomes.json found. Run `npm run intl:update` first.");
    } else if (!fs.existsSync(INTL_PATH)) {
      console.log("  No international.json found. Run `npm run intl:update` first.");
    } else {
      const outcomes: InternationalOutcomes = JSON.parse(
        fs.readFileSync(OUTCOMES_PATH, "utf-8")
      );
      const intlData = JSON.parse(fs.readFileSync(INTL_PATH, "utf-8"));
      const existingCallouts = outcomes.callouts ?? {};
      const updatedCallouts: Record<string, Record<string, OutcomeCallout>> = { ...existingCallouts };

      const usIndicators = outcomes.countries.USA?.indicators ?? {};
      const countryCodes = Object.keys(intlData.countries ?? {});

      // US spending ratios from budget.ts FY2025 data ($7,000B total)
      // Cannot import budget.ts directly (uses @/* path aliases)
      const US_RATIOS: Record<string, number> = {
        "social-security": 1540 / 7000,
        healthcare: 1810 / 7000,
        defense: 895 / 7000,
        interest: 952 / 7000,
        "income-security": 660 / 7000,
        veterans: 190 / 7000,
        education: 265 / 7000,
        infrastructure: 175 / 7000,
        immigration: 68 / 7000,
        science: 75 / 7000,
        international: 65 / 7000,
        justice: 82 / 7000,
        agriculture: 42 / 7000,
        government: 181 / 7000,
      };

      let outcomesEnriched = 0;
      let outcomesSkipped = 0;

      for (const [categoryId, catDef] of Object.entries(CATEGORY_INDICATORS)) {
        if (!updatedCallouts[categoryId]) {
          updatedCallouts[categoryId] = {};
        }

        for (const countryCode of countryCodes) {
          if (totalApiCalls >= MAX_ENRICHMENTS_PER_RUN) {
            console.log("  Hit max enrichments per run, stopping outcomes.");
            break;
          }

          const countryOutcomes = outcomes.countries[countryCode];
          if (!countryOutcomes) continue;

          const countryIndicators = countryOutcomes.indicators;

          // Check if we have enough indicators for this category
          const availableKeys = catDef.keys.filter(
            (k) => usIndicators[k] && countryIndicators[k]
          );
          if (availableKeys.length === 0) continue;

          // Staleness check
          const existing = existingCallouts[categoryId]?.[countryCode];
          if (existing && !opts.force) {
            const stale = availableKeys.some((k) => {
              const usKey = `${k}_usa`;
              const countryKey = `${k}_country`;
              const prevUs = existing.indicatorValuesAtEnrichment[usKey];
              const prevCountry = existing.indicatorValuesAtEnrichment[countryKey];
              const currUs = usIndicators[k]?.value;
              const currCountry = countryIndicators[k]?.value;

              if (prevUs == null || prevCountry == null) return true;
              if (currUs == null || currCountry == null) return false;

              const usDrift = Math.abs(currUs - prevUs) / Math.abs(prevUs || 1);
              const countryDrift = Math.abs(currCountry - prevCountry) / Math.abs(prevCountry || 1);
              return usDrift > STALENESS_THRESHOLD || countryDrift > STALENESS_THRESHOLD;
            });

            if (!stale) {
              outcomesSkipped++;
              continue;
            }
          }

          // Format indicators for the prompt
          const countryName = countryOutcomes.name;
          const lines: string[] = [];
          for (const k of availableKeys) {
            const usVal = usIndicators[k];
            const countryVal = countryIndicators[k];
            lines.push(`- ${k.replace(/_/g, " ")}: US ${usVal.value} ${usVal.unit}, ${countryName} ${countryVal.value} ${countryVal.unit}`);
          }

          // Add healthcare system info if healthcare category
          if (categoryId === "healthcare") {
            const usHealth = outcomes.countries.USA?.healthcareSystem;
            const countryHealth = countryOutcomes.healthcareSystem;
            if (usHealth) lines.push(`- Healthcare system: US ${usHealth.type}, coverage ${usHealth.covered}`);
            if (countryHealth) lines.push(`- Healthcare system: ${countryName} ${countryHealth.type}, coverage ${countryHealth.covered}`);
          }

          // Get spending ratios
          const usRatio = US_RATIOS[categoryId] ?? 0;
          const countryRatios = intlData.countries[countryCode]?.ratios ?? {};
          const countryRatio = countryRatios[categoryId] ?? 0;

          if (opts.dryRun) {
            console.log(`  Would enrich: ${catDef.name} × ${countryName}`);
            outcomesEnriched++;
            continue;
          }

          console.log(`  Enriching: ${catDef.name} × ${countryName}...`);
          const calloutText = await enrichOutcomeCallout(
            catDef.name,
            countryName,
            usRatio,
            countryRatio,
            lines.join("\n"),
            apiKey,
          );

          if (!calloutText) {
            stats.errors++;
            continue;
          }

          // Build staleness snapshot
          const snapshot: Record<string, number> = {};
          for (const k of availableKeys) {
            snapshot[`${k}_usa`] = usIndicators[k].value;
            snapshot[`${k}_country`] = countryIndicators[k].value;
          }

          updatedCallouts[categoryId][countryCode] = {
            text: calloutText,
            indicatorValuesAtEnrichment: snapshot,
            enrichedAt: today,
          };

          outcomesEnriched++;
          totalApiCalls++;
          await delay(200);
        }
      }

      if (!opts.dryRun) {
        outcomes.callouts = updatedCallouts;
        outcomes.lastUpdated = today;
        fs.writeFileSync(OUTCOMES_PATH, JSON.stringify(outcomes, null, 2) + "\n");
        console.log(`  Wrote callouts to international-outcomes.json`);
      }

      console.log(`  Outcomes: ${outcomesEnriched} enriched, ${outcomesSkipped} skipped (not stale)`);
      console.log("");
    }
  }
```

- [ ] **Step 4: Verify the build compiles**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add scripts/enrich-data.ts
git commit -m "feat(intl-outcomes): add outcome callout enrichment to enrich-data pipeline"
```

---

**Note:** The spec mentions optionally extending `intl-validator.ts` to warn on missing indicators. This is intentionally deferred — the World Bank fetcher already silently omits missing indicators, and the callout generator skips categories with insufficient data. Adding validator warnings is a future nice-to-have, not a launch requirement.

---

## Chunk 3: UI Integration

### Task 6: Render callouts in single-country ComparisonRow

**Files:**
- Modify: `src/components/InternationalComparison.tsx`

- [ ] **Step 1: Add the outcomes import at the top of InternationalComparison.tsx**

After the existing imports:

```typescript
import outcomesData from "@/data/international-outcomes.json";
import type { InternationalOutcomes } from "@/data/international-outcomes";

const outcomes = outcomesData as unknown as InternationalOutcomes;
```

Note: The file may not exist yet at dev time. Create a minimal placeholder `src/data/international-outcomes.json` first:

```json
{
  "lastUpdated": "",
  "source": "",
  "primaryYear": 0,
  "countries": {},
  "callouts": {}
}
```

- [ ] **Step 2: Pass countryCode to ComparisonRow (already available) and add callout rendering**

The `ComparisonRow` component already receives `countryCode` as a prop. Add callout rendering at the end of the component's return, after the bars `</div>`:

```tsx
      {/* Editorial callout */}
      {outcomes.callouts?.[item.categoryId]?.[countryCode]?.text && (
        <p className="text-xs text-slate-400 mt-1.5 leading-relaxed italic">
          {outcomes.callouts[item.categoryId][countryCode].text}
        </p>
      )}
```

This goes inside the outermost `<div>` of `ComparisonRow`, after the `{/* Bars */} <div className="space-y-1">...</div>` block.

- [ ] **Step 3: Verify it compiles and renders**

Run: `npm run dev`
Navigate to the app, enter income, scroll to international comparison, select a single country.
Expected: No callouts visible yet (placeholder JSON has empty callouts). No errors in console.

- [ ] **Step 4: Commit**

```bash
git add src/components/InternationalComparison.tsx src/data/international-outcomes.json
git commit -m "feat(intl-outcomes): render editorial callouts in single-country comparison view"
```

---

### Task 7: Add all-countries header insight

**Files:**
- Modify: `src/components/InternationalComparison.tsx`

- [ ] **Step 1: Add the static insights array**

Near the top of the file, after the `COUNTRY_COLORS` constant:

```typescript
/**
 * Cross-cutting insights shown in the all-countries comparison header.
 * These are manually curated — update if the country list changes.
 */
const ALL_COUNTRIES_INSIGHTS = [
  "Every country shown here provides universal healthcare coverage. The US does not.",
  "The US spends more on healthcare per person than any country here — and has the lowest life expectancy.",
  "All six comparison countries have lower income inequality (Gini index) than the United States.",
];
```

- [ ] **Step 2: Render one insight in the all-countries header**

In the all-countries view section, inside the header `<div className="px-4 py-3 border-b border-white/10">`, after the legend `<div className="flex flex-wrap gap-x-3 gap-y-1">...</div>`, add:

```tsx
                    {/* Cross-cutting insight */}
                    <p className="text-xs text-slate-400 mt-2 leading-relaxed italic">
                      {ALL_COUNTRIES_INSIGHTS[0]}
                    </p>
```

For now, show the first insight. A future enhancement could rotate them or show contextually.

- [ ] **Step 3: Verify it renders**

Run: `npm run dev`
Select "All countries" in the comparison. Expected: The insight text appears below the legend in the header area.

- [ ] **Step 4: Commit**

```bash
git add src/components/InternationalComparison.tsx
git commit -m "feat(intl-outcomes): add editorial insight to all-countries comparison header"
```

---

## Chunk 4: Documentation Updates

### Task 8: Update docs

**Files:**
- Modify: `docs/todo/international-comparison-spec.md`
- Modify: `CLAUDE.md`
- Modify: `docs/LAUNCH-CHECKLIST.md`

- [ ] **Step 1: Add Phase 1.5 section to international-comparison-spec.md**

After the Phase 1 section (around line 13) and before the Phase 2 mention, add:

```markdown
**Phase 1.5** (this work): Add outcome context from World Bank Open Data API. For each comparison country, show factual editorial callouts alongside the spending comparison bars — contrasting what citizens get (life expectancy, coverage, inequality) with what the US spends. Callouts are generated by Claude Haiku at build time and committed as static data.

Key additions:
- `scripts/lib/worldbank-fetcher.ts` — fetches 12 World Bank indicators per country
- `scripts/lib/ai-enricher.ts` — `enrichOutcomeCallout()` generates editorial text
- `src/data/international-outcomes.json` — raw indicators + AI callouts
- `src/data/international-outcomes.ts` — TypeScript type definitions
- `scripts/update-intl-data.ts` — extended with World Bank fetch step (`--skip-outcomes` to skip)
- `scripts/enrich-data.ts` — extended with outcome callout generation (`--outcomes-only`)
```

- [ ] **Step 2: Update CLAUDE.md**

Add to the APIs section:
```
- **APIs:** Geocodio (ZIP → reps), House Clerk + Senate XML (roll call votes), World Bank (international outcome indicators)
```

Add to the Key Utilities or Data section (under `src/data/`):
```
| `international-outcomes.json` | `src/data/` | World Bank outcome indicators + AI editorial callouts per country per category |
| `international-outcomes.ts` | `src/data/` | TypeScript types for outcome data |
```

- [ ] **Step 3: Update docs/LAUNCH-CHECKLIST.md**

In the "After Launch" section, add a data freshness item:

```markdown
### 9. Periodic Data Updates

Run annually (after OECD publishes new COFOG data, typically mid-year):

```bash
npm run intl:update          # Fetch OECD ratios + World Bank indicators
npm run enrich -- --outcomes-only  # Generate editorial callouts
```

Review the generated callouts in `src/data/international-outcomes.json` before committing.
```

- [ ] **Step 4: Commit**

```bash
git add docs/todo/international-comparison-spec.md CLAUDE.md docs/LAUNCH-CHECKLIST.md
git commit -m "docs: update specs, CLAUDE.md, and launch checklist for international outcomes"
```

---

### Task 9: Run full build and verify

**Files:** None (verification only)

- [ ] **Step 1: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Run all tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 3: Run production build**

Run: `npx next build`
Expected: Build succeeds with no errors

- [ ] **Step 4: Final commit (if any fixes needed)**

If any fixes were required, commit them:
```bash
git commit -m "fix(intl-outcomes): address build/test issues"
```
