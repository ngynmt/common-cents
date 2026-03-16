"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { TaxEstimate, TaxYear } from "@/lib/tax";
import { estimateFederalTax, formatCurrency, formatPercent, SUPPORTED_TAX_YEARS } from "@/lib/tax";
import { TRANSITION_DEFAULT } from "@/lib/constants";
import { calculatePersonalSpending } from "@/lib/spending";
import SpendingChart from "./SpendingChart";
import ReceiptLine from "./ReceiptLine";
import SecondaryTabs, { type TabId } from "./SecondaryTabs";
import SpendingTrends from "./SpendingTrends";
import RepresentativesModal from "./RepresentativesModal";
import StickyNav from "./StickyNav";
import ShareSheet from "./ShareSheet";

import type { Representative, VoteRecord } from "@/data/representatives";
import type { CampaignFinanceSummary } from "@/data/campaign-finance";
import { estimateInternationalTax, type SupportedCountry } from "@/lib/international-tax";
import { trackCategoryToggled, trackRepsModalOpened } from "@/lib/analytics";
import InfoTooltip from "./InfoTooltip";

interface TaxReceiptProps {
  taxEstimate: TaxEstimate;
  representatives: Representative[] | null;
  votes: VoteRecord[];
  onBack: () => void;
  financeData?: Record<string, CampaignFinanceSummary | null>;
  compareCountry?: string | null;
  onCompareCountryChange?: (code: string | null) => void;
  onZipSubmit?: (zip: string) => void;
}

