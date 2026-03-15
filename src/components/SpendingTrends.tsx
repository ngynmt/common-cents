"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CATEGORY_LABELS } from "@/lib/expenditures";
import type { SpendingTrend } from "@/app/api/spending-trends/route";
import { enrichedTrends } from "@/data/enriched-trends";
import InfoTooltip from "./InfoTooltip";

/** Only show trends with changes above this threshold */
const ANOMALY_THRESHOLD = 15; // percent

function formatCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${(n / 1e3).toFixed(0)}K`;
}

function formatMonth(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export default function SpendingTrends() {
  const [trends, setTrends] = useState<SpendingTrend[]>([]);
  const [recordDate, setRecordDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const fetchTrends = async () => {
    setLoading(true);
    setFetchError(false);
    try {
      const res = await fetch("/api/spending-trends");
      if (!res.ok) {
        setFetchError(true);
        return;
      }
      const data = await res.json();
      setTrends(data.trends ?? []);
      setRecordDate(data.recordDate ?? null);
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const doFetch = async () => {
      try {
        const res = await fetch("/api/spending-trends");
        if (!res.ok) {
          if (!cancelled) setFetchError(true);
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setTrends(data.trends ?? []);
          setRecordDate(data.recordDate ?? null);
        }
      } catch {
        if (!cancelled) setFetchError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    doFetch();
    return () => { cancelled = true; };
  }, []);

  // Only show outlays with significant changes
  const anomalies = trends.filter(
    (t) => t.type === "outlay" && Math.abs(t.changePercent) >= ANOMALY_THRESHOLD,
  );

  // Notable receipt changes (tariffs, etc.)
  const receiptAnomalies = trends.filter(
    (t) => t.type === "receipt" && Math.abs(t.changePercent) >= ANOMALY_THRESHOLD,
  );

  if (loading) {
    return (
      <div className="h-16 rounded-xl bg-white/5 border border-white/10 animate-pulse" />
    );
  }

  if (fetchError) {
    return (
      <div className="rounded-xl bg-white/[0.03] border border-white/10 px-4 py-3 flex items-center justify-between">
        <span className="text-xs text-gray-500">Unable to load spending trends.</span>
        <button
          onClick={fetchTrends}
          className="text-xs text-indigo-400 hover:text-indigo-300 underline cursor-pointer focus:outline-none"
        >
          Retry
        </button>
      </div>
    );
  }

  if (anomalies.length === 0 && receiptAnomalies.length === 0) {
    return null; // Nothing noteworthy to show
  }

  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/10">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:ring-inset hover:bg-white/[0.02] transition-colors rounded-xl"
      >
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2" aria-hidden="true">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400"></span>
          </span>
          <span className="text-xs font-semibold text-white inline-flex items-center gap-1.5">
            Notable Spending Changes vs. Last Year
            <InfoTooltip width="w-64">
              These are fiscal year-to-date comparisons from the Monthly Treasury Statement — not full-year totals. They compare spending so far this fiscal year (starting Oct 1) to the same period last year. Only changes above {ANOMALY_THRESHOLD}% are shown to highlight the most significant shifts. Source: U.S. Treasury Fiscal Data.
            </InfoTooltip>
          </span>
          {recordDate && (
            <span className="text-[10px] text-gray-500">
              as of {formatMonth(recordDate)}
            </span>
          )}
        </div>
        <motion.span
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-gray-500 text-lg"
          aria-hidden="true"
        >
          ▾
        </motion.span>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pt-1 pb-3 space-y-3">
              {/* Outlay anomalies */}
              {anomalies.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider">
                    Spending
                  </div>
                  {anomalies.map((t) => (
                    <TrendRow key={t.classification} trend={t} />
                  ))}
                </div>
              )}

              {/* Receipt anomalies */}
              {receiptAnomalies.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider">
                    Revenue (taxes &amp; tariffs)
                  </div>
                  {receiptAnomalies.map((t) => (
                    <TrendRow key={t.classification} trend={t} />
                  ))}
                </div>
              )}

              <p className="text-[9px] text-gray-600 pt-1 border-t border-white/5">
                Fiscal year-to-date vs. same period last year. Only showing changes above {ANOMALY_THRESHOLD}%.{" "}
                Explanations are AI-generated and may not reflect all factors.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Contextual notes explaining what changes in specific categories mean for everyday people */
const CONSUMER_NOTES: Record<string, string> = {
  customs: "Tariff costs are largely passed on to consumers through higher prices on imported goods.",
  "corp-tax": "Economists debate whether corporate tax changes are borne by shareholders, workers, or consumers through prices.",
  interest: "Rising interest costs reduce funding available for other programs and services.",
};

function TrendRow({ trend }: { trend: SpendingTrend }) {
  const isUp = trend.changePercent > 0;
  // For outlays: up = more spending (red), down = less spending (green)
  // For receipts like customs/tariffs: up = more cost to consumers (red)
  // For other receipts (income tax, corp tax): up = more revenue (neutral/green)
  const isConsumerCost = trend.type === "receipt" && trend.categoryId === "customs";
  const isPositive = isConsumerCost
    ? !isUp
    : trend.type === "receipt"
      ? isUp
      : !isUp;

  const label = trend.type === "outlay"
    ? CATEGORY_LABELS[trend.categoryId] || trend.classification
    : trend.classification;

  const consumerNote = CONSUMER_NOTES[trend.categoryId];

  // Bar width proportional to absolute change, capped at 100%
  const barWidth = Math.min(Math.abs(trend.changePercent) / 100, 1) * 100;

  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-gray-300">{label}</span>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <span className="text-[9px] text-gray-500">
            {formatCompact(trend.currentFytd)} vs {formatCompact(trend.priorFytd)}
          </span>
          <span
            className={`font-medium ${isPositive ? "text-green-400" : "text-red-400"}`}
          >
            {isUp ? "+" : ""}{trend.changePercent}%
          </span>
        </div>
      </div>
      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${barWidth}%` }}
          transition={{ duration: 0.5 }}
          className={`h-full rounded-full ${isPositive ? "bg-green-500/50" : "bg-red-500/50"}`}
        />
      </div>
      {consumerNote && (
        <p className="text-[9px] text-amber-400/80 mt-0.5">
          {consumerNote}
        </p>
      )}
      {!consumerNote && enrichedTrends[trend.classification]?.whyItMatters && (
        <p className="text-[9px] text-gray-400 mt-0.5">
          {enrichedTrends[trend.classification].whyItMatters}
        </p>
      )}
    </div>
  );
}
