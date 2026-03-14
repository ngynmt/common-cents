/**
 * International tax estimation for Phase 2 comparison.
 *
 * Estimates what a person would pay in income tax + social contributions
 * in the UK, Germany, Australia, Japan, South Korea, or France given
 * their gross income in USD.
 *
 * All calculations use individual/single filing. Married filing is
 * approximated where applicable (UK: same as single, Germany: income
 * splitting, Australia: same as single).
 *
 * These are simplified estimates — they use standard allowances and do
 * not account for country-specific credits, deductions, or benefits.
 *
 * Exchange rates are approximate annual averages and bundled statically.
 */

import type { FilingStatus } from "./tax";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InternationalTaxEstimate {
  countryCode: string;
  countryName: string;
  grossIncomeUsd: number;
  grossIncomeLocal: number;
  currencyCode: string;
  exchangeRate: number; // 1 USD = X local currency
  incomeTax: number; // in local currency
  socialContributions: number; // in local currency
  totalTax: number; // in local currency
  totalTaxUsd: number;
  effectiveRate: number;
  marginalRate: number;
}

export type SupportedCountry = "GBR" | "DEU" | "AUS" | "JPN" | "KOR" | "FRA";

export const SUPPORTED_COUNTRIES: Record<
  SupportedCountry,
  { name: string; currencyCode: string }
> = {
  GBR: { name: "United Kingdom", currencyCode: "GBP" },
  DEU: { name: "Germany", currencyCode: "EUR" },
  AUS: { name: "Australia", currencyCode: "AUD" },
  JPN: { name: "Japan", currencyCode: "JPY" },
  KOR: { name: "South Korea", currencyCode: "KRW" },
  FRA: { name: "France", currencyCode: "EUR" },
};

// ---------------------------------------------------------------------------
// Exchange rates (approximate 2024 annual averages, 1 USD = X)
// ---------------------------------------------------------------------------

const EXCHANGE_RATES: Record<SupportedCountry, number> = {
  GBR: 0.79, // 1 USD = 0.79 GBP
  DEU: 0.92, // 1 USD = 0.92 EUR
  AUS: 1.53, // 1 USD = 1.53 AUD
  JPN: 151.0, // 1 USD = 151 JPY
  KOR: 1350.0, // 1 USD = 1350 KRW
  FRA: 0.92, // 1 USD = 0.92 EUR (same as Germany)
};

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

interface TaxBracket {
  min: number;
  max: number;
  rate: number;
}

function applyBrackets(income: number, brackets: TaxBracket[]): number {
  let tax = 0;
  for (const bracket of brackets) {
    if (income <= bracket.min) break;
    const taxable = Math.min(income, bracket.max) - bracket.min;
    tax += taxable * bracket.rate;
  }
  return Math.max(0, tax);
}

function getMarginalRate(income: number, brackets: TaxBracket[]): number {
  for (let i = brackets.length - 1; i >= 0; i--) {
    if (income > brackets[i].min) return brackets[i].rate;
  }
  return brackets[0].rate;
}

// ---------------------------------------------------------------------------
// United Kingdom (2025/26 tax year)
// ---------------------------------------------------------------------------

// Income tax brackets (England, Wales, Northern Ireland)
const UK_BRACKETS: TaxBracket[] = [
  { min: 0, max: 37700, rate: 0.20 }, // Basic rate
  { min: 37700, max: 125140, rate: 0.40 }, // Higher rate
  { min: 125140, max: Infinity, rate: 0.45 }, // Additional rate
];

const UK_PERSONAL_ALLOWANCE = 12570;
// Personal allowance tapers: reduced by £1 for every £2 over £100,000
const UK_ALLOWANCE_TAPER_START = 100000;

// National Insurance (Class 1, employee, 2025/26)
const UK_NI_BRACKETS: TaxBracket[] = [
  { min: 12570, max: 50270, rate: 0.08 },
  { min: 50270, max: Infinity, rate: 0.02 },
];

