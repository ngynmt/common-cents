import { NextRequest, NextResponse } from "next/server";
import type { CampaignFinanceSummary, DonorEmployer, OutsideSpender } from "@/data/campaign-finance";
import { FEC_CANDIDATE_IDS } from "@/data/fec-candidate-ids";

const FEC_BASE = "https://api.open.fec.gov/v1";
const FEC_API_KEY = process.env.FEC_API_KEY || "DEMO_KEY";

/** Try these cycles in order — most recent first */
const CYCLES = [2026, 2024, 2022];

/** Employers to exclude — junk/missing data only */
const JUNK_PATTERNS = [
  "N/A",
  "NONE",
  "NULL",
  "INFORMATION REQUESTED",
  "REFUSED",
  "NOT PROVIDED",
];

function isJunkEmployer(employer: string | null | undefined): boolean {
  if (!employer) return true;
  const normalized = employer.trim().toUpperCase();
  if (normalized.length === 0) return true;
  return JUNK_PATTERNS.some((p) => normalized === p || normalized.startsWith(p));
}

interface FECCommittee {
  committee_id: string;
  designation: string;
  committee_type: string;
}

interface FECCandidate {
  candidate_id: string;
  name: string;
  party: string;
  office: string;
  state: string;
}

interface FECEmployerResult {
  employer: string;
  total: number;
  count: number;
}

interface FECTotalsResult {
  receipts?: number;
  contributions?: number;
  individual_contributions?: number;
  cycle: number;
}

interface FECIndependentExpenditure {
  committee_name: string;
  total: number;
  count: number;
  support_oppose_indicator: "S" | "O";
}

function fecUrl(path: string, params: Record<string, string | number> = {}): string {
  const url = new URL(`${FEC_BASE}${path}`);
  url.searchParams.set("api_key", FEC_API_KEY);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }
  return url.toString();
}

