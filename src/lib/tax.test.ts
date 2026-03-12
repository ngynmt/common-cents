import { describe, it, expect } from "vitest";
import { estimateFederalTax, formatCurrency, formatCurrencyPrecise, formatPercent } from "./tax";

describe("estimateFederalTax — 2024", () => {
  it("returns zero tax for zero income", () => {
    const result = estimateFederalTax(0, "single", 2024);
    expect(result.totalFederalTax).toBe(0);
    expect(result.effectiveRate).toBe(0);
    expect(result.taxableIncome).toBe(0);
  });

  it("returns zero income tax when income is below standard deduction", () => {
    const result = estimateFederalTax(10000, "single", 2024);
    expect(result.federalIncomeTax).toBe(0);
    expect(result.taxableIncome).toBe(0);
    // FICA still applies
    expect(result.socialSecurityTax).toBeGreaterThan(0);
    expect(result.medicareTax).toBeGreaterThan(0);
  });

  it("applies correct standard deduction for each filing status", () => {
    expect(estimateFederalTax(50000, "single", 2024).standardDeduction).toBe(14600);
    expect(estimateFederalTax(50000, "married", 2024).standardDeduction).toBe(29200);
    expect(estimateFederalTax(50000, "head_of_household", 2024).standardDeduction).toBe(21900);
  });

  it("calculates correct taxable income", () => {
    const result = estimateFederalTax(75000, "single", 2024);
    expect(result.taxableIncome).toBe(75000 - 14600);
  });

  // Verified against IRS tax tables for 2024
  it("calculates income tax for a single filer at $75,000", () => {
    // Taxable income: 75000 - 14600 = 60400
    // 10% on first 11600 = 1160
    // 12% on 11600-47150 = 4266
    // 22% on 47150-60400 = 2915
    // Total = 8341
    const result = estimateFederalTax(75000, "single", 2024);
    expect(result.federalIncomeTax).toBe(8341);
  });

  it("calculates income tax for married filing jointly at $150,000", () => {
    // Taxable income: 150000 - 29200 = 120800
    // 10% on first 23200 = 2320
    // 12% on 23200-94300 = 8532
    // 22% on 94300-120800 = 5830
    // Total = 16682
    const result = estimateFederalTax(150000, "married", 2024);
    expect(result.federalIncomeTax).toBe(16682);
  });

  it("caps Social Security tax at 2024 wage base", () => {
    const belowCap = estimateFederalTax(100000, "single", 2024);
    expect(belowCap.socialSecurityTax).toBe(100000 * 0.062);

    const aboveCap = estimateFederalTax(200000, "single", 2024);
    expect(aboveCap.socialSecurityTax).toBe(168600 * 0.062);
  });

  it("applies Medicare surtax above threshold", () => {
    const below = estimateFederalTax(190000, "single", 2024);
    expect(below.medicareTax).toBe(190000 * 0.0145);

    const above = estimateFederalTax(250000, "single", 2024);
    // Base: 250000 * 0.0145 = 3625
    // Surtax: (250000 - 200000) * 0.009 = 450
    expect(above.medicareTax).toBe(3625 + 450);
  });

  it("total tax equals income tax + SS + Medicare", () => {
    const result = estimateFederalTax(100000, "single", 2024);
    expect(result.totalFederalTax).toBe(
      result.federalIncomeTax + result.socialSecurityTax + result.medicareTax
    );
  });

  it("effective rate equals total tax / gross income", () => {
    const result = estimateFederalTax(100000, "single", 2024);
    expect(result.effectiveRate).toBeCloseTo(result.totalFederalTax / 100000, 10);
  });

  it("returns correct marginal rate", () => {
    // Single, taxable income 60400 → 22% bracket
    expect(estimateFederalTax(75000, "single", 2024).marginalRate).toBe(0.22);
    // Single, taxable income 0 → 10% bracket
    expect(estimateFederalTax(10000, "single", 2024).marginalRate).toBe(0.10);
  });

  it("preserves input values in output", () => {
    const result = estimateFederalTax(85000, "married", 2024);
    expect(result.grossIncome).toBe(85000);
    expect(result.filingStatus).toBe("married");
    expect(result.taxYear).toBe(2024);
  });
});

describe("estimateFederalTax — 2025", () => {
  it("defaults to 2025 tax year", () => {
    const result = estimateFederalTax(75000, "single");
    expect(result.taxYear).toBe(2025);
  });

  it("applies 2025 standard deductions", () => {
    expect(estimateFederalTax(50000, "single").standardDeduction).toBe(15000);
    expect(estimateFederalTax(50000, "married").standardDeduction).toBe(30000);
    expect(estimateFederalTax(50000, "head_of_household").standardDeduction).toBe(22500);
  });

  // Verified against IRS 2025 brackets (Rev. Proc. 2024-40)
  it("calculates income tax for a single filer at $75,000", () => {
    // Taxable income: 75000 - 15000 = 60000
    // 10% on first 11925 = 1192.50
    // 12% on 11925-48475 = 4386
    // 22% on 48475-60000 = 2535.50
    // Total = 8114
    const result = estimateFederalTax(75000, "single", 2025);
    expect(result.federalIncomeTax).toBe(8114);
  });

  it("uses 2025 Social Security wage base ($176,100)", () => {
    const aboveCap = estimateFederalTax(200000, "single", 2025);
    expect(aboveCap.socialSecurityTax).toBe(176100 * 0.062);
  });

  it("2025 tax is slightly lower than 2024 for same income (inflation adjustment)", () => {
    const tax2024 = estimateFederalTax(75000, "single", 2024);
    const tax2025 = estimateFederalTax(75000, "single", 2025);
    // Higher deduction + wider brackets → lower income tax
    expect(tax2025.federalIncomeTax).toBeLessThan(tax2024.federalIncomeTax);
    // But higher SS wage base → potentially higher FICA for high earners
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
