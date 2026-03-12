/**
 * Congress.gov API v3 client for bill discovery and details.
 * Docs: https://api.congress.gov/
 */

const BASE_URL = "https://api.congress.gov/v3";

function getApiKey(): string {
  return process.env.CONGRESS_API_KEY || "DEMO_KEY";
}

interface CongressApiResponse<T> {
  [key: string]: T;
}

export interface BillSummary {
  number: number;
  type: string; // "HR", "S", etc.
  title: string;
  congress: number;
  originChamber: string;
  latestAction: { actionDate: string; text: string };
  url: string;
}

export interface BillAction {
  actionDate: string;
  text: string;
  type: string;
  recordedVotes?: Array<{
    chamber: string;
    congress: number;
    date: string;
    rollNumber: number;
    sessionNumber: number;
    url: string;
  }>;
}

export interface BillDetail {
  number: number;
  type: string;
  title: string;
  congress: number;
  committees?: { url: string };
  actions: { url: string };
  latestAction: { actionDate: string; text: string };
}

export interface CommitteeInfo {
  name: string;
  chamber: string;
}

async function fetchJson<T>(url: string): Promise<T> {
  const separator = url.includes("?") ? "&" : "?";
  const fullUrl = `${url}${separator}api_key=${getApiKey()}&format=json`;

  const res = await fetch(fullUrl);
  if (!res.ok) {
    throw new Error(`Congress API ${res.status}: ${res.statusText} — ${url}`);
  }
  return res.json() as Promise<T>;
}

/**
 * Search for bills that became law or passed both chambers.
 */
export async function fetchRecentEnactedBills(
  congress: number
): Promise<BillSummary[]> {
  const data = await fetchJson<CongressApiResponse<BillSummary[]>>(
    `${BASE_URL}/bill/${congress}?sort=updateDate+desc&limit=250`
  );
  return data.bills ?? [];
}

/**
 * Fetch a specific bill's details.
 */
export async function fetchBillDetail(
  congress: number,
  billType: string,
  billNumber: number
): Promise<BillDetail> {
  const type = billType.toLowerCase();
  const data = await fetchJson<CongressApiResponse<BillDetail>>(
    `${BASE_URL}/bill/${congress}/${type}/${billNumber}`
  );
  return data.bill as BillDetail;
}

/**
 * Fetch a bill's actions, which include roll call vote references.
 */
export async function fetchBillActions(
  congress: number,
  billType: string,
  billNumber: number
): Promise<BillAction[]> {
  const type = billType.toLowerCase();
  const data = await fetchJson<CongressApiResponse<BillAction[]>>(
    `${BASE_URL}/bill/${congress}/${type}/${billNumber}/actions?limit=250`
  );
  return data.actions ?? [];
}

/**
 * Fetch committees for a bill.
 */
export async function fetchBillCommittees(
  congress: number,
  billType: string,
  billNumber: number
): Promise<CommitteeInfo[]> {
  const type = billType.toLowerCase();
  const data = await fetchJson<
    CongressApiResponse<Array<{ name: string; chamber: string }>>
  >(
    `${BASE_URL}/bill/${congress}/${type}/${billNumber}/committees`
  );
  return (data.committees ?? []).map((c) => ({
    name: c.name,
    chamber: c.chamber,
  }));
}

/**
 * Fetch cosponsor count for a bill.
 */
export async function fetchBillCosponsors(
  congress: number,
  billType: string,
  billNumber: number
): Promise<number> {
  const type = billType.toLowerCase();
  const data = await fetchJson<CongressApiResponse<unknown[]>>(
    `${BASE_URL}/bill/${congress}/${type}/${billNumber}/cosponsors?limit=1`
  );
  // The API returns a count field at the top level
  const count = (data as Record<string, unknown>).count;
  if (typeof count === "number") return count;
  // Fallback: count the array
  const cosponsors = (data as Record<string, unknown>).cosponsors;
  return Array.isArray(cosponsors) ? cosponsors.length : 0;
}

export interface DiscoveredVote {
  chamber: "House" | "Senate";
  rollNumber: number;
  year: number;
  sessionNumber: number;
  congress: number;
}

/**
 * Extract roll call votes from a bill's actions.
 */
export function extractVotesFromActions(actions: BillAction[]): DiscoveredVote[] {
  const votes: DiscoveredVote[] = [];

  for (const action of actions) {
    if (!action.recordedVotes) continue;
    for (const rv of action.recordedVotes) {
      const chamber = rv.chamber === "House of Representatives" ? "House" : "Senate";
      votes.push({
        chamber,
        rollNumber: rv.rollNumber,
        year: new Date(rv.date).getFullYear(),
        sessionNumber: rv.sessionNumber,
        congress: rv.congress,
      });
    }
  }

  return votes;
}

/**
 * Parse a bill identifier like "hr1234-119" into its components.
 */
export function parseBillId(billId: string): {
  type: string;
  number: number;
  congress: number;
} {
  const match = billId.match(/^(hr|s|hjres|sjres)(\d+)-(\d+)$/i);
  if (!match) {
    throw new Error(
      `Invalid bill ID "${billId}". Expected format: hr1234-119 or s567-119`
    );
  }
  return {
    type: match[1].toLowerCase(),
    number: parseInt(match[2], 10),
    congress: parseInt(match[3], 10),
  };
}

/**
 * Fetch vote totals from House Clerk XML.
 */
export async function fetchHouseVoteTotals(
  year: number,
  rollCall: number
): Promise<{ yea: number; nay: number } | null> {
  const url = `https://clerk.house.gov/evs/${year}/roll${rollCall}.xml`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const xml = await res.text();

    const yeaMatch = xml.match(/<yea-total>(\d+)<\/yea-total>/);
    const nayMatch = xml.match(/<nay-total>(\d+)<\/nay-total>/);
    if (!yeaMatch || !nayMatch) return null;

    return { yea: parseInt(yeaMatch[1], 10), nay: parseInt(nayMatch[1], 10) };
  } catch {
    return null;
  }
}

/**
 * Fetch vote totals from Senate XML.
 */
export async function fetchSenateVoteTotals(
  congress: number,
  session: number,
  rollCall: number
): Promise<{ yea: number; nay: number } | null> {
  const padded = String(rollCall).padStart(5, "0");
  const url = `https://www.senate.gov/legislative/LIS/roll_call_votes/vote${congress}${session}/vote_${congress}_${session}_${padded}.xml`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const xml = await res.text();

    const yeaMatch = xml.match(/<yeas>(\d+)<\/yeas>/);
    const nayMatch = xml.match(/<nays>(\d+)<\/nays>/);
    if (!yeaMatch || !nayMatch) return null;

    return { yea: parseInt(yeaMatch[1], 10), nay: parseInt(nayMatch[1], 10) };
  } catch {
    return null;
  }
}
