import { describe, it, expect, vi } from "vitest";

// Mock useMemo to execute the factory function directly (no React render needed)
vi.mock("react", () => ({
  useMemo: (fn: () => unknown) => fn(),
}));

import {
  getAvailableCountries,
  useInternationalComparison,
  useAllCountriesComparison,
} from "./useInternationalComparison";
import intlData from "@/data/international.json";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSpending(
  items: Array<{ id: string; name: string; amount: number; pct: number }>
) {
  return items.map((i) => ({
    category: { id: i.id, name: i.name, color: `#${i.id.slice(0, 6)}` },
    amount: i.amount,
    percentage: i.pct,
  }));
}

/**
 * Minimal realistic spending that covers mapped, unmapped, and varying amounts.
 * Percentages are arbitrary and intentionally don't sum to 100 — the hook
 * doesn't enforce that.
 */
const MOCK_SPENDING = makeSpending([
  { id: "defense", name: "Defense", amount: 2000, pct: 20 },
  { id: "healthcare", name: "Healthcare", amount: 3000, pct: 30 },
  { id: "education", name: "Education", amount: 1500, pct: 15 },
  { id: "veterans", name: "Veterans", amount: 1000, pct: 10 },
  { id: "immigration", name: "Immigration", amount: 500, pct: 5 },
  { id: "international", name: "International Affairs", amount: 400, pct: 4 },
  { id: "social-security", name: "Social Security", amount: 1600, pct: 16 },
]);

const TOTAL_TAX = 10000;

// ---------------------------------------------------------------------------
// getAvailableCountries
// ---------------------------------------------------------------------------

describe("getAvailableCountries", () => {
  it("returns all 6 countries", () => {
    const countries = getAvailableCountries();
    const codes = countries.map((c) => c.code);

    expect(codes).toContain("GBR");
    expect(codes).toContain("DEU");
    expect(codes).toContain("AUS");
    expect(codes).toContain("JPN");
    expect(codes).toContain("KOR");
    expect(codes).toContain("FRA");
  });

  it("includes hasTaxEstimate flag for each country", () => {
    const countries = getAvailableCountries();
    for (const c of countries) {
      expect(typeof c.hasTaxEstimate).toBe("boolean");
    }
  });

  it("returns country names from the data file", () => {
    const countries = getAvailableCountries();
    const gbr = countries.find((c) => c.code === "GBR");
    expect(gbr?.name).toBe("United Kingdom");
  });
});

// ---------------------------------------------------------------------------
// useInternationalComparison — null cases
// ---------------------------------------------------------------------------

