"use client";

import { useRef, useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, LabelList } from "recharts";
import type { CampaignFinanceSummary } from "@/data/campaign-finance";
import { formatCurrency } from "@/lib/tax";

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
function useContainerWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      if (w > 0) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, width };
}

export default function FinanceChart({ finance }: FinanceChartProps) {
  const outsideSpending = finance.outsideSpending; // null = fetch failed, [] = confirmed none
  const hasOutsideSpending = outsideSpending !== null && outsideSpending.length > 0;
  const confirmedNoOutsideSpending = outsideSpending !== null && outsideSpending.length === 0;
  const hasEmployers = finance.topEmployers.length > 0;

  const outsideContainer = useContainerWidth();
  const employerContainer = useContainerWidth();

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
      <div className="text-xs text-gray-400">
        {finance.cycle} cycle · <span className="text-white font-medium">{formatCompact(finance.totalRaised)} total raised</span>
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
          <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">
            Outside spending (Super PACs){finance.outsideSpendingCycle && finance.outsideSpendingCycle !== finance.cycle ? ` · ${finance.outsideSpendingCycle} cycle` : ""}
          </div>
          <div ref={outsideContainer.ref} className="w-full h-[150px]">
            {outsideContainer.width > 0 && (
              <BarChart
                data={outsideData}
                layout="vertical"
                width={outsideContainer.width}
                height={CHART_HEIGHT}
                margin={{ top: 0, right: 55, left: 0, bottom: 0 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={130}
                  tick={{ fill: "#9ca3af", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1f2937",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  labelStyle={{ color: "#fff" }}
                  itemStyle={{ color: "#9ca3af" }}
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
                    style={{ fill: "#9ca3af", fontSize: 10 }}
                  />
                </Bar>
              </BarChart>
            )}
          </div>
          <div className="flex items-center gap-3 text-[10px] text-gray-600">
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
          <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">
            Top donor employers
          </div>
          <div ref={employerContainer.ref} className="w-full h-[150px]">
            {employerContainer.width > 0 && (
              <BarChart
                data={employerData}
                layout="vertical"
                width={employerContainer.width}
                height={CHART_HEIGHT}
                margin={{ top: 0, right: 55, left: 0, bottom: 0 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={130}
                  tick={{ fill: "#9ca3af", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1f2937",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  labelStyle={{ color: "#fff" }}
                  itemStyle={{ color: "#9ca3af" }}
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
                    style={{ fill: "#9ca3af", fontSize: 10 }}
                  />
                </Bar>
              </BarChart>
            )}
          </div>
        </div>
      )}

      <p className="text-[10px] text-gray-600">
        Personal donations from employees, not corporate · Source: FEC.gov
      </p>
    </div>
  );
}
