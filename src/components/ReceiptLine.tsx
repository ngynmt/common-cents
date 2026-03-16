"use client";

import { motion, AnimatePresence } from "framer-motion";
import { TRANSITION_DEFAULT, STAGGER_DELAY } from "@/lib/constants";
import type { PersonalSpendingCategory } from "@/lib/spending";
import { calculateSubcategorySpending } from "@/lib/spending";
import { formatCurrency, formatPercent } from "@/lib/tax";
import type { Legislation } from "@/data/budget";
import InfoTooltip from "./InfoTooltip";

interface ReceiptLineProps {
  item: PersonalSpendingCategory;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  isActive: boolean;
  previousAmount?: number; // for year-over-year comparison
}

function StatusBadge({ status }: { status: Legislation["status"] }) {
  const styles: Record<string, string> = {
    enacted: "bg-green-500/20 text-green-400",
    passed_house: "bg-blue-500/20 text-blue-400",
    passed_senate: "bg-blue-500/20 text-blue-400",
    in_committee: "bg-yellow-500/20 text-yellow-400",
    introduced: "bg-slate-500/20 text-slate-400",
  };

  const labels: Record<string, string> = {
    enacted: "Enacted",
    passed_house: "Passed House",
    passed_senate: "Passed Senate",
    in_committee: "In Committee",
    introduced: "Introduced",
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

export default function ReceiptLine({
  item,
  index,
  isExpanded,
  onToggle,
  isActive,
  previousAmount,
}: ReceiptLineProps) {
  const subcategories = calculateSubcategorySpending(item.amount, item.category);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ ...TRANSITION_DEFAULT, delay: index * STAGGER_DELAY }}
      className="border-b border-white/8 last:border-b-0"
    >
      {/* Main line item */}
      <button
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-label={`${item.category.name}: ${formatCurrency(item.amount)}, ${formatPercent(item.percentage / 100)} of your taxes`}
        className={`w-full px-4 py-3 flex items-center gap-3 transition-all hover:bg-white/5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:ring-inset ${
          isActive ? "bg-white/5" : ""
        }`}
      >
        {/* Color indicator */}
        <div
          className="w-3 h-3 rounded-full shrink-0"
          style={{ backgroundColor: item.category.color }}
        />

        {/* Icon */}
        <span className="text-lg shrink-0">{item.category.icon}</span>

        {/* Category name */}
        <span className="text-sm font-medium text-white text-left flex-1 min-w-0 truncate">
          {item.category.name}
        </span>

        {/* Dotted leader */}
        <span className="flex-1 border-b border-dotted border-white/10 mx-2 self-end mb-1" aria-hidden="true" />

        {/* Amount & percentage */}
        <div className="text-right shrink-0">
          <div className="text-sm font-semibold text-white font-amount">
            {formatCurrency(item.amount)}
          </div>
          {previousAmount !== undefined && Math.abs(item.amount - previousAmount) >= 1 ? (
            <div className={`text-[10px] font-medium font-amount ${item.amount > previousAmount ? "text-red-400" : "text-green-400"}`}>
              {item.amount > previousAmount ? "+" : ""}{formatCurrency(item.amount - previousAmount)}
            </div>
          ) : (
            <div className="text-xs text-slate-400">
              {formatPercent(item.percentage / 100)}
            </div>
          )}
        </div>

        {/* Expand arrow */}
        <motion.span
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-slate-400 shrink-0 text-lg"
          aria-hidden="true"
        >
          ▾
        </motion.span>
      </button>

      {/* Expanded detail */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="px-4 pt-2 pb-4 space-y-4">
              {/* Description */}
              <p className="text-sm text-slate-400 pl-10">
                {item.category.description}
              </p>

              {/* Subcategories */}
              <div className="pl-10 space-y-1">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 inline-flex items-center gap-1.5">
                  Breakdown
                  <InfoTooltip position="below">
                    Each subcategory shows how much of your tax contribution to {item.category.name} goes to that program. Amounts are calculated by applying the federal budget&apos;s percentage breakdown to your personal tax payment. Percentages are relative to this category, not your total taxes.
                  </InfoTooltip>
                </h4>
                {subcategories.map((sub, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-slate-300 truncate">
                        {sub.subcategory.name}
                      </div>
                      {sub.subcategory.agencies && (
                        <div className="text-xs text-slate-400 truncate">
                          {sub.subcategory.agencies.join(", ")}
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <div className="text-sm text-white font-medium font-amount">
                        {formatCurrency(sub.amount)}
                      </div>
                      <div className="text-xs text-slate-400">
                        {formatPercent(sub.percentage / 100)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Bar visualization for subcategories */}
              <div className="pl-10">
                <div className="flex h-3 rounded-full overflow-hidden bg-white/5">
                  {subcategories.map((sub, i) => (
                    <motion.div
                      key={i}
                      initial={{ width: 0 }}
                      animate={{ width: `${sub.percentage}%` }}
                      transition={{ duration: 0.5, delay: i * 0.05 }}
                      className="h-full"
                      style={{
                        backgroundColor: item.category.color,
                        opacity: 1 - i * 0.12,
                      }}
                      title={`${sub.subcategory.name}: ${formatPercent(sub.percentage / 100)}`}
                    />
                  ))}
                </div>
              </div>

              {/* Recent Legislation */}
              {item.category.legislation.length > 0 && (
                <div className="pl-10 space-y-2">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Recent Legislation
                  </h4>
                  {item.category.legislation.map((bill, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-lg bg-white/5 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <a
                          href={bill.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
                        >
                          {bill.title}<span className="sr-only-inline"> (opens in new tab)</span>
                        </a>
                        <StatusBadge status={bill.status} />
                      </div>
                      <p className="text-xs text-slate-400">{bill.summary}</p>
                      <p className="text-xs text-slate-400">
                        <span className="text-slate-400">Impact:</span> {bill.impact}
                      </p>
                      <div className="text-xs text-slate-400">
                        Sponsors: {bill.sponsors.join(", ")}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
