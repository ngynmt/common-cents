import { describe, it, expect } from "vitest";
import { estimateFederalTax, formatCurrency, formatCurrencyPrecise, formatPercent } from "./tax";

describe("estimateFederalTax", () => {
  it("returns zero tax for zero income", () => {
    const result = estimateFederalTax(0, "single");
    expect(result.totalFederalTax).toBe(0);
    expect(result.effectiveRate).toBe(0);
    expect(result.taxableIncome).toBe(0);
  });

  it("returns zero income tax when income is below standard deduction", () => {
    const result = estimateFederalTax(10000, "single");
    expect(result.federalIncomeTax).toBe(0);
    expect(result.taxableIncome).toBe(0);
    // FICA still applies
    expect(result.socialSecurityTax).toBeGreaterThan(0);
    expect(result.medicareTax).toBeGreaterThan(0);
  });

  it("applies correct standard deduction for each filing status", () => {
    expect(estimateFederalTax(50000, "single").standardDeduction).toBe(14600);
    expect(estimateFederalTax(50000, "married").standardDeduction).toBe(29200);
    expect(estimateFederalTax(50000, "head_of_household").standardDeduction).toBe(21900);
  });

  it("calculates correct taxable income", () => {
    const result = estimateFederalTax(75000, "single");
    expect(result.taxableIncome).toBe(75000 - 14600);
  });

  // Verified against IRS tax tables for 2024
  it("calculates income tax for a single filer at $75,000", () => {
    // Taxable income: 75000 - 14600 = 60400
    // 10% on first 11600 = 1160
    // 12% on 11600-47150 = 4266
    // 22% on 47150-60400 = 2915
    // Total = 8341
    const result = estimateFederalTax(75000, "single");
    expect(result.federalIncomeTax).toBe(8341);
  });

  it("calculates income tax for married filing jointly at $150,000", () => {
    // Taxable income: 150000 - 29200 = 120800
    // 10% on first 23200 = 2320
    // 12% on 23200-94300 = 8532
    // 22% on 94300-120800 = 5830
    // Total = 16682
    const result = estimateFederalTax(150000, "married");
    expect(result.federalIncomeTax).toBe(16682);
  });

  it("caps Social Security tax at wage base", () => {
    const belowCap = estimateFederalTax(100000, "single");
    expect(belowCap.socialSecurityTax).toBe(100000 * 0.062);

    const aboveCap = estimateFederalTax(200000, "single");
    expect(aboveCap.socialSecurityTax).toBe(168600 * 0.062);
  });

  it("applies Medicare surtax above threshold", () => {
    const below = estimateFederalTax(190000, "single");
    expect(below.medicareTax).toBe(190000 * 0.0145);

    const above = estimateFederalTax(250000, "single");
    // Base: 250000 * 0.0145 = 3625
    // Surtax: (250000 - 200000) * 0.009 = 450
    expect(above.medicareTax).toBe(3625 + 450);
  });

  it("uses correct Medicare surtax threshold for married", () => {
    const result = estimateFederalTax(300000, "married");
    // Base: 300000 * 0.0145 = 4350
    // Surtax: (300000 - 250000) * 0.009 = 450
    expect(result.medicareTax).toBe(4350 + 450);
  });

  it("total tax equals income tax + SS + Medicare", () => {
    const result = estimateFederalTax(100000, "single");
    expect(result.totalFederalTax).toBe(
      result.federalIncomeTax + result.socialSecurityTax + result.medicareTax
    );
  });

  it("effective rate equals total tax / gross income", () => {
    const result = estimateFederalTax(100000, "single");
    expect(result.effectiveRate).toBeCloseTo(result.totalFederalTax / 100000, 10);
  });

  it("returns correct marginal rate", () => {
    // Single, taxable income 60400 → 22% bracket
    expect(estimateFederalTax(75000, "single").marginalRate).toBe(0.22);
    // Single, taxable income 0 → 10% bracket
    expect(estimateFederalTax(10000, "single").marginalRate).toBe(0.10);
  });

  it("preserves input values in output", () => {
    const result = estimateFederalTax(85000, "married");
    expect(result.grossIncome).toBe(85000);
    expect(result.filingStatus).toBe("married");
  });
});

describe("formatCurrency", () => {
  it("formats whole dollars with no cents", () => {
    expect(formatCurrency(1234)).toBe("$1,234");
    expect(formatCurrency(0)).toBe("$0");
    expect(formatCurrency(1000000)).toBe("$1,000,000");
  });

  it("rounds to nearest dollar", () => {
    expect(formatCurrency(1234.56)).toBe("$1,235");
    expect(formatCurrency(1234.49)).toBe("$1,234");
  });
});

describe("formatCurrencyPrecise", () => {
  it("formats with cents", () => {
    expect(formatCurrencyPrecise(1234.56)).toBe("$1,234.56");
    expect(formatCurrencyPrecise(0)).toBe("$0.00");
  });
});

describe("formatPercent", () => {
  it("formats rate as percentage", () => {
    expect(formatPercent(0.221)).toBe("22.1%");
    expect(formatPercent(0.1)).toBe("10.0%");
  });
});
