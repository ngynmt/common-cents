"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { formatCurrency } from "@/lib/tax";
import type { ContractorInfluence } from "@/lib/influence";

interface InfluenceChainProps {
  /** The contractor or entity name to look up */
  contractorName: string;
}

const partyColors: Record<string, string> = {
  D: "text-blue-400",
  R: "text-red-400",
  I: "text-purple-400",
};

function formatCompact(n: number): string {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return formatCurrency(n);
}

export default function InfluenceChain({ contractorName }: InfluenceChainProps) {
  const [expanded, setExpanded] = useState(false);
  const [data, setData] = useState<ContractorInfluence | null | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }

    setExpanded(true);

    // Only fetch once
    if (data !== undefined) return;

    setLoading(true);
    try {
      const res = await fetch(
        `/api/contractor-influence?contractor=${encodeURIComponent(contractorName)}`,
      );
      if (!res.ok) {
        setData(null);
        return;
      }
      const json = await res.json();
      setData(json.influence ?? null);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-2">
      <button
        onClick={handleToggle}
        className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded flex items-center gap-1"
      >
        <motion.span
          animate={{ rotate: expanded ? 90 : 0 }}
          transition={{ duration: 0.15 }}
          className="inline-block"
          aria-hidden="true"
        >
          ▸
        </motion.span>
        Follow the Money
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
            <div className="mt-2 p-3 rounded-lg bg-white/5 border border-white/10 space-y-2">
              {loading && (
                <div className="space-y-2">
                  <div className="h-3 w-48 bg-white/10 rounded animate-pulse" />
                  <div className="h-3 w-36 bg-white/10 rounded animate-pulse" />
                </div>
              )}

              {!loading && data === null && (
                <p className="text-[10px] text-gray-500">
                  No campaign contribution data found for this contractor.
                </p>
              )}

              {!loading && data && (
                <>
                  {/* Summary */}
                  <div className="text-[10px] text-gray-400">
                    <span className="text-white font-medium">{data.contractorName}</span>
                    {" "}employees donated{" "}
                    <span className="text-indigo-400 font-medium">
                      {formatCompact(data.totalDonations)}
                    </span>
                    {" "}to members of Congress
                    <span className="text-gray-500"> ({data.cycle} cycle)</span>
                  </div>

                  {/* Flow arrow */}
                  <div className="flex items-center gap-1 text-gray-600">
                    <span className="text-[10px]">↓</span>
                    <span className="text-[10px]">Top recipients</span>
                  </div>

                  {/* Top recipients */}
                  <div className="space-y-1">
                    {data.topRecipients.slice(0, 5).map((r) => (
                      <div
                        key={r.candidateId || r.recipientName}
                        className="flex items-center justify-between text-[10px]"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`font-medium ${partyColors[r.recipientParty] || "text-gray-400"}`}>
                            {r.recipientName}
                          </span>
                          {r.recipientState && (
                            <span className="text-gray-600 shrink-0">
                              ({r.recipientParty}-{r.recipientState})
                            </span>
                          )}
                        </div>
                        <span className="text-gray-400 font-medium shrink-0 ml-2">
                          {formatCompact(r.total)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Source */}
                  <p className="text-[9px] text-gray-600 pt-1 border-t border-white/5">
                    Source:{" "}
                    <a
                      href="https://www.fec.gov"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-500 hover:text-gray-400 underline"
                    >
                      FEC<span className="sr-only"> (opens in new tab)</span>
                    </a>
                    {" · "}Employee contributions do not imply corporate endorsement
                  </p>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
