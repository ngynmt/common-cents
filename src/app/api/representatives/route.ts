import { NextRequest, NextResponse } from "next/server";
import type { Representative } from "@/data/representatives";

const CIVIC_DIVISIONS_URL = "https://www.googleapis.com/civicinfo/v2/divisionsByAddress";
const CONGRESS_API_URL = "https://api.congress.gov/v3";
const CONGRESS_API_KEY = process.env.CONGRESS_API_KEY || "DEMO_KEY";

interface CongressMemberSummary {
  bioguideId: string;
  name: string; // "Last, First"
  partyName: string;
  state: string;
  depiction?: { imageUrl: string };
  terms?: { item: { chamber: string; startYear: number; endYear?: number }[] };
}

interface CongressMemberDetail {
  bioguideId: string;
  directOrderName: string;
  firstName: string;
  lastName: string;
  partyHistory: { partyAbbreviation: string; partyName: string }[];
  district?: number;
  state: string;
  currentMember: boolean;
  addressInformation?: {
    officeAddress: string;
    phoneNumber: string;
    city: string;
    district: string;
    zipCode: number;
  };
  officialWebsiteUrl?: string;
  depiction?: { imageUrl: string };
  // Detail endpoint returns terms as array directly, not wrapped in { item: [...] }
  terms?: { chamber: string; startYear: number; endYear?: number }[];
}

function parseParty(partyName: string): "D" | "R" | "I" {
  const lower = partyName.toLowerCase();
  if (lower.includes("democrat")) return "D";
  if (lower.includes("republican")) return "R";
  return "I";
}

function estimateNextElection(chamber: "house" | "senate", terms?: TermEntry[] | { item: TermEntry[] }): number {
  const currentYear = new Date().getFullYear();
  const nextEvenYear = currentYear % 2 === 0 ? currentYear : currentYear + 1;

  if (chamber === "house") {
    return nextEvenYear;
  }

  // For senators: determine their election class from their first Senate term.
  // Senate classes cycle every 6 years. We find the first term start, derive the
  // election year (the even year at or before the start), then project forward.
  const items = Array.isArray(terms) ? terms : terms?.item || [];
  const senateTerms = items.filter((t) => t.chamber === "Senate");

  if (senateTerms.length > 0) {
    const firstSenateStart = Math.min(...senateTerms.map((t) => t.startYear));
    // Election happens in the even year at or just before the term starts
    // Regular: starts 2013 (odd) → elected 2012 (even)
    // Special: starts 2002 (even) → elected 2002 (even)
    const firstElection = firstSenateStart % 2 === 0 ? firstSenateStart : firstSenateStart - 1;
    let next = firstElection;
    while (next < currentYear) next += 6;
    return next;
  }

  return nextEvenYear;
}

type TermEntry = { chamber: string; startYear: number; endYear?: number };

function getLatestTerm(terms?: TermEntry[] | { item: TermEntry[] }) {
  // Handle both formats: detail returns array, list returns { item: [...] }
  const items = Array.isArray(terms) ? terms : terms?.item || [];
  if (items.length === 0) return null;
  return [...items].sort((a, b) => (b.startYear || 0) - (a.startYear || 0))[0];
}

function transformMemberDetail(member: CongressMemberDetail): Representative {
  const latestTerm = getLatestTerm(member.terms);
  // Use multiple signals to determine chamber — terms data alone can be unreliable
  const termSaysSenate = latestTerm?.chamber === "Senate";
  const officeSaysSenate = member.addressInformation?.officeAddress?.toLowerCase().includes("senate") ?? false;
  const websiteSaysSenate = member.officialWebsiteUrl?.toLowerCase().includes("senate") ?? false;
  const isSenate = termSaysSenate || officeSaysSenate || websiteSaysSenate;
  const chamber: "house" | "senate" = isSenate ? "senate" : "house";

  const stateAbbr = member.state?.length === 2
    ? member.state
    : stateNameToAbbr(member.state) || member.state;

  const party = member.partyHistory?.[member.partyHistory.length - 1];

  return {
    id: member.bioguideId.toLowerCase(),
    name: member.directOrderName,
    chamber,
    party: party ? parseParty(party.partyName) : "I",
    state: stateAbbr,
    district: !isSenate && member.district ? String(member.district) : undefined,
    photoUrl: member.depiction?.imageUrl || "",
    phone: member.addressInformation?.phoneNumber || "",
    office: member.addressInformation
      ? `${member.addressInformation.officeAddress}, Washington, DC ${member.addressInformation.zipCode}`
      : "",
    website: member.officialWebsiteUrl || "",
    contactFormUrl: member.officialWebsiteUrl
      ? `${member.officialWebsiteUrl.replace(/\/$/, "")}/contact`
      : "",
    nextElection: estimateNextElection(chamber, member.terms),
  };
}

