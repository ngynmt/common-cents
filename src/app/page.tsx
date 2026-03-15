"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import TaxForm from "@/components/TaxForm";
import TaxReceipt from "@/components/TaxReceipt";
import { estimateFederalTax, SUPPORTED_TAX_YEARS, type FilingStatus, type TaxEstimate } from "@/lib/tax";
import { type Representative, type VoteRecord } from "@/data/representatives";
import type { CampaignFinanceSummary } from "@/data/campaign-finance";
import { trackPageView, trackReceiptGenerated, trackRepLookedUp } from "@/lib/analytics";

const FETCH_TIMEOUT_MS = 8000;

function fetchWithTimeout(url: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function fetchVotes(reps: Representative[]): Promise<VoteRecord[]> {
  const houseReps = reps.filter((r) => r.chamber === "house");
  const senateReps = reps.filter((r) => r.chamber === "senate");

  const bioguideIds = houseReps.map((r) => r.id);
  const lisIds = senateReps.map((r) => r.lisId).filter(Boolean) as string[];

  // Build a map from lisId -> bioguideId for re-mapping senate vote records
  const lisToId = new Map<string, string>();
  for (const rep of senateReps) {
    if (rep.lisId) lisToId.set(rep.lisId, rep.id);
  }

  if (bioguideIds.length === 0 && lisIds.length === 0) return [];

  try {
    const params = new URLSearchParams();
    if (bioguideIds.length > 0) params.set("bioguideIds", bioguideIds.join(","));
    if (lisIds.length > 0) params.set("lisIds", lisIds.join(","));

    const res = await fetchWithTimeout(`/api/votes?${params.toString()}`);
    const data = await res.json();

    if (!data.votes || !Array.isArray(data.votes)) return [];

    // Re-map senate vote representativeIds from "lis:S270" back to bioguide IDs
    // Drop votes that can't be mapped — they'd never match a rep card anyway
    return data.votes
      .map((v: VoteRecord) => {
        if (v.representativeId.startsWith("lis:")) {
          const lisId = v.representativeId.slice(4);
          const mapped = lisToId.get(lisId);
          if (!mapped) {
            console.warn(`[votes] Could not map lis_id "${lisId}" to a bioguide ID — skipping vote`);
            return null;
          }
          return { ...v, representativeId: mapped };
        }
        return v;
      })
      .filter((v: VoteRecord | null): v is VoteRecord => v !== null);
  } catch (err) {
    console.error("[votes] Failed to fetch vote records:", err);
    return [];
  }
}

async function fetchRepresentatives(zipCode: string): Promise<Representative[] | null> {
  if (!zipCode || zipCode.length < 5) return null;

  try {
    const res = await fetchWithTimeout(`/api/representatives?zip=${encodeURIComponent(zipCode)}`);
    const data = await res.json();
    if (data.fallback || !data.representatives) return null;
    return data.representatives;
  } catch (err) {
    console.error("[reps] Failed to fetch representatives:", err);
    return null;
  }
}

const VALID_FILING_STATUSES: FilingStatus[] = ["single", "married", "head_of_household"];

function HomeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [taxEstimate, setTaxEstimate] = useState<TaxEstimate | null>(null);
  const [representatives, setRepresentatives] = useState<Representative[] | null>(null);
  const [votes, setVotes] = useState<VoteRecord[]>([]);
  const [financeData, setFinanceData] = useState<Record<string, CampaignFinanceSummary | null>>({});
  const [compareCountry, setCompareCountry] = useState<string | null>(() => searchParams.get("compare"));
  const [initialized, setInitialized] = useState(false);

  const processInputs = useCallback(async (income: number, filingStatus: FilingStatus, zipCode: string) => {
    const estimate = estimateFederalTax(income, filingStatus);
    setTaxEstimate(estimate);

    const reps = await fetchRepresentatives(zipCode);
    setRepresentatives(reps);
    if (reps && reps.length > 0) {
      trackRepLookedUp(reps[0].state);
      const liveVotes = await fetchVotes(reps);
      setVotes(liveVotes);

      // Fetch campaign finance data (non-blocking, longer timeout since FEC API is slow)
      const ids = reps.map((r) => r.id).join(",");
      const repNames = reps.map((r) => encodeURIComponent(r.name)).join(",");
      const repStates = reps.map((r) => r.state).join(",");
      const repChambers = reps.map((r) => r.chamber).join(",");
      fetchWithTimeout(`/api/campaign-finance?bioguideIds=${ids}&names=${repNames}&states=${repStates}&chambers=${repChambers}`, 20000)
        .then((res) => res.json())
        .then((json) => { if (json.data) setFinanceData(json.data); })
        .catch((err) => console.error("[finance] Failed to fetch campaign finance:", err));
    } else {
      setVotes([]);
      setFinanceData({});
    }
  }, []);

  // On mount, check URL params for saved state
  /* eslint-disable react-hooks/set-state-in-effect -- intentional: restore state from URL on mount */
  useEffect(() => {
    const incomeParam = searchParams.get("income");
    const filingParam = searchParams.get("filing") as FilingStatus | null;
    const zipParam = searchParams.get("zip") || "";
    if (
      incomeParam &&
      !isNaN(Number(incomeParam)) &&
      Number(incomeParam) > 0 &&
      filingParam &&
      VALID_FILING_STATUSES.includes(filingParam)
    ) {
      processInputs(Number(incomeParam), filingParam, zipParam);
    }
    trackPageView("/", !!incomeParam);
    setInitialized(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleFormSubmit = (data: {
    income: number;
    filingStatus: FilingStatus;
    zipCode: string;
  }) => {
    trackReceiptGenerated(data.filingStatus, !!data.zipCode);
    processInputs(data.income, data.filingStatus, data.zipCode);

    // Save to URL params (replaces current URL without navigation)
    const params = new URLSearchParams();
    params.set("income", String(data.income));
    params.set("filing", data.filingStatus);
    if (data.zipCode) params.set("zip", data.zipCode);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  const handleCompareCountryChange = (code: string | null) => {
    setCompareCountry(code);
    const params = new URLSearchParams(searchParams.toString());
    if (code) {
      params.set("compare", code);
    } else {
      params.delete("compare");
    }
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  const handleBack = () => {
    setTaxEstimate(null);
    setRepresentatives(null);
    setVotes([]);
    setFinanceData({});
    setCompareCountry(null);
    router.replace("/", { scroll: false });
  };

  // Don't render until we've checked URL params
  if (!initialized) return null;

  const showReceipt = taxEstimate !== null;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Skip to main content link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-indigo-600 focus:text-white focus:rounded-lg focus:outline-none"
      >
        Skip to main content
      </a>

      {/* Header */}
      <header className="border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={showReceipt ? handleBack : undefined}
              className={showReceipt ? "cursor-pointer" : "cursor-default"}
            >
              <span className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                Common Cents
              </span>
            </button>
          </div>
          <span className="text-xs text-gray-400">
            FY {SUPPORTED_TAX_YEARS[SUPPORTED_TAX_YEARS.length - 1]} Estimates
          </span>
        </div>
      </header>

      {/* Main content */}
      <main id="main-content" className="max-w-6xl mx-auto px-4 py-12" aria-live="polite">
        <AnimatePresence mode="wait">
          {!showReceipt && (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center gap-8"
            >
              {/* Hero */}
              <div className="text-center space-y-4 max-w-lg">
                <h1 className="text-4xl sm:text-5xl font-bold">
                  Where do your{" "}
                  <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                    tax dollars
                  </span>{" "}
                  go?
                </h1>
                <p className="text-gray-400 text-lg">
                  Get a personalized receipt for your federal taxes. See exactly
                  how your money is spent — and who decides.
                </p>
              </div>

              <TaxForm onSubmit={handleFormSubmit} />

              {/* Trust indicators */}
              <div className="flex items-center gap-6 text-xs text-gray-400">
                <span>No data stored</span>
                <span aria-hidden="true">•</span>
                <span>Calculated in your browser</span>
                <span aria-hidden="true">•</span>
                <a href="https://github.com/ngynmt/common-cents" target="_blank" rel="noopener noreferrer" className="underline decoration-gray-500 underline-offset-2 hover:decoration-gray-300 transition-colors">100% open source</a>
              </div>
            </motion.div>
          )}

          {showReceipt && (
            <motion.div
              key="receipt"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <TaxReceipt
                taxEstimate={taxEstimate}
                representatives={representatives}
                votes={votes}
                onBack={handleBack}
                financeData={financeData}
                compareCountry={compareCountry}
                onCompareCountryChange={handleCompareCountryChange}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 mt-20">
        <div className="max-w-6xl mx-auto px-4 py-6 text-center text-xs text-gray-400 space-y-3">
          <p>
            Tax estimates are approximations based on standard deduction and{" "}
            <a href="https://www.irs.gov/taxtopics/tc751" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-gray-200 underline">IRS<span className="sr-only"> (opens in new tab)</span></a>
            {" "}brackets. Some descriptions are AI-generated summaries of government filings.
          </p>
          <p className="text-[10px] text-gray-500">
            Sources:{" "}
            <a href="https://www.whitehouse.gov/omb/budget/historical-tables/" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-300 underline">OMB<span className="sr-only"> (opens in new tab)</span></a>
            {" · "}
            <a href="https://www.cbo.gov/cost-estimates" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-300 underline">CBO<span className="sr-only"> (opens in new tab)</span></a>
            {" · "}
            <a href="https://www.congress.gov/" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-300 underline">Congress.gov<span className="sr-only"> (opens in new tab)</span></a>
            {" · "}
            <a href="https://www.usaspending.gov" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-300 underline">USASpending.gov<span className="sr-only"> (opens in new tab)</span></a>
            {" · "}
            <a href="https://fiscaldata.treasury.gov/datasets/monthly-treasury-statement/" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-300 underline">Treasury MTS<span className="sr-only"> (opens in new tab)</span></a>
            {" · "}
            <a href="https://www.fec.gov" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-300 underline">FEC<span className="sr-only"> (opens in new tab)</span></a>
          </p>
          <p>
            Common Cents is not affiliated with any government agency or political organization.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <a
              href="https://docs.google.com/forms/d/e/1FAIpQLScpU812Yifx_E9eu3MtKZzVxp6Kwar9Cbr7ucFR6CdXW6pPSw/viewform?usp=publish-editor"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/5 text-gray-300 hover:bg-white/10 transition-colors text-xs font-medium"
            >
              Share feedback
            </a>
            <a
              href="https://buymeacoffee.com/meeshers"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#FFDD00]/10 text-[#FFDD00] hover:bg-[#FFDD00]/20 transition-colors text-xs font-medium"
            >
              <span aria-hidden="true">&#9749;</span>
              Buy me a coffee
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}