describe("useInternationalComparison", () => {
  it("returns null when countryCode is null", () => {
    const result = useInternationalComparison(
      MOCK_SPENDING,
      TOTAL_TAX,
      null
    );
    expect(result).toBeNull();
  });

  it("returns null for an invalid country code", () => {
    const result = useInternationalComparison(
      MOCK_SPENDING,
      TOTAL_TAX,
      "ZZZZZ"
    );
    expect(result).toBeNull();
  });

  // -------------------------------------------------------------------------
  // "same-amount" mode
  // -------------------------------------------------------------------------
  describe("same-amount mode", () => {
    it("countryTotalAmount equals totalFederalTax", () => {
      const result = useInternationalComparison(
        MOCK_SPENDING,
        TOTAL_TAX,
        "GBR",
        "same-amount"
      );
      expect(result).not.toBeNull();
      expect(result!.countryTotalAmount).toBe(TOTAL_TAX);
    });

    it("redistributes US tax amount by country ratios", () => {
      const result = useInternationalComparison(
        MOCK_SPENDING,
        TOTAL_TAX,
        "GBR",
        "same-amount"
      )!;

      const gbrRatios = intlData.countries.GBR.ratios as Record<string, number>;

      // Check a mapped category: defense
      const defense = result.items.find((i) => i.categoryId === "defense")!;
      expect(defense.countryAmount).toBeCloseTo(
        TOTAL_TAX * gbrRatios["defense"],
        2
      );
      expect(defense.countryPct).toBeCloseTo(gbrRatios["defense"] * 100, 2);
      expect(defense.isUnmapped).toBe(false);
    });

    it("taxEstimate is null in same-amount mode", () => {
      const result = useInternationalComparison(
        MOCK_SPENDING,
        TOTAL_TAX,
        "GBR",
        "same-amount"
      )!;
      expect(result.taxEstimate).toBeNull();
    });

    it("returns correct mode and country metadata", () => {
      const result = useInternationalComparison(
        MOCK_SPENDING,
        TOTAL_TAX,
        "DEU",
        "same-amount"
      )!;
      expect(result.mode).toBe("same-amount");
      expect(result.country.code).toBe("DEU");
      expect(result.country.name).toBe("Germany");
      expect(result.usTotalAmount).toBe(TOTAL_TAX);
      expect(result.dataYear).toBe(intlData.dataYear);
    });
  });

  // -------------------------------------------------------------------------
  // "estimated-tax" mode
  // -------------------------------------------------------------------------
  describe("estimated-tax mode", () => {
    it("countryTotalAmount differs from totalFederalTax", () => {
      const result = useInternationalComparison(
        MOCK_SPENDING,
        TOTAL_TAX,
        "GBR",
        "estimated-tax",
        75000,
        "single"
      )!;

      expect(result).not.toBeNull();
      // The estimated tax for GBR at $75k will not be exactly $10,000
      expect(result.countryTotalAmount).not.toBe(TOTAL_TAX);
    });

    it("taxEstimate is non-null", () => {
      const result = useInternationalComparison(
        MOCK_SPENDING,
        TOTAL_TAX,
        "GBR",
        "estimated-tax",
        75000,
        "single"
      )!;

      expect(result.taxEstimate).not.toBeNull();
      expect(result.taxEstimate!.countryCode).toBe("GBR");
      expect(result.taxEstimate!.totalTaxUsd).toBeGreaterThan(0);
    });

    it("country amounts use estimated tax total, not US tax", () => {
      const result = useInternationalComparison(
        MOCK_SPENDING,
        TOTAL_TAX,
        "GBR",
        "estimated-tax",
        75000,
        "single"
      )!;

      const gbrRatios = intlData.countries.GBR.ratios as Record<string, number>;
      const healthcare = result.items.find(
        (i) => i.categoryId === "healthcare"
      )!;
      expect(healthcare.countryAmount).toBeCloseTo(
        result.countryTotalAmount * gbrRatios["healthcare"],
        2
      );
    });

    it("mode is reported as estimated-tax", () => {
      const result = useInternationalComparison(
        MOCK_SPENDING,
        TOTAL_TAX,
        "DEU",
        "estimated-tax",
        100000,
        "single"
      )!;
      expect(result.mode).toBe("estimated-tax");
    });
  });

  // -------------------------------------------------------------------------
  // Sorting
  // -------------------------------------------------------------------------
  describe("sorting", () => {
    it("items are sorted by usAmount descending", () => {
      const result = useInternationalComparison(
        MOCK_SPENDING,
        TOTAL_TAX,
        "AUS",
        "same-amount"
      )!;

      for (let i = 1; i < result.items.length; i++) {
        expect(result.items[i - 1].usAmount).toBeGreaterThanOrEqual(
          result.items[i].usAmount
        );
      }
    });
  });

  // -------------------------------------------------------------------------
  // Unmapped categories
  // -------------------------------------------------------------------------
  describe("unmapped categories", () => {
    it("unmapped categories have isUnmapped=true and countryAmount=0", () => {
      const result = useInternationalComparison(
        MOCK_SPENDING,
        TOTAL_TAX,
        "GBR",
        "same-amount"
      )!;

      // GBR unmapped: immigration, veterans, international
      const veterans = result.items.find((i) => i.categoryId === "veterans")!;
      expect(veterans.isUnmapped).toBe(true);
      expect(veterans.countryAmount).toBe(0);
      expect(veterans.countryPct).toBe(0);

      const immigration = result.items.find(
        (i) => i.categoryId === "immigration"
      )!;
      expect(immigration.isUnmapped).toBe(true);
      expect(immigration.countryAmount).toBe(0);

      const intl = result.items.find(
        (i) => i.categoryId === "international"
      )!;
      expect(intl.isUnmapped).toBe(true);
      expect(intl.countryAmount).toBe(0);
    });

    it("mapped categories have isUnmapped=false", () => {
      const result = useInternationalComparison(
        MOCK_SPENDING,
        TOTAL_TAX,
        "GBR",
        "same-amount"
      )!;

      const defense = result.items.find((i) => i.categoryId === "defense")!;
      expect(defense.isUnmapped).toBe(false);

      const healthcare = result.items.find(
        (i) => i.categoryId === "healthcare"
      )!;
      expect(healthcare.isUnmapped).toBe(false);
    });

    it("unmappedPct reflects the sum of unmapped category percentages", () => {
      const result = useInternationalComparison(
        MOCK_SPENDING,
        TOTAL_TAX,
        "GBR",
        "same-amount"
      )!;

      // veterans (10%) + immigration (5%) + international (4%) = 19%
      const expectedUnmappedPct = 10 + 5 + 4;
      expect(result.unmappedPct).toBe(expectedUnmappedPct);
    });

    it("unmappedPct is 0 when no categories are unmapped", () => {
      // Create spending with only mapped categories
      const mappedOnly = makeSpending([
        { id: "defense", name: "Defense", amount: 5000, pct: 50 },
        { id: "healthcare", name: "Healthcare", amount: 5000, pct: 50 },
      ]);

      const result = useInternationalComparison(
        mappedOnly,
        TOTAL_TAX,
        "GBR",
        "same-amount"
      )!;

      expect(result.unmappedPct).toBe(0);
    });
  });
});

