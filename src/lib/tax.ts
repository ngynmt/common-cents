/**
 * Federal income tax estimation (2024 tax year)
 *
 * Uses standard deduction + marginal tax brackets to estimate
 * federal income tax paid. This is a simplified estimate — it does not
 * account for itemized deductions, credits (beyond standard), AMT,
 * capital gains rates, or self-employment tax.
 *
 * FICA (Social Security + Medicare) is included as a separate line
 * since it's a significant portion of what people pay.
 */

export type FilingStatus = "single" | "married" | "head_of_household";

interface TaxBracket {
  min: number;
  max: number;
  rate: number;
}

const BRACKETS: Record<FilingStatus, TaxBracket[]> = {
  single: [
    { min: 0, max: 11600, rate: 0.10 },
    { min: 11600, max: 47150, rate: 0.12 },
    { min: 47150, max: 100525, rate: 0.22 },
    { min: 100525, max: 191950, rate: 0.24 },
    { min: 191950, max: 243725, rate: 0.32 },
    { min: 243725, max: 609350, rate: 0.35 },
    { min: 609350, max: Infinity, rate: 0.37 },
  ],
  married: [
    { min: 0, max: 23200, rate: 0.10 },
    { min: 23200, max: 94300, rate: 0.12 },
    { min: 94300, max: 201050, rate: 0.22 },
    { min: 201050, max: 383900, rate: 0.24 },
    { min: 383900, max: 487450, rate: 0.32 },
    { min: 487450, max: 731200, rate: 0.35 },
    { min: 731200, max: Infinity, rate: 0.37 },
  ],
  head_of_household: [
    { min: 0, max: 16550, rate: 0.10 },
    { min: 16550, max: 63100, rate: 0.12 },
    { min: 63100, max: 100500, rate: 0.22 },
    { min: 100500, max: 191950, rate: 0.24 },
    { min: 191950, max: 243700, rate: 0.32 },
    { min: 243700, max: 609350, rate: 0.35 },
    { min: 609350, max: Infinity, rate: 0.37 },
  ],
};

const STANDARD_DEDUCTION: Record<FilingStatus, number> = {
  single: 14600,
  married: 29200,
  head_of_household: 21900,
};

// FICA rates (employee share only)
const SOCIAL_SECURITY_RATE = 0.062;
const SOCIAL_SECURITY_WAGE_BASE = 168600; // 2024 cap
const MEDICARE_RATE = 0.0145;
const MEDICARE_SURTAX_RATE = 0.009; // Additional Medicare tax
const MEDICARE_SURTAX_THRESHOLD: Record<FilingStatus, number> = {
  single: 200000,
  married: 250000,
  head_of_household: 200000,
};

export interface TaxEstimate {
  grossIncome: number;
  filingStatus: FilingStatus;
  standardDeduction: number;
  taxableIncome: number;
  federalIncomeTax: number;
  socialSecurityTax: number;
  medicareTax: number;
  totalFederalTax: number;
  effectiveRate: number;
  marginalRate: number;
}

/**
 * Calculate estimated federal income tax using marginal brackets.
 */
function calculateIncomeTax(taxableIncome: number, status: FilingStatus): number {
  const brackets = BRACKETS[status];
  let tax = 0;

  for (const bracket of brackets) {
    if (taxableIncome <= bracket.min) break;
    const taxableInBracket = Math.min(taxableIncome, bracket.max) - bracket.min;
    tax += taxableInBracket * bracket.rate;
  }

  return Math.max(0, tax);
}

/**
 * Get the marginal tax rate for a given taxable income.
 */
function getMarginalRate(taxableIncome: number, status: FilingStatus): number {
  const brackets = BRACKETS[status];
  for (let i = brackets.length - 1; i >= 0; i--) {
    if (taxableIncome > brackets[i].min) {
      return brackets[i].rate;
    }
  }
  return brackets[0].rate;
}

/**
 * Calculate FICA taxes (Social Security + Medicare).
 */
function calculateFICA(
  grossIncome: number,
  status: FilingStatus
): { socialSecurity: number; medicare: number } {
  const socialSecurity = Math.min(grossIncome, SOCIAL_SECURITY_WAGE_BASE) * SOCIAL_SECURITY_RATE;

  let medicare = grossIncome * MEDICARE_RATE;
  const surtaxThreshold = MEDICARE_SURTAX_THRESHOLD[status];
  if (grossIncome > surtaxThreshold) {
    medicare += (grossIncome - surtaxThreshold) * MEDICARE_SURTAX_RATE;
  }

  return { socialSecurity, medicare };
}

/**
 * Estimate total federal taxes for a given income and filing status.
 */
export function estimateFederalTax(
  grossIncome: number,
  filingStatus: FilingStatus
): TaxEstimate {
  const standardDeduction = STANDARD_DEDUCTION[filingStatus];
  const taxableIncome = Math.max(0, grossIncome - standardDeduction);
  const federalIncomeTax = calculateIncomeTax(taxableIncome, filingStatus);
  const marginalRate = getMarginalRate(taxableIncome, filingStatus);
  const fica = calculateFICA(grossIncome, filingStatus);

  const totalFederalTax = federalIncomeTax + fica.socialSecurity + fica.medicare;
  const effectiveRate = grossIncome > 0 ? totalFederalTax / grossIncome : 0;

  return {
    grossIncome,
    filingStatus,
    standardDeduction,
    taxableIncome,
    federalIncomeTax,
    socialSecurityTax: fica.socialSecurity,
    medicareTax: fica.medicare,
    totalFederalTax,
    effectiveRate,
    marginalRate,
  };
}

/**
 * Format a dollar amount for display.
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format a dollar amount with cents for smaller values.
 */
export function formatCurrencyPrecise(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format a percentage for display.
 */
export function formatPercent(rate: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(rate);
}
