"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import { TRANSITION_DEFAULT } from "@/lib/constants";
import {
  useInternationalComparison,
  useAllCountriesComparison,
  getAvailableCountries,
  type ComparisonMode,
} from "@/hooks/useInternationalComparison";
import { formatCurrency, formatPercent, type FilingStatus } from "@/lib/tax";
import { trackInternationalCompared } from "@/lib/analytics";
import type { PersonalSpendingCategory } from "@/lib/spending";
import InfoTooltip from "./InfoTooltip";
import outcomesData from "@/data/international-outcomes.json";
import type { InternationalOutcomes } from "@/data/international-outcomes";

const outcomes = outcomesData as unknown as InternationalOutcomes;

/** Short display labels for country codes. */
const COUNTRY_SHORT_LABELS: Record<string, string> = {
  GBR: "UK",
  DEU: "DE",
  AUS: "AU",
  JPN: "JP",
  KOR: "KR",
  FRA: "FR",
};

/** Distinct colors for each country in "all countries" mode. */
const COUNTRY_COLORS: Record<string, string> = {
  GBR: "#f87171", // red
  DEU: "#facc15", // yellow
  AUS: "#34d399", // green
  JPN: "#f472b6", // pink
  KOR: "#60a5fa", // blue
  FRA: "#a78bfa", // purple
};

/**
 * Cross-cutting insights shown in the all-countries comparison header.
 * These are manually curated — update if the country list changes.
 */
const ALL_COUNTRIES_INSIGHTS = [
  "Every country shown here provides universal healthcare coverage. The US does not.",
  "All six comparison countries have lower income inequality (Gini index) than the United States.",
];

interface InternationalComparisonProps {
  spending: PersonalSpendingCategory[];
  totalFederalTax: number;
  grossIncome: number;
  filingStatus: FilingStatus;
  /** Country code from URL params, if any */
  initialCountry?: string | null;
  /** Callback when country changes (for URL param sync) */
  onCountryChange?: (code: string | null) => void;
}

