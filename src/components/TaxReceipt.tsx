"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { TaxEstimate, TaxYear } from "@/lib/tax";
import { estimateFederalTax, formatCurrency, formatPercent, SUPPORTED_TAX_YEARS } from "@/lib/tax";
import { calculatePersonalSpending } from "@/lib/spending";
import SpendingChart from "./SpendingChart";
import ReceiptLine from "./ReceiptLine";
import BillsPanel from "./BillsPanel";
import RepresentativesModal from "./RepresentativesModal";

import type { Representative, VoteRecord } from "@/data/representatives";

interface TaxReceiptProps {
  taxEstimate: TaxEstimate;
  representatives: Representative[] | null;
  votes: VoteRecord[];
  onBack: () => void;
}

export default function TaxReceipt({ taxEstimate, representatives, votes, onBack }: TaxReceiptProps) {
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
    } else {
      setExpandedCategory(categoryId);
      setActiveCategoryId(categoryId);
    }
  };

  const isComparing = comparison !== null;
  const currentYear = taxEstimate.taxYear;
  const priorYear = SUPPORTED_TAX_YEARS.filter((y) => y < currentYear).at(-1) ?? null;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8">
      {/* Back button */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={onBack}
        className="text-sm text-gray-400 hover:text-white transition-colors cursor-pointer"
      >
        ← Change inputs
      </motion.button>

      {/* Summary header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center space-y-2"
      >
        <h2 className="text-2xl font-bold text-white">Your Federal Tax Receipt</h2>
        <div className="flex items-center justify-center gap-6 text-sm text-gray-400 flex-wrap">
          <span>
            Income: <span className="text-white font-medium">{formatCurrency(taxEstimate.grossIncome)}</span>
          </span>
          <span>
            Est. Federal Tax: <span className="text-white font-medium">{formatCurrency(taxEstimate.totalFederalTax)}</span>
            {isComparing && (
              <DeltaBadge current={taxEstimate.totalFederalTax} previous={comparison.estimate.totalFederalTax} />
            )}
          </span>
          <span>
            Effective Rate: <span className="text-white font-medium">{formatPercent(taxEstimate.effectiveRate)}</span>
          </span>
        </div>
        <p className="text-xs text-gray-500 max-w-lg mx-auto">
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
            className={`text-xs px-4 py-2 rounded-full border transition-colors cursor-pointer ${
              isComparing
                ? "bg-indigo-500/20 border-indigo-500/30 text-indigo-400"
                : "bg-white/5 border-white/10 text-gray-400 hover:text-white hover:border-white/20"
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
                <div className="text-[10px] text-gray-500 uppercase tracking-wider">FY {priorYear}</div>
                <div className="text-lg font-bold text-gray-400">{formatCurrency(comparison.estimate.totalFederalTax)}</div>
                <div className="text-[10px] text-gray-500">Effective: {formatPercent(comparison.estimate.effectiveRate)}</div>
              </div>
              <div className="text-center p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                <div className="text-[10px] text-indigo-400 uppercase tracking-wider">FY {currentYear}</div>
                <div className="text-lg font-bold text-white">{formatCurrency(taxEstimate.totalFederalTax)}</div>
                <div className="text-[10px] text-gray-400">Effective: {formatPercent(taxEstimate.effectiveRate)}</div>
              </div>
            </div>
            <p className="text-center text-[10px] text-gray-500 mt-2">
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
            <div className="text-xs text-gray-400">{item.label}</div>
            <div className="text-sm font-semibold text-white">
              {formatCurrency(item.value)}
              {isComparing && item.prev !== undefined && (
                <DeltaBadge current={item.value} previous={item.prev} />
              )}
            </div>
          </div>
        ))}
      </motion.div>

      {/* Chart + Receipt layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
          transition={{ duration: 0.5, delay: 0.3 }}
          className="bg-white/[0.03] backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden"
        >
          {/* Receipt header */}
          <div className="px-4 py-3 border-b border-white/10">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
                Spending Breakdown
              </h3>
              <span className="text-sm font-bold text-white">
                {formatCurrency(taxEstimate.totalFederalTax)}
              </span>
            </div>
          </div>

          {/* Receipt lines */}
          <div className="max-h-[600px] overflow-y-auto">
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
          <div className="px-4 py-3 border-t border-white/10 bg-white/5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-300">TOTAL</span>
              <span className="text-sm font-bold text-white">
                {formatCurrency(taxEstimate.totalFederalTax)}
              </span>
            </div>
          </div>

          {/* Contact reps button — inside receipt card */}
          {representatives && representatives.length > 0 && (
            <div className="px-4 py-3 border-t border-white/5">
              <button
                onClick={() => setShowRepsModal(true)}
                className="w-full py-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-sm text-indigo-400 hover:bg-indigo-500/20 transition-colors font-medium cursor-pointer"
              >
                See How Your Reps Voted
              </button>
            </div>
          )}
        </motion.div>
      </div>

      {/* Bills panel — prominent, below chart+receipt */}
      <div className="mt-10">
        <BillsPanel
          activeCategoryId={activeCategoryId}
          activeCategoryName={
            activeCategoryId
              ? spending.find((s) => s.category.id === activeCategoryId)?.category.name ?? null
              : null
          }
          totalFederalTax={taxEstimate.totalFederalTax}
          representatives={representatives}
        />
      </div>

      {/* Nudge to add ZIP if not provided */}
      {!representatives && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="text-center p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20"
        >
          <p className="text-sm text-gray-300">
            Want to see how your representatives voted on these spending decisions?
          </p>
          <button
            onClick={onBack}
            className="mt-2 text-sm text-indigo-400 hover:text-indigo-300 font-medium transition-colors cursor-pointer"
          >
            ← Go back and add your ZIP code
          </button>
        </motion.div>
      )}

      {/* Source attribution */}
      <div className="text-center pt-4">
        <p className="text-[10px] text-gray-600">
          Spending data:{" "}
          <a href="https://www.whitehouse.gov/omb/budget/historical-tables/" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-400 underline">OMB Historical Tables</a>
          {" · "}Tax brackets:{" "}
          <a href="https://www.irs.gov/taxtopics/tc751" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-400 underline">IRS</a>
          {" · "}Bills:{" "}
          <a href="https://www.congress.gov/" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-400 underline">Congress.gov</a>
          {" · "}Cost estimates:{" "}
          <a href="https://www.cbo.gov/cost-estimates" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-400 underline">CBO</a>
        </p>
      </div>

      {/* Representatives modal */}
      {representatives && (
        <RepresentativesModal
          isOpen={showRepsModal}
          onClose={() => setShowRepsModal(false)}
          representatives={representatives}
          votes={votes}
        />
      )}
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
      className={`ml-1.5 text-[10px] font-medium ${
        isUp ? "text-red-400" : "text-green-400"
      }`}
    >
      {isUp ? "+" : ""}{formatCurrency(delta)}
    </span>
  );
}