function estimateUkTax(grossIncomeGbp: number): {
  incomeTax: number;
  socialContributions: number;
  marginalRate: number;
} {
  // Calculate personal allowance (tapers above £100k)
  let personalAllowance = UK_PERSONAL_ALLOWANCE;
  if (grossIncomeGbp > UK_ALLOWANCE_TAPER_START) {
    const reduction = Math.floor(
      (grossIncomeGbp - UK_ALLOWANCE_TAPER_START) / 2
    );
    personalAllowance = Math.max(0, personalAllowance - reduction);
  }

  const taxableIncome = Math.max(0, grossIncomeGbp - personalAllowance);
  const incomeTax = applyBrackets(taxableIncome, UK_BRACKETS);
  const ni = applyBrackets(grossIncomeGbp, UK_NI_BRACKETS);

  // Marginal rate includes NI
  let marginal = getMarginalRate(taxableIncome, UK_BRACKETS);
  if (grossIncomeGbp > 12570 && grossIncomeGbp <= 50270) marginal += 0.08;
  else if (grossIncomeGbp > 50270) marginal += 0.02;
  // Effective 60% band where allowance tapers
  if (
    grossIncomeGbp > UK_ALLOWANCE_TAPER_START &&
    grossIncomeGbp <= UK_ALLOWANCE_TAPER_START + UK_PERSONAL_ALLOWANCE * 2
  ) {
    marginal = 0.6;
  }

  return { incomeTax, socialContributions: ni, marginalRate: marginal };
}

// ---------------------------------------------------------------------------
// Germany (2025 tax year)
//
// Germany uses continuous polynomial formulas (§32a EStG) rather than
// discrete brackets. We approximate with the published piecewise zones.
// ---------------------------------------------------------------------------

const DE_BASIC_ALLOWANCE = 12096;

// Solidarity surcharge: 5.5% of income tax, but exempted below threshold
const DE_SOLI_THRESHOLD = 19950; // tax amount threshold (approx)

// Social contributions (employee share, 2025 rates)
const DE_SOCIAL = {
  pension: { rate: 0.093, cap: 96600 }, // West Germany cap
  health: { rate: 0.0875, cap: 66150 }, // avg incl supplemental
  unemployment: { rate: 0.013, cap: 96600 },
  care: { rate: 0.018, cap: 66150 }, // childless rate (slightly higher)
};

/**
 * German income tax formula (2025, §32a EStG approximation).
 * Uses the published piecewise zones with linear interpolation
 * between zone boundaries.
 */
function calculateGermanIncomeTax(
  taxableIncome: number,
  splitting: boolean = false
): number {
  // If married splitting, compute tax on half income and double
  const income = splitting ? taxableIncome / 2 : taxableIncome;

  let tax: number;

  if (income <= DE_BASIC_ALLOWANCE) {
    tax = 0;
  } else if (income <= 17443) {
    // Zone 2: progressive 14% → 24%
    const y = (income - DE_BASIC_ALLOWANCE) / 10000;
    tax = (932.3 * y + 1400) * y;
  } else if (income <= 68480) {
    // Zone 3: progressive 24% → 42%
    const z = (income - 17443) / 10000;
    tax = (176.64 * z + 2397) * z + 1015.13;
  } else if (income <= 277825) {
    // Zone 4: flat 42%
    tax = 0.42 * income - 10911.92;
  } else {
    // Zone 5: flat 45%
    tax = 0.45 * income - 19246.67;
  }

  tax = Math.floor(tax);

  // Solidarity surcharge
  if (tax > DE_SOLI_THRESHOLD) {
    tax += tax * 0.055;
  }

  return splitting ? Math.floor(tax * 2) : Math.floor(tax);
}

