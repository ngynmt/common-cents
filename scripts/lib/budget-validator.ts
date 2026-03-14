/**
 * Validates mapped budget data against structural and sanity rules.
 *
 * Rules:
 * - Total spending within 20% of prior year
 * - No category decreased >20% without warning
 * - All 14 category IDs present
 * - Category sum within 5% of total
 * - Subcategory amounts sum to parent (within 2% for rounding)
 * - Immigration estimate flagged if >30% different from prior year
 */

import type { MappedBudgetData } from "./budget-mapper";

export interface ValidationResult {
  pass: boolean;
  message: string;
}

const EXPECTED_CATEGORY_IDS = [
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

function checkAllCategoriesPresent(
  data: MappedBudgetData
): ValidationResult {
  const missing = EXPECTED_CATEGORY_IDS.filter(
    (id) => !(id in data.amounts) || data.amounts[id] === 0
  );
  return {
    pass: missing.length === 0,
    message:
      missing.length === 0
        ? `All 14 categories present`
        : `Missing categories: ${missing.join(", ")}`,
  };
}

function checkCategorySumMatchesTotal(
  data: MappedBudgetData
): ValidationResult {
  const categorySum = Object.values(data.amounts).reduce((a, b) => a + b, 0);
  const diff = Math.abs(categorySum - data.totalSpending);
  const pct = data.totalSpending > 0 ? (diff / data.totalSpending) * 100 : 100;
  return {
    pass: pct < 5,
    message:
      pct < 5
        ? `Category sum ($${categorySum}B) within ${pct.toFixed(1)}% of total ($${data.totalSpending}B)`
        : `Category sum ($${categorySum}B) differs from total ($${data.totalSpending}B) by ${pct.toFixed(1)}%`,
  };
}

function checkTotalVsPriorYear(
  data: MappedBudgetData,
  priorTotal?: number
): ValidationResult {
  if (!priorTotal) {
    return { pass: true, message: "No prior year total to compare" };
  }
  const pctChange =
    ((data.totalSpending - priorTotal) / priorTotal) * 100;
  const absPct = Math.abs(pctChange);
  return {
    pass: absPct < 20,
    message:
      absPct < 20
        ? `Total spending ${pctChange >= 0 ? "+" : ""}${pctChange.toFixed(1)}% vs prior year ($${priorTotal}B → $${data.totalSpending}B)`
        : `Total spending changed ${pctChange >= 0 ? "+" : ""}${pctChange.toFixed(1)}% vs prior year — exceeds 20% threshold`,
  };
}

function checkCategoryChanges(
  data: MappedBudgetData,
  priorAmounts?: Record<string, number>
): ValidationResult[] {
  if (!priorAmounts) {
    return [
      { pass: true, message: "No prior year category data to compare" },
    ];
  }

  const results: ValidationResult[] = [];
  for (const id of EXPECTED_CATEGORY_IDS) {
    const current = data.amounts[id];
    const prior = priorAmounts[id];
    if (!current || !prior) continue;

    const pctChange = ((current - prior) / prior) * 100;
    if (pctChange < -20) {
      results.push({
        pass: false,
        message: `${id}: decreased ${pctChange.toFixed(1)}% ($${prior}B → $${current}B) — exceeds 20% threshold`,
      });
    }
  }

  if (results.length === 0) {
    results.push({
      pass: true,
      message: "No category decreased >20% from prior year",
    });
  }
  return results;
}

function checkSubcategorySums(
  data: MappedBudgetData
): ValidationResult[] {
  const results: ValidationResult[] = [];

  for (const [categoryId, subs] of Object.entries(
    data.subcategoryOverrides
  )) {
    const parentAmount = data.amounts[categoryId];
    if (!parentAmount) continue;

    const subSum = Object.values(subs).reduce((a, b) => a + b, 0);
    const diff = Math.abs(subSum - parentAmount);
    const pct = (diff / parentAmount) * 100;

    if (pct > 2) {
      results.push({
        pass: false,
        message: `${categoryId}: subcategories sum to $${subSum}B vs parent $${parentAmount}B (${pct.toFixed(1)}% off)`,
      });
    }
  }

  if (results.length === 0) {
    results.push({
      pass: true,
      message: "All subcategory sums within 2% of parent amounts",
    });
  }
  return results;
}

function checkImmigrationEstimate(
  data: MappedBudgetData,
  priorImmigration?: number
): ValidationResult {
  if (!priorImmigration || !data.amounts["immigration"]) {
    return {
      pass: true,
      message: "No prior immigration data to compare",
    };
  }

  const pctChange =
    ((data.amounts["immigration"] - priorImmigration) / priorImmigration) *
    100;
  const absPct = Math.abs(pctChange);
  return {
    pass: absPct < 30,
    message:
      absPct < 30
        ? `Immigration estimate ${pctChange >= 0 ? "+" : ""}${pctChange.toFixed(1)}% vs prior year ($${priorImmigration}B → $${data.amounts["immigration"]}B)`
        : `Immigration estimate changed ${pctChange >= 0 ? "+" : ""}${pctChange.toFixed(1)}% vs prior year — MANUAL REVIEW REQUIRED`,
  };
}

export function validateBudgetData(
  data: MappedBudgetData,
  priorTotal?: number,
  priorAmounts?: Record<string, number>
): { results: ValidationResult[]; allPassed: boolean } {
  const results = [
    checkAllCategoriesPresent(data),
    checkCategorySumMatchesTotal(data),
    checkTotalVsPriorYear(data, priorTotal),
    ...checkCategoryChanges(data, priorAmounts),
    ...checkSubcategorySums(data),
    checkImmigrationEstimate(data, priorAmounts?.["immigration"]),
  ];

  return {
    results,
    allPassed: results.every((r) => r.pass),
  };
}
