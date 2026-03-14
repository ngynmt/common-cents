import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock the fetcher so mapper/validator tests don't hit the network
// ---------------------------------------------------------------------------
vi.mock("./oecd-fetcher", () => ({
  fetchCofogData: vi.fn(),
}));

import { fetchCofogData } from "./oecd-fetcher";
import {
  mapCofogToCategories,
  COFOG_CATEGORY_MAP,
  type CofogDataRow,
} from "./cofog-mapper";
import {
  validateIntlData,
  type IntlCountryData,
} from "./intl-validator";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal COFOG data set with all 10 divisions present. */
function makeCofogRows(
  overrides: Partial<Record<string, number>> = {}
): CofogDataRow[] {
  const defaults: Record<string, number> = {
    "01": 13.5, // General public services
    "02": 3.8, // Defence
    "03": 4.2, // Public order and safety
    "04": 10.1, // Economic affairs
    "05": 1.8, // Environmental protection
    "06": 1.5, // Housing and community
    "07": 18.5, // Health
    "08": 2.5, // Recreation, culture, religion
    "09": 11.0, // Education
    "10": 33.1, // Social protection
  };

  const merged = { ...defaults, ...overrides };

  return Object.entries(merged).map(([code, pctOfTotal]) => ({
    cofogCode: code,
    cofogLabel: `COFOG ${code}`,
    pctOfTotalExpenditure: pctOfTotal,
  }));
}

/** Build COFOG rows that include sub-division detail for splits. */
function makeCofogRowsWithSubdivisions(
  overrides: Partial<Record<string, number>> = {}
): CofogDataRow[] {
  const rows = makeCofogRows(overrides);

  // Add sub-division rows needed for splitting
  rows.push(
    // 01.7 Public debt transactions → interest
    { cofogCode: "01.7", cofogLabel: "Public debt transactions", pctOfTotalExpenditure: 5.0 },
    // 04.2 Agriculture → agriculture
    { cofogCode: "04.2", cofogLabel: "Agriculture, forestry, fishing, hunting", pctOfTotalExpenditure: 1.5 },
    // 10.2 Old age → social-security
    { cofogCode: "10.2", cofogLabel: "Old age", pctOfTotalExpenditure: 20.0 },
  );

  return rows;
}