function estimateGermanTax(
  grossIncomeEur: number,
  filingStatus: FilingStatus
): {
  incomeTax: number;
  socialContributions: number;
  marginalRate: number;
} {
  const splitting = filingStatus === "married";
  const taxableIncome = Math.max(0, grossIncomeEur); // No separate standard deduction; basic allowance is built into formula

  const incomeTax = calculateGermanIncomeTax(taxableIncome, splitting);

  // Social contributions
  let social = 0;
  for (const [, config] of Object.entries(DE_SOCIAL)) {
    social += Math.min(grossIncomeEur, config.cap) * config.rate;
  }

  // Approximate marginal rate
  const delta = 100;
  const taxPlus = calculateGermanIncomeTax(taxableIncome + delta, splitting);
  const marginalRate = (taxPlus - incomeTax) / delta;

  return { incomeTax, socialContributions: social, marginalRate };
}

// ---------------------------------------------------------------------------
// Australia (2025-26 tax year)
// ---------------------------------------------------------------------------

const AUS_BRACKETS: TaxBracket[] = [
  { min: 0, max: 18200, rate: 0 }, // Tax-free threshold
  { min: 18200, max: 45000, rate: 0.16 },
  { min: 45000, max: 135000, rate: 0.30 },
  { min: 135000, max: 190000, rate: 0.37 },
  { min: 190000, max: Infinity, rate: 0.45 },
];

const AUS_MEDICARE_LEVY_RATE = 0.02;
const AUS_MEDICARE_LEVY_LOW_THRESHOLD = 26000;

function estimateAustralianTax(grossIncomeAud: number): {
  incomeTax: number;
  socialContributions: number;
  marginalRate: number;
} {
  const incomeTax = applyBrackets(grossIncomeAud, AUS_BRACKETS);

  // Medicare levy: 2% of taxable income (phased in for low incomes)
  let medicareLevy = 0;
  if (grossIncomeAud > AUS_MEDICARE_LEVY_LOW_THRESHOLD) {
    medicareLevy = grossIncomeAud * AUS_MEDICARE_LEVY_RATE;
  }

  let marginal = getMarginalRate(grossIncomeAud, AUS_BRACKETS);
  if (grossIncomeAud > AUS_MEDICARE_LEVY_LOW_THRESHOLD) {
    marginal += AUS_MEDICARE_LEVY_RATE;
  }

  return {
    incomeTax,
    socialContributions: medicareLevy,
    marginalRate: marginal,
  };
}

// ---------------------------------------------------------------------------
// Japan (2025 tax year)
//
// National income tax uses progressive brackets. A 2.1% reconstruction
// surtax applies on top. Resident tax (~10%) is a flat local rate.
// Social insurance: health, pension, employment, long-term care.
// Individual filing only (no joint/splitting).
// ---------------------------------------------------------------------------

const JPN_BRACKETS: TaxBracket[] = [
  { min: 0, max: 1950000, rate: 0.05 },
  { min: 1950000, max: 3300000, rate: 0.10 },
  { min: 3300000, max: 6950000, rate: 0.20 },
  { min: 6950000, max: 9000000, rate: 0.23 },
  { min: 9000000, max: 18000000, rate: 0.33 },
  { min: 18000000, max: 40000000, rate: 0.40 },
  { min: 40000000, max: Infinity, rate: 0.45 },
];

const JPN_BASIC_DEDUCTION = 580000; // Basic deduction (基礎控除, raised in 2025)
const JPN_RESIDENT_TAX_RATE = 0.10; // Flat ~10% local/resident tax
const JPN_RECONSTRUCTION_SURTAX_RATE = 0.021; // 2.1% on national income tax

// Employment income deduction (給与所得控除) — simplified schedule
function japanEmploymentDeduction(grossIncome: number): number {
  if (grossIncome <= 1625000) return 650000;
  if (grossIncome <= 1800000) return grossIncome * 0.4 - 100000;
  if (grossIncome <= 3600000) return grossIncome * 0.3 + 80000;
  if (grossIncome <= 6600000) return grossIncome * 0.2 + 440000;
  if (grossIncome <= 8500000) return grossIncome * 0.1 + 1100000;
  return 1950000; // Cap
}

