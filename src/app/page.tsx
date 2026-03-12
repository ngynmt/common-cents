"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import TaxForm from "@/components/TaxForm";
import TaxReceipt from "@/components/TaxReceipt";
import { estimateFederalTax, type FilingStatus, type TaxEstimate } from "@/lib/tax";
import { type Representative, type VoteRecord } from "@/data/representatives";

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

    const res = await fetch(`/api/votes?${params.toString()}`);
    const data = await res.json();

    if (!data.votes || !Array.isArray(data.votes)) return [];

    // Re-map senate vote representativeIds from "lis:S270" back to bioguide IDs
    return data.votes.map((v: VoteRecord) => {
      if (v.representativeId.startsWith("lis:")) {
        const lisId = v.representativeId.slice(4);
        return { ...v, representativeId: lisToId.get(lisId) || v.representativeId };
      }
      return v;
    });
  } catch {
    return [];
  }
}

async function fetchRepresentatives(zipCode: string): Promise<Representative[] | null> {
  if (!zipCode || zipCode.length < 5) return null;

  try {
    const res = await fetch(`/api/representatives?zip=${encodeURIComponent(zipCode)}`);
    const data = await res.json();
    if (data.fallback || !data.representatives) return null;
    return data.representatives;
  } catch {
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
  const [initialized, setInitialized] = useState(false);

  const processInputs = useCallback(async (income: number, filingStatus: FilingStatus, zipCode: string) => {
    const estimate = estimateFederalTax(income, filingStatus);
    setTaxEstimate(estimate);

    const reps = await fetchRepresentatives(zipCode);
    setRepresentatives(reps);
    if (reps) {
      const liveVotes = await fetchVotes(reps);
      setVotes(liveVotes);
    } else {
      setVotes([]);
    }
  }, []);

  // On mount, check URL params for saved state
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
    setInitialized(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFormSubmit = (data: {
    income: number;
    filingStatus: FilingStatus;
    zipCode: string;
  }) => {
    processInputs(data.income, data.filingStatus, data.zipCode);

    // Save to URL params (replaces current URL without navigation)
    const params = new URLSearchParams();
    params.set("income", String(data.income));
    params.set("filing", data.filingStatus);
    if (data.zipCode) params.set("zip", data.zipCode);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  const handleBack = () => {
    setTaxEstimate(null);
    setRepresentatives(null);
    setVotes([]);
    router.replace("/", { scroll: false });
  };

  // Don't render until we've checked URL params
  if (!initialized) return null;

  const showReceipt = taxEstimate !== null;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
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
          <span className="text-xs text-gray-500">
            FY 2025 Estimates
          </span>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 py-12">
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
              <div className="flex items-center gap-6 text-xs text-gray-500">
                <span>No data stored</span>
                <span>•</span>
                <span>Calculated in your browser</span>
                <span>•</span>
                <span>100% open source</span>
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
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 mt-20">
        <div className="max-w-6xl mx-auto px-4 py-6 text-center text-xs text-gray-500 space-y-3">
          <p>
            Tax estimates are approximations based on standard deduction and IRS brackets.
            Spending data from OMB and CBO.
          </p>
          <p>
            Common Cents is not affiliated with any government agency or political organization.
          </p>
          <a
            href="https://buymeacoffee.com/meeshers"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#FFDD00]/10 text-[#FFDD00] hover:bg-[#FFDD00]/20 transition-colors text-xs font-medium"
          >
            <span>&#9749;</span>
            Buy me a coffee
          </a>
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
