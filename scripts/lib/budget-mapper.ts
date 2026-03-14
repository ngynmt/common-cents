/**
 * Maps OMB function/subfunction codes to our 14 budget category IDs.
 *
 * Our categories don't always map 1:1 to OMB functions — some categories
 * combine multiple functions, and "immigration" is synthesized from
 * subfunctions scattered across several functions.
 */

import type { OmbParseResult, OmbOutlayRow } from "./omb-parser";
import type { BudgetCategory } from "../../src/data/budget";

export interface MappedBudgetData {
  year: number;
  totalSpending: number; // billions
  amounts: Record<string, number>; // category ID → billions
  subcategoryOverrides: Record<string, Record<string, number>>; // category ID → { subcategory name → billions }
  unmappedRows: OmbOutlayRow[];
  warnings: string[];
}

/**
 * OMB function code → our category ID mapping.
 * Function codes are 3-digit numbers assigned by OMB (multiples of 50).
 */
const FUNCTION_TO_CATEGORY: Record<number, string> = {
  50: "defense",       // National Defense
  150: "international", // International Affairs
  250: "science",       // General Science, Space, and Technology
  270: "science",       // Energy (DOE non-weapons)
  300: "science",       // Natural Resources and Environment
  350: "agriculture",   // Agriculture
  370: "infrastructure", // Commerce and Housing Credit
  400: "infrastructure", // Transportation
  450: "infrastructure", // Community and Regional Development
  500: "education",     // Education, Training, Employment, Social Services
  550: "healthcare",    // Health
  570: "healthcare",    // Medicare
  600: "income-security", // Income Security
  650: "social-security", // Social Security
  700: "veterans",      // Veterans Benefits and Services
  750: "justice",       // Administration of Justice
  800: "government",    // General Government
  900: "interest",      // Net Interest
  920: "government",    // Allowances
  950: "government",    // Undistributed Offsetting Receipts
};

/**
 * Known immigration-related subfunctions that should be pulled out of their
 * parent OMB functions and assigned to our "immigration" category.
 *
 * These codes come from DHS/DOJ budget justifications, not OMB function mapping.
 * This list is inherently incomplete — always flag for manual review.
 */
const IMMIGRATION_SUBFUNCTIONS: Set<number> = new Set([
  751, // Federal law enforcement activities (partial — CBP/ICE portions)
  753, // Federal correctional activities (partial — immigration detention)
]);

/**
 * Map parsed OMB data to our 14 category structure.
 *
 * Strategy:
 * 1. Function-level amounts from OMB → category totals
 * 2. Subcategory amounts: use OMB subfunction data where mappable,
 *    otherwise scale proportionally from prior year data
 */
export function mapOmbToCategories(
  parseResult: OmbParseResult,
  priorYearData?: BudgetCategory[]
): MappedBudgetData {
  const warnings: string[] = [...parseResult.warnings];
  const amounts: Record<string, number> = {};
  const unmappedRows: OmbOutlayRow[] = [];

  // Separate function-level rows from subfunction rows
  const functionRows = parseResult.rows.filter(
    (r) => r.functionCode === r.subfunctionCode
  );
  const subfunctionRows = parseResult.rows.filter(
    (r) => r.functionCode !== r.subfunctionCode
  );

  // Step 1: Aggregate function-level amounts into categories
  for (const row of functionRows) {
    const categoryId = FUNCTION_TO_CATEGORY[row.functionCode];
    if (!categoryId) {
      unmappedRows.push(row);
      warnings.push(
        `Unmapped function code ${row.functionCode} (${row.functionName}): ${row.amount.toFixed(1)}B`
      );
      continue;
    }
    amounts[categoryId] = (amounts[categoryId] ?? 0) + row.amount;
  }

  // Round category amounts to whole billions
  for (const id of Object.keys(amounts)) {
    amounts[id] = Math.round(amounts[id]);
  }

  // Step 2: Estimate immigration from known subfunctions
  let immigrationEstimate = 0;
  for (const row of subfunctionRows) {
    if (IMMIGRATION_SUBFUNCTIONS.has(row.subfunctionCode)) {
      // Only a fraction of these subfunctions is immigration-related.
      // Use a conservative 25% estimate for law enforcement, 40% for corrections.
      const fraction = row.subfunctionCode === 753 ? 0.4 : 0.25;
      immigrationEstimate += row.amount * fraction;
    }
  }

  // If we have prior year immigration data, use it to sanity-check
  const priorImmigration = priorYearData?.find(
    (c) => c.id === "immigration"
  )?.amount;
  if (priorImmigration && immigrationEstimate > 0) {
    // Blend: 60% OMB estimate, 40% inflated prior year
    const inflatedPrior = priorImmigration * 1.05; // assume ~5% growth
    immigrationEstimate = immigrationEstimate * 0.6 + inflatedPrior * 0.4;
  } else if (priorImmigration) {
    // No OMB subfunctions found — inflate prior year
    immigrationEstimate = priorImmigration * 1.05;
  }

  if (immigrationEstimate > 0) {
    amounts["immigration"] = Math.round(immigrationEstimate);
    // Subtract immigration estimate from the parent categories (justice primarily)
    if (amounts["justice"]) {
      amounts["justice"] = Math.round(
        amounts["justice"] - immigrationEstimate * 0.7
      );
    }
    warnings.push(
      `Immigration estimate (${amounts["immigration"]}B) is synthesized from subfunctions — MANUAL REVIEW REQUIRED`
    );
  }

  // Step 3: Generate subcategory overrides
  const subcategoryOverrides: Record<string, Record<string, number>> = {};

  if (priorYearData) {
    for (const priorCategory of priorYearData) {
      const newAmount = amounts[priorCategory.id];
      if (!newAmount || newAmount === 0) continue;

      const ratio = newAmount / priorCategory.amount;
      const overrides: Record<string, number> = {};

      for (const sub of priorCategory.subcategories) {
        overrides[sub.name] = Math.round(sub.amount * ratio);
      }

      // Adjust rounding so subcategories sum to parent
      const subSum = Object.values(overrides).reduce((a, b) => a + b, 0);
      const diff = newAmount - subSum;
      if (diff !== 0) {
        // Apply rounding adjustment to the largest subcategory
        const largestSub = Object.entries(overrides).sort(
          (a, b) => b[1] - a[1]
        )[0];
        if (largestSub) {
          overrides[largestSub[0]] += diff;
        }
      }

      subcategoryOverrides[priorCategory.id] = overrides;
    }
  }

  // Compute total spending from our mapped categories
  const totalSpending = Object.values(amounts).reduce((a, b) => a + b, 0);

  // Check that all 14 categories are present
  const expectedIds = [
    "defense",
    "international",
    "science",
    "agriculture",
    "infrastructure",
    "education",
    "healthcare",
    "income-security",
    "social-security",
    "veterans",
    "justice",
    "government",
    "interest",
    "immigration",
  ];
  for (const id of expectedIds) {
    if (!(id in amounts)) {
      warnings.push(`Missing category: ${id}`);
    }
  }

  return {
    year: parseResult.year,
    totalSpending,
    amounts,
    subcategoryOverrides,
    unmappedRows,
    warnings,
  };
}