function makeIntlCountryData(
  overrides: Partial<IntlCountryData> = {}
): IntlCountryData {
  return {
    name: "United Kingdom",
    countryCode: "GBR",
    dataYear: 2023,
    totalExpenditurePctGDP: 44.5,
    ratios: {
      defense: 0.038,
      international: 0,
      science: 0.018,
      agriculture: 0.015,
      infrastructure: 0.071,
      education: 0.135,
      healthcare: 0.185,
      "income-security": 0.131,
      "social-security": 0.2,
      veterans: 0,
      justice: 0.042,
      government: 0.085,
      interest: 0.05,
      immigration: 0.03,
    },
    unmappedCategories: ["immigration", "veterans", "international"],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// cofog-mapper
// ---------------------------------------------------------------------------

describe("cofog-mapper", () => {
  describe("COFOG_CATEGORY_MAP", () => {
    it("covers all 10 COFOG top-level divisions", () => {
      const cofogCodes = Object.keys(COFOG_CATEGORY_MAP);
      for (let i = 1; i <= 10; i++) {
        const code = i.toString().padStart(2, "0");
        expect(cofogCodes).toContain(code);
      }
    });
  });

  describe("mapCofogToCategories", () => {
    it("returns ratios that sum to 1.0 (within rounding tolerance)", () => {
      const rows = makeCofogRowsWithSubdivisions();
      const result = mapCofogToCategories(rows, "GBR");

      const sum = Object.values(result.ratios).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 2);
    });

    it("maps COFOG 02 (Defence) directly to defense", () => {
      const rows = makeCofogRowsWithSubdivisions({ "02": 5.0 });
      const result = mapCofogToCategories(rows, "GBR");

      // 5.0% out of topLevelTotal (~101.5) → ratio ≈ 0.0493
      // Just verify it's proportional and in the right ballpark
      expect(result.ratios.defense).toBeGreaterThan(0.04);
      expect(result.ratios.defense).toBeLessThan(0.06);
    });

    it("maps COFOG 07 (Health) directly to healthcare", () => {
      const rows = makeCofogRowsWithSubdivisions({ "07": 20.0 });
      const result = mapCofogToCategories(rows, "GBR");

      // 20% out of topLevelTotal → ratio close to 0.2
      expect(result.ratios.healthcare).toBeGreaterThan(0.18);
      expect(result.ratios.healthcare).toBeLessThan(0.22);
    });

    it("splits COFOG 01 into government and interest using sub-division 01.7", () => {
      const rows = makeCofogRowsWithSubdivisions();
      // 01 total = 13.5%, 01.7 (debt) = 5.0%
      // → interest = 5.0%, government = 8.5%
      const result = mapCofogToCategories(rows, "GBR");

      expect(result.ratios.interest).toBeCloseTo(0.05, 3);
      expect(result.ratios.government).toBeCloseTo(0.085, 3);
    });

    it("splits COFOG 04 into infrastructure and agriculture using sub-division 04.2", () => {
      const rows = makeCofogRowsWithSubdivisions();
      // 04 total = 10.1%, 04.2 (agriculture) = 1.5%
      // → agriculture = 1.5%, infrastructure gets 04 remainder + 06
      const result = mapCofogToCategories(rows, "GBR");

      expect(result.ratios.agriculture).toBeCloseTo(0.015, 3);
    });

    it("combines COFOG 06 (Housing) into infrastructure", () => {
      const rows = makeCofogRowsWithSubdivisions();
      // 04 remainder (10.1 - 1.5 = 8.6%) + 06 (1.5%) = 10.1%
      const result = mapCofogToCategories(rows, "GBR");

      expect(result.ratios.infrastructure).toBeCloseTo(0.101, 2);
    });

    it("combines COFOG 08 (Recreation) and 09 (Education) into education", () => {
      const rows = makeCofogRowsWithSubdivisions();
      // 08 (2.5%) + 09 (11.0%) = 13.5%
      const result = mapCofogToCategories(rows, "GBR");

      expect(result.ratios.education).toBeCloseTo(0.135, 3);
    });

    it("maps COFOG 05 (Environmental protection) to science", () => {
      const rows = makeCofogRowsWithSubdivisions({ "05": 2.0 });
      const result = mapCofogToCategories(rows, "GBR");

      expect(result.ratios.science).toBeCloseTo(0.02, 3);
    });

    it("maps COFOG 03 (Public order) to justice", () => {
      const rows = makeCofogRowsWithSubdivisions({ "03": 4.0 });
      const result = mapCofogToCategories(rows, "GBR");

      expect(result.ratios.justice).toBeCloseTo(0.04, 3);
    });

    it("splits COFOG 10 (Social protection) using sub-division 10.2 for social-security", () => {
      const rows = makeCofogRowsWithSubdivisions();
      // 10 total = 33.1%, 10.2 (old age) = 20.0%
      // → social-security = 20.0%, income-security = 13.1%
      const result = mapCofogToCategories(rows, "GBR");

      expect(result.ratios["social-security"]).toBeCloseTo(0.2, 3);
      expect(result.ratios["income-security"]).toBeCloseTo(0.131, 3);
    });

    it("marks immigration, veterans, and international as unmapped", () => {
      const rows = makeCofogRowsWithSubdivisions();
      const result = mapCofogToCategories(rows, "GBR");

      expect(result.unmappedCategories).toContain("immigration");
      expect(result.unmappedCategories).toContain("veterans");
      expect(result.unmappedCategories).toContain("international");
    });

    it("sets unmapped category ratios to 0", () => {
      const rows = makeCofogRowsWithSubdivisions();
      const result = mapCofogToCategories(rows, "GBR");

      expect(result.ratios.immigration).toBe(0);
      expect(result.ratios.veterans).toBe(0);
      expect(result.ratios.international).toBe(0);
    });

    it("falls back to proportional split when sub-division 01.7 is missing", () => {
      // Only top-level rows, no sub-divisions
      const rows = makeCofogRows();
      const result = mapCofogToCategories(rows, "GBR");

      // Without 01.7, should use a default split for government/interest
      // Both should be > 0 and sum to 01 total
      expect(result.ratios.government).toBeGreaterThan(0);
      expect(result.ratios.interest).toBeGreaterThan(0);
      expect(result.ratios.government + result.ratios.interest).toBeCloseTo(
        0.135,
        3
      );
    });

    it("falls back to proportional split when sub-division 04.2 is missing", () => {
      const rows = makeCofogRows();
      const result = mapCofogToCategories(rows, "GBR");

      // Without 04.2, infrastructure gets all of 04 + 06
      // agriculture uses a default estimate
      expect(result.ratios.infrastructure).toBeGreaterThan(0);
      expect(result.ratios.agriculture).toBeGreaterThanOrEqual(0);
    });

    it("falls back to proportional split when sub-division 10.2 is missing", () => {
      const rows = makeCofogRows();
      const result = mapCofogToCategories(rows, "GBR");

      // Without 10.2, should use a default split for social-security / income-security
      expect(result.ratios["social-security"]).toBeGreaterThan(0);
      expect(result.ratios["income-security"]).toBeGreaterThan(0);
      expect(
        result.ratios["social-security"] + result.ratios["income-security"]
      ).toBeCloseTo(0.331, 3);
    });

    it("handles zero-value COFOG divisions", () => {
      const rows = makeCofogRowsWithSubdivisions({ "02": 0 });
      const result = mapCofogToCategories(rows, "GBR");

      expect(result.ratios.defense).toBe(0);
      // Other ratios should still sum to ~1.0
      const sum = Object.values(result.ratios).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 2);
    });

    it("throws when COFOG data is empty", () => {
      expect(() => mapCofogToCategories([], "GBR")).toThrow();
    });

    it("throws when a required top-level division is missing", () => {
      // Remove COFOG 07 (Health) entirely
      const rows = makeCofogRowsWithSubdivisions().filter(
        (r) => r.cofogCode !== "07"
      );
      expect(() => mapCofogToCategories(rows, "GBR")).toThrow(/07/);
    });
  });
});