export default function InternationalComparison({
  spending,
  totalFederalTax,
  grossIncome,
  filingStatus,
  initialCountry = null,
  onCountryChange,
}: InternationalComparisonProps) {
  const [selectedCountry, setSelectedCountry] = useState<string | null>(
    initialCountry ?? "ALL"
  );
  const [mode, setMode] = useState<ComparisonMode>("same-amount");
  const { resolvedTheme } = useTheme();

  const isAllMode = selectedCountry === "ALL";
  const countries = getAvailableCountries();

  const comparison = useInternationalComparison(
    spending,
    totalFederalTax,
    isAllMode ? null : selectedCountry,
    mode,
    grossIncome,
    filingStatus,
    resolvedTheme ?? "dark"
  );

  const allComparisons = useAllCountriesComparison(
    spending,
    totalFederalTax,
    isAllMode,
    mode,
    grossIncome,
    filingStatus,
    resolvedTheme ?? "dark"
  );

  const handleCountrySelect = (code: string | null) => {
    setSelectedCountry(code);
    onCountryChange?.(code);
    if (code) {
      trackInternationalCompared(code);
    }
  };

  // Whether to show the mode toggle: single country with tax estimate, or all countries
  const showModeToggle = isAllMode || comparison?.country.hasTaxEstimate;

  return (
    <div>
      <h3 className="text-sm font-semibold text-text-primary mb-3 inline-flex items-center gap-1.5">
        Your Tax Breakdown vs. Other Countries
        <InfoTooltip width="w-60">
          US rate includes federal income tax, Social Security (6.2%), and Medicare (1.45%). Other countries&apos; rates include their equivalent income tax and social contributions. Rates are not perfectly comparable — countries structure taxes differently (e.g., VAT, employer-side contributions, regional taxes are excluded).
        </InfoTooltip>
      </h3>
            {/* Country selector + mode toggle */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <div className="flex items-center gap-2">
                <label
                  htmlFor="compare-country"
                  className="text-xs text-text-secondary"
                >
                  Compare with:
                </label>
                <select
                  id="compare-country"
                  value={selectedCountry ?? ""}
                  onChange={(e) => handleCountrySelect(e.target.value)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-border bg-surface-elevated text-text-secondary cursor-pointer hover:border-white/20 transition-colors appearance-none pr-7 focus:outline-none focus:border-sky-500/40"
                  style={{
                    backgroundImage:
                      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236b7280' d='M3 5l3 3 3-3'/%3E%3C/svg%3E\")",
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "right 8px center",
                  }}
                >
                  <option value="ALL">All countries</option>
                  {countries.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Mode toggle */}
              {showModeToggle && (
                <div className="flex items-center rounded-lg border border-border overflow-hidden text-[11px]">
                  <button
                    onClick={() => setMode("same-amount")}
                    className={`px-3 py-1.5 transition-colors cursor-pointer inline-flex items-center gap-1 ${
                      mode === "same-amount"
                        ? "bg-surface-elevated text-text-primary"
                        : "text-text-secondary hover:text-text-secondary"
                    }`}
                  >
                    Same amount
                    <InfoTooltip width="w-56">
                      Takes your actual US tax payment and shows how it would be allocated if spent according to each country&apos;s budget priorities (OECD COFOG data). It answers: &ldquo;If my country spent like theirs, where would my money go?&rdquo;
                    </InfoTooltip>
                  </button>
                  <button
                    onClick={() => setMode("estimated-tax")}
                    className={`px-3 py-1.5 transition-colors cursor-pointer border-l border-border inline-flex items-center gap-1 ${
                      mode === "estimated-tax"
                        ? "bg-sky-500/20 text-sky-400"
                        : "text-text-secondary hover:text-text-secondary"
                    }`}
                  >
                    Estimated tax
                    <InfoTooltip width="w-56">
                      Calculates what you&apos;d roughly owe in each country on the same income, then distributes that amount across their budget categories using OECD spending ratios. Tax estimates use simplified brackets and may not reflect all deductions or credits.
                    </InfoTooltip>
                  </button>
                </div>
              )}
            </div>

            {/* Single-country tax estimate summary (Phase 2 only) */}
            <AnimatePresence>
              {!isAllMode &&
                comparison?.taxEstimate &&
                mode === "estimated-tax" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 grid grid-cols-2 gap-3 max-w-md mx-auto">
                      <div className="text-center p-3 rounded-xl bg-surface-elevated border border-border">
                        <div className="text-[10px] text-text-secondary uppercase tracking-wider">
                          US taxes
                        </div>
                        <div className="font-amount text-lg font-bold text-text-primary">
                          {formatCurrency(totalFederalTax)}
                        </div>
                        <div className="text-[10px] text-text-secondary">
                          Effective:{" "}
                          {formatPercent(totalFederalTax / grossIncome)}
                        </div>
                      </div>
                      <div className="text-center p-3 rounded-xl bg-sky-500/10 border border-sky-500/20">
                        <div className="text-[10px] text-sky-400 uppercase tracking-wider">
                          {comparison.country.name}
                        </div>
                        <div className="font-amount text-lg font-bold text-sky-300">
                          {formatCurrency(comparison.taxEstimate.totalTaxUsd)}
                        </div>
                        <div className="text-[10px] text-sky-400/60">
                          Effective:{" "}
                          {formatPercent(comparison.taxEstimate.effectiveRate)}
                        </div>
                      </div>
                    </div>
                    <p className="text-center text-[10px] text-text-secondary mt-1.5">
                      Estimated income tax + social contributions on{" "}
                      {formatCurrency(grossIncome)} income
                    </p>
                  </motion.div>
                )}
            </AnimatePresence>

            {/* ---- ALL COUNTRIES VIEW ---- */}
            <AnimatePresence mode="wait">
              {isAllMode && allComparisons.length > 0 && (
                <motion.div
                  key={`all-${mode}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25 }}
                  className="mt-4 rounded-xl bg-surface-card border border-border overflow-hidden"
                >
                  {/* Header */}
                  <div className="px-4 py-3 border-b border-border">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                        {mode === "estimated-tax"
                          ? "What your taxes would look like in other countries"
                          : "US spending ratio vs. other countries"}
                      </h4>
                      <span className="text-[10px] text-text-secondary inline-flex items-center gap-1">
                        OECD {allComparisons[0].dataYear} data
                        <InfoTooltip width="w-56">
                          OECD spending data typically lags 1-2 years. {allComparisons[0].dataYear} is the most recent year with complete data for all countries shown.
                        </InfoTooltip>
                      </span>
                    </div>
                    {/* Legend */}
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      <span className="flex items-center gap-1 text-[10px] text-text-secondary">
                        <span className="w-2 h-2 rounded-full bg-text-muted" />
                        US
                        {mode === "estimated-tax" && (
                          <span className="font-amount text-text-secondary ml-0.5">
                            {formatCurrency(totalFederalTax)}
                          </span>
                        )}
                      </span>
                      {allComparisons.map((c) => (
                        <span
                          key={c.country.code}
                          className="flex items-center gap-1 text-[10px] text-text-secondary"
                        >
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{
                              backgroundColor:
                                COUNTRY_COLORS[c.country.code] ?? "#888",
                            }}
                          />
                          {COUNTRY_SHORT_LABELS[c.country.code] ??
                            c.country.code}
                          {mode === "estimated-tax" && (
                            <span className="font-amount text-text-secondary ml-0.5">
                              {formatCurrency(c.countryTotalAmount)}
                            </span>
                          )}
                        </span>
                      ))}
                    </div>
                    {/* Cross-cutting insight */}
                    <p className="text-xs text-text-secondary mt-2 leading-relaxed italic">
                      {ALL_COUNTRIES_INSIGHTS.join(" ")}
                    </p>
                  </div>

                  {/* Rows */}
                  <div className="lg:max-h-[600px] lg:overflow-y-auto">
                    {allComparisons[0].items.map((usItem) => (
                      <AllCountriesRow
                        key={usItem.categoryId}
                        categoryId={usItem.categoryId}
                        categoryName={usItem.categoryName}
                        color={usItem.color}
                        usAmount={usItem.usAmount}
                        usPct={usItem.usPct}
                        countryData={allComparisons.map((c) => {
                          const item = c.items.find(
                            (i) => i.categoryId === usItem.categoryId
                          );
                          return {
                            code: c.country.code,
                            amount: item?.countryAmount ?? 0,
                            pct: item?.countryPct ?? 0,
                            isUnmapped: item?.isUnmapped ?? true,
                          };
                        })}
                        maxAmount={Math.max(
                          ...allComparisons.flatMap((c) =>
                            c.items.map((i) =>
                              Math.max(i.usAmount, i.countryAmount)
                            )
                          )
                        )}
                      />
                    ))}
                  </div>

                  {/* Footer */}
                  <div className="px-4 py-3 border-t border-border bg-surface-elevated">
                    <div className="text-xs font-semibold text-text-secondary mb-1.5">
                      TOTAL
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-text-secondary w-7 shrink-0">
                          US
                        </span>
                        <span className="font-amount text-xs font-bold text-text-primary">
                          {formatCurrency(totalFederalTax)}
                        </span>
                      </div>
                      {mode === "estimated-tax" &&
                        allComparisons.map((c) => (
                          <div
                            key={c.country.code}
                            className="flex items-center justify-between"
                          >
                            <span className="text-[10px] w-7 shrink-0" style={{ color: COUNTRY_COLORS[c.country.code] ?? "#888" }}>
                              {COUNTRY_SHORT_LABELS[c.country.code] ??
                                c.country.code}
                            </span>
                            <span
                              className="font-amount text-xs font-bold"
                              style={{ color: COUNTRY_COLORS[c.country.code] ?? "#888" }}
                            >
                              {formatCurrency(c.countryTotalAmount)}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ---- SINGLE COUNTRY VIEW ---- */}
            <AnimatePresence mode="wait">
              {!isAllMode && comparison && (
                <motion.div
                  key={`${comparison.country.code}-${mode}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25 }}
                  className="mt-4 rounded-xl bg-surface-card border border-border overflow-hidden"
                >
                  {/* Header */}
                  <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                      {mode === "estimated-tax"
                        ? `What your taxes would look like in ${comparison.country.name}`
                        : `US spending ratio vs. ${comparison.country.name}`}
                    </h4>
                    <span className="text-[10px] text-text-secondary inline-flex items-center gap-1">
                      OECD {comparison.dataYear} data
                      <InfoTooltip width="w-56">
                        OECD spending data typically lags 1-2 years. {comparison.dataYear} is the most recent year with complete data for all countries shown.
                      </InfoTooltip>
                    </span>
                  </div>

                  {/* Rows */}
                  <div className="lg:max-h-[500px] lg:overflow-y-auto">
                    {comparison.items.map((item) => (
                      <ComparisonRow
                        key={item.categoryId}
                        item={item}
                        countryCode={comparison.country.code}
                        countryName={comparison.country.name}
                        maxAmount={Math.max(
                          ...comparison.items.map((i) =>
                            Math.max(i.usAmount, i.countryAmount)
                          )
                        )}
                      />
                    ))}
                  </div>

                  {/* Footer */}
                  <div className="px-4 py-3 border-t border-border bg-surface-elevated">
                    <div className="text-xs font-semibold text-text-secondary mb-1.5">
                      TOTAL
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-text-secondary w-7 shrink-0">
                          US
                        </span>
                        <span className="font-amount text-xs font-bold text-text-primary">
                          {formatCurrency(comparison.usTotalAmount)}
                        </span>
                      </div>
                      {mode === "estimated-tax" &&
                        comparison.countryTotalAmount !==
                          comparison.usTotalAmount && (
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-sky-400/60 w-7 shrink-0">
                              {COUNTRY_SHORT_LABELS[comparison.country.code] ??
                                comparison.country.code}
                            </span>
                            <span className="font-amount text-xs font-bold text-sky-400">
                              {formatCurrency(comparison.countryTotalAmount)}
                            </span>
                          </div>
                        )}
                    </div>
                    {comparison.unmappedPct > 0 && (
                      <p className="text-[10px] text-text-secondary mt-1">
                        {comparison.unmappedPct.toFixed(1)}% of US spending has
                        no direct equivalent in{" "}
                        {comparison.country.name}&apos;s budget classification
                      </p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Source attribution */}
            {(comparison || (isAllMode && allComparisons.length > 0)) && (
              <p className="text-center text-[10px] text-text-secondary mt-2">
                {isAllMode ? (
                  mode === "estimated-tax" ? (
                    <>
                      Estimated taxes for {formatCurrency(grossIncome)} income,
                      distributed by each country&apos;s spending ratios
                    </>
                  ) : (
                    <>
                      Same tax amount ({formatCurrency(totalFederalTax)}),
                      distributed by each country&apos;s spending ratios
                    </>
                  )
                ) : comparison ? (
                  mode === "estimated-tax" ? (
                    <>
                      Estimated taxes in {comparison.country.name} (
                      {formatCurrency(comparison.countryTotalAmount)}),
                      distributed by spending ratios
                    </>
                  ) : (
                    <>
                      Same tax amount (
                      {formatCurrency(comparison.usTotalAmount)}), distributed by
                      each country&apos;s spending ratios
                    </>
                  )
                ) : null}
                <span aria-hidden="true">{" · "}</span>
                <a
                  href="https://stats.oecd.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-text-secondary hover:text-text-secondary underline focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
                >
                  OECD COFOG<span className="sr-only-inline"> (opens in new tab)</span>
                </a>
                {" · "}Some descriptions are AI-summarized
              </p>
            )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single-country row component
// ---------------------------------------------------------------------------

function ComparisonRow({
  item,
  countryCode,
  countryName,
  maxAmount,
}: {
  item: {
    categoryId: string;
    categoryName: string;
    color: string;
    usAmount: number;
    usPct: number;
    countryAmount: number;
    countryPct: number;
    isUnmapped: boolean;
  };
  countryCode: string;
  countryName: string;
  maxAmount: number;
}) {
  const usWidth = maxAmount > 0 ? (item.usAmount / maxAmount) * 100 : 0;
  const countryWidth =
    maxAmount > 0 ? (item.countryAmount / maxAmount) * 100 : 0;

  const shortLabel = COUNTRY_SHORT_LABELS[countryCode] ?? countryCode;

  return (
    <div className="px-4 py-2.5 border-b border-border-subtle last:border-b-0 group hover:bg-surface-elevated transition-colors">
      {/* Category name */}
      <div className="text-xs text-text-secondary mb-1.5 flex items-center gap-1.5">
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: item.color }}
        />
        {item.categoryName}
      </div>

      {/* Bars */}
      <div className="space-y-1">
        {/* US bar */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-text-secondary w-7 shrink-0">US</span>
          <div className="flex-1 h-3 bg-surface-elevated rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: item.color, opacity: 0.7 }}
              initial={{ width: 0 }}
              animate={{ width: `${usWidth}%` }}
              transition={TRANSITION_DEFAULT}
            />
          </div>
          <span className="font-amount w-24 text-right text-[10px] text-text-secondary tabular-nums shrink-0 whitespace-nowrap">
            {formatCurrency(item.usAmount)}{" "}
            <span className="text-text-secondary">({item.usPct.toFixed(1)}%)</span>
          </span>
        </div>

        {/* Country bar */}
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] text-sky-400/60 w-7 shrink-0"
            title={countryName}
          >
            {shortLabel}
          </span>
          {item.isUnmapped ? (
            <>
              <div className="flex-1 h-3 bg-surface-elevated rounded-full overflow-hidden relative">
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="italic text-[9px] text-text-muted">
                    No equivalent
                  </span>
                </div>
              </div>
              <span
                className="w-24 text-right text-[10px] text-text-secondary shrink-0 whitespace-nowrap"
                title={`${item.categoryName} doesn't have a direct equivalent in ${countryName}'s budget classification`}
              >
                —
              </span>
            </>
          ) : (
            <>
              <div className="flex-1 h-3 bg-surface-elevated rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-sky-500/60"
                  initial={{ width: 0 }}
                  animate={{ width: `${countryWidth}%` }}
                  transition={{ ...TRANSITION_DEFAULT, delay: 0.1 }}
                />
              </div>
              <span className="font-amount w-24 text-right text-[10px] text-sky-400/80 tabular-nums shrink-0 whitespace-nowrap">
                {formatCurrency(item.countryAmount)}{" "}
                <span className="text-sky-400/40">
                  ({item.countryPct.toFixed(1)}%)
                </span>
              </span>
            </>
          )}
        </div>
      </div>

      {/* Editorial callout */}
      {outcomes.callouts?.[item.categoryId]?.[countryCode]?.text && (
        <p className="text-xs text-text-secondary mt-1.5 leading-relaxed italic">
          {outcomes.callouts[item.categoryId][countryCode].text}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// All-countries row component
// ---------------------------------------------------------------------------

function AllCountriesRow({
  categoryId,
  categoryName,
  color,
  usAmount,
  usPct,
  countryData,
  maxAmount,
}: {
  categoryId: string;
  categoryName: string;
  color: string;
  usAmount: number;
  usPct: number;
  countryData: Array<{
    code: string;
    amount: number;
    pct: number;
    isUnmapped: boolean;
  }>;
  maxAmount: number;
}) {
  const usWidth = maxAmount > 0 ? (usAmount / maxAmount) * 100 : 0;

  return (
    <div className="px-4 py-2 border-b border-border-subtle last:border-b-0 group hover:bg-surface-elevated transition-colors">
      {/* Category name */}
      <div className="text-xs text-text-secondary mb-1 flex items-center gap-1.5">
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        {categoryName}
      </div>

      {/* Bars — compact with h-2 */}
      <div className="space-y-0.5">
        {/* US bar */}
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-text-secondary w-7 shrink-0">US</span>
          <div className="flex-1 h-2 bg-surface-elevated rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-text-muted"
              initial={{ width: 0 }}
              animate={{ width: `${usWidth}%` }}
              transition={TRANSITION_DEFAULT}
            />
          </div>
          <span className="font-amount w-24 text-right text-[10px] text-text-secondary tabular-nums shrink-0 whitespace-nowrap">
            {formatCurrency(usAmount)}{" "}
            <span className="text-text-secondary">{usPct.toFixed(0)}%</span>
          </span>
        </div>

        {/* Country bars */}
        {countryData.map((cd) => {
          const width = maxAmount > 0 ? (cd.amount / maxAmount) * 100 : 0;
          const countryColor = COUNTRY_COLORS[cd.code] ?? "#888";
          const shortLabel = COUNTRY_SHORT_LABELS[cd.code] ?? cd.code;

          return (
            <div key={`${categoryId}-${cd.code}`} className="flex items-center gap-2">
              <span
                className="text-[9px] w-7 shrink-0"
                style={{ color: countryColor, opacity: 0.8 }}
              >
                {shortLabel}
              </span>
              {cd.isUnmapped ? (
                <>
                  <div className="flex-1 h-2 bg-surface-elevated rounded-full" />
                  <span className="w-24 text-right text-[10px] text-text-secondary shrink-0 whitespace-nowrap">
                    —
                  </span>
                </>
              ) : (
                <>
                  <div className="flex-1 h-2 bg-surface-elevated rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: countryColor, opacity: 0.6 }}
                      initial={{ width: 0 }}
                      animate={{ width: `${width}%` }}
                      transition={{ ...TRANSITION_DEFAULT, delay: 0.05 }}
                    />
                  </div>
                  <span
                    className="font-amount w-24 text-right text-[10px] tabular-nums shrink-0 whitespace-nowrap"
                    style={{ color: countryColor, opacity: 0.8 }}
                  >
                    {formatCurrency(cd.amount)}{" "}
                    <span style={{ opacity: 0.5 }}>{cd.pct.toFixed(0)}%</span>
                  </span>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
