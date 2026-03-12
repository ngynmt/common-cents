/**
 * Suggests a budget category ID based on congressional committee names
 * and bill title keywords.
 *
 * Valid category IDs (from src/data/budget.ts):
 *   social-security, healthcare, defense, interest, income-security,
 *   veterans, education, infrastructure, immigration, science,
 *   international, justice, agriculture, government
 */

const COMMITTEE_MAP: Array<{ pattern: RegExp; categoryId: string }> = [
  { pattern: /armed services/i, categoryId: "defense" },
  { pattern: /appropriations.*defense/i, categoryId: "defense" },
  { pattern: /energy and commerce.*health/i, categoryId: "healthcare" },
  { pattern: /finance.*health/i, categoryId: "healthcare" },
  { pattern: /health/i, categoryId: "healthcare" },
  { pattern: /ways and means.*social security/i, categoryId: "social-security" },
  { pattern: /veterans/i, categoryId: "veterans" },
  { pattern: /education/i, categoryId: "education" },
  { pattern: /transportation/i, categoryId: "infrastructure" },
  { pattern: /judiciary/i, categoryId: "justice" },
  { pattern: /agriculture/i, categoryId: "agriculture" },
  { pattern: /science.*space.*technology/i, categoryId: "science" },
  { pattern: /foreign (affairs|relations)/i, categoryId: "international" },
  { pattern: /homeland security/i, categoryId: "immigration" },
  { pattern: /appropriations/i, categoryId: "government" },
];

const TITLE_KEYWORDS: Array<{ pattern: RegExp; categoryId: string }> = [
  { pattern: /defense|military|national security/i, categoryId: "defense" },
  { pattern: /health|medicare|medicaid|drug/i, categoryId: "healthcare" },
  { pattern: /social security|ssa/i, categoryId: "social-security" },
  { pattern: /veteran/i, categoryId: "veterans" },
  { pattern: /education|school|student/i, categoryId: "education" },
  { pattern: /infrastructure|highway|bridge|broadband|water/i, categoryId: "infrastructure" },
  { pattern: /judiciary|justice|crime|gun|firearm/i, categoryId: "justice" },
  { pattern: /agriculture|farm|food/i, categoryId: "agriculture" },
  { pattern: /science|research|semiconductor|chip/i, categoryId: "science" },
  { pattern: /foreign|international|aid/i, categoryId: "international" },
  { pattern: /homeland|border|immigration/i, categoryId: "immigration" },
  { pattern: /debt|deficit|fiscal|budget/i, categoryId: "interest" },
  { pattern: /tax|irs|revenue/i, categoryId: "government" },
];

export interface CategorySuggestion {
  categoryId: string;
  confidence: "high" | "low";
  source: string;
}

/**
 * Suggest a spending category based on committee names and bill title.
 */
export function suggestCategory(
  committees: string[],
  billTitle: string
): CategorySuggestion {
  // Try committee match first (higher confidence)
  for (const committee of committees) {
    for (const { pattern, categoryId } of COMMITTEE_MAP) {
      if (pattern.test(committee)) {
        return {
          categoryId,
          confidence: "high",
          source: `committee: ${committee}`,
        };
      }
    }
  }

  // Fall back to title keywords
  for (const { pattern, categoryId } of TITLE_KEYWORDS) {
    if (pattern.test(billTitle)) {
      return {
        categoryId,
        confidence: "low",
        source: `title keyword match`,
      };
    }
  }

  return {
    categoryId: "unknown",
    confidence: "low",
    source: "no match found",
  };
}
