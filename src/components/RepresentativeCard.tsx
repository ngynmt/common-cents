"use client";

import { motion } from "framer-motion";
import type { Representative, VoteRecord } from "@/data/representatives";
import type { CampaignFinanceSummary } from "@/data/campaign-finance";
import FinanceChart from "./FinanceCard";

interface RepresentativeCardProps {
  rep: Representative;
  votes: VoteRecord[];
  compact?: boolean;
  finance?: CampaignFinanceSummary | null;
}

/**
 * Maps legislation titles to what a YES vote meant for spending.
 * This lets us explain the *effect* of a vote, not just the direction.
 */
const VOTE_CONTEXT: Record<string, { yesEffect: string; noEffect: string }> = {
  "National Defense Authorization Act for FY 2024": {
    yesEffect: "Voted to authorize $886B in defense spending",
    noEffect: "Voted against authorizing $886B in defense spending",
  },
  "Inflation Reduction Act — Healthcare Provisions": {
    yesEffect: "Voted to expand ACA subsidies and allow Medicare drug negotiation",
    noEffect: "Voted against ACA subsidy expansion and Medicare drug negotiation",
  },
  "Social Security Fairness Act of 2023": {
    yesEffect: "Voted to increase Social Security benefits for public sector workers",
    noEffect: "Voted against increasing Social Security benefits for public sector workers",
  },
  "Infrastructure Investment and Jobs Act (IIJA)": {
    yesEffect: "Voted to invest $1.2T in roads, bridges, broadband, and water",
    noEffect: "Voted against the $1.2T infrastructure investment package",
  },
  "CHIPS and Science Act": {
    yesEffect: "Voted to fund $280B for semiconductor manufacturing and research",
    noEffect: "Voted against $280B for semiconductor and science investment",
  },
  "Bipartisan Safer Communities Act": {
    yesEffect: "Voted to fund school safety, mental health, and background checks",
    noEffect: "Voted against gun safety and mental health funding",
  },
  "PACT Act (Promise to Address Comprehensive Toxics Act)": {
    yesEffect: "Voted to expand VA benefits for veterans exposed to toxic substances",
    noEffect: "Voted against expanding VA benefits for toxic-exposed veterans",
  },
  "Fiscal Responsibility Act of 2023": {
    yesEffect: "Voted to suspend the debt ceiling and cap discretionary spending",
    noEffect: "Voted against suspending the debt ceiling",
  },
};

function VoteBadge({ vote }: { vote: VoteRecord["vote"] }) {
  const styles: Record<string, string> = {
    yes: "bg-green-500/20 text-green-400",
    no: "bg-red-500/20 text-red-400",
    abstain: "bg-slate-500/20 text-text-secondary",
    not_voting: "bg-slate-500/20 text-text-secondary",
  };
  const labels: Record<string, string> = {
    yes: "YES",
    no: "NO",
    abstain: "Abstained",
    not_voting: "Did not vote",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${styles[vote]}`}>
      {labels[vote]}
    </span>
  );
}

function PartyBadge({ party }: { party: Representative["party"] }) {
  const styles: Record<string, string> = {
    D: "bg-blue-500/20 text-blue-400",
    R: "bg-red-500/20 text-red-400",
    I: "bg-purple-500/20 text-purple-400",
  };
  const labels: Record<string, string> = {
    D: "Democrat",
    R: "Republican",
    I: "Independent",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[party]}`}>
      {labels[party]}
    </span>
  );
}

export default function RepresentativeCard({ rep, votes, compact, finance }: RepresentativeCardProps) {
  const chamberLabel = rep.chamber === "senate" ? "Senator" : rep.district ? `Rep. (${rep.state}-${rep.district})` : `Rep. (${rep.state})`;
  const currentYear = new Date().getFullYear();
  const isUpThisYear = rep.nextElection === currentYear;
  const isUpNextYear = rep.nextElection === currentYear + 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-3 rounded-xl bg-surface-elevated border space-y-2 ${
        isUpThisYear ? "border-amber-500/30" : "border-border"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-text-primary">{rep.name}</span>
            <PartyBadge party={rep.party} />
          </div>
          <div className="text-xs text-text-secondary">{chamberLabel}</div>
        </div>
        <div className="text-right shrink-0">
          {isUpThisYear ? (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
              Up for re-election this year
            </span>
          ) : isUpNextYear ? (
            <span className="text-[10px] text-text-secondary">
              Re-election: {rep.nextElection}
            </span>
          ) : (
            <span className="text-[10px] text-text-secondary">
              Re-election: {rep.nextElection}
            </span>
          )}
        </div>
      </div>

      {/* Campaign finance */}
      {finance && (finance.totalRaised > 0 || finance.topEmployers.length > 0) && (
        <div className="pt-1 border-t border-border-subtle">
          <FinanceChart finance={finance} />
        </div>
      )}

      {/* Votes on relevant legislation */}
      {votes.length > 0 && (
        <div className="space-y-2">
          {votes.map((vote, i) => {
            const context = VOTE_CONTEXT[vote.legislationTitle];
            const effectText = context
              ? vote.vote === "yes"
                ? context.yesEffect
                : vote.vote === "no"
                  ? context.noEffect
                  : null
              : null;

            return (
              <div key={i} className="space-y-0.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-text-secondary flex-1 truncate">
                    {vote.legislationTitle}
                  </span>
                  <VoteBadge vote={vote.vote} />
                </div>
                {effectText && (
                  <p className="text-[10px] text-text-secondary pl-0.5">
                    {effectText}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Contact info */}
      {!compact && (
        <div className="flex items-center gap-3 pt-1">
          <a
            href={`tel:${rep.phone}`}
            className="text-xs px-3 py-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 transition-colors"
          >
            Call {rep.phone}
          </a>
          <a
            href={rep.contactFormUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs px-3 py-1.5 rounded-lg bg-surface-card text-text-secondary hover:bg-surface-elevated transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            Email<span className="sr-only-inline"> {rep.name} (opens in new tab)</span>
          </a>
          <a
            href={rep.website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs px-3 py-1.5 rounded-lg bg-surface-card text-text-secondary hover:bg-surface-elevated transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            Website<span className="sr-only-inline"> for {rep.name} (opens in new tab)</span>
          </a>
        </div>
      )}
    </motion.div>
  );
}
