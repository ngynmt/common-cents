/**
 * Maps OECD COFOG (Classification of Functions of Government) divisions
 * to our 14 budget category IDs and computes spending ratios.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CofogDataRow {
  cofogCode: string; // e.g., "01", "01.7", "04.2"
  cofogLabel: string;
  pctOfTotalExpenditure: number;
}

export interface MappedCountryRatios {
  ratios: Record<string, number>;
  unmappedCategories: string[];
}

// ---------------------------------------------------------------------------
// Our 14 budget category IDs
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
] as const;

// Categories with no direct COFOG equivalent
const UNMAPPED_CATEGORIES = ["immigration", "veterans", "international"];

// Required top-level COFOG divisions (01–10)
const REQUIRED_COFOG_DIVISIONS = [
  "01",
  "02",
  "03",
  "04",
  "05",
  "06",
  "07",
  "08",
  "09",
  "10",
];

// ---------------------------------------------------------------------------
// COFOG → category mapping table
//
// Each entry describes how a top-level COFOG division maps to our categories.
// Some divisions map 1:1; others require splitting using sub-division data.
// ---------------------------------------------------------------------------

export const COFOG_CATEGORY_MAP: Record<
  string,
  { targets: string[]; description: string }
> = {
  "01": {
    targets: ["government", "interest"],
    description:
      "General public services → split: 01.7 (debt) → interest, remainder → government",
  },
  "02": { targets: ["defense"], description: "Defence → defense" },
  "03": {
    targets: ["justice"],
    description: "Public order and safety → justice",
  },
  "04": {
    targets: ["infrastructure", "agriculture"],
    description:
      "Economic affairs → split: 04.2 → agriculture, remainder → infrastructure",
  },
  "05": {
    targets: ["science"],
    description: "Environmental protection → science",
  },
  "06": {
    targets: ["infrastructure"],
    description: "Housing and community amenities → infrastructure",
  },
  "07": { targets: ["healthcare"], description: "Health → healthcare" },
  "08": {
    targets: ["education"],
    description: "Recreation, culture, religion → education (partial)",
  },
  "09": { targets: ["education"], description: "Education → education" },
  "10": {
    targets: ["social-security", "income-security"],
    description:
      "Social protection → split: 10.2 (old age) → social-security, remainder → income-security",
  },
};

// Default split ratios when sub-division data is unavailable.
// Based on typical OECD averages.
const DEFAULT_SPLITS = {
  // COFOG 01: proportion going to debt interest (01.7) vs general government
  "01_interest_share": 0.35,
  // COFOG 04: proportion going to agriculture (04.2) vs infrastructure
  "04_agriculture_share": 0.15,
  // COFOG 10: proportion going to old age (10.2) vs income-security
  "10_social_security_share": 0.6,
};

// ---------------------------------------------------------------------------
// Mapper
// ---------------------------------------------------------------------------

/**
 * Map COFOG data rows to our 14 budget category ratios.
 *
 * @param rows - COFOG data rows (top-level and optionally sub-division)
 * @param countryCode - ISO 3-letter country code (for error messages)
 * @returns Ratios object (sums to 1.0) and list of unmapped categories
 */
export function mapCofogToCategories(
  rows: CofogDataRow[],
  countryCode: string
): MappedCountryRatios {
  if (rows.length === 0) {
    throw new Error(`No COFOG data provided for ${countryCode}`);
  }

  // Index rows by code for quick lookup
  const byCode = new Map<string, number>();
  for (const row of rows) {
    byCode.set(row.cofogCode, row.pctOfTotalExpenditure);
  }

  // Validate required top-level divisions are present
  for (const code of REQUIRED_COFOG_DIVISIONS) {
    if (!byCode.has(code)) {
      throw new Error(
        `Missing required COFOG division ${code} for ${countryCode}`
      );
    }
  }

  // Compute the total of all top-level divisions for normalization
  const topLevelTotal = REQUIRED_COFOG_DIVISIONS.reduce(
    (sum, code) => sum + (byCode.get(code) ?? 0),
    0
  );

  if (topLevelTotal === 0) {
    throw new Error(
      `All COFOG divisions are zero for ${countryCode} — no data to map`
    );
  }

  // Initialize ratios
  const ratios: Record<string, number> = {};
  for (const id of ALL_CATEGORY_IDS) {
    ratios[id] = 0;
  }

  // --- Direct 1:1 mappings ---
  ratios.defense = (byCode.get("02") ?? 0) / topLevelTotal;
  ratios.justice = (byCode.get("03") ?? 0) / topLevelTotal;
  ratios.science = (byCode.get("05") ?? 0) / topLevelTotal;
  ratios.healthcare = (byCode.get("07") ?? 0) / topLevelTotal;

  // --- COFOG 08 + 09 → education ---
  ratios.education =
    ((byCode.get("08") ?? 0) + (byCode.get("09") ?? 0)) / topLevelTotal;

  // --- COFOG 01 → government + interest (split on 01.7) ---
  const cofog01 = byCode.get("01") ?? 0;
  if (byCode.has("01.7")) {
    const debtInterest = byCode.get("01.7")!;
    ratios.interest = debtInterest / topLevelTotal;
    ratios.government = (cofog01 - debtInterest) / topLevelTotal;
  } else {
    // Fallback: use default split
    ratios.interest =
      (cofog01 * DEFAULT_SPLITS["01_interest_share"]) / topLevelTotal;
    ratios.government =
      (cofog01 * (1 - DEFAULT_SPLITS["01_interest_share"])) / topLevelTotal;
  }

  // --- COFOG 04 → infrastructure + agriculture (split on 04.2) ---
  // Also add COFOG 06 to infrastructure
  const cofog04 = byCode.get("04") ?? 0;
  const cofog06 = byCode.get("06") ?? 0;

  if (byCode.has("04.2")) {
    const agri = byCode.get("04.2")!;
    ratios.agriculture = agri / topLevelTotal;
    ratios.infrastructure = (cofog04 - agri + cofog06) / topLevelTotal;
  } else {
    // Fallback: use default split
    ratios.agriculture =
      (cofog04 * DEFAULT_SPLITS["04_agriculture_share"]) / topLevelTotal;
    ratios.infrastructure =
      (cofog04 * (1 - DEFAULT_SPLITS["04_agriculture_share"]) + cofog06) /
      topLevelTotal;
  }

  // --- COFOG 10 → social-security + income-security (split on 10.2) ---
  const cofog10 = byCode.get("10") ?? 0;
  if (byCode.has("10.2")) {
    const oldAge = byCode.get("10.2")!;
    ratios["social-security"] = oldAge / topLevelTotal;
    ratios["income-security"] = (cofog10 - oldAge) / topLevelTotal;
  } else {
    // Fallback: use default split
    ratios["social-security"] =
      (cofog10 * DEFAULT_SPLITS["10_social_security_share"]) / topLevelTotal;
    ratios["income-security"] =
      (cofog10 * (1 - DEFAULT_SPLITS["10_social_security_share"])) /
      topLevelTotal;
  }

  // --- Unmapped categories stay at 0 ---
  // immigration, veterans, international have no COFOG equivalent

  return {
    ratios,
    unmappedCategories: [...UNMAPPED_CATEGORIES],
  };
}