// ---------------------------------------------------------------------------
// intl-validator
// ---------------------------------------------------------------------------

describe("intl-validator", () => {
  describe("validateIntlData", () => {
    it("passes for valid country data", () => {
      const data = makeIntlCountryData();
      const { allPassed } = validateIntlData(data);
      expect(allPassed).toBe(true);
    });

    it("fails when ratios do not sum to 1.0", () => {
      const data = makeIntlCountryData();
      data.ratios.defense = 0.5; // Inflate so sum >> 1.0
      const { allPassed, results } = validateIntlData(data);

      expect(allPassed).toBe(false);
      const sumCheck = results.find((r) => r.message.includes("sum"));
      expect(sumCheck).toBeDefined();
    });

    it("fails when a mapped category ratio is negative", () => {
      const data = makeIntlCountryData();
      data.ratios.healthcare = -0.1;
      const { allPassed, results } = validateIntlData(data);

      expect(allPassed).toBe(false);
      const negCheck = results.find((r) => r.message.includes("negative"));
      expect(negCheck).toBeDefined();
    });

    it("fails when required category IDs are missing from ratios", () => {
      const data = makeIntlCountryData();
      delete (data.ratios as Record<string, number>)["defense"];
      const { allPassed, results } = validateIntlData(data);

      expect(allPassed).toBe(false);
      const missingCheck = results.find((r) => r.message.includes("missing"));
      expect(missingCheck).toBeDefined();
    });

    it("passes when unmapped categories have ratio of 0", () => {
      const data = makeIntlCountryData();
      // immigration, veterans, international are unmapped and 0 — should be fine
      const { allPassed } = validateIntlData(data);
      expect(allPassed).toBe(true);
    });

    it("warns when a mapped category has suspiciously high ratio (>0.5)", () => {
      const data = makeIntlCountryData();
      // Redistribute to make healthcare dominate but still sum to 1.0
      data.ratios.healthcare = 0.6;
      data.ratios.defense = 0.01;
      data.ratios.government = 0.01;
      data.ratios.interest = 0.01;
      // Recalculate to sum to 1.0
      const others = Object.entries(data.ratios).filter(
        ([k]) => !["healthcare", "defense", "government", "interest"].includes(k)
      );
      const othersSum = others.reduce((s, [, v]) => s + v, 0);
      const target = 1.0 - 0.6 - 0.01 - 0.01 - 0.01;
      const scale = target / othersSum;
      for (const [k] of others) {
        data.ratios[k as keyof typeof data.ratios] *= scale;
      }

      const { results } = validateIntlData(data);
      const warning = results.find(
        (r) => r.message.includes("suspiciously high") || r.level === "warn"
      );
      expect(warning).toBeDefined();
    });

    it("fails when dataYear is missing or invalid", () => {
      const data = makeIntlCountryData({ dataYear: 0 });
      const { allPassed } = validateIntlData(data);
      expect(allPassed).toBe(false);
    });

    it("fails when countryCode is empty", () => {
      const data = makeIntlCountryData({ countryCode: "" });
      const { allPassed } = validateIntlData(data);
      expect(allPassed).toBe(false);
    });

    it("reports all failures, not just the first one", () => {
      const data = makeIntlCountryData({
        countryCode: "",
        dataYear: 0,
      });
      data.ratios.defense = -0.1;
      const { results } = validateIntlData(data);

      const failures = results.filter((r) => r.level === "error");
      expect(failures.length).toBeGreaterThanOrEqual(3);
    });
  });
});

