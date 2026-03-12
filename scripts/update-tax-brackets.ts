#!/usr/bin/env npx tsx
/**
 * Fetch and generate tax bracket config for a new tax year.
 *
 * Usage:
 *   npm run tax:update -- --year 2026
 *   npm run tax:update -- --year 2026 --json
 *   npm run tax:update -- --year 2026 --ss-wage-base 180600
 *   npm run tax:update -- --year 2025 --validate
 */

import { fetchTaxYearData, type TaxYearData } from "./lib/tax-data-fetcher";
import { validateTaxData } from "./lib/tax-data-validator";

interface Args {
  year: number;
  json: boolean;
  validate: boolean;
  ssWageBase?: number;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  let year = 0;
  let json = false;
  let validate = false;
  let ssWageBase: number | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--year" && args[i + 1]) {
      year = parseInt(args[i + 1], 10);
      if (isNaN(year) || year < 2020 || year > 2040) {
        console.error("Error: --year must be a number between 2020 and 2040");
        process.exit(1);
      }
      i++;
    } else if (args[i] === "--json") {
      json = true;
    } else if (args[i] === "--validate") {
      validate = true;
    } else if (args[i] === "--ss-wage-base" && args[i + 1]) {
      ssWageBase = parseInt(args[i + 1], 10);
      if (isNaN(ssWageBase)) {
        console.error("Error: --ss-wage-base must be a number");
        process.exit(1);
      }
      i++;
    }
  }

  if (!year) {
    console.error(
      "Usage: npm run tax:update -- --year YYYY [--json] [--validate] [--ss-wage-base N]"
    );
    process.exit(1);
  }

  return { year, json, validate, ssWageBase };
}

/**
 * Format a number with underscore separators matching the style in tax.ts
 * e.g., 176100 → "176100", 11925 → "11925"
 */
function formatNum(n: number): string {
  if (n === Infinity) return "Infinity";
  return String(n);
}

/**
 * Generate a TypeScript config block matching tax.ts style.
 */
function generateTypeScript(data: TaxYearData): string {
  const indent = "  ";
  const lines: string[] = [];

  lines.push(`${indent}${data.year}: {`);
  lines.push(`${indent}${indent}brackets: {`);

  for (const status of ["single", "married", "head_of_household"] as const) {
    lines.push(`${indent}${indent}${indent}${status}: [`);
    for (const bracket of data.brackets[status]) {
      lines.push(
        `${indent}${indent}${indent}${indent}{ min: ${formatNum(bracket.min)}, max: ${formatNum(bracket.max)}, rate: ${bracket.rate.toFixed(2)} },`
      );
    }
    lines.push(`${indent}${indent}${indent}],`);
  }

  lines.push(`${indent}${indent}},`);
  lines.push(`${indent}${indent}standardDeduction: {`);

  for (const status of ["single", "married", "head_of_household"] as const) {
    lines.push(
      `${indent}${indent}${indent}${status}: ${formatNum(data.standardDeduction[status])},`
    );
  }

  lines.push(`${indent}${indent}},`);
  lines.push(
    `${indent}${indent}socialSecurityWageBase: ${formatNum(data.socialSecurityWageBase)},`
  );
  lines.push(`${indent}},`);

  return lines.join("\n");
}

function printHuman(data: TaxYearData, allPassed: boolean) {
  console.log(`\nGenerated TaxYearConfig for ${data.year}:\n`);
  console.log(generateTypeScript(data));
  console.log();

  console.log(`Source: ${data.sourceUrl}`);
  console.log();

  console.log("To apply:");
  console.log(
    `  1. Add this entry to TAX_YEAR_CONFIG in src/lib/tax.ts`
  );
  console.log(
    `  2. Update the TaxYear type: export type TaxYear = ... | ${data.year};`
  );
  console.log(`  3. Add ${data.year} to SUPPORTED_TAX_YEARS`);
  console.log(`  4. Run \`npm test\` to verify`);

  if (!allPassed) {
    console.log(
      "\n⚠ Some validation checks failed — review the output above before applying."
    );
  }
}

async function main() {
  const { year, json, validate, ssWageBase } = parseArgs();

  if (!json) {
    console.log(`Fetching ${year} tax data from Tax Foundation...`);
  }

  const data = await fetchTaxYearData(year);

  // Override SS wage base if provided
  if (ssWageBase) {
    data.socialSecurityWageBase = ssWageBase;
  }

  // Look up prior year SS wage base for validation
  // Import the existing config dynamically to compare
  let priorYearWageBase: number | undefined;
  try {
    const taxModule = await import("../src/lib/tax");
    const supportedYears = taxModule.SUPPORTED_TAX_YEARS as number[];
    const priorYear = supportedYears[supportedYears.length - 1];
    if (priorYear && priorYear < year) {
      // Read the config to get prior year's wage base
      // We can't directly access TAX_YEAR_CONFIG since it's not exported,
      // but we can use estimateFederalTax to infer it indirectly.
      // For now, we'll skip prior-year comparison if we can't access it.
    }
  } catch {
    // Not in project root or module not found — skip comparison
  }

  const { results, allPassed } = validateTaxData(data, priorYearWageBase);

  if (json) {
    console.log(
      JSON.stringify(
        {
          data: {
            ...data,
            brackets: Object.fromEntries(
              Object.entries(data.brackets).map(([status, brackets]) => [
                status,
                brackets.map((b) => ({
                  ...b,
                  max: b.max === Infinity ? "Infinity" : b.max,
                })),
              ])
            ),
          },
          validation: { results, allPassed },
          typescript: generateTypeScript(data),
        },
        null,
        2
      )
    );
    return;
  }

  // Print validation results
  console.log("\nValidation:");
  for (const r of results) {
    console.log(`  ${r.pass ? "✓" : "✗"} ${r.message}`);
  }

  if (validate) {
    process.exit(allPassed ? 0 : 1);
  }

  printHuman(data, allPassed);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
