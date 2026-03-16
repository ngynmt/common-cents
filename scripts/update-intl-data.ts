#!/usr/bin/env npx tsx
/**
 * Fetch OECD COFOG data and generate international comparison JSON.
 *
 * Usage:
 *   npm run intl:update
 *   npm run intl:update -- --year 2023
 *   npm run intl:update -- --countries GBR,DEU
 *   npm run intl:update -- --summary
 *   npm run intl:validate
 */

import * as fs from "fs";
import * as path from "path";
import { fetchCofogData } from "./lib/oecd-fetcher";
import { mapCofogToCategories } from "./lib/cofog-mapper";
import { validateIntlData, type IntlCountryData } from "./lib/intl-validator";
import { fetchAllIndicators } from "./lib/worldbank-fetcher";
import type { InternationalOutcomes, CountryOutcomes } from "../src/data/international-outcomes";

// ---------------------------------------------------------------------------
// Country registry
// ---------------------------------------------------------------------------

const COUNTRIES: Record<string, string> = {
  GBR: "United Kingdom",
  DEU: "Germany",
  AUS: "Australia",
  JPN: "Japan",
  KOR: "South Korea",
  FRA: "France",
};

const ALL_COUNTRY_CODES = ["USA", ...Object.keys(COUNTRIES)];

const HEALTHCARE_SYSTEMS: Record<string, { type: string; covered: string }> = {
  USA: { type: "mixed private/public", covered: "~92% (27M uninsured)" },
  GBR: { type: "universal (NHS)", covered: "100%" },
  DEU: { type: "universal (multi-payer)", covered: "100%" },
  AUS: { type: "universal (Medicare)", covered: "100%" },
  JPN: { type: "universal (NHI)", covered: "100%" },
  KOR: { type: "universal (NHI)", covered: "100%" },
  FRA: { type: "universal (statutory)", covered: "100%" },
};

const DEFAULT_YEAR = 2023;
const OUTPUT_PATH = path.resolve(__dirname, "../src/data/international.json");
const OUTCOMES_OUTPUT_PATH = path.resolve(__dirname, "../src/data/international-outcomes.json");

// ---------------------------------------------------------------------------
// CLI arg parsing
// ---------------------------------------------------------------------------

interface Args {
  year: number;
  countries: string[];
  summary: boolean;
  validate: boolean;
  skipOutcomes: boolean;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  let year = DEFAULT_YEAR;
  let countries = Object.keys(COUNTRIES);
  let summary = false;
  let validate = false;
  let skipOutcomes = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--year" && args[i + 1]) {
      year = parseInt(args[i + 1], 10);
      if (isNaN(year) || year < 2000 || year > 2040) {
        console.error("Error: --year must be a number between 2000 and 2040");
        process.exit(1);
      }
      i++;
    } else if (args[i] === "--countries" && args[i + 1]) {
      countries = args[i + 1].split(",").map((c) => c.trim().toUpperCase());
      for (const code of countries) {
        if (!COUNTRIES[code]) {
          console.error(
            `Error: unknown country code "${code}". Supported: ${Object.keys(COUNTRIES).join(", ")}`
          );
          process.exit(1);
        }
      }
      i++;
    } else if (args[i] === "--summary") {
      summary = true;
    } else if (args[i] === "--validate") {
      validate = true;
    } else if (args[i] === "--skip-outcomes") {
      skipOutcomes = true;
    }
  }

  return { year, countries, summary, validate, skipOutcomes };
}

// ---------------------------------------------------------------------------
// Validate-only mode
// ---------------------------------------------------------------------------

