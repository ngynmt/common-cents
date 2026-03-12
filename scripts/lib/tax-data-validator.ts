/**
 * Validates parsed tax year data against structural and sanity rules.
 *
 * Rules:
 * - 7 brackets per filing status
 * - Bracket boundaries are contiguous (no gaps)
 * - Rates are strictly increasing: 10%, 12%, 22%, 24%, 32%, 35%, 37%
 * - Top bracket max is Infinity
 * - Standard deduction: married ≈ 2× single (within $200)
 * - Standard deduction: head_of_household between single and married
 * - SS wage base > 0 and > prior year's (if provided)
 * - All bracket boundaries are positive integers
 */

import type { TaxYearData, FilingStatus, TaxBracket } from "./tax-data-fetcher";

export interface ValidationResult {
  pass: boolean;
  message: string;
}

const EXPECTED_RATES = [0.10, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37];
const FILING_STATUSES: FilingStatus[] = ["single", "married", "head_of_household"];

function checkBracketCount(data: TaxYearData): ValidationResult[] {
  return FILING_STATUSES.map((status) => {
    const count = data.brackets[status].length;
    return {
      pass: count === 7,
      message:
        count === 7
          ? `${status}: 7 brackets`
          : `${status}: expected 7 brackets, got ${count}`,
    };
  });
}

function checkContiguousBoundaries(data: TaxYearData): ValidationResult[] {
  return FILING_STATUSES.map((status) => {
    const brackets = data.brackets[status];
    const gaps: string[] = [];

    for (let i = 1; i < brackets.length; i++) {
      if (brackets[i].min !== brackets[i - 1].max) {
        gaps.push(
          `gap between bracket ${i} (max ${brackets[i - 1].max}) and bracket ${i + 1} (min ${brackets[i].min})`
        );
      }
    }

    if (brackets[0]?.min !== 0) {
      gaps.push(`first bracket min is ${brackets[0]?.min}, expected 0`);
    }

    return {
      pass: gaps.length === 0,
      message:
        gaps.length === 0
          ? `${status}: boundaries are contiguous`
          : `${status}: ${gaps.join("; ")}`,
    };
  });
}

function checkRates(data: TaxYearData): ValidationResult[] {
  return FILING_STATUSES.map((status) => {
    const rates = data.brackets[status].map((b) => b.rate);
    const match = rates.every((r, i) => Math.abs(r - EXPECTED_RATES[i]) < 0.001);
    return {
      pass: match,
      message: match
        ? `${status}: rates match expected [10%, 12%, 22%, 24%, 32%, 35%, 37%]`
        : `${status}: unexpected rates [${rates.map((r) => (r * 100).toFixed(0) + "%").join(", ")}]`,
    };
  });
}

function checkTopBracket(data: TaxYearData): ValidationResult[] {
  return FILING_STATUSES.map((status) => {
    const brackets = data.brackets[status];
    const topMax = brackets[brackets.length - 1]?.max;
    return {
      pass: topMax === Infinity,
      message:
        topMax === Infinity
          ? `${status}: top bracket max is Infinity`
          : `${status}: top bracket max is ${topMax}, expected Infinity`,
    };
  });
}

function checkStandardDeduction(data: TaxYearData): ValidationResult[] {
  const results: ValidationResult[] = [];
  const { single, married, head_of_household } = data.standardDeduction;

  // married ≈ 2× single (within $200)
  const diff = Math.abs(married - 2 * single);
  results.push({
    pass: diff <= 200,
    message:
      diff <= 200
        ? `Standard deduction: married ($${married.toLocaleString()}) ≈ 2× single ($${single.toLocaleString()})`
        : `Standard deduction: married ($${married.toLocaleString()}) is not ≈ 2× single ($${single.toLocaleString()}), diff = $${diff}`,
  });

  // head_of_household between single and married
  results.push({
    pass: head_of_household > single && head_of_household < married,
    message:
      head_of_household > single && head_of_household < married
        ? `Standard deduction: head_of_household ($${head_of_household.toLocaleString()}) between single and married`
        : `Standard deduction: head_of_household ($${head_of_household.toLocaleString()}) not between single ($${single.toLocaleString()}) and married ($${married.toLocaleString()})`,
  });

  // All positive
  for (const status of FILING_STATUSES) {
    const val = data.standardDeduction[status];
    results.push({
      pass: val > 0 && Number.isInteger(val),
      message:
        val > 0 && Number.isInteger(val)
          ? `Standard deduction ${status}: $${val.toLocaleString()} (positive integer)`
          : `Standard deduction ${status}: $${val} is invalid (must be positive integer)`,
    });
  }

  return results;
}

function checkSSWageBase(
  data: TaxYearData,
  priorYearWageBase?: number
): ValidationResult[] {
  const results: ValidationResult[] = [];
  const wb = data.socialSecurityWageBase;

  if (wb === 0) {
    results.push({
      pass: false,
      message:
        "Social Security wage base not found — provide with --ss-wage-base",
    });
    return results;
  }

  results.push({
    pass: wb > 100_000,
    message:
      wb > 100_000
        ? `SS wage base: $${wb.toLocaleString()} (reasonable range)`
        : `SS wage base: $${wb.toLocaleString()} seems too low`,
  });

  if (priorYearWageBase) {
    results.push({
      pass: wb > priorYearWageBase,
      message:
        wb > priorYearWageBase
          ? `SS wage base: $${wb.toLocaleString()} > prior year $${priorYearWageBase.toLocaleString()}`
          : `SS wage base: $${wb.toLocaleString()} ≤ prior year $${priorYearWageBase.toLocaleString()} — may be incorrect`,
    });
  }

  return results;
}

function checkBracketBoundariesAreIntegers(
  data: TaxYearData
): ValidationResult[] {
  return FILING_STATUSES.map((status) => {
    const nonIntegers: string[] = [];
    data.brackets[status].forEach((b: TaxBracket, i: number) => {
      if (!Number.isInteger(b.min)) nonIntegers.push(`bracket ${i + 1} min: ${b.min}`);
      if (b.max !== Infinity && !Number.isInteger(b.max))
        nonIntegers.push(`bracket ${i + 1} max: ${b.max}`);
    });
    return {
      pass: nonIntegers.length === 0,
      message:
        nonIntegers.length === 0
          ? `${status}: all bracket boundaries are integers`
          : `${status}: non-integer boundaries: ${nonIntegers.join(", ")}`,
    };
  });
}

export function validateTaxData(
  data: TaxYearData,
  priorYearWageBase?: number
): { results: ValidationResult[]; allPassed: boolean } {
  const results = [
    ...checkBracketCount(data),
    ...checkContiguousBoundaries(data),
    ...checkRates(data),
    ...checkTopBracket(data),
    ...checkBracketBoundariesAreIntegers(data),
    ...checkStandardDeduction(data),
    ...checkSSWageBase(data, priorYearWageBase),
  ];

  return {
    results,
    allPassed: results.every((r) => r.pass),
  };
}