// Social insurance (employee share, approximate 2025)
const JPN_SOCIAL = {
  healthInsurance: { rate: 0.05, cap: Infinity }, // ~10% total, employee half ~5%
  pension: { rate: 0.0915, cap: 650000 * 12 }, // Employees' Pension, monthly cap ¥650k
  employment: { rate: 0.006, cap: Infinity }, // Employment insurance
  longTermCare: { rate: 0.009, cap: Infinity }, // Age 40+, ~0.9% employee share
};

function estimateJapaneseTax(grossIncomeJpy: number): {
  incomeTax: number;
  socialContributions: number;
  marginalRate: number;
} {
  // Social insurance
  let social = 0;
  for (const [, config] of Object.entries(JPN_SOCIAL)) {
    social += Math.min(grossIncomeJpy, config.cap) * config.rate;
  }

  // Employment income deduction
  const empDeduction = japanEmploymentDeduction(grossIncomeJpy);
  const employmentIncome = Math.max(0, grossIncomeJpy - empDeduction);

  // Social insurance is also deductible
  const taxableIncome = Math.max(
    0,
    employmentIncome - JPN_BASIC_DEDUCTION - social
  );

  // National income tax
  let nationalTax = applyBrackets(taxableIncome, JPN_BRACKETS);
  // Reconstruction surtax
  nationalTax += nationalTax * JPN_RECONSTRUCTION_SURTAX_RATE;
  nationalTax = Math.floor(nationalTax);

  // Resident tax (flat 10%)
  const residentTax = Math.floor(taxableIncome * JPN_RESIDENT_TAX_RATE);

  const incomeTax = nationalTax + residentTax;

  let marginal = getMarginalRate(taxableIncome, JPN_BRACKETS);
  marginal = marginal * (1 + JPN_RECONSTRUCTION_SURTAX_RATE) + JPN_RESIDENT_TAX_RATE;

  return { incomeTax, socialContributions: social, marginalRate: marginal };
}

// ---------------------------------------------------------------------------
// South Korea (2025 tax year)
//
// Progressive national income tax with 8 brackets. Local income tax
// is 10% of national tax. Social contributions: NHI, pension,
// employment insurance, long-term care.
// Individual filing (no joint/splitting).
// ---------------------------------------------------------------------------

const KOR_BRACKETS: TaxBracket[] = [
  { min: 0, max: 14000000, rate: 0.06 },
  { min: 14000000, max: 50000000, rate: 0.15 },
  { min: 50000000, max: 88000000, rate: 0.24 },
  { min: 88000000, max: 150000000, rate: 0.35 },
  { min: 150000000, max: 300000000, rate: 0.38 },
  { min: 300000000, max: 500000000, rate: 0.40 },
  { min: 500000000, max: 1000000000, rate: 0.42 },
  { min: 1000000000, max: Infinity, rate: 0.45 },
];

const KOR_BASIC_DEDUCTION = 1500000; // Basic personal deduction
const KOR_LOCAL_TAX_RATE = 0.10; // 10% of national income tax

// Employment income deduction schedule
function koreaEmploymentDeduction(grossIncome: number): number {
  if (grossIncome <= 5000000) return grossIncome * 0.7;
  if (grossIncome <= 15000000) return 3500000 + (grossIncome - 5000000) * 0.4;
  if (grossIncome <= 45000000) return 7500000 + (grossIncome - 15000000) * 0.15;
  if (grossIncome <= 100000000) return 12000000 + (grossIncome - 45000000) * 0.05;
  return Math.min(14750000 + (grossIncome - 100000000) * 0.02, 20000000);
}

// Social contributions (employee share, 2025 approximate)
const KOR_SOCIAL = {
  nationalPension: { rate: 0.045, cap: 5900000 * 12 }, // 9% total, split 50/50, monthly income cap ~₩5.9M
  healthInsurance: { rate: 0.03545, cap: Infinity }, // ~7.09% total, employee half
  longTermCare: { rate: 0.004585, cap: Infinity }, // ~12.95% of health premium
  employmentInsurance: { rate: 0.009, cap: Infinity }, // ~0.9% employee share
};

