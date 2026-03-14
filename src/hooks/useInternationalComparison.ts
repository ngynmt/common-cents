import { useMemo } from "react";
import intlData from "@/data/international.json";
import {
  estimateInternationalTax,
  isSupportedCountry,
  type InternationalTaxEstimate,
} from "@/lib/international-tax";
import type { FilingStatus } from "@/lib/tax";

export interface CountryOption {
  code: string;
  name: string;
  /** Whether Phase 2 tax estimation is available */
  hasTaxEstimate: boolean;
}

export interface ComparisonItem {
  categoryId: string;
  categoryName: string;
  color: string;
  usAmount: number;
  usPct: number;
  countryAmount: number;
  countryPct: number;
  isUnmapped: boolean;
}

export type ComparisonMode = "same-amount" | "estimated-tax";

export interface InternationalComparison {
  country: CountryOption;
  mode: ComparisonMode;
  items: ComparisonItem[];
  usTotalAmount: number;
  countryTotalAmount: number;
  dataYear: number;
  unmappedPct: number;
  /** Phase 2 tax estimate details (null in Phase 1 mode) */
  taxEstimate: InternationalTaxEstimate | null;
}

/**
 * Available countries for comparison.
 */
export function getAvailableCountries(): CountryOption[] {
  return Object.entries(intlData.countries).map(([code, data]) => ({
    code,
    name: (data as { name: string }).name,
    hasTaxEstimate: isSupportedCountry(code),
  }));
}

type UsSpending = Array<{
  category: { id: string; name: string; color: string };
  amount: number;
  percentage: number;
}>;

/**
 * Pure computation: build comparison data for a single country.
 */
function computeComparison(
  usSpending: UsSpending,
  totalFederalTax: number,
  countryCode: string,
  mode: ComparisonMode,
  grossIncome: number,
  filingStatus: FilingStatus
): InternationalComparison | null {
  const countryEntry = intlData.countries[
    countryCode as keyof typeof intlData.countries
  ] as
    | {
        name: string;
        countryCode: string;
        dataYear: number;
        ratios: Record<string, number>;
        unmappedCategories: string[];
      }
    | undefined;

  if (!countryEntry) return null;

  // Phase 2: estimate taxes in that country
  let taxEstimate: InternationalTaxEstimate | null = null;
  let countryTotalAmount = totalFederalTax;

  if (mode === "estimated-tax" && isSupportedCountry(countryCode)) {
    taxEstimate = estimateInternationalTax(
      grossIncome,
      filingStatus,
      countryCode
    );
    countryTotalAmount = taxEstimate.totalTaxUsd;
  }

  const items: ComparisonItem[] = usSpending.map((s) => {
    const ratio = countryEntry.ratios[s.category.id] ?? 0;
    const isUnmapped = countryEntry.unmappedCategories.includes(
      s.category.id
    );

    return {
      categoryId: s.category.id,
      categoryName: s.category.name,
      color: s.category.color,
      usAmount: s.amount,
      usPct: s.percentage,
      countryAmount: isUnmapped ? 0 : countryTotalAmount * ratio,
      countryPct: isUnmapped ? 0 : ratio * 100,
      isUnmapped,
    };
  });

  items.sort((a, b) => b.usAmount - a.usAmount);

  const unmappedPct = items
    .filter((i) => i.isUnmapped)
    .reduce((sum, i) => sum + i.usPct, 0);

  return {
    country: {
      code: countryCode,
      name: countryEntry.name,
      hasTaxEstimate: isSupportedCountry(countryCode),
    },
    mode,
    items,
    usTotalAmount: totalFederalTax,
    countryTotalAmount,
    dataYear: intlData.dataYear,
    unmappedPct,
    taxEstimate,
  };
}

/**
 * Compute an international spending comparison for a single country.
 */
export function useInternationalComparison(
  usSpending: UsSpending,
  totalFederalTax: number,
  countryCode: string | null,
  mode: ComparisonMode = "same-amount",
  grossIncome: number = 0,
  filingStatus: FilingStatus = "single"
): InternationalComparison | null {
  return useMemo(() => {
    if (!countryCode) return null;
    return computeComparison(
      usSpending,
      totalFederalTax,
      countryCode,
      mode,
      grossIncome,
      filingStatus
    );
  }, [usSpending, totalFederalTax, countryCode, mode, grossIncome, filingStatus]);
}

/**
 * Compute comparisons for all available countries at once.
 */
export function useAllCountriesComparison(
  usSpending: UsSpending,
  totalFederalTax: number,
  enabled: boolean,
  mode: ComparisonMode = "same-amount",
  grossIncome: number = 0,
  filingStatus: FilingStatus = "single"
): InternationalComparison[] {
  return useMemo(() => {
    if (!enabled) return [];
    const countries = getAvailableCountries();
    const results: InternationalComparison[] = [];
    for (const c of countries) {
      const comparison = computeComparison(
        usSpending,
        totalFederalTax,
        c.code,
        mode,
        grossIncome,
        filingStatus
      );
      if (comparison) results.push(comparison);
    }
    return results;
  }, [usSpending, totalFederalTax, enabled, mode, grossIncome, filingStatus]);
}
