"use client";

import React, { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, LabelList } from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import type { CampaignFinanceSummary } from "@/data/campaign-finance";
import { formatCurrency } from "@/lib/tax";
import type { DonorContractsResult } from "@/app/api/contractor-contracts/route";
import InfoTooltip from "./InfoTooltip";

interface FinanceChartProps {
  finance: CampaignFinanceSummary;
}

const EMPLOYER_BAR_COLOR = "#60a5fa"; // blue-400 — neutral across parties
const CHART_HEIGHT = 150;

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return formatCurrency(n);
}

function truncate(s: string | null | undefined, max: number): string {
  if (!s) return "Unknown";
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

/** Observe an element's width so charts render correctly inside animated containers. */
function useContainerWidth(): [React.RefCallback<HTMLDivElement>, number] {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      if (w > 0) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);

  return [setEl, width];
}

export default function FinanceChart({ finance }: FinanceChartProps) {
  const outsideSpending = finance.outsideSpending; // null = fetch failed, [] = confirmed none
  const hasOutsideSpending = outsideSpending !== null && outsideSpending.length > 0;
  const confirmedNoOutsideSpending = outsideSpending !== null && outsideSpending.length === 0;
  const hasEmployers = finance.topEmployers.length > 0;

  const [outsideRef, outsideWidth] = useContainerWidth();
  const [employerRef, employerWidth] = useContainerWidth();

  // Outside spending chart data — top 5, color-coded by support/oppose
  const outsideData = (outsideSpending ?? []).slice(0, 5).map((d) => ({
    name: truncate(d.name, 28),
    fullName: d.name,
    total: d.total,
    support: d.support,
  }));

  // Employer chart data — top 5
  const employerData = finance.topEmployers.slice(0, 5).map((d) => ({
    name: truncate(d.employer, 25),
    fullName: d.employer,
    total: d.total,
    count: d.count,
  }));

  return (
    <div className="space-y-2">
      {/* Headline */}
      <div className="text-xs text-slate-400 inline-flex items-center gap-1">
        {finance.cycle} cycle · <span className="text-white font-medium">{formatCompact(finance.totalRaised)} total raised</span>
        <InfoTooltip width="w-60">
          A cycle is the 2-year election period (e.g., &ldquo;2024&rdquo; covers Jan 2023 &ndash; Dec 2024). &ldquo;Total raised&rdquo; includes all contributions to this candidate&apos;s principal campaign committee during that cycle. Source: FEC.gov.
        </InfoTooltip>
      </div>

      {/* Outside spending (PACs / Super PACs) — primary */}
      {confirmedNoOutsideSpending && (
        <div className="py-2 px-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <p className="text-xs text-emerald-400 font-medium">No outside spending</p>
          <p className="text-[10px] text-emerald-400/70 mt-0.5">
            No Super PAC money was spent for or against this candidate in recent cycles.
          </p>
        </div>
      )}
      {hasOutsideSpending && (
        <div className="space-y-1">
          <div className="text-xs font-serif text-slate-400 font-medium uppercase tracking-wider">
            Outside spending (Super PACs){finance.outsideSpendingCycle && finance.outsideSpendingCycle !== finance.cycle ? ` · ${finance.outsideSpendingCycle} cycle` : ""}
          </div>
          <div ref={outsideRef} className="w-full h-[150px]" role="img" aria-label={`Outside spending: ${outsideData.map((d) => `${d.fullName}: ${formatCompact(d.total)} ${d.support ? "supporting" : "opposing"}`).join(", ")}`}>
            {outsideWidth > 0 && (
              <BarChart
                data={outsideData}
                layout="vertical"
                width={outsideWidth}
                height={CHART_HEIGHT}
                margin={{ top: 0, right: 55, left: 0, bottom: 0 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={130}
                  tick={{ fill: "#94a3b8", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  labelStyle={{ color: "#fff" }}
                  itemStyle={{ color: "#94a3b8" }}
                  formatter={(value, _name, props) => {
                    const v = typeof value === "number" ? value : 0;
                    const p = props?.payload as { support?: boolean; fullName?: string } | undefined;
                    const label = p?.support ? "Supporting" : "Opposing";
                    return [
                      `${formatCurrency(v)} spent ${label.toLowerCase()}`,
                      p?.fullName ?? "",
                    ];
                  }}
                />
                <Bar dataKey="total" radius={[0, 4, 4, 0]} barSize={14}>
                  {outsideData.map((d, i) => (
                    <Cell
                      key={i}
                      fill={d.support ? "#22c55e" : "#ef4444"}
                      fillOpacity={0.7}
                    />
                  ))}
                  <LabelList
                    dataKey="total"
                    position="right"
                    formatter={(v) => formatCompact(Number(v))}
                    style={{ fill: "#9ca3af", fontSize: 10, fontFamily: "Courier New, monospace" }}
                  />
                </Bar>
              </BarChart>
            )}
          </div>
          <div className="flex items-center gap-3 text-[10px] text-slate-400">
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500/70" /> Supporting
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-red-500/70" /> Opposing
            </span>
          </div>
        </div>
      )}

      {/* Donor employers — secondary */}
      {hasEmployers && (
        <div className="space-y-1">
          <div className="text-xs font-serif text-slate-400 font-medium uppercase tracking-wider">
            Top donor employers
          </div>
          <div ref={employerRef} className="w-full h-[150px]" role="img" aria-label={`Top donor employers: ${employerData.map((d) => `${d.fullName}: ${formatCompact(d.total)}`).join(", ")}`}>
            {employerWidth > 0 && (
              <BarChart
                data={employerData}
                layout="vertical"
                width={employerWidth}
                height={CHART_HEIGHT}
                margin={{ top: 0, right: 55, left: 0, bottom: 0 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={130}
                  tick={{ fill: "#94a3b8", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  labelStyle={{ color: "#fff" }}
                  itemStyle={{ color: "#94a3b8" }}
                  formatter={(value, _name, props) => {
                    const v = typeof value === "number" ? value : 0;
                    const p = props?.payload as { count?: number; fullName?: string } | undefined;
                    return [
                      `${formatCurrency(v)} from ${p?.count ?? 0} employees`,
                      p?.fullName ?? "",
                    ];
                  }}
                />
                <Bar dataKey="total" radius={[0, 4, 4, 0]} barSize={14}>
                  {employerData.map((_, i) => (
                    <Cell key={i} fill={EMPLOYER_BAR_COLOR} fillOpacity={0.6} />
                  ))}
                  <LabelList
                    dataKey="total"
                    position="right"
                    formatter={(v) => formatCompact(Number(v))}
                    style={{ fill: "#9ca3af", fontSize: 10, fontFamily: "Courier New, monospace" }}
                  />
                </Bar>
              </BarChart>
            )}
          </div>
        </div>
      )}

      <p className="text-[10px] text-slate-400 inline-flex items-center gap-1">
        Personal donations from employees, not corporate <span aria-hidden="true">·</span> Source: FEC.gov
        <InfoTooltip width="w-60">
          These are donations from individual employees who listed this company as their employer on FEC filings. They are personal contributions, not corporate spending. Companies cannot donate directly to candidates. Totals aggregate all individual donations from employees of the same employer.
        </InfoTooltip>
      </p>

      {/* Donor employer federal contracts */}
      {hasEmployers && (
        <DonorContracts
          employers={finance.topEmployers.slice(0, 5)}
          repName={finance.name}
        />
      )}
    </div>
  );
}

function DonorContracts({ employers, repName }: { employers: { employer: string; total: number; count: number }[]; repName: string }) {
  const [expanded, setExpanded] = useState(false);
  const [data, setData] = useState<DonorContractsResult[] | null | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }

    setExpanded(true);
    if (data !== undefined) return;

    setLoading(true);
    try {
      const names = employers.map((e) => encodeURIComponent(e.employer)).join(",");
      const res = await fetch(`/api/contractor-contracts?names=${names}`);
      if (!res.ok) {
        setData(null);
        return;
      }
      const json = await res.json();
      // Only keep employers that actually have contracts
      const results: DonorContractsResult[] = (json.results ?? []).filter(
        (r: DonorContractsResult) => r.contracts.length > 0,
      );
      setData(results.length > 0 ? results : null);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pt-1">
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
        Federal contracts received by top donors
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
            <div className="mt-2 space-y-3">
              {loading && (
                <div className="space-y-2">
                  <div className="h-12 bg-white/5 rounded-lg animate-pulse" />
                  <div className="h-12 bg-white/5 rounded-lg animate-pulse" />
                </div>
              )}

              {!loading && data === null && (
                <p className="text-[10px] text-slate-400 py-2">
                  No federal contracts found for these donor employers.
                </p>
              )}

              {!loading && data && (() => {
                const totalContractValue = data.reduce((sum, e) => sum + e.totalAmount, 0);
                const totalDonated = employers
                  .filter((e) => data.some((d) => d.employer.toUpperCase() === e.employer.toUpperCase()))
                  .reduce((sum, e) => sum + e.total, 0);
                const employersWithContracts = data.length;

                return (
                  <div className="p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/10 space-y-1">
                    <p className="text-[10px] text-slate-300">
                      <span className="text-amber-400 font-medium">{employersWithContracts}</span> of{" "}
                      {repName}&apos;s top donor employers also receive federal contracts.
                      Their employees donated{" "}
                      <span className="font-amount text-white font-medium">{formatCompact(totalDonated)}</span>{" "}
                      to this representative while holding{" "}
                      <span className="font-amount text-white font-medium">{formatCompact(totalContractValue)}</span>{" "}
                      in government contracts.
                    </p>
                    <p className="text-[9px] text-slate-400">
                      This does not imply wrongdoing — employee donations are personal, not corporate.
                      But the connection is worth knowing about.
                    </p>
                  </div>
                );
              })()}

              {!loading && data && data.map((employer) => (
                <div key={employer.employer} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium text-white">
                      {employer.employer}
                    </span>
                    <span className="font-amount text-[10px] text-indigo-400 font-medium">
                      {formatCompact(employer.totalAmount)} total
                    </span>
                  </div>
                  {employer.contracts.map((c) => (
                    <ContractRow key={c.awardId} contract={c} />
                  ))}
                </div>
              ))}

              {!loading && data && (
                <p className="text-[9px] text-slate-500 pt-1 border-t border-white/8 inline-flex items-center gap-1 flex-wrap">
                  Contract values are total award amounts, not annual spending
                  <InfoTooltip width="w-56">
                    Federal contracts are often multi-year awards. A $500M contract might be spent over 5-10 years, so the annual cost is much lower than the headline number. These are total obligated amounts, not payments made in a single year.
                  </InfoTooltip>
                  <span aria-hidden="true">·</span>{" "}
                  <a
                    href="https://www.usaspending.gov"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-400 hover:text-slate-400 underline"
                  >
                    USASpending.gov<span className="sr-only"> (opens in new tab)</span>
                  </a>
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const DESCRIPTION_THRESHOLD = 60;

function ContractRow({ contract: c }: { contract: import("@/app/api/contractor-contracts/route").DonorContract }) {
  const [showMore, setShowMore] = useState(false);
  const isLong = c.description.length > DESCRIPTION_THRESHOLD;

  return (
    <div className="pl-2 border-l-2 border-white/10 flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className={`text-[10px] text-slate-400 ${!showMore && isLong ? "line-clamp-1" : ""}`}>
          {c.description}
        </p>
        {isLong && (
          <button
            onClick={() => setShowMore((v) => !v)}
            className="text-[9px] text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer focus:outline-none mt-0.5"
          >
            {showMore ? "Show less" : "Show more"}
          </button>
        )}
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[9px] text-slate-400">{c.agency}</span>
          <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-indigo-500/20 text-indigo-400">
            {c.categoryLabel}
          </span>
        </div>
      </div>
      <a
        href={c.url}
        target="_blank"
        rel="noopener noreferrer"
        className="font-amount text-[10px] text-white font-medium shrink-0 hover:text-indigo-400 transition-colors"
      >
        {formatCompact(c.amount)}
        <span className="sr-only"> — view on USASpending.gov (opens in new tab)</span>
      </a>
    </div>
  );
}