// ---------------------------------------------------------------------------
// useAllCountriesComparison
// ---------------------------------------------------------------------------

describe("useAllCountriesComparison", () => {
  it("returns empty array when disabled", () => {
    const results = useAllCountriesComparison(
      MOCK_SPENDING,
      TOTAL_TAX,
      false
    );
    expect(results).toEqual([]);
  });

  it("returns comparisons for all available countries when enabled", () => {
    const results = useAllCountriesComparison(
      MOCK_SPENDING,
      TOTAL_TAX,
      true
    );
    const countries = getAvailableCountries();
    expect(results).toHaveLength(countries.length);

    const codes = results.map((r) => r.country.code);
    for (const c of countries) {
      expect(codes).toContain(c.code);
    }
  });

  it("each comparison has the correct structure", () => {
    const results = useAllCountriesComparison(
      MOCK_SPENDING,
      TOTAL_TAX,
      true
    );

    for (const r of results) {
      expect(r.items).toHaveLength(MOCK_SPENDING.length);
      expect(r.usTotalAmount).toBe(TOTAL_TAX);
      expect(r.dataYear).toBe(intlData.dataYear);
      expect(r.mode).toBe("same-amount");
      expect(r.taxEstimate).toBeNull();
    }
  });

  it("same-amount mode uses same total for all countries", () => {
    const results = useAllCountriesComparison(
      MOCK_SPENDING,
      TOTAL_TAX,
      true,
      "same-amount"
    );

    for (const r of results) {
      expect(r.countryTotalAmount).toBe(TOTAL_TAX);
    }
  });

  it("estimated-tax mode produces different totals per country", () => {
    const results = useAllCountriesComparison(
      MOCK_SPENDING,
      TOTAL_TAX,
      true,
      "estimated-tax",
      75000,
      "single"
    );

    // Each country should have a non-null tax estimate
    for (const r of results) {
      expect(r.taxEstimate).not.toBeNull();
      expect(r.countryTotalAmount).toBeGreaterThan(0);
    }

    // Not all countries should produce the exact same tax
    const totals = new Set(results.map((r) => r.countryTotalAmount));
    expect(totals.size).toBeGreaterThan(1);
  });

  it("items are sorted by usAmount descending in each comparison", () => {
    const results = useAllCountriesComparison(
      MOCK_SPENDING,
      TOTAL_TAX,
      true
    );

    for (const r of results) {
      for (let i = 1; i < r.items.length; i++) {
        expect(r.items[i - 1].usAmount).toBeGreaterThanOrEqual(
          r.items[i].usAmount
        );
      }
    }
  });
});
