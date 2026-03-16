"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { formatCurrency } from "@/lib/tax";
import type { BillChampion } from "@/data/pending-bills";
import type { CampaignFinanceSummary } from "@/data/campaign-finance";
import type { DonorContractsResult } from "@/app/api/contractor-contracts/route";
import type { LobbyingSummary } from "@/app/api/lobbying/route";

interface BillInfluenceChainProps {
  champion: BillChampion;
  billNumber: string;
}

function formatCompact(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return formatCurrency(n);
}

interface InfluenceData {
  finance: CampaignFinanceSummary | null;
  donorContracts: DonorContractsResult[];
  lobbying: LobbyingSummary | null;
}

export default function BillInfluenceChain({
  champion,
  billNumber,
}: BillInfluenceChainProps) {
  const [expanded, setExpanded] = useState(false);
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());
  const [data, setData] = useState<InfluenceData | null | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setFetchError(false);
    try {
      // Fetch all three data sources in parallel
      const [financeRes, lobbyingRes] = await Promise.all([
        fetch(
          `/api/campaign-finance?search=${encodeURIComponent(champion.name)}`,
        ),
        fetch(`/api/lobbying?bill=${encodeURIComponent(billNumber)}`),
      ]);

      // Parse lobbying data
      let lobbying: LobbyingSummary | null = null;
      if (lobbyingRes.ok) {
        const lobbyingJson = await lobbyingRes.json();
        lobbying = lobbyingJson.data ?? null;
      }

      // Parse finance data
      let finance: CampaignFinanceSummary | null = null;
      if (financeRes.ok) {
        const financeJson = await financeRes.json();
        finance = financeJson.data?.search ?? null;
      }

      if (!finance && !lobbying) {
        setData(null);
        return;
      }

      if (!finance || finance.topEmployers.length === 0) {
        setData({ finance: null, donorContracts: [], lobbying });
        return;
      }

      // Fetch federal contracts for top donor employers
      const topEmployers = finance.topEmployers.slice(0, 5);
      const names = topEmployers
        .map((e) => encodeURIComponent(e.employer))
        .join(",");
      const contractsRes = await fetch(
        `/api/contractor-contracts?names=${names}`,
      );
      let donorContracts: DonorContractsResult[] = [];

      if (contractsRes.ok) {
        const contractsJson = await contractsRes.json();
        donorContracts = (contractsJson.results ?? []).filter(
          (r: DonorContractsResult) => r.contracts.length > 0,
        );
      }

      setData({ finance, donorContracts, lobbying });
    } catch {
      setFetchError(true);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }

    setExpanded(true);
    if (data !== undefined && !fetchError) return;

    await fetchData();
  };

  return (
    <div>
      <button
        onClick={handleToggle}
        className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded flex items-center gap-1 mt-1"
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
            <div className="mt-2 p-3 rounded-lg bg-white/5 border border-white/10 space-y-3">
              {loading && (
                <div className="space-y-2">
                  <div className="h-3 w-48 bg-white/10 rounded animate-pulse" />
                  <div className="h-3 w-36 bg-white/10 rounded animate-pulse" />
                  <div className="h-3 w-52 bg-white/10 rounded animate-pulse" />
                </div>
              )}

              {!loading && data === null && (
                <div className="text-[10px] text-slate-400">
                  {fetchError ? (
                    <div className="flex items-center gap-2">
                      <span>Failed to load influence data.</span>
                      <button
                        onClick={fetchData}
                        className="text-indigo-400 hover:text-indigo-300 underline cursor-pointer focus:outline-none"
                      >
                        Retry
                      </button>
                    </div>
                  ) : (
                    "No influence data found for this bill."
                  )}
                </div>
              )}

              {!loading &&
                data &&
                (() => {
                  const { finance, donorContracts, lobbying } = data;
                  const topEmployers = finance?.topEmployers.slice(0, 5) ?? [];
                  const employersWithContracts = donorContracts.length;
                  const totalDonated = topEmployers.reduce(
                    (s, e) => s + e.total,
                    0,
                  );
                  const totalContractValue = donorContracts.reduce(
                    (s, e) => s + e.totalAmount,
                    0,
                  );
                  const hasFinance = finance && finance.totalRaised > 0;

                  // Find lobbying clients that overlap with donor employers or outside spenders
                  const lobbyingClients = new Set(
                    (lobbying?.clients || []).map((c) => c.toUpperCase()),
                  );
                  const lobbyingClientsArr = Array.from(lobbyingClients);
                  const fuzzyMatch = (name: string) =>
                    lobbyingClients.has(name) ||
                    lobbyingClientsArr.some(
                      (c) => c.includes(name) || name.includes(c),
                    );

                  const donorEmployerNames = topEmployers.map((e) =>
                    e.employer.toUpperCase(),
                  );
                  const overlappingEmployers =
                    donorEmployerNames.filter(fuzzyMatch);

                  const outsideSpenders = (finance?.outsideSpending || [])
                    .filter((s) => s.support)
                    .map((s) => s.name.toUpperCase());
                  const overlappingSpenders =
                    outsideSpenders.filter(fuzzyMatch);

                  const overlappingOrgs = [
                    ...new Set([
                      ...overlappingEmployers,
                      ...overlappingSpenders,
                    ]),
                  ];

                  // Lobbyists with former government positions (deduplicated by name)
                  const revolvingDoorAll = (lobbying?.filings || [])
                    .flatMap((f) => f.activities)
                    .flatMap((a) => a.lobbyists)
                    .filter(
                      (l) => l.coveredPosition && l.coveredPosition.length > 0,
                    );
                  const seenNames = new Set<string>();
                  const revolvingDoor = revolvingDoorAll
                    .filter((l) => {
                      const key = l.name.toUpperCase();
                      if (seenNames.has(key)) return false;
                      seenNames.add(key);
                      return true;
                    })
                    .slice(0, 5);

                  return (
                    <>
                      {/* Lobbying section */}
                      {lobbying && lobbying.filings.length > 0 && (
                        <>
                          <div className="text-xs text-slate-400">
                            <span className="text-amber-400 font-medium">
                              {lobbying.totalFilings}
                            </span>{" "}
                            lobbying filings mention{" "}
                            <span className="text-white font-medium">
                              {billNumber}
                            </span>
                            {lobbying.totalSpending > 0 && (
                              <>
                                {" "}
                                totaling{" "}
                                <span className="text-amber-400 font-medium font-amount">
                                  {formatCompact(lobbying.totalSpending)}
                                </span>{" "}
                                in reported spending
                              </>
                            )}
                          </div>

                          <div>
                            <div className="text-xs text-slate-400 mb-1">
                              Top organizations lobbying on this bill
                            </div>
                            <div className="space-y-0.5">
                              {lobbying.filings
                                .filter((f) => f.amount > 0)
                                .filter(
                                  (f, i, arr) =>
                                    arr.findIndex(
                                      (x) =>
                                        x.client.toUpperCase() ===
                                        f.client.toUpperCase(),
                                    ) === i,
                                )
                                .slice(0, 8)
                                .map((f) => (
                                  <div
                                    key={`${f.client}-${f.filingYear}-${f.filingPeriod}`}
                                    className="flex items-center justify-between text-xs"
                                  >
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <span className="text-slate-300 truncate">
                                        {f.client}
                                      </span>
                                      {f.client !== f.registrant && (
                                        <span className="text-[9px] text-slate-500 shrink-0">
                                          via {f.registrant}
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-slate-400 font-medium font-amount ml-2 shrink-0">
                                      {formatCompact(f.amount)}
                                    </span>
                                  </div>
                                ))}
                            </div>
                          </div>

                          {/* Revolving door */}
                          {revolvingDoor.length > 0 && (
                            <div>
                              <div className="text-xs text-slate-400 mb-1">
                                Lobbyists with prior government roles
                              </div>
                              <div className="space-y-0.5">
                                {revolvingDoor.map((l, i) => (
                                  <div
                                    key={`${l.name}-${i}`}
                                    className="text-xs"
                                  >
                                    <span className="text-slate-300">
                                      {l.name}
                                    </span>
                                    <span className="text-slate-500">
                                      {" "}
                                      — formerly {l.coveredPosition}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Overlap alert */}
                          {overlappingOrgs.length > 0 && (
                            <div className="p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/10 space-y-1">
                              <p className="text-[10px] text-slate-300">
                                <span className="text-amber-400 font-medium">
                                  {overlappingOrgs.length}
                                </span>{" "}
                                organization
                                {overlappingOrgs.length > 1 ? "s" : ""} lobbying
                                on this bill also{" "}
                                {overlappingEmployers.length > 0 &&
                                overlappingSpenders.length > 0
                                  ? `${overlappingEmployers.length > 1 ? "have" : "has"} employees who donated to or Super PACs supporting`
                                  : overlappingSpenders.length > 0
                                    ? `${overlappingOrgs.length > 1 ? "fund" : "funds"} Super PACs supporting`
                                    : `${overlappingOrgs.length > 1 ? "have" : "has"} employees who donated to`}{" "}
                                {champion.name}.
                              </p>
                              <p className="text-[9px] text-slate-400">
                                Lobbying is legal advocacy — but the overlap
                                between lobbying spending and campaign donations
                                is worth noting.
                              </p>
                            </div>
                          )}
                        </>
                      )}

                      {/* Champion funding summary */}
                      {hasFinance && (
                        <>
                          <div className="text-xs text-slate-400">
                            <span className="text-white font-medium">
                              {champion.title} {champion.name}
                            </span>{" "}
                            raised{" "}
                            <span className="text-indigo-400 font-medium font-amount">
                              {formatCompact(finance.totalRaised)}
                            </span>{" "}
                            ({finance.cycle} cycle)
                          </div>

                          {/* Outside spending (Super PACs) */}
                          {finance.outsideSpending &&
                            finance.outsideSpending.length > 0 && (
                              <div>
                                <div className="text-xs text-slate-400 mb-1">
                                  Outside spending (Super PACs)
                                  {finance.outsideSpendingCycle &&
                                  finance.outsideSpendingCycle !== finance.cycle
                                    ? ` · ${finance.outsideSpendingCycle} cycle`
                                    : ""}
                                </div>
                                <div className="space-y-0.5">
                                  {finance.outsideSpending
                                    .slice(0, 5)
                                    .map((s) => (
                                      <div
                                        key={`${s.name}-${s.support}`}
                                        className="flex items-center justify-between text-xs"
                                      >
                                        <div className="flex items-center gap-1.5 min-w-0">
                                          <span
                                            className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${
                                              s.support
                                                ? "bg-green-500/70"
                                                : "bg-red-500/70"
                                            }`}
                                          />
                                          <span className="text-slate-300 truncate">
                                            {s.name}
                                          </span>
                                        </div>
                                        <span className="text-slate-400 font-medium font-amount ml-2 shrink-0">
                                          {formatCompact(s.total)}
                                        </span>
                                      </div>
                                    ))}
                                </div>
                                <div className="flex items-center gap-3 text-[9px] text-slate-500 mt-1">
                                  <span className="flex items-center gap-1">
                                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500/70" />{" "}
                                    Supporting
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500/70" />{" "}
                                    Opposing
                                  </span>
                                </div>
                              </div>
                            )}

                          {/* Top donor employers */}
                          <div>
                            <div className="text-xs text-slate-400 mb-1">
                              Top donor employers
                            </div>
                            <div className="space-y-0.5">
                              {topEmployers.map((e) => (
                                <div
                                  key={e.employer}
                                  className="flex items-center justify-between text-xs"
                                >
                                  <span className="text-slate-300">
                                    {e.employer}
                                  </span>
                                  <span className="text-slate-400 font-medium font-amount ml-2 shrink-0">
                                    {formatCompact(e.total)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Connection to federal contracts */}
                          {employersWithContracts > 0 && (
                            <>
                              <div className="flex items-center gap-1 text-slate-500">
                                <span className="text-xs">↓</span>
                                <span className="text-xs">
                                  These employers also receive federal contracts
                                </span>
                              </div>

                              <div className="p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/10 space-y-1">
                                <p className="text-[10px] text-slate-300">
                                  <span className="text-amber-400 font-medium">
                                    {employersWithContracts}
                                  </span>{" "}
                                  of {champion.name}&apos;s top donor employers
                                  hold{" "}
                                  <span className="text-white font-medium">
                                    {formatCompact(totalContractValue)}
                                  </span>{" "}
                                  in government contracts while their employees
                                  donated{" "}
                                  <span className="text-white font-medium">
                                    {formatCompact(totalDonated)}
                                  </span>{" "}
                                  to this bill&apos;s sponsor.
                                </p>
                                <p className="text-[9px] text-slate-400">
                                  Employee donations are personal, not corporate
                                  — but the connection is worth knowing about.
                                </p>
                              </div>

                              {donorContracts.map((employer) => (
                                <div
                                  key={employer.employer}
                                  className="space-y-1"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-white">
                                      {employer.employer}
                                    </span>
                                    <span className="text-xs text-indigo-400 font-medium font-amount">
                                      {formatCompact(employer.totalAmount)}
                                    </span>
                                  </div>
                                  {employer.contracts.slice(0, 3).map((c) => {
                                    const descKey = `contract-${c.awardId}`;
                                    const isDescExpanded = expandedDescriptions.has(descKey);
                                    return (
                                      <div
                                        key={c.awardId}
                                        className="pl-2 border-l-2 border-white/10 flex items-start justify-between gap-2"
                                      >
                                        <div className="min-w-0 flex-1">
                                          <p className={`text-xs text-slate-400${!isDescExpanded ? " line-clamp-1" : ""}`}>
                                            {c.description}
                                          </p>
                                          {c.description && c.description.length > 60 && (
                                            <button
                                              onClick={() => setExpandedDescriptions((prev) => {
                                                const next = new Set(prev);
                                                if (next.has(descKey)) next.delete(descKey);
                                                else next.add(descKey);
                                                return next;
                                              })}
                                              className="text-xs text-indigo-400 hover:text-indigo-300 mt-0.5 cursor-pointer focus:outline-none"
                                            >
                                              {isDescExpanded ? "Show less" : "Show more"}
                                            </button>
                                          )}
                                        </div>
                                        <a
                                          href={c.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-xs text-white font-medium font-amount shrink-0 hover:text-indigo-400 transition-colors"
                                        >
                                          {formatCompact(c.amount)}
                                          <span className="sr-only">
                                            {" "}
                                            — view on USASpending.gov (opens in
                                            new tab)
                                          </span>
                                        </a>
                                      </div>
                                    );
                                  })}
                                </div>
                              ))}
                            </>
                          )}

                          {employersWithContracts === 0 && (
                            <p className="text-xs text-slate-400">
                              None of {champion.name}&apos;s top donor employers
                              were found to hold major federal contracts.
                            </p>
                          )}
                        </>
                      )}

                      {/* Source */}
                      <p className="text-[9px] text-slate-500 pt-1 border-t border-white/8">
                        Source:{" "}
                        <a
                          href="https://lda.senate.gov/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-400 hover:text-slate-400 underline"
                        >
                          Senate LDA
                          <span className="sr-only"> (opens in new tab)</span>
                        </a>
                        {" · "}
                        <a
                          href="https://www.fec.gov"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-400 hover:text-slate-400 underline"
                        >
                          FEC
                          <span className="sr-only"> (opens in new tab)</span>
                        </a>
                        {" · "}
                        <a
                          href="https://www.usaspending.gov"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-400 hover:text-slate-400 underline"
                        >
                          USASpending.gov
                          <span className="sr-only"> (opens in new tab)</span>
                        </a>
                      </p>
                    </>
                  );
                })()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