const STATE_ABBRS: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
  kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS", missouri: "MO",
  montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH", "new jersey": "NJ",
  "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND",
  ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI",
  "south carolina": "SC", "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT",
  vermont: "VT", virginia: "VA", washington: "WA", "west virginia": "WV",
  wisconsin: "WI", wyoming: "WY",
};

function stateNameToAbbr(name: string): string | undefined {
  return STATE_ABBRS[name.toLowerCase()];
}

async function getStateFromZip(zip: string, apiKey: string): Promise<string | null> {
  try {
    const url = `${CIVIC_DIVISIONS_URL}?address=${encodeURIComponent(zip)}&key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.normalizedInput?.state) {
      return data.normalizedInput.state;
    }
    const divisions = data.divisions || {};
    for (const divId of Object.keys(divisions)) {
      const match = divId.match(/state:(\w+)/);
      if (match && !divId.includes("/cd:") && !divId.includes("/place:")) {
        return match[1].toUpperCase();
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function getMembersForState(stateAbbr: string): Promise<CongressMemberSummary[]> {
  const url = `${CONGRESS_API_URL}/member/${stateAbbr}?currentMember=true&limit=100&api_key=${CONGRESS_API_KEY}`;
  const res = await fetch(url, { next: { revalidate: 86400 } });
  if (!res.ok) {
    console.error("Congress API list error:", res.status, await res.text().catch(() => ""));
    return [];
  }
  const data = await res.json();
  return data.members || [];
}

async function getMemberDetail(bioguideId: string): Promise<CongressMemberDetail | null> {
  const url = `${CONGRESS_API_URL}/member/${bioguideId}?api_key=${CONGRESS_API_KEY}`;
  const res = await fetch(url, { next: { revalidate: 86400 } });
  if (!res.ok) return null;
  const data = await res.json();
  return data.member || null;
}

export async function GET(request: NextRequest) {
  const zip = request.nextUrl.searchParams.get("zip");

  if (!zip || zip.length < 5) {
    return NextResponse.json(
      { error: "A valid ZIP code is required" },
      { status: 400 },
    );
  }

  const civicKey = process.env.GOOGLE_CIVIC_API_KEY;
  if (!civicKey) {
    return NextResponse.json({ fallback: true, representatives: null });
  }

  try {
    // Step 1: ZIP → state
    const state = await getStateFromZip(zip, civicKey);
    if (!state) {
      return NextResponse.json({ fallback: true, representatives: null });
    }

    // Step 2: Get all current members for this state
    const members = await getMembersForState(state);
    if (members.length === 0) {
      return NextResponse.json({ fallback: true, representatives: null });
    }

    // Step 3: Fetch full details for all members
    const details = await Promise.all(
      members.map((m) => getMemberDetail(m.bioguideId)),
    );

    const representatives: Representative[] = details
      .filter((d): d is CongressMemberDetail => d !== null && d.currentMember)
      .map(transformMemberDetail)
      // Sort: senators first, then house by district number
      .sort((a, b) => {
        if (a.chamber !== b.chamber) return a.chamber === "senate" ? -1 : 1;
        if (a.district && b.district) return Number(a.district) - Number(b.district);
        return a.name.localeCompare(b.name);
      });

    return NextResponse.json({
      fallback: false,
      state,
      representatives,
    });
  } catch (err) {
    console.error("Failed to fetch representatives:", err);
    return NextResponse.json({ fallback: true, representatives: null });
  }
}
