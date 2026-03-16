"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TRANSITION_DEFAULT } from "@/lib/constants";
import { formatCurrency } from "@/lib/tax";
import { calculatePersonalCost, calculateBillPersonalCost, CATEGORY_LABELS, type FederalContract } from "@/lib/expenditures";
import type { PendingBill } from "@/data/pending-bills";
import InfluenceChain from "./InfluenceChain";
import { enrichedContracts } from "@/data/enriched-contracts";
import InfoTooltip from "./InfoTooltip";

interface RecentExpendituresProps {
  totalFederalTax: number;
}

type SortMode = "amount" | "date";

function formatCompact(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return formatCurrency(n);
}

function titleCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\b(Llc|Inc|Corp|Ltd|Lp|Llp)\b/gi, (m) => m.toUpperCase());
}

function ContractCard({
  contract,
  personalCost,
  personalCostTax,
}: {
  contract: FederalContract;
  personalCost: number;
  personalCostTax: number;
}) {
  const [descExpanded, setDescExpanded] = useState(false);
  const description = enrichedContracts[contract.id]?.summary || contract.description || "Federal contract award";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={TRANSITION_DEFAULT}
      className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-white truncate">
              {titleCase(contract.recipientName)}
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-500/20 text-indigo-400 shrink-0">
              {CATEGORY_LABELS[contract.categoryId] || contract.categoryId}
            </span>
          </div>
          <p className={`text-xs text-slate-400 mt-1${!descExpanded ? " line-clamp-3" : ""}`}>
            {description}
          </p>
          {description.length > 120 && (
            <button
              onClick={() => setDescExpanded((prev) => !prev)}
              className="text-xs text-indigo-400 hover:text-indigo-300 mt-1 cursor-pointer focus:outline-none"
            >
              {descExpanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-bold text-white font-amount">
            {formatCompact(contract.amount)}
          </div>
          <div className="text-[10px] text-indigo-400 font-medium inline-flex items-center gap-1">
            Cost you: <span className="font-amount">{formatCurrency(personalCost)}</span>
            <InfoTooltip width="w-60">
              Your personal cost = (contract amount &divide; $4.9T total federal revenue) &times; your federal tax. This proportionally distributes the contract cost across all taxpayers based on your tax contribution.
              {contract.annualizedAmount && " The /yr figure assumes the contract continues at its current spending rate."}
            </InfoTooltip>
          </div>
          {contract.annualizedAmount && (
            <div className="text-[9px] text-slate-400 font-amount">
              ~{formatCurrency(calculatePersonalCost(contract.annualizedAmount, personalCostTax))}/yr
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between text-[10px] text-slate-400">
        <span>{contract.awardingAgency}</span>
        <a
          href={contract.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-slate-400 hover:text-slate-300 underline"
        >
          USASpending.gov<span className="sr-only"> (opens in new tab)</span>
        </a>
      </div>
      <InfluenceChain contractorName={contract.recipientName} />
    </motion.div>
  );
}

function EnactedBillCard({
  bill,
  personalCost,
}: {
  bill: PendingBill;
  personalCost: number;
}) {
  const [descExpanded, setDescExpanded] = useState(false);
  const description = bill.summary || bill.title;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={TRANSITION_DEFAULT}
      className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-white">
              {bill.shortTitle}
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400 shrink-0">
              Enacted
            </span>
            {bill.publicLawNumber && (
              <span className="text-xs text-slate-400">
                {bill.publicLawNumber}
              </span>
            )}
          </div>
          <p className={`text-xs text-slate-400 mt-1${!descExpanded ? " line-clamp-3" : ""}`}>
            {description}
          </p>
          {description.length > 120 && (
            <button
              onClick={() => setDescExpanded((prev) => !prev)}
              className="text-xs text-indigo-400 hover:text-indigo-300 mt-1 cursor-pointer focus:outline-none"
            >
              {descExpanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>
        {bill.totalAnnualImpact !== 0 && (
          <div className="text-right shrink-0">
            <div className="text-sm font-bold text-white font-amount">
              {formatCompact(Math.abs(bill.totalAnnualImpact) * 1e9)}/yr
            </div>
            <div className="text-[10px] text-indigo-400 font-medium">
              Cost you: <span className="font-amount">{formatCurrency(personalCost)}</span>/yr
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between text-[10px] text-slate-400">
        <span>{bill.enactedDate || bill.lastActionDate}</span>
        {bill.congressUrl && (
          <a
            href={bill.congressUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 hover:text-slate-300 underline"
          >
            Congress.gov<span className="sr-only"> (opens in new tab)</span>
          </a>
        )}
      </div>
    </motion.div>
  );
}

export default function RecentExpenditures({ totalFederalTax }: RecentExpendituresProps) {
  const [contracts, setContracts] = useState<FederalContract[]>([]);
  const [enactedBills, setEnactedBills] = useState<PendingBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [contractPage, setContractPage] = useState(1);
  const [sortMode, setSortMode] = useState<SortMode>("amount");
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      setError(false);

      const results = await Promise.allSettled([
        fetch("/api/contracts?days=180&min_amount=100000000&page=1")
          .then((r) => r.json())
          .then((d) => ({ contracts: d.contracts ?? [], hasMore: d.hasMore ?? false })),
        fetch("/api/bills?status=enacted&days=180")
          .then((r) => r.json())
          .then((d) => d.bills ?? []),
      ]);

      if (cancelled) return;

      const contractsResult = results[0];
      const billsResult = results[1];

      if (contractsResult.status === "fulfilled") {
        setContracts(contractsResult.value.contracts);
        setHasMore(contractsResult.value.hasMore);
      }
      if (billsResult.status === "fulfilled") {
        setEnactedBills(billsResult.value);
      }

      const allFailed =
        contractsResult.status === "rejected" && billsResult.status === "rejected";
      setError(allFailed);
      setLoading(false);
    }

    fetchData();
    return () => { cancelled = true; };
  }, []);

  const [rateLimited, setRateLimited] = useState(false);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || rateLimited) return;
    setLoadingMore(true);

    const nextPage = contractPage + 1;
    try {
      const res = await fetch(`/api/contracts?days=180&min_amount=100000000&page=${nextPage}`);
      if (res.status === 429) {
        setRateLimited(true);
        const retryAfter = parseInt(res.headers.get("Retry-After") || "60", 10);
        setTimeout(() => setRateLimited(false), retryAfter * 1000);
        return;
      }
      const data = await res.json();
      const newContracts: FederalContract[] = data.contracts ?? [];
      setContracts((prev) => [...prev, ...newContracts]);
      setHasMore(data.hasMore ?? false);
      setContractPage(nextPage);
    } catch {
      // Silently fail — user can retry
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, contractPage, rateLimited]);

  type Item =
    | { type: "contract"; data: FederalContract; date: string; amount: number; category: string }
    | { type: "bill"; data: PendingBill; date: string; amount: number; category: string };

  // Unique categories present in the data for the filter dropdown
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const c of contracts) cats.add(c.categoryId);
    for (const b of enactedBills) {
      if (b.impactedCategories[0]) cats.add(b.impactedCategories[0]);
    }
    return Array.from(cats).sort((a, b) =>
      (CATEGORY_LABELS[a] || a).localeCompare(CATEGORY_LABELS[b] || b),
    );
  }, [contracts, enactedBills]);

  const sortedItems = useMemo(() => {
    let items: Item[] = [
      ...contracts.map((c) => ({
        type: "contract" as const,
        data: c,
        date: c.startDate,
        amount: c.amount,
        category: c.categoryId,
      })),
      ...enactedBills.map((b) => ({
        type: "bill" as const,
        data: b,
        date: b.enactedDate || b.lastActionDate,
        amount: Math.abs(b.totalAnnualImpact) * 1e9,
        category: b.impactedCategories[0] || "",
      })),
    ];

    if (filterCategory) {
      items = items.filter((item) => item.category === filterCategory);
    }

    switch (sortMode) {
      case "amount":
        items.sort((a, b) => b.amount - a.amount);
        break;
      case "date":
        items.sort((a, b) => b.date.localeCompare(a.date));
        break;
    }

    return items;
  }, [contracts, enactedBills, sortMode, filterCategory]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 rounded-xl bg-white/5 border border-white/10 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (error || (contracts.length === 0 && enactedBills.length === 0)) {
    return (
      <div className="text-center py-8 text-slate-400 text-sm space-y-2">
        <p>
          {error
            ? "Unable to fetch recent spending data."
            : "No recent expenditures found."}
        </p>
        {error && (
          <button
            onClick={() => {
              setError(false);
              setLoading(true);
              setContractPage(1);
              // Re-trigger the effect by forcing a re-mount isn't possible,
              // so we inline the fetch logic
              Promise.allSettled([
                fetch("/api/contracts?days=180&min_amount=100000000&page=1")
                  .then((r) => r.json())
                  .then((d) => ({ contracts: d.contracts ?? [], hasMore: d.hasMore ?? false })),
                fetch("/api/bills?status=enacted&days=180")
                  .then((r) => r.json())
                  .then((d) => d.bills ?? []),
              ]).then((results) => {
                if (results[0].status === "fulfilled") {
                  setContracts(results[0].value.contracts);
                  setHasMore(results[0].value.hasMore);
                }
                if (results[1].status === "fulfilled") {
                  setEnactedBills(results[1].value);
                }
                const allFailed = results[0].status === "rejected" && results[1].status === "rejected";
                setError(allFailed);
                setLoading(false);
              });
            }}
            className="text-indigo-400 hover:text-indigo-300 underline cursor-pointer focus:outline-none text-sm"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-white">
        How Your Tax Dollars Were Spent in the Last 6 Months
      </h3>

      {/* Sort + filter controls */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1">
          <span className="text-xs text-slate-400 mr-1">Sort by</span>
          {([
            { key: "amount" as SortMode, label: "Amount" },
            { key: "date" as SortMode, label: "Recent" },
          ]).map((option) => (
            <button
              key={option.key}
              onClick={() => setSortMode(option.key)}
              className={`text-xs px-2.5 py-1 rounded-full transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                sortMode === option.key
                  ? "bg-white/10 text-white"
                  : "text-slate-400 hover:text-slate-300"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="category-filter" className="text-xs text-slate-400">
            Category
          </label>
          <select
            id="category-filter"
            value={filterCategory || ""}
            onChange={(e) => setFilterCategory(e.target.value || null)}
            className="text-xs bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="">All</option>
            {availableCategories.map((catId) => (
              <option key={catId} value={catId}>
                {CATEGORY_LABELS[catId] || catId}
              </option>
            ))}
          </select>
        </div>
      </div>

      <AnimatePresence>
        {sortedItems.map((item) => {
          if (item.type === "contract") {
            const pc = calculatePersonalCost(item.data.amount, totalFederalTax);
            return (
              <ContractCard
                key={item.data.id}
                contract={item.data}
                personalCost={pc}
                personalCostTax={totalFederalTax}
              />
            );
          } else {
            const pc = calculateBillPersonalCost(item.data, totalFederalTax);
            return (
              <EnactedBillCard
                key={item.data.id}
                bill={item.data}
                personalCost={pc}
              />
            );
          }
        })}
      </AnimatePresence>

      {/* Load more */}
      {hasMore && (
        <div className="text-center pt-2">
          <button
            onClick={loadMore}
            disabled={loadingMore || rateLimited}
            className="text-xs px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {rateLimited
              ? "Too many requests — try again shortly"
              : loadingMore
                ? "Loading..."
                : "Load More Contracts"}
          </button>
        </div>
      )}

      <p className="text-center text-[10px] text-slate-400 mt-2">
        <a href="https://www.usaspending.gov" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-slate-300 underline">
          USASpending.gov<span className="sr-only"> (opens in new tab)</span>
        </a>
        {" · "}
        <a href="https://www.congress.gov" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-slate-300 underline">
          Congress.gov<span className="sr-only"> (opens in new tab)</span>
        </a>
        {" · "}
        <a href="https://fiscaldata.treasury.gov/datasets/monthly-treasury-statement/" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-slate-300 underline">
          Treasury MTS<span className="sr-only"> (opens in new tab)</span>
        </a>
        {" · "}Some descriptions are AI-summarized
      </p>
    </div>
  );
}