async function fecFetch<T>(path: string, params: Record<string, string | number> = {}): Promise<T | null> {
  try {
    const res = await fetch(fecUrl(path, params), { next: { revalidate: 86400 } });
    if (!res.ok) {
      console.error(`[fec] ${path} returned ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error(`[fec] Failed to fetch ${path}:`, err);
    return null;
  }
}

function parseParty(party: string): "D" | "R" | "I" {
  if (party === "DEM" || party === "D") return "D";
  if (party === "REP" || party === "R") return "R";
  return "I";
}

function parseOffice(office: string): "house" | "senate" {
  return office === "S" ? "senate" : "house";
}

function titleCase(s: string): string {
  if (!s) return s;
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

async function getTopEmployers(committeeId: string, cycle: number): Promise<DonorEmployer[]> {
  const data = await fecFetch<{ results: FECEmployerResult[] }>(
    "/schedules/schedule_a/by_employer/",
    { committee_id: committeeId, cycle, sort: "-total", per_page: 30 },
  );
  if (!data?.results) return [];

  return data.results
    .filter((r) => !isJunkEmployer(r.employer))
    .slice(0, 10)
    .map((r) => ({
      employer: titleCase(r.employer),
      total: r.total,
      count: r.count,
    }));
}

interface OutsideSpendingResult {
  spenders: OutsideSpender[] | null;
  cycle: number | null;
}

async function getOutsideSpending(candidateId: string): Promise<OutsideSpendingResult> {
  // Query all recent cycles in parallel — PAC activity may span cycles
  const results = await Promise.all(
    CYCLES.map((cycle) =>
      fecFetch<{ results: FECIndependentExpenditure[] }>(
        "/schedules/schedule_e/by_candidate/",
        { candidate_id: candidateId, cycle, sort: "-total", per_page: 15 },
      ),
    ),
  );

  // If ALL cycle queries failed, return null to distinguish from "no spending"
  if (results.every((r) => r === null)) return { spenders: null, cycle: null };

  // Merge and deduplicate by committee name + support/oppose
  // Track which cycle had the most spending (for display purposes)
  const merged = new Map<string, OutsideSpender>();
  let bestCycle: number | null = null;
  let bestCycleTotal = 0;

  for (let idx = 0; idx < results.length; idx++) {
    const data = results[idx];
    if (!data?.results) continue;
    let cycleTotal = 0;
    for (const r of data.results) {
      if (r.total <= 0 || !r.committee_name) continue;
      cycleTotal += r.total;
      const key = `${r.committee_name}|${r.support_oppose_indicator}`;
      const existing = merged.get(key);
      if (existing) {
        if (r.total > existing.total) {
          existing.total = r.total;
        }
      } else {
        merged.set(key, {
          name: titleCase(r.committee_name) || "Unknown Committee",
          total: r.total,
          support: r.support_oppose_indicator === "S",
        });
      }
    }
    if (cycleTotal > bestCycleTotal) {
      bestCycleTotal = cycleTotal;
      bestCycle = CYCLES[idx];
    }
  }

  return {
    spenders: Array.from(merged.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 15),
    cycle: bestCycle,
  };
}

async function fetchFinanceForCandidate(
  candidateId: string,
  bioguideId: string,
): Promise<CampaignFinanceSummary | null> {
  // 1. Get candidate details
  const candidateData = await fecFetch<{ results: FECCandidate[] }>(
    `/candidate/${candidateId}/`,
  );
  const candidate = candidateData?.results?.[0];
  if (!candidate) return null;

  // 2. Get totals for each cycle we care about — query per cycle to avoid
  //    null-cycle aggregate rows pushing real data off the first page
  const totalsResults = (
    await Promise.all(
      CYCLES.map((cycle) =>
        fecFetch<{ results: FECTotalsResult[] }>(
          `/candidate/${candidateId}/totals/`,
          { cycle, per_page: 1 },
        ),
      ),
    )
  ).flatMap((data, i) => {
    const r = data?.results?.[0];
    // Ensure cycle is set (some entries come back with cycle=null even when queried by cycle)
    return r ? [{ ...r, cycle: r.cycle ?? CYCLES[i] }] : [];
  });

  // Pick the most recent cycle that has meaningful receipts
  let bestTotals: FECTotalsResult | undefined;
  for (const cycle of CYCLES) {
    const match = totalsResults.find((t) => t.cycle === cycle);
    if (match && (match.receipts ?? match.contributions ?? 0) > 0) {
      bestTotals = match;
      break;
    }
  }
  if (!bestTotals && totalsResults.length > 0) {
    bestTotals = totalsResults.find((t) => (t.receipts ?? t.contributions ?? 0) > 0)
      ?? totalsResults[0];
  }

  const cycle = bestTotals?.cycle ?? CYCLES[0];
  const totalRaised = bestTotals?.receipts
    ?? bestTotals?.contributions
    ?? bestTotals?.individual_contributions
    ?? 0;

  // 3. Fetch committee, employers, and outside spending in parallel
  const [committeeData, outsideResult] = await Promise.all([
    fecFetch<{ results: FECCommittee[] }>(
      `/candidate/${candidateId}/committees/`,
      { cycle, designation: "P" },
    ),
    getOutsideSpending(candidateId),
  ]);

  let committeeId = committeeData?.results?.[0]?.committee_id;

  if (!committeeId) {
    // Broaden: any authorized committee
    const broadData = await fecFetch<{ results: FECCommittee[] }>(
      `/candidate/${candidateId}/committees/`,
      { cycle },
    );
    committeeId = broadData?.results?.[0]?.committee_id;
  }

  // Get top employers (requires committeeId)
  const topEmployers = committeeId
    ? await getTopEmployers(committeeId, cycle)
    : [];

  return {
    bioguideId,
    name: titleCase(candidate.name),
    party: parseParty(candidate.party),
    chamber: parseOffice(candidate.office),
    state: candidate.state,
    candidateId,
    committeeId: committeeId ?? "",
    cycle,
    totalRaised,
    topEmployers,
    outsideSpending: outsideResult.spenders,
    outsideSpendingCycle: outsideResult.cycle,
  };
}

async function searchCandidateByName(
  name: string,
  bioguideId?: string,
  state?: string,
  chamber?: "house" | "senate",
): Promise<CampaignFinanceSummary | null> {
  const office = chamber === "senate" ? "S" : chamber === "house" ? "H" : undefined;

  // Try full name first
  const params: Record<string, string | number> = { q: name, sort: "-receipts", per_page: 5 };
  if (state) params.state = state;
  if (office) params.office = office;

  let data = await fecFetch<{ results: FECCandidate[] }>(
    "/candidates/search/",
    params,
  );

  let candidate = data?.results?.[0];

  // If no results, try last name only (handles nickname mismatches like Lizzie→Elizabeth)
  if (!candidate && name.includes(" ")) {
    const lastName = name.split(" ").pop()!;
    const fallbackParams: Record<string, string | number> = { q: lastName, sort: "-receipts", per_page: 5 };
    if (state) fallbackParams.state = state;
    if (office) fallbackParams.office = office;

    data = await fecFetch<{ results: FECCandidate[] }>(
      "/candidates/search/",
      fallbackParams,
    );
    candidate = data?.results?.[0];
  }

  if (!candidate) return null;

  return fetchFinanceForCandidate(candidate.candidate_id, bioguideId ?? candidate.candidate_id);
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const bioguideIds = searchParams.get("bioguideIds");
  const names = searchParams.get("names");
  const search = searchParams.get("search");

  if (!bioguideIds && !search) {
    return NextResponse.json(
      { error: "Provide bioguideIds or search parameter" },
      { status: 400 },
    );
  }

  if (search) {
    const result = await searchCandidateByName(search);
    return NextResponse.json({ data: { search: result } });
  }

  const ids = bioguideIds!.split(",").map((id) => id.trim().toLowerCase());
  const nameList = names ? names.split(",").map((n) => decodeURIComponent(n.trim())) : [];
  const states = searchParams.get("states");
  const stateList = states ? states.split(",").map((s) => s.trim()) : [];
  const chambers = searchParams.get("chambers");
  const chamberList = chambers ? chambers.split(",").map((c) => c.trim() as "house" | "senate") : [];
  const results: Record<string, CampaignFinanceSummary | null> = {};

  await Promise.all(
    ids.map(async (bioguideId, i) => {
      const fecId = FEC_CANDIDATE_IDS[bioguideId];
      let result: CampaignFinanceSummary | null = null;

      if (fecId) {
        result = await fetchFinanceForCandidate(fecId, bioguideId);
      }

      if (!result && nameList[i]) {
        result = await searchCandidateByName(nameList[i], bioguideId, stateList[i], chamberList[i]);
      }

      results[bioguideId] = result;
    }),
  );

  return NextResponse.json({ data: results });
}