export default function TaxReceipt({ taxEstimate, representatives, votes, onBack, financeData, compareCountry, onCompareCountryChange, onZipSubmit }: TaxReceiptProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [showRepsModal, setShowRepsModal] = useState(false);
  const [compareYear, setCompareYear] = useState<TaxYear | null>(null);

  const spending = calculatePersonalSpending(taxEstimate.totalFederalTax, taxEstimate.taxYear);

  // Compute comparison data when user enables it
  const comparison = useMemo(() => {
    if (!compareYear) return null;
    const compEstimate = estimateFederalTax(
      taxEstimate.grossIncome,
      taxEstimate.filingStatus,
      compareYear,
    );
    const compSpending = calculatePersonalSpending(compEstimate.totalFederalTax, compareYear);
    return { estimate: compEstimate, spending: compSpending };
  }, [compareYear, taxEstimate.grossIncome, taxEstimate.filingStatus]);

  const handleCategoryClick = (categoryId: string) => {
    if (expandedCategory === categoryId) {
      setExpandedCategory(null);
      setActiveCategoryId(null);
      trackCategoryToggled(categoryId, false);
    } else {
      setExpandedCategory(categoryId);
      setActiveCategoryId(categoryId);
      trackCategoryToggled(categoryId, true);
    }
  };

  const isComparing = comparison !== null;
  const currentYear = taxEstimate.taxYear;
  const priorYear = SUPPORTED_TAX_YEARS.filter((y) => y < currentYear).at(-1) ?? null;

  const [showShareSheet, setShowShareSheet] = useState(false);
  const [secondaryTab, setSecondaryTab] = useState<TabId>("bills");

  // International rate comparison for callout
  const intlCallout = useMemo(() => {
    const countries: { code: SupportedCountry; label: string }[] = [
      { code: "GBR", label: "UK" },
      { code: "DEU", label: "Germany" },
      { code: "AUS", label: "Australia" },
    ];
    return countries.map(({ code, label }) => {
      const est = estimateInternationalTax(taxEstimate.grossIncome, taxEstimate.filingStatus, code);
      return { label, rate: est.effectiveRate };
    });
  }, [taxEstimate.grossIncome, taxEstimate.filingStatus]);


  return (
    <div className="w-full max-w-4xl mx-auto space-y-8">
      {/* Back button */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={onBack}
        className="text-sm text-slate-400 hover:text-white transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
      >
        ← Change inputs
      </motion.button>

      {/* Summary header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...TRANSITION_DEFAULT, duration: 0.5 }}
        className="text-center space-y-2"
      >
        <h2 className="text-2xl font-bold text-white font-serif">Your Federal Tax Receipt</h2>
        <div className="flex items-center justify-center gap-6 text-sm text-slate-400 flex-wrap">
          <span>
            Income: <span className="text-white font-medium font-amount">{formatCurrency(taxEstimate.grossIncome)}</span>
          </span>
          <span>
            Est. Federal Tax: <span className="text-white font-medium font-amount">{formatCurrency(taxEstimate.totalFederalTax)}</span>
            {isComparing && (
              <DeltaBadge current={taxEstimate.totalFederalTax} previous={comparison.estimate.totalFederalTax} />
            )}
          </span>
          <span className="inline-flex items-center gap-1">
            Effective Rate: <span className="text-white font-medium">{formatPercent(taxEstimate.effectiveRate)}</span>
            <InfoTooltip>
              Your effective rate is your total federal tax divided by your gross income ({formatCurrency(taxEstimate.totalFederalTax)} &divide; {formatCurrency(taxEstimate.grossIncome)}). This is different from your marginal rate (tax bracket), which only applies to income above each bracket&apos;s threshold. Your effective rate is always lower because the first dollars you earn are taxed at lower rates.
            </InfoTooltip>
          </span>
        </div>
        <p className="text-[10px] text-slate-500 uppercase tracking-[1.5px]">
          Fiscal Year {currentYear} · {taxEstimate.filingStatus === "single" ? "Single Filer" : taxEstimate.filingStatus === "married" ? "Married Filing Jointly" : "Head of Household"}
        </p>
        <p className="text-xs text-slate-400 max-w-lg mx-auto italic">
          This is an estimate based on standard deduction and FY {currentYear} tax brackets.
          Your actual taxes may differ based on deductions, credits, and other factors.
        </p>
      </motion.div>

      {/* Year comparison toggle — only show if a prior year exists */}
      {priorYear && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex items-center justify-center"
        >
          <button
            onClick={() => setCompareYear(isComparing ? null : priorYear)}
            className={`text-xs px-4 py-2 rounded-full border transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              isComparing
                ? "bg-indigo-500/20 border-indigo-500/30 text-indigo-400"
                : "bg-white/5 border-white/10 text-slate-400 hover:text-white hover:border-white/20"
            }`}
          >
            {isComparing ? `Comparing with FY ${priorYear} ✕` : `Compare with FY ${priorYear}`}
          </button>
        </motion.div>
      )}

      {/* Comparison summary cards */}
      <AnimatePresence>
        {isComparing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-2 gap-3 max-w-lg mx-auto">
              <div className="text-center p-3 rounded-xl bg-white/5 border border-white/10">
                <div className="text-xs text-slate-400 uppercase tracking-wider">FY {priorYear}</div>
                <div className="text-lg font-bold text-slate-400 font-amount">{formatCurrency(comparison.estimate.totalFederalTax)}</div>
                <div className="text-xs text-slate-400">Effective: {formatPercent(comparison.estimate.effectiveRate)}</div>
              </div>
              <div className="text-center p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                <div className="text-xs text-indigo-400 uppercase tracking-wider">FY {currentYear}</div>
                <div className="text-lg font-bold text-white font-amount">{formatCurrency(taxEstimate.totalFederalTax)}</div>
                <div className="text-xs text-slate-400">Effective: {formatPercent(taxEstimate.effectiveRate)}</div>
              </div>
            </div>
            <p className="text-center text-xs text-slate-400 mt-2">
              Same income ({formatCurrency(taxEstimate.grossIncome)}), different tax year brackets and spending allocations
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tax breakdown mini-summary */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="grid grid-cols-3 gap-3 max-w-lg mx-auto"
      >
        {[
          { label: "Income Tax", value: taxEstimate.federalIncomeTax, prev: comparison?.estimate.federalIncomeTax },
          { label: "Social Security", value: taxEstimate.socialSecurityTax, prev: comparison?.estimate.socialSecurityTax },
          { label: "Medicare", value: taxEstimate.medicareTax, prev: comparison?.estimate.medicareTax },
        ].map((item) => (
          <div key={item.label} className="text-center p-3 rounded-xl bg-white/5">
            <div className="text-xs text-slate-400">{item.label}</div>
            <div className="text-sm font-semibold text-white">
              <span className="font-amount">{formatCurrency(item.value)}</span>
              {isComparing && item.prev !== undefined && (
                <DeltaBadge current={item.value} previous={item.prev} />
              )}
            </div>
          </div>
        ))}
      </motion.div>

      {/* Chart + Receipt layout */}
      <div id="section-receipt" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Donut chart */}
        <div className="flex items-center justify-center">
          <SpendingChart
            spending={spending}
            onCategoryClick={handleCategoryClick}
            activeCategoryId={activeCategoryId}
          />
        </div>

        {/* Receipt list */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ ...TRANSITION_DEFAULT, duration: 0.5, delay: 0.3 }}
          className="bg-white/[0.03] backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden"
        >
          {/* Receipt header */}
          <div className="px-4 py-3 border-b-2 border-white/10 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
              Spending Breakdown
            </h3>
            <button
              onClick={() => setShowShareSheet(true)}
              className="text-slate-400 hover:text-white transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-lg p-1"
              aria-label="Share the breakdown"
              title="Share the breakdown"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </button>
          </div>

          {/* Receipt lines */}
          <div className="lg:max-h-[600px] lg:overflow-y-auto">
            {spending.map((item, index) => {
              const prevItem = comparison?.spending.find(
                (s) => s.category.id === item.category.id,
              );
              return (
                <ReceiptLine
                  key={item.category.id}
                  item={item}
                  index={index}
                  isExpanded={expandedCategory === item.category.id}
                  onToggle={() => handleCategoryClick(item.category.id)}
                  isActive={activeCategoryId === item.category.id}
                  previousAmount={prevItem?.amount}
                />
              );
            })}
          </div>

          {/* Receipt footer */}
          <div className="px-4 py-3 border-t-[3px] border-double border-white/15 bg-white/5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-400 uppercase tracking-[1.5px]">TOTAL</span>
              <span className="text-base font-bold text-white font-amount">
                {formatCurrency(taxEstimate.totalFederalTax)}
              </span>
            </div>
          </div>

          {/* Contact reps button — always visible */}
          <div className="px-4 py-3 border-t border-white/8">
            <button
              onClick={() => { trackRepsModalOpened(); setShowRepsModal(true); }}
              className="w-full py-2.5 rounded-xl bg-indigo-500 text-white shadow-lg shadow-indigo-500/25 hover:bg-indigo-400 transition-colors font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              See How Your Reps Voted
            </button>
          </div>
        </motion.div>
      </div>

      {/* International rate callout */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="flex items-center justify-center gap-x-2 gap-y-1 flex-wrap text-xs text-slate-400"
      >
        <span>Your effective rate: <span className="text-white font-medium">{formatPercent(taxEstimate.effectiveRate)}</span></span>
        <span aria-hidden="true" className="leading-none">·</span>
        {intlCallout.map((c, i) => (
          <span key={c.label} className="inline-flex items-center gap-2">
            <span>{c.label}: <span className="text-white font-medium">{formatPercent(c.rate)}</span></span>
            {i < intlCallout.length - 1 && <span aria-hidden="true" className="leading-none">·</span>}
          </span>
        ))}
        <button
          onClick={() => {
            setSecondaryTab("compare");
            const tabsEl = document.getElementById("secondary-tabs");
            if (tabsEl) tabsEl.scrollIntoView({ behavior: "smooth" });
          }}
          className="text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer focus:outline-none"
        >
          Compare more →
        </button>
      </motion.div>

      {/* Spending trends — above tabs for visibility */}
      <div id="section-trends" className="mt-8">
        <SpendingTrends />
      </div>

      {/* Secondary content tabs — Pending Bills, Recent Spending, Global Comparison */}
      <div id="secondary-tabs" className="mt-6">
        <SecondaryTabs
          activeCategoryId={activeCategoryId}
          activeCategoryName={
            activeCategoryId
              ? spending.find((s) => s.category.id === activeCategoryId)?.category.name ?? null
              : null
          }
          totalFederalTax={taxEstimate.totalFederalTax}
          representatives={representatives}
          spending={spending}
          grossIncome={taxEstimate.grossIncome}
          filingStatus={taxEstimate.filingStatus}
          compareCountry={compareCountry ?? null}
          onCompareCountryChange={onCompareCountryChange ?? (() => {})}
          activeTab={secondaryTab}
          onTabChange={setSecondaryTab}
        />
      </div>

      {/* Share sheet */}
      <ShareSheet
        isOpen={showShareSheet}
        onClose={() => setShowShareSheet(false)}
        spending={spending}
        effectiveRate={taxEstimate.effectiveRate}
        taxYear={taxEstimate.taxYear}
      />

      {/* Sticky jump-to nav (mobile only) */}
      <StickyNav
        activeSecondaryTab={secondaryTab}
        onTabChange={setSecondaryTab}
        hidden={showRepsModal || showShareSheet}
      />

      {/* Representatives modal */}
      <RepresentativesModal
        isOpen={showRepsModal}
        onClose={() => setShowRepsModal(false)}
        representatives={representatives ?? []}
        votes={votes}
        financeData={financeData}
        onZipSubmit={onZipSubmit}
      />
    </div>
  );
}

/**
 * Small inline badge showing the delta between current and previous year.
 */
function DeltaBadge({ current, previous }: { current: number; previous: number }) {
  const delta = current - previous;
  if (Math.abs(delta) < 1) return null;

  const isUp = delta > 0;
  return (
    <span
      className={`ml-1.5 text-[10px] font-medium font-amount ${
        isUp ? "text-red-400" : "text-green-400"
      }`}
    >
      {isUp ? "+" : ""}{formatCurrency(delta)}
    </span>
  );
}
