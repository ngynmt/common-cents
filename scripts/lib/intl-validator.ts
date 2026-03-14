/**
 * Validates international comparison data for a single country.
 * Checks completeness, ratio sanity, and metadata.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IntlCountryData {
  name: string;
  countryCode: string;
  dataYear: number;
  totalExpenditurePctGDP: number;
  ratios: Record<string, number>;
  unmappedCategories: string[];
}

export interface ValidationResult {
  level: "error" | "warn";
  message: string;
}

export interface ValidationReport {
  allPassed: boolean;
  results: ValidationResult[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALL_CATEGORY_IDS = [
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

const RATIO_SUM_TOLERANCE = 0.02;
const SUSPICIOUSLY_HIGH_RATIO = 0.5;
const MIN_DATA_YEAR = 2000;

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

export function validateIntlData(data: IntlCountryData): ValidationReport {
  const results: ValidationResult[] = [];

  // 1. Metadata checks
  if (!data.countryCode) {
    results.push({ level: "error", message: "Country code is missing or empty" });
  }

  if (!data.dataYear || data.dataYear < MIN_DATA_YEAR) {
    results.push({
      level: "error",
      message: `Data year is missing or invalid: ${data.dataYear}`,
    });
  }

  // 2. All 14 category IDs must be present in ratios
  for (const id of ALL_CATEGORY_IDS) {
    if (!(id in data.ratios)) {
      results.push({
        level: "error",
        message: `Category "${id}" is missing from ratios`,
      });
    }
  }

  // 3. No negative ratios
  for (const [id, value] of Object.entries(data.ratios)) {
    if (value < 0) {
      results.push({
        level: "error",
        message: `Category "${id}" has a negative ratio: ${value}`,
      });
    }
  }

  // 4. Ratios should sum to 1.0 (within tolerance)
  const ratioSum = Object.values(data.ratios).reduce((a, b) => a + b, 0);
  if (Math.abs(ratioSum - 1.0) > RATIO_SUM_TOLERANCE) {
    results.push({
      level: "error",
      message: `Ratios sum to ${ratioSum.toFixed(4)}, expected 1.0 (tolerance: ${RATIO_SUM_TOLERANCE})`,
    });
  }

  // 5. Warn on suspiciously high individual ratios
  for (const [id, value] of Object.entries(data.ratios)) {
    if (
      value > SUSPICIOUSLY_HIGH_RATIO &&
      !data.unmappedCategories.includes(id)
    ) {
      results.push({
        level: "warn",
        message: `Category "${id}" has a suspiciously high ratio: ${value.toFixed(4)}`,
      });
    }
  }

  const hasErrors = results.some((r) => r.level === "error");

  return {
    allPassed: !hasErrors,
    results,
  };
}