function estimateKoreanTax(grossIncomeKrw: number): {
  incomeTax: number;
  socialContributions: number;
  marginalRate: number;
} {
  // Social contributions
  let social = 0;
  for (const [, config] of Object.entries(KOR_SOCIAL)) {
    social += Math.min(grossIncomeKrw, config.cap) * config.rate;
  }

  // Employment income deduction
  const empDeduction = koreaEmploymentDeduction(grossIncomeKrw);
  const employmentIncome = Math.max(0, grossIncomeKrw - empDeduction);

  // Basic deduction + social insurance deduction
  const taxableIncome = Math.max(
    0,
    employmentIncome - KOR_BASIC_DEDUCTION - social
  );

  // National income tax
  const nationalTax = applyBrackets(taxableIncome, KOR_BRACKETS);
  // Local income tax (10% of national)
  const localTax = Math.floor(nationalTax * KOR_LOCAL_TAX_RATE);
  const incomeTax = Math.floor(nationalTax) + localTax;

  let marginal = getMarginalRate(taxableIncome, KOR_BRACKETS);
  marginal = marginal * (1 + KOR_LOCAL_TAX_RATE);

  return { incomeTax, socialContributions: social, marginalRate: marginal };
}

// ---------------------------------------------------------------------------
// France (2025 tax year)
//
// Progressive income tax with 5 brackets. Uses "quotient familial"
// (family quotient) — married couples file jointly with 2 parts.
// Social contributions (CSG/CRDS + employee charges) are significant.
// ---------------------------------------------------------------------------

const FRA_BRACKETS: TaxBracket[] = [
  { min: 0, max: 11294, rate: 0 },
  { min: 11294, max: 28797, rate: 0.11 },
  { min: 28797, max: 82341, rate: 0.30 },
  { min: 82341, max: 177106, rate: 0.41 },
  { min: 177106, max: Infinity, rate: 0.45 },
];

// Standard 10% deduction for employment income (abattement pour frais professionnels)
const FRA_EMPLOYMENT_DEDUCTION_RATE = 0.10;
const FRA_EMPLOYMENT_DEDUCTION_MIN = 495;
const FRA_EMPLOYMENT_DEDUCTION_MAX = 14171;

// Social contributions (employee share on gross salary, approximate 2025)
// CSG (9.2%) + CRDS (0.5%) apply on 98.25% of gross salary
// CSG: 6.8% is deductible from taxable income, 2.4% is not
const FRA_CSG_RATE = 0.092;
const FRA_CRDS_RATE = 0.005;
const FRA_CSG_CRDS_BASE = 0.9825; // Applied to 98.25% of gross
const FRA_CSG_DEDUCTIBLE_RATE = 0.068; // Portion deductible from taxable income
const FRA_EMPLOYEE_SOCIAL_CHARGES = {
  retirement: { rate: 0.069, cap: 47100 }, // Old-age pension (capped at PASS)
  retirementUncapped: { rate: 0.004, cap: Infinity }, // Old-age pension (uncapped)
  agircArrcoT1: { rate: 0.0315, cap: 47100 }, // Supplemental pension tranche 1
  agircArrcoT2: { rate: 0.0864, capMin: 47100, capMax: 376800 }, // Tranche 2
};