async function runValidation() {
  if (!fs.existsSync(OUTPUT_PATH)) {
    console.error(`No international data file found at ${OUTPUT_PATH}`);
    console.error("Run `npm run intl:update` first.");
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf-8"));
  let allValid = true;

  console.log(`\nValidating international data (${OUTPUT_PATH}):\n`);
  console.log(`  Data year: ${raw.dataYear}`);
  console.log(`  Last updated: ${raw.lastUpdated}`);
  console.log(`  Countries: ${Object.keys(raw.countries).join(", ")}\n`);

  for (const [code, country] of Object.entries(raw.countries) as [
    string,
    IntlCountryData,
  ][]) {
    const { allPassed, results } = validateIntlData(country);
    const status = allPassed ? "PASS" : "FAIL";
    console.log(`  ${allPassed ? "✓" : "✗"} ${code} (${country.name}): ${status}`);

    for (const r of results) {
      const icon = r.level === "error" ? "✗" : "⚠";
      console.log(`      ${icon} ${r.message}`);
    }

    if (!allPassed) allValid = false;
  }

  console.log();
  process.exit(allValid ? 0 : 1);
}

// ---------------------------------------------------------------------------
// Print summary
// ---------------------------------------------------------------------------

function printSummary(
  countries: Record<string, IntlCountryData>
) {
  // Header
  const codes = Object.keys(countries);
  const header =
    "Category".padEnd(20) +
    codes.map((c) => c.padStart(10)).join("");
  console.log(`\n${header}`);
  console.log("-".repeat(header.length));

  // Get all category IDs from the first country
  const first = countries[codes[0]];
  const categoryIds = Object.keys(first.ratios).sort(
    (a, b) => first.ratios[b] - first.ratios[a]
  );

  for (const id of categoryIds) {
    let line = id.padEnd(20);
    for (const code of codes) {
      const ratio = countries[code].ratios[id];
      const pct = (ratio * 100).toFixed(1) + "%";
      line += pct.padStart(10);
    }
    console.log(line);
  }

  console.log("-".repeat(header.length));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { year, countries, summary, validate, skipOutcomes } = parseArgs();

  if (validate) {
    await runValidation();
    return;
  }

  console.log(
    `Fetching OECD COFOG data for ${countries.join(", ")} (year: ${year})...\n`
  );

  const countryResults: Record<string, IntlCountryData> = {};
  let hasErrors = false;

  for (const code of countries) {
    const name = COUNTRIES[code];
    process.stdout.write(`  ${code} (${name})... `);

    try {
      const rows = await fetchCofogData(code, year);
      const mapped = mapCofogToCategories(rows, code);

      const countryData: IntlCountryData = {
        name,
        countryCode: code,
        dataYear: year,
        totalExpenditurePctGDP: 0, // Filled from OECD data if available
        ...mapped,
      };

      const { allPassed, results } = validateIntlData(countryData);
      if (allPassed) {
        console.log(`OK (${rows.length} COFOG rows)`);
      } else {
        console.log("WARNINGS:");
        for (const r of results) {
          console.log(`      ${r.level === "error" ? "✗" : "⚠"} ${r.message}`);
        }
        hasErrors = true;
      }

      countryResults[code] = countryData;
    } catch (err) {
      console.log(`FAILED: ${(err as Error).message}`);
      hasErrors = true;
    }

    // Polite delay between requests
    if (code !== countries[countries.length - 1]) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  if (Object.keys(countryResults).length === 0) {
    console.error("\nNo country data fetched successfully. Aborting.");
    process.exit(1);
  }

  // Build output
  const output = {
    lastUpdated: new Date().toISOString().split("T")[0],
    dataYear: year,
    source: "OECD COFOG via SDMX",
    countries: countryResults,
  };

  // Write JSON
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + "\n");
  console.log(`\nGenerated: ${OUTPUT_PATH}`);

  if (summary) {
    printSummary(countryResults);
  }

  if (hasErrors) {
    console.log(
      "\n⚠ Some countries had validation warnings — review the output above."
    );
  }

  // --- World Bank Outcome Indicators ---
  if (!skipOutcomes) {
    console.log("\nFetching World Bank outcome indicators...\n");

    try {
      const indicatorData = await fetchAllIndicators(ALL_COUNTRY_CODES);

      const countryNames: Record<string, string> = {
        USA: "United States",
        ...COUNTRIES,
      };

      const outcomesCountries: Record<string, CountryOutcomes> = {};
      for (const [code, indicators] of indicatorData) {
        outcomesCountries[code] = {
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
        countries: outcomesCountries,
        callouts: existingCallouts as InternationalOutcomes["callouts"],
      };

      fs.writeFileSync(OUTCOMES_OUTPUT_PATH, JSON.stringify(outcomesOutput, null, 2) + "\n");
      console.log(`  Generated: ${OUTCOMES_OUTPUT_PATH}`);
      console.log(`  Countries with indicators: ${Object.keys(outcomesCountries).length}`);

      for (const [code, data] of Object.entries(outcomesCountries)) {
        const count = Object.keys(data.indicators).length;
        console.log(`    ${code} (${data.name}): ${count} indicators`);
      }
    } catch (err) {
      console.error(`\nWorld Bank fetch failed: ${(err as Error).message}`);
      console.error("Continuing without outcome data.");
    }
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
