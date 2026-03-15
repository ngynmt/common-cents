"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { pendingBills, getBillImpactForCategory, type PendingBill } from "@/data/pending-bills";
import { TOTAL_FEDERAL_SPENDING, getBudgetData } from "@/data/budget";
import { formatCurrency } from "@/lib/tax";
import type { Representative } from "@/data/representatives";
import { useEngagement } from "@/lib/useEngagement";
import { trackBillViewed, trackBillVoted, trackRepContactClicked } from "@/lib/analytics";
import BillInfluenceChain from "./BillInfluenceChain";

type SortMode = "impact" | "date" | "likelihood";

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

interface BillsPanelProps {
  activeCategoryId: string | null;
  activeCategoryName: string | null;
  totalFederalTax: number;
  representatives: Representative[] | null;
}

function LikelihoodDot({ likelihood }: { likelihood: PendingBill["passageLikelihood"] }) {
  const colors: Record<string, string> = {
    high: "bg-green-400",
    medium: "bg-yellow-400",
    low: "bg-gray-400",
    enacted: "bg-indigo-400",
  };
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${colors[likelihood]}`}
      role="img"
      aria-label={`${likelihood} likelihood of passing`}
    />
  );
}

function StatusPill({ status }: { status: PendingBill["status"] }) {
  const labels: Record<string, string> = {
    passed_house: "Passed House",
    passed_senate: "Passed Senate",
    in_committee: "In Committee",
    introduced: "Introduced",
    floor_vote_scheduled: "Vote Scheduled",
    enacted: "Enacted",
  };
  const styles: Record<string, string> = {
    passed_house: "bg-blue-500/20 text-blue-400",
    passed_senate: "bg-blue-500/20 text-blue-400",
    in_committee: "bg-yellow-500/20 text-yellow-400",
    introduced: "bg-gray-500/20 text-gray-400",
    floor_vote_scheduled: "bg-orange-500/20 text-orange-400",
    enacted: "bg-green-500/20 text-green-400",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function PartyTag({ party, name, state }: { party: string; name: string; state: string }) {
  const colors: Record<string, string> = {
    D: "text-blue-400",
    R: "text-red-400",
    I: "text-purple-400",
  };
  const fullParty: Record<string, string> = {
    D: "Democrat",
    R: "Republican",
    I: "Independent",
  };
  return (
    <span className={`text-xs ${colors[party]}`}>
      {name} (<abbr title={fullParty[party] ?? party} className="no-underline">{party}</abbr>-{state})
    </span>
  );
}

function ImpactBar({
  currentAmount,
  projectedAmount,
  color,
}: {
  currentAmount: number;
  projectedAmount: number;
  color: string;
}) {
  const maxAmount = Math.max(currentAmount, projectedAmount);
  const currentWidth = (currentAmount / maxAmount) * 100;
  const projectedWidth = (projectedAmount / maxAmount) * 100;
  const isIncrease = projectedAmount > currentAmount;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-gray-500 w-14 shrink-0">Now</span>
        <div className="flex-1 h-4 bg-white/5 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${currentWidth}%` }}
            transition={{ duration: 0.5 }}
            className="h-full rounded-full flex items-center justify-end pr-1.5"
            style={{ backgroundColor: color }}
          >
            <span className="text-[9px] font-semibold text-white/90">
              {formatCurrency(currentAmount)}
            </span>
          </motion.div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-gray-500 w-14 shrink-0">If passed</span>
        <div className="flex-1 h-4 bg-white/5 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: `${currentWidth}%` }}
            animate={{ width: `${projectedWidth}%` }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="h-full rounded-full flex items-center justify-end pr-1.5"
            style={{
              backgroundColor: color,
              opacity: 0.7,
              backgroundImage: isIncrease
                ? `repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.1) 2px, rgba(255,255,255,0.1) 4px)`
                : undefined,
            }}
          >
            <span className="text-[9px] font-semibold text-white/90">
              {formatCurrency(projectedAmount)}
            </span>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export default function BillsPanel({
  activeCategoryId,
  activeCategoryName,
  totalFederalTax,
  representatives,
}: BillsPanelProps) {
  const [sortMode, setSortMode] = useState<SortMode>("impact");
  const [expandedBill, setExpandedBill] = useState<string | null>(null);
  const [stance, setStance] = useState<Record<string, "support" | "oppose">>({});
  // Keyed as "billId::repId" (using :: to avoid conflicts with hyphens in IDs)
  const [contactRep, setContactRep] = useState<string | null>(null);
  // Track which bills the user has already voted on (prevent double-counting)
  const [userVoted, setUserVoted] = useState<Record<string, boolean>>({});

  // Engagement counters
  const allBillIds = useMemo(() => pendingBills.map((b) => b.id), []);
  const { data: engagement, recordAction } = useEngagement(allBillIds);

  // Filter and sort bills
  const filteredBills = useMemo(() => {
    const bills = activeCategoryId
      ? pendingBills.filter((b) => b.impactedCategories.includes(activeCategoryId))
      : [...pendingBills];

    switch (sortMode) {
      case "impact":
        bills.sort((a, b) => Math.abs(b.totalAnnualImpact) - Math.abs(a.totalAnnualImpact));
        break;
      case "date":
        bills.sort((a, b) => new Date(b.lastActionDate).getTime() - new Date(a.lastActionDate).getTime());
        break;
      case "likelihood": {
        const order: Record<string, number> = { enacted: -1, high: 0, medium: 1, low: 2 };
        bills.sort((a, b) => order[a.passageLikelihood] - order[b.passageLikelihood]);
        break;
      }
    }

    return bills;
  }, [activeCategoryId, sortMode]);

  const getCategoryColor = (bill: PendingBill): string => {
    // Import colors from budget data
    const colors: Record<string, string> = {
      defense: "#ef4444",
      healthcare: "#ec4899",
      "social-security": "#6366f1",
      "income-security": "#8b5cf6",
      infrastructure: "#f97316",
      immigration: "#10b981",
      education: "#3b82f6",
      science: "#22c55e",
      veterans: "#14b8a6",
      interest: "#f59e0b",
      international: "#a855f7",
      justice: "#64748b",
      agriculture: "#84cc16",
      government: "#78716c",
    };
    return colors[bill.impactedCategories[0]] || "#6366f1";
  };

  const budgetCategories = useMemo(() => getBudgetData(2025), []);
  const totalSpending = TOTAL_FEDERAL_SPENDING[2025];

  const getUserImpact = (bill: PendingBill) => {
    return (bill.totalAnnualImpact / totalSpending) * totalFederalTax;
  };

  const getCurrentAmount = (bill: PendingBill) => {
    const catId = bill.impactedCategories[0];
    const impact = getBillImpactForCategory(bill, catId);
    if (!impact) return 0;
    const cat = budgetCategories.find((c) => c.id === catId);
    const catAmount = cat?.amount || 100;
    return (catAmount / totalSpending) * totalFederalTax;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
      className="w-full"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2" aria-hidden="true">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400"></span>
          </span>
          <h3 className="text-sm font-semibold text-white">
            {activeCategoryId
              ? `Bills Impacting ${activeCategoryName}`
              : "Upcoming Bills That Could Change Your Receipt"}
          </h3>
        </div>
      </div>

      {/* Sort controls */}
      <div className="flex items-center gap-1 mb-3">
        <span className="text-xs text-gray-400 mr-1">Sort by</span>
        {(
          [
            { key: "impact" as SortMode, label: "Impact" },
            { key: "date" as SortMode, label: "Recent" },
            { key: "likelihood" as SortMode, label: "Likelihood" },
          ] as const
        ).map((option) => (
          <button
            key={option.key}
            onClick={() => setSortMode(option.key)}
            className={`text-xs px-2.5 py-1 rounded-full transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              sortMode === option.key
                ? "bg-white/10 text-white"
                : "text-gray-400 hover:text-gray-300"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Bills list */}
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {filteredBills.length === 0 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-sm text-gray-500 py-4 text-center"
            >
              No pending bills for this category.
            </motion.p>
          )}

          {filteredBills.map((bill) => {
            const userImpact = getUserImpact(bill);
            const isIncrease = userImpact > 0;
            const color = getCategoryColor(bill);
            const isExpanded = expandedBill === bill.id;
            const currentAmount = getCurrentAmount(bill);
            const billStance = stance[bill.id];

            return (
              <motion.div
                key={bill.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden"
              >
                {/* Bill row — always visible */}
                <button
                  onClick={() => {
                    const willExpand = !isExpanded;
                    setExpandedBill(willExpand ? bill.id : null);
                    if (willExpand) trackBillViewed(bill.id);
                  }}
                  aria-expanded={isExpanded}
                  aria-label={`${bill.shortTitle}: ${isIncrease ? "+" : ""}${formatCurrency(userImpact)} per year`}
                  className="w-full p-3 text-left hover:bg-white/[0.03] transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:ring-inset"
                >
                  <div className="flex items-start gap-3">
                    {/* Impact indicator */}
                    <div
                      className={`mt-0.5 text-right shrink-0 w-16 py-1 px-2 rounded-lg ${
                        isIncrease ? "bg-red-500/10" : "bg-green-500/10"
                      }`}
                    >
                      <div
                        className={`text-xs font-bold ${
                          isIncrease ? "text-red-400" : "text-green-400"
                        }`}
                      >
                        {isIncrease ? "+" : ""}
                        {formatCurrency(userImpact)}
                      </div>
                      <div className="text-[10px] text-gray-500">/year</div>
                    </div>

                    {/* Bill info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-white">
                          {bill.shortTitle}
                        </span>
                        <StatusPill status={bill.status} />
                        <LikelihoodDot likelihood={bill.passageLikelihood} />
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-gray-500 font-mono">
                          {bill.billNumber}
                        </span>
                        <span className="text-[10px] text-gray-600" aria-hidden="true">·</span>
                        <PartyTag
                          party={bill.champion.party}
                          name={bill.champion.name}
                          state={bill.champion.state}
                        />
                        {bill.bipartisan && (
                          <>
                            <span className="text-[10px] text-gray-600" aria-hidden="true">·</span>
                            <span className="text-[10px] text-purple-400">Bipartisan</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Expand indicator */}
                    <motion.span
                      animate={{ rotate: isExpanded ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                      className="text-gray-500 shrink-0 mt-1 text-lg"
                      aria-hidden="true"
                    >
                      ▾
                    </motion.span>
                  </div>
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
                      <div className="px-3 pb-3 space-y-3 border-t border-white/5 pt-3">
                        {/* Summary */}
                        <p className="text-xs text-gray-400">{bill.summary}</p>

                        {/* Impact visualization */}
                        <ImpactBar
                          currentAmount={currentAmount}
                          projectedAmount={currentAmount + userImpact}
                          color={color}
                        />

                        {/* CBO detail */}
                        {bill.spendingImpacts.map((impact, i) => (
                          <div
                            key={i}
                            className="p-2.5 rounded-lg bg-white/5 text-xs text-gray-300"
                          >
                            <span className="text-gray-500">CBO Estimate: </span>
                            {impact.description}
                          </div>
                        ))}

                        {/* Metadata */}
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>{bill.cosponsors} cosponsors</span>
                          <span>Last action: {bill.lastActionDate}</span>
                        </div>

                        {/* Links */}
                        <div className="flex items-center gap-2">
                          <a
                            href={bill.congressUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs px-3 py-1.5 rounded-lg bg-white/5 text-indigo-400 hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            Full bill text<span className="sr-only-inline"> (opens in new tab)</span>
                          </a>
                          <a
                            href={bill.cboScoreUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs px-3 py-1.5 rounded-lg bg-white/5 text-indigo-400 hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            CBO score<span className="sr-only-inline"> (opens in new tab)</span>
                          </a>
                        </div>

                        {/* Follow the Money */}
                        <BillInfluenceChain champion={bill.champion} />

                        {/* Take action — support/oppose with engagement counters */}
                        <div className="space-y-2 pt-2 border-t border-white/5">
                          {(() => {
                            const billEngagement = engagement[bill.id];
                            const supportCount = billEngagement?.support || 0;
                            const opposeCount = billEngagement?.oppose || 0;
                            const contactedCount = billEngagement?.contacted || 0;
                            const totalVotes = supportCount + opposeCount;
                            const supportPct = totalVotes > 0 ? Math.round((supportCount / totalVotes) * 100) : 0;
                            const opposePct = totalVotes > 0 ? 100 - supportPct : 0;

                            return (
                              <>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs text-gray-500">
                                    What do you think?
                                  </span>
                                  <button
                                    onClick={() => {
                                      const newStance = stance[bill.id] === "support" ? undefined! : "support";
                                      setStance((s) => ({ ...s, [bill.id]: newStance }));
                                      if (newStance === "support" && !userVoted[bill.id]) {
                                        recordAction(bill.id, "support");
                                        trackBillVoted(bill.id, "support");
                                        setUserVoted((v) => ({ ...v, [bill.id]: true }));
                                      }
                                    }}
                                    className={`text-xs px-3 py-1.5 rounded-full transition-all cursor-pointer ${
                                      billStance === "support"
                                        ? "bg-green-500/20 text-green-400 border border-green-500/30"
                                        : "bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10"
                                    }`}
                                  >
                                    I support this
                                  </button>
                                  <button
                                    onClick={() => {
                                      const newStance = stance[bill.id] === "oppose" ? undefined! : "oppose";
                                      setStance((s) => ({ ...s, [bill.id]: newStance }));
                                      if (newStance === "oppose" && !userVoted[bill.id]) {
                                        recordAction(bill.id, "oppose");
                                        trackBillVoted(bill.id, "oppose");
                                        setUserVoted((v) => ({ ...v, [bill.id]: true }));
                                      }
                                    }}
                                    className={`text-xs px-3 py-1.5 rounded-full transition-all cursor-pointer ${
                                      billStance === "oppose"
                                        ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                        : "bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10"
                                    }`}
                                  >
                                    I oppose this
                                  </button>
                                </div>

                                {/* Engagement bar — show after anyone has voted */}
                                {totalVotes > 0 && (
                                  <div className="space-y-1" aria-live="polite">
                                    <div className="flex h-2 rounded-full overflow-hidden bg-white/5">
                                      <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${supportPct}%` }}
                                        transition={{ duration: 0.5 }}
                                        className="h-full bg-green-500/60"
                                      />
                                      <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${opposePct}%` }}
                                        transition={{ duration: 0.5 }}
                                        className="h-full bg-red-500/60"
                                      />
                                    </div>
                                    <div className="flex items-center justify-between text-[10px] text-gray-500">
                                      <span>
                                        <span className="text-green-400">{supportPct}%</span> support
                                        {" · "}
                                        <span className="text-red-400">{opposePct}%</span> oppose
                                      </span>
                                      <span>{formatCount(totalVotes)} votes</span>
                                    </div>
                                  </div>
                                )}

                                {/* Contact reps section */}
                                {representatives && representatives.length > 0 && (
                                  <AnimatePresence>
                                    {billStance && (
                                      <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden space-y-2"
                                      >
                                        <div className="flex items-center justify-between">
                                          <p className="text-xs text-gray-400">
                                            Contact your representative about{" "}
                                            <span className="text-white">{bill.shortTitle}</span>:
                                          </p>
                                          {contactedCount > 0 && (
                                            <span className="text-[10px] text-indigo-400 shrink-0">
                                              {formatCount(contactedCount)} people contacted their rep
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                          {representatives.map((rep) => (
                                            <button
                                              key={rep.id}
                                              onClick={() =>
                                                setContactRep(
                                                  contactRep === `${bill.id}::${rep.id}`
                                                    ? null
                                                    : `${bill.id}::${rep.id}`
                                                )
                                              }
                                              className={`text-xs px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                                                contactRep === `${bill.id}::${rep.id}`
                                                  ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30"
                                                  : "bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10"
                                              }`}
                                            >
                                              {rep.name}
                                            </button>
                                          ))}
                                        </div>

                                        <AnimatePresence>
                                          {contactRep?.startsWith(`${bill.id}::`) &&
                                            (() => {
                                              const repId = contactRep.split("::")[1];
                                              const rep = representatives.find(
                                                (r) => r.id === repId
                                              );
                                              if (!rep) return null;
                                              const script = billStance === "support"
                                                ? `Hello, my name is [Your Name] and I'm a constituent. I'm calling to urge ${rep.name} to support ${bill.billNumber}, the ${bill.shortTitle}. This bill would affect my federal taxes by approximately ${formatCurrency(Math.abs(userImpact))} per year, and I believe it is a worthwhile investment. I'd like to know the representative's position on this legislation. Thank you.`
                                                : `Hello, my name is [Your Name] and I'm a constituent. I'm calling to urge ${rep.name} to oppose ${bill.billNumber}, the ${bill.shortTitle}. This bill would change my federal tax burden by approximately ${formatCurrency(Math.abs(userImpact))} per year, and I have concerns about this spending change. I'd like to know the representative's position. Thank you.`;
                                              return (
                                                <motion.div
                                                  initial={{ height: 0, opacity: 0 }}
                                                  animate={{ height: "auto", opacity: 1 }}
                                                  exit={{ height: 0, opacity: 0 }}
                                                  className="overflow-hidden"
                                                >
                                                  <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-2">
                                                    <div className="flex items-center justify-between">
                                                      <h5 className="text-xs font-semibold text-gray-400">
                                                        Suggested Script
                                                      </h5>
                                                      <button
                                                        onClick={() =>
                                                          navigator.clipboard.writeText(script)
                                                        }
                                                        className="text-xs px-2 py-1 rounded bg-white/5 text-gray-400 hover:bg-white/10 transition-colors cursor-pointer"
                                                      >
                                                        Copy
                                                      </button>
                                                    </div>
                                                    <p className="text-xs text-gray-300 leading-relaxed italic">
                                                      &ldquo;{script}&rdquo;
                                                    </p>
                                                    <div className="flex items-center gap-2">
                                                      <a
                                                        href={`tel:${rep.phone}`}
                                                        onClick={() => { recordAction(bill.id, "contacted"); trackRepContactClicked(bill.id, "call", rep.chamber); }}
                                                        className="text-xs px-3 py-1.5 rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 transition-colors font-medium"
                                                      >
                                                        Call: {rep.phone}
                                                      </a>
                                                      <a
                                                        href={rep.contactFormUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        onClick={() => { recordAction(bill.id, "contacted"); trackRepContactClicked(bill.id, "email", rep.chamber); }}
                                                        className="text-xs px-3 py-1.5 rounded-lg bg-white/10 text-white hover:bg-white/15 transition-colors font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                      >
                                                        Email<span className="sr-only-inline"> (opens in new tab)</span>
                                                      </a>
                                                    </div>
                                                  </div>
                                                </motion.div>
                                              );
                                            })()}
                                        </AnimatePresence>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
