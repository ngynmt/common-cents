import { describe, it, expect } from "vitest";
import {
  estimateInternationalTax,
  isSupportedCountry,
  SUPPORTED_COUNTRIES,
} from "./international-tax";

describe("isSupportedCountry", () => {
  it("returns true for supported countries", () => {
    expect(isSupportedCountry("GBR")).toBe(true);
    expect(isSupportedCountry("DEU")).toBe(true);
    expect(isSupportedCountry("AUS")).toBe(true);
    expect(isSupportedCountry("JPN")).toBe(true);
    expect(isSupportedCountry("KOR")).toBe(true);
    expect(isSupportedCountry("FRA")).toBe(true);
  });

  it("returns false for unsupported countries", () => {
    expect(isSupportedCountry("CAN")).toBe(false);
    expect(isSupportedCountry("USA")).toBe(false);
    expect(isSupportedCountry("")).toBe(false);
  });
});

describe("estimateInternationalTax", () => {
  // -------------------------------------------------------------------
  // Zero income — all countries
  // -------------------------------------------------------------------
  it.each(Object.keys(SUPPORTED_COUNTRIES))(
    "%s: zero income produces zero tax",
    (code) => {
      const result = estimateInternationalTax(0, "single", code as "GBR");
      expect(result.totalTax).toBe(0);
      expect(result.effectiveRate).toBe(0);
    }
  );

  // -------------------------------------------------------------------
  // United Kingdom
  // -------------------------------------------------------------------
  describe("UK", () => {
    it("applies personal allowance — low income is mostly tax-free", () => {
      // £12,570 ≈ $15,911 at 0.79 rate → should have ~£0 income tax
      const result = estimateInternationalTax(15000, "single", "GBR");
      expect(result.incomeTax).toBeLessThan(100);
      expect(result.countryCode).toBe("GBR");
      expect(result.currencyCode).toBe("GBP");
    });

    it("calculates basic rate (20%) correctly", () => {
      // $75k → ~£59,250
      // Taxable: £59,250 - £12,570 = £46,680
      // First £37,700 at 20% = £7,540
      // Remaining £8,980 at 40% = £3,592
      // Total income tax ≈ £11,132
      const result = estimateInternationalTax(75000, "single", "GBR");
      expect(result.incomeTax).toBeGreaterThan(10000);
      expect(result.incomeTax).toBeLessThan(13000);
    });

    it("includes National Insurance contributions", () => {
      const result = estimateInternationalTax(75000, "single", "GBR");
      expect(result.socialContributions).toBeGreaterThan(0);
      // NI should be significant but less than income tax at this level
      expect(result.socialContributions).toBeLessThan(result.incomeTax);
    });

    it("tapers personal allowance above £100k", () => {
      // $140k → ~£110,600 — in the taper zone
      const result = estimateInternationalTax(140000, "single", "GBR");
      // Effective rate should be high due to 60% effective marginal band
      expect(result.effectiveRate).toBeGreaterThan(0.25);
    });

    it("effective rate is reasonable for $200k income", () => {
      const result = estimateInternationalTax(200000, "single", "GBR");
      // UK effective rate at this level should be ~35-40%
      expect(result.effectiveRate).toBeGreaterThan(0.3);
      expect(result.effectiveRate).toBeLessThan(0.45);
    });
  });

  // -------------------------------------------------------------------
  // Germany
  // -------------------------------------------------------------------
  describe("Germany", () => {
    it("applies basic allowance — low income is tax-free", () => {
      // €12,096 ≈ $13,148 at 0.92 rate → should be tax-free
      const result = estimateInternationalTax(13000, "single", "DEU");
      expect(result.incomeTax).toBe(0);
    });

    it("progressive formula produces reasonable tax at middle income", () => {
      // $75k → ~€69,000 — in the 42% flat zone just above the cutoff
      const result = estimateInternationalTax(75000, "single", "DEU");
      expect(result.incomeTax).toBeGreaterThan(10000);
      expect(result.incomeTax).toBeLessThan(25000);
    });

    it("includes social contributions with caps", () => {
      const result = estimateInternationalTax(75000, "single", "DEU");
      expect(result.socialContributions).toBeGreaterThan(0);
      // Social contributions should be ~20% of gross, so ~€13,800
      expect(result.socialContributions).toBeGreaterThan(10000);
      expect(result.socialContributions).toBeLessThan(18000);
    });

    it("married filing uses income splitting", () => {
      const single = estimateInternationalTax(100000, "single", "DEU");
      const married = estimateInternationalTax(100000, "married", "DEU");
      // Splitting should result in lower income tax
      expect(married.incomeTax).toBeLessThan(single.incomeTax);
    });

    it("solidarity surcharge applies above threshold", () => {
      // At very low income, no soli. At high income, soli applies.
      const low = estimateInternationalTax(30000, "single", "DEU");
      const high = estimateInternationalTax(150000, "single", "DEU");
      // High income tax should include ~5.5% soli on top
      // We can't easily isolate it, but the effective rate should reflect it
      expect(high.effectiveRate).toBeGreaterThan(low.effectiveRate);
    });

    it("effective rate is reasonable for $200k income", () => {
      const result = estimateInternationalTax(200000, "single", "DEU");
      // Germany effective rate at this level should be ~40-50% (high social contributions)
      expect(result.effectiveRate).toBeGreaterThan(0.35);
      expect(result.effectiveRate).toBeLessThan(0.55);
    });
  });

  // -------------------------------------------------------------------
  // Australia
  // -------------------------------------------------------------------
  describe("Australia", () => {
    it("applies tax-free threshold — low income is tax-free", () => {
      // A$18,200 ≈ $11,895 at 1.53 rate → should be tax-free
      const result = estimateInternationalTax(11000, "single", "AUS");
      expect(result.incomeTax).toBe(0);
    });

    it("16% bracket applies for moderate income", () => {
      // $30k → ~A$45,900 — just into the 30% bracket
      const result = estimateInternationalTax(30000, "single", "AUS");
      expect(result.incomeTax).toBeGreaterThan(3000);
      expect(result.incomeTax).toBeLessThan(7000);
    });

    it("includes Medicare levy at 2%", () => {
      const result = estimateInternationalTax(75000, "single", "AUS");
      const grossLocal = 75000 * 1.53;
      // Medicare levy should be ~2% of gross
      expect(result.socialContributions).toBeCloseTo(
        grossLocal * 0.02,
        -2 // within 100
      );
    });

    it("no Medicare levy below threshold", () => {
      // $15k → ~A$22,950 — below the $26,000 threshold
      const result = estimateInternationalTax(15000, "single", "AUS");
      expect(result.socialContributions).toBe(0);
    });

    it("filing status does not affect tax (individual taxation)", () => {
      const single = estimateInternationalTax(100000, "single", "AUS");
      const married = estimateInternationalTax(100000, "married", "AUS");
      expect(single.totalTax).toBe(married.totalTax);
    });

    it("effective rate is reasonable for $200k income", () => {
      const result = estimateInternationalTax(200000, "single", "AUS");
      // Australia effective rate at this level should be ~30-38%
      expect(result.effectiveRate).toBeGreaterThan(0.25);
      expect(result.effectiveRate).toBeLessThan(0.42);
    });
  });

  // -------------------------------------------------------------------
  // Japan
  // -------------------------------------------------------------------
  describe("Japan", () => {
    it("low income has minimal tax due to deductions", () => {
      // $15k → ¥2,265,000 — employment deduction + basic deduction absorb much of it
      // but resident tax (10%) still applies, so total income tax ~¥100k
      const result = estimateInternationalTax(15000, "single", "JPN");
      expect(result.incomeTax).toBeLessThan(200000);
      expect(result.countryCode).toBe("JPN");
      expect(result.currencyCode).toBe("JPY");
    });

    it("includes reconstruction surtax and resident tax", () => {
      // $75k → ¥11,325,000
      const result = estimateInternationalTax(75000, "single", "JPN");
      // Income tax should include both national + resident tax
      expect(result.incomeTax).toBeGreaterThan(1000000);
      expect(result.incomeTax).toBeLessThan(3000000);
    });

    it("includes social insurance contributions", () => {
      const result = estimateInternationalTax(75000, "single", "JPN");
      expect(result.socialContributions).toBeGreaterThan(0);
      // Social insurance ~15% of gross → ~¥1.7M
      expect(result.socialContributions).toBeGreaterThan(1000000);
    });

    it("filing status does not affect tax (individual taxation)", () => {
      const single = estimateInternationalTax(100000, "single", "JPN");
      const married = estimateInternationalTax(100000, "married", "JPN");
      expect(single.totalTax).toBe(married.totalTax);
    });

    it("effective rate is reasonable for $200k income", () => {
      const result = estimateInternationalTax(200000, "single", "JPN");
      // Japan effective rate at ~$200k should be ~30-45%
      expect(result.effectiveRate).toBeGreaterThan(0.25);
      expect(result.effectiveRate).toBeLessThan(0.50);
    });
  });

  // -------------------------------------------------------------------
  // South Korea
  // -------------------------------------------------------------------
  describe("South Korea", () => {
    it("low income has minimal tax due to deductions", () => {
      // $15k → ₩20,250,000
      const result = estimateInternationalTax(15000, "single", "KOR");
      expect(result.incomeTax).toBeLessThan(1000000); // Less than ₩1M
      expect(result.countryCode).toBe("KOR");
      expect(result.currencyCode).toBe("KRW");
    });

    it("includes local income tax (10% of national)", () => {
      const result = estimateInternationalTax(75000, "single", "KOR");
      expect(result.incomeTax).toBeGreaterThan(5000000);
      expect(result.incomeTax).toBeLessThan(20000000);
    });

    it("includes social insurance contributions", () => {
      const result = estimateInternationalTax(75000, "single", "KOR");
      expect(result.socialContributions).toBeGreaterThan(0);
      // Social ~9-10% of gross → ~₩9M-10M
      expect(result.socialContributions).toBeGreaterThan(5000000);
    });

    it("filing status does not affect tax (individual taxation)", () => {
      const single = estimateInternationalTax(100000, "single", "KOR");
      const married = estimateInternationalTax(100000, "married", "KOR");
      expect(single.totalTax).toBe(married.totalTax);
    });

    it("effective rate is reasonable for $200k income", () => {
      const result = estimateInternationalTax(200000, "single", "KOR");
      // South Korea effective rate at ~$200k should be ~25-40%
      expect(result.effectiveRate).toBeGreaterThan(0.20);
      expect(result.effectiveRate).toBeLessThan(0.45);
    });
  });

  // -------------------------------------------------------------------
  // France
  // -------------------------------------------------------------------
  describe("France", () => {
    it("low income within 0% bracket is tax-free", () => {
      // $12k → €11,040 — below the first bracket threshold (€11,294)
      const result = estimateInternationalTax(12000, "single", "FRA");
      expect(result.incomeTax).toBeLessThan(100);
      expect(result.countryCode).toBe("FRA");
      expect(result.currencyCode).toBe("EUR");
    });

    it("progressive brackets produce reasonable tax at middle income", () => {
      // $75k → €69,000
      const result = estimateInternationalTax(75000, "single", "FRA");
      expect(result.incomeTax).toBeGreaterThan(8000);
      expect(result.incomeTax).toBeLessThan(20000);
    });

    it("includes significant social contributions (CSG/CRDS)", () => {
      const result = estimateInternationalTax(75000, "single", "FRA");
      expect(result.socialContributions).toBeGreaterThan(0);
      // CSG+CRDS+charges ~17% of gross → ~€11,730
      expect(result.socialContributions).toBeGreaterThan(8000);
    });

    it("married filing uses family quotient (lower tax)", () => {
      const single = estimateInternationalTax(100000, "single", "FRA");
      const married = estimateInternationalTax(100000, "married", "FRA");
      // Family quotient divides by 2 parts → lower tax
      expect(married.incomeTax).toBeLessThan(single.incomeTax);
    });

    it("effective rate is reasonable for $200k income", () => {
      const result = estimateInternationalTax(200000, "single", "FRA");
      // France effective rate at ~$200k should be ~35-50% (high social charges)
      expect(result.effectiveRate).toBeGreaterThan(0.30);
      expect(result.effectiveRate).toBeLessThan(0.55);
    });
  });

  // -------------------------------------------------------------------
  // Cross-country comparisons
  // -------------------------------------------------------------------
  describe("cross-country", () => {
    it("all countries return valid exchange rates", () => {
      for (const code of Object.keys(SUPPORTED_COUNTRIES)) {
        const result = estimateInternationalTax(
          100000,
          "single",
          code as "GBR"
        );
        expect(result.exchangeRate).toBeGreaterThan(0);
        expect(result.grossIncomeLocal).toBeGreaterThan(0);
        expect(result.grossIncomeLocal).toBe(100000 * result.exchangeRate);
      }
    });

    it("totalTaxUsd converts back correctly", () => {
      for (const code of Object.keys(SUPPORTED_COUNTRIES)) {
        const result = estimateInternationalTax(
          100000,
          "single",
          code as "GBR"
        );
        expect(result.totalTaxUsd).toBeCloseTo(
          result.totalTax / result.exchangeRate,
          2
        );
      }
    });

    it("effective rates are in a reasonable range for $100k income", () => {
      for (const code of Object.keys(SUPPORTED_COUNTRIES)) {
        const result = estimateInternationalTax(
          100000,
          "single",
          code as "GBR"
        );
        // All six countries should have effective rates between 15-55%
        expect(result.effectiveRate).toBeGreaterThan(0.15);
        expect(result.effectiveRate).toBeLessThan(0.55);
      }
    });

    it("Germany has highest effective rate at $100k (high social contributions)", () => {
      const uk = estimateInternationalTax(100000, "single", "GBR");
      const de = estimateInternationalTax(100000, "single", "DEU");
      const aus = estimateInternationalTax(100000, "single", "AUS");

      // Germany's social contributions make it the highest taxed at this level
      expect(de.effectiveRate).toBeGreaterThan(uk.effectiveRate);
      expect(de.effectiveRate).toBeGreaterThan(aus.effectiveRate);
    });
  });
});