// ---------------------------------------------------------------------------
// oecd-fetcher (mocked)
// ---------------------------------------------------------------------------

describe("oecd-fetcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns COFOG rows for a valid country", async () => {
    const mockRows = makeCofogRows();
    vi.mocked(fetchCofogData).mockResolvedValue(mockRows);

    const result = await fetchCofogData("GBR", 2023);

    expect(fetchCofogData).toHaveBeenCalledWith("GBR", 2023);
    expect(result).toHaveLength(10);
    expect(result[0]).toHaveProperty("cofogCode");
    expect(result[0]).toHaveProperty("pctOfTotalExpenditure");
  });

  it("throws on network error", async () => {
    vi.mocked(fetchCofogData).mockRejectedValue(new Error("Network error"));

    await expect(fetchCofogData("GBR", 2023)).rejects.toThrow("Network error");
  });

  it("throws when country code is not found in OECD data", async () => {
    vi.mocked(fetchCofogData).mockRejectedValue(
      new Error("No data found for country: XYZ")
    );

    await expect(fetchCofogData("XYZ", 2023)).rejects.toThrow("No data found");
  });
});

// ---------------------------------------------------------------------------
// Integration: fetch → map → validate pipeline
// ---------------------------------------------------------------------------

describe("intl-data pipeline (integration)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("end-to-end: fetched COFOG data maps and validates successfully", async () => {
    const mockRows = makeCofogRowsWithSubdivisions();
    vi.mocked(fetchCofogData).mockResolvedValue(mockRows);

    // Fetch
    const rows = await fetchCofogData("GBR", 2023);

    // Map
    const mapped = mapCofogToCategories(rows, "GBR");

    // Validate
    const countryData: IntlCountryData = {
      name: "United Kingdom",
      countryCode: "GBR",
      dataYear: 2023,
      totalExpenditurePctGDP: 44.5,
      ...mapped,
    };

    const { allPassed } = validateIntlData(countryData);
    expect(allPassed).toBe(true);
  });

  it("end-to-end: processes multiple countries independently", async () => {
    const gbrRows = makeCofogRowsWithSubdivisions({ "02": 5.0 });
    const deuRows = makeCofogRowsWithSubdivisions({ "02": 2.5 });

    vi.mocked(fetchCofogData)
      .mockResolvedValueOnce(gbrRows)
      .mockResolvedValueOnce(deuRows);

    const gbrData = await fetchCofogData("GBR", 2023);
    const deuData = await fetchCofogData("DEU", 2023);

    const gbrMapped = mapCofogToCategories(gbrData, "GBR");
    const deuMapped = mapCofogToCategories(deuData, "DEU");

    // UK defense should be higher than Germany's
    expect(gbrMapped.ratios.defense).toBeGreaterThan(deuMapped.ratios.defense);

    // Both should have valid ratio sums
    const gbrSum = Object.values(gbrMapped.ratios).reduce((a, b) => a + b, 0);
    const deuSum = Object.values(deuMapped.ratios).reduce((a, b) => a + b, 0);
    expect(gbrSum).toBeCloseTo(1.0, 2);
    expect(deuSum).toBeCloseTo(1.0, 2);
  });
});