function estimateFrenchTax(
  grossIncomeEur: number,
  filingStatus: FilingStatus
): {
  incomeTax: number;
  socialContributions: number;
  marginalRate: number;
} {
  // Social charges: CSG + CRDS on 98.25% of gross
  const csgCrdsBase = grossIncomeEur * FRA_CSG_CRDS_BASE;
  let social = csgCrdsBase * (FRA_CSG_RATE + FRA_CRDS_RATE);

  // Other employee charges
  for (const [key, config] of Object.entries(FRA_EMPLOYEE_SOCIAL_CHARGES)) {
    if (key === "agircArrcoT2") {
      // Tranche 2: only on income between PASS and 8x PASS
      const c = config as { rate: number; capMin: number; capMax: number };
      if (grossIncomeEur > c.capMin) {
        social += (Math.min(grossIncomeEur, c.capMax) - c.capMin) * c.rate;
      }
    } else {
      social += Math.min(grossIncomeEur, (config as { rate: number; cap: number }).cap) * config.rate;
    }
  }

  // Taxable income: gross minus deductible CSG, then 10% employment deduction
  const deductibleCSG = csgCrdsBase * FRA_CSG_DEDUCTIBLE_RATE;
  const netTaxableBeforeDeduction = grossIncomeEur - deductibleCSG;
  const employmentDeduction = Math.min(
    FRA_EMPLOYMENT_DEDUCTION_MAX,
    Math.max(
      FRA_EMPLOYMENT_DEDUCTION_MIN,
      netTaxableBeforeDeduction * FRA_EMPLOYMENT_DEDUCTION_RATE
    )
  );
  const netTaxable = Math.max(0, netTaxableBeforeDeduction - employmentDeduction);

  // Family quotient: married = 2 parts, single = 1 part
  const parts = filingStatus === "married" ? 2 : 1;
  const perPart = netTaxable / parts;
  const taxPerPart = applyBrackets(perPart, FRA_BRACKETS);
  const incomeTax = Math.floor(taxPerPart * parts);

  let marginal = getMarginalRate(perPart, FRA_BRACKETS);

  return { incomeTax, socialContributions: social, marginalRate: marginal };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function isSupportedCountry(code: string): code is SupportedCountry {
  return code in SUPPORTED_COUNTRIES;
}

/**
 * Estimate what a person would pay in taxes in another country,
 * given their income in USD.
 */
export function estimateInternationalTax(
  grossIncomeUsd: number,
  filingStatus: FilingStatus,
  countryCode: SupportedCountry
): InternationalTaxEstimate {
  const country = SUPPORTED_COUNTRIES[countryCode];
  const exchangeRate = EXCHANGE_RATES[countryCode];
  const grossIncomeLocal = grossIncomeUsd * exchangeRate;

  let incomeTax: number;
  let socialContributions: number;
  let marginalRate: number;

  switch (countryCode) {
    case "GBR": {
      const uk = estimateUkTax(grossIncomeLocal);
      incomeTax = uk.incomeTax;
      socialContributions = uk.socialContributions;
      marginalRate = uk.marginalRate;
      break;
    }
    case "DEU": {
      const de = estimateGermanTax(grossIncomeLocal, filingStatus);
      incomeTax = de.incomeTax;
      socialContributions = de.socialContributions;
      marginalRate = de.marginalRate;
      break;
    }
    case "AUS": {
      const aus = estimateAustralianTax(grossIncomeLocal);
      incomeTax = aus.incomeTax;
      socialContributions = aus.socialContributions;
      marginalRate = aus.marginalRate;
      break;
    }
    case "JPN": {
      const jpn = estimateJapaneseTax(grossIncomeLocal);
      incomeTax = jpn.incomeTax;
      socialContributions = jpn.socialContributions;
      marginalRate = jpn.marginalRate;
      break;
    }
    case "KOR": {
      const kor = estimateKoreanTax(grossIncomeLocal);
      incomeTax = kor.incomeTax;
      socialContributions = kor.socialContributions;
      marginalRate = kor.marginalRate;
      break;
    }
    case "FRA": {
      const fra = estimateFrenchTax(grossIncomeLocal, filingStatus);
      incomeTax = fra.incomeTax;
      socialContributions = fra.socialContributions;
      marginalRate = fra.marginalRate;
      break;
    }
  }

  const totalTax = incomeTax + socialContributions;
  const totalTaxUsd = totalTax / exchangeRate;
  const effectiveRate = grossIncomeUsd > 0 ? totalTaxUsd / grossIncomeUsd : 0;

  return {
    countryCode,
    countryName: country.name,
    grossIncomeUsd,
    grossIncomeLocal,
    currencyCode: country.currencyCode,
    exchangeRate,
    incomeTax,
    socialContributions,
    totalTax,
    totalTaxUsd,
    effectiveRate,
    marginalRate,
  };
}
