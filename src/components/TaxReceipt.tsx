"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { TaxEstimate } from "@/lib/tax";
import { formatCurrency, formatPercent } from "@/lib/tax";
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
  const spending = calculatePersonalSpending(taxEstimate.totalFederalTax);

  const handleCategoryClick = (categoryId: string) => {
    if (expandedCategory === categoryId) {
      setExpandedCategory(null);
      setActiveCategoryId(null);
    } else {
      setExpandedCategory(categoryId);
      setActiveCategoryId(categoryId);
    }
  };

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
        <div className="flex items-center justify-center gap-6 text-sm text-gray-400">
          <span>
            Income: <span className="text-white font-medium">{formatCurrency(taxEstimate.grossIncome)}</span>
          </span>
          <span>
            Est. Federal Tax: <span className="text-white font-medium">{formatCurrency(taxEstimate.totalFederalTax)}</span>
          </span>
          <span>
            Effective Rate: <span className="text-white font-medium">{formatPercent(taxEstimate.effectiveRate)}</span>
          </span>
        </div>
        <p className="text-xs text-gray-500 max-w-lg mx-auto">
          This is an estimate based on standard deduction and {new Date().getFullYear()} tax brackets.
          Your actual taxes may differ based on deductions, credits, and other factors.
        </p>
      </motion.div>

      {/* Tax breakdown mini-summary */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="grid grid-cols-3 gap-3 max-w-lg mx-auto"
      >
        {[
          { label: "Income Tax", value: taxEstimate.federalIncomeTax },
          { label: "Social Security", value: taxEstimate.socialSecurityTax },
          { label: "Medicare", value: taxEstimate.medicareTax },
        ].map((item) => (
          <div key={item.label} className="text-center p-3 rounded-xl bg-white/5">
            <div className="text-xs text-gray-400">{item.label}</div>
            <div className="text-sm font-semibold text-white">{formatCurrency(item.value)}</div>
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
            {spending.map((item, index) => (
              <ReceiptLine
                key={item.category.id}
                item={item}
                index={index}
                isExpanded={expandedCategory === item.category.id}
                onToggle={() => handleCategoryClick(item.category.id)}
                isActive={activeCategoryId === item.category.id}
              />
            ))}
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
          <a href="https://www.irs.gov/newsroom/irs-provides-tax-inflation-adjustments-for-tax-year-2024" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-400 underline">IRS Rev. Proc. 2023-34</a>
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
