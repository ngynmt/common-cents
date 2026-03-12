/**
 * Federal income tax estimation (2024 & 2025 tax years)
 *
 * Uses standard deduction + marginal tax brackets to estimate
 * federal income tax paid. This is a simplified estimate — it does not
 * account for itemized deductions, credits (beyond standard), AMT,
 * capital gains rates, or self-employment tax.
 *
 * FICA (Social Security + Medicare) is included as a separate line
 * since it's a significant portion of what people pay.
 *
 * 2025 brackets from IRS Rev. Proc. 2024-40.
 */

export type FilingStatus = "single" | "married" | "head_of_household";
export type TaxYear = 2024 | 2025;

interface TaxBracket {
  min: number;
  max: number;
  rate: number;
}

interface TaxYearConfig {
  brackets: Record<FilingStatus, TaxBracket[]>;
  standardDeduction: Record<FilingStatus, number>;
  socialSecurityWageBase: number;
}

const TAX_YEAR_CONFIG: Record<TaxYear, TaxYearConfig> = {
  2024: {
    brackets: {
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
    },
    standardDeduction: {
      single: 14600,
      married: 29200,
      head_of_household: 21900,
    },
    socialSecurityWageBase: 168600,
  },
  2025: {
    brackets: {
      single: [
        { min: 0, max: 11925, rate: 0.10 },
        { min: 11925, max: 48475, rate: 0.12 },
        { min: 48475, max: 103350, rate: 0.22 },
        { min: 103350, max: 197300, rate: 0.24 },
        { min: 197300, max: 250525, rate: 0.32 },
        { min: 250525, max: 626350, rate: 0.35 },
        { min: 626350, max: Infinity, rate: 0.37 },
      ],
      married: [
        { min: 0, max: 23850, rate: 0.10 },
        { min: 23850, max: 96950, rate: 0.12 },
        { min: 96950, max: 206700, rate: 0.22 },
        { min: 206700, max: 394600, rate: 0.24 },
        { min: 394600, max: 501050, rate: 0.32 },
        { min: 501050, max: 751600, rate: 0.35 },
        { min: 751600, max: Infinity, rate: 0.37 },
      ],
      head_of_household: [
        { min: 0, max: 17000, rate: 0.10 },
        { min: 17000, max: 64850, rate: 0.12 },
        { min: 64850, max: 103350, rate: 0.22 },
        { min: 103350, max: 197300, rate: 0.24 },
        { min: 197300, max: 250500, rate: 0.32 },
        { min: 250500, max: 626350, rate: 0.35 },
        { min: 626350, max: Infinity, rate: 0.37 },
      ],
    },
    standardDeduction: {
      single: 15000,
      married: 30000,
      head_of_household: 22500,
    },
    socialSecurityWageBase: 176100,
  },
};

// FICA rates (employee share only) — unchanged between 2024 and 2025
const SOCIAL_SECURITY_RATE = 0.062;
const MEDICARE_RATE = 0.0145;
const MEDICARE_SURTAX_RATE = 0.009;
const MEDICARE_SURTAX_THRESHOLD: Record<FilingStatus, number> = {
  single: 200000,
  married: 250000,
  head_of_household: 200000,
};

export interface TaxEstimate {
  grossIncome: number;
  filingStatus: FilingStatus;
  taxYear: TaxYear;
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
function calculateIncomeTax(taxableIncome: number, brackets: TaxBracket[]): number {
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
function getMarginalRate(taxableIncome: number, brackets: TaxBracket[]): number {
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
  status: FilingStatus,
  ssWageBase: number,
): { socialSecurity: number; medicare: number } {
  const socialSecurity = Math.min(grossIncome, ssWageBase) * SOCIAL_SECURITY_RATE;

  let medicare = grossIncome * MEDICARE_RATE;
  const surtaxThreshold = MEDICARE_SURTAX_THRESHOLD[status];
  if (grossIncome > surtaxThreshold) {
    medicare += (grossIncome - surtaxThreshold) * MEDICARE_SURTAX_RATE;
  }

  return { socialSecurity, medicare };
}

/**
 * Estimate total federal taxes for a given income, filing status, and tax year.
 * Defaults to 2025 (current tax year).
 */
export function estimateFederalTax(
  grossIncome: number,
  filingStatus: FilingStatus,
  taxYear: TaxYear = 2025,
): TaxEstimate {
  const config = TAX_YEAR_CONFIG[taxYear];
  const standardDeduction = config.standardDeduction[filingStatus];
  const taxableIncome = Math.max(0, grossIncome - standardDeduction);
  const brackets = config.brackets[filingStatus];
  const federalIncomeTax = calculateIncomeTax(taxableIncome, brackets);
  const marginalRate = getMarginalRate(taxableIncome, brackets);
  const fica = calculateFICA(grossIncome, filingStatus, config.socialSecurityWageBase);

  const totalFederalTax = federalIncomeTax + fica.socialSecurity + fica.medicare;
  const effectiveRate = grossIncome > 0 ? totalFederalTax / grossIncome : 0;

  return {
    grossIncome,
    filingStatus,
    taxYear,
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
