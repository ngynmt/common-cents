import { NextRequest, NextResponse } from "next/server";
import type { Representative } from "@/data/representatives";
import { getSenatorNextElection } from "@/data/senate-classes";
import { logApi, trackedFetch } from "@/lib/api-logger";
import { checkRateLimit } from "@/lib/redis";

const ZIP_REGEX = /^\d{5}$/;

const GEOCODIO_URL = "https://api.geocod.io/v1.7/geocode";
const GEOCODIO_API_KEY = process.env.GEOCODIO_API_KEY || "DEMO";

interface GeocodioLegislator {
  type: "representative" | "senator";
  seniority?: string;
  bio: {
    last_name: string;
    first_name: string;
    birthday: string;
    gender: string;
    party: string;
    photo_url: string;
  };
  contact: {
    url: string;
    address: string;
    phone: string;
    contact_form: string | null;
  };
  references: {
    bioguide_id: string;
    lis_id?: string;
  };
}

interface GeocodioDistrict {
  name: string;
  district_number: number;
  ocd_id: string;
  proportion: number;
  current_legislators: GeocodioLegislator[];
}

function parseParty(party: string): "D" | "R" | "I" {
  const lower = party.toLowerCase();
  if (lower.includes("democrat")) return "D";
  if (lower.includes("republican")) return "R";
  return "I";
}

function getNextElectionYear(
  leg: GeocodioLegislator,
  state: string,
  allSenators: GeocodioLegislator[],
): number {
  const currentYear = new Date().getFullYear();
  const nextEvenYear = currentYear % 2 === 0 ? currentYear : currentYear + 1;

  if (leg.type === "representative") {
    return nextEvenYear; // House reps are always up every 2 years
  }

  // Determine seniority rank (1 = more senior) among the two state senators
  // using Geocodio's seniority field (overall senate rank — lower number = more senior)
  const stateSenators = allSenators.filter(
    (s) => s.type === "senator",
  );

  let seniorityRank: 1 | 2 | undefined;
  if (stateSenators.length === 2 && leg.seniority) {
    const other = stateSenators.find(
      (s) => s.references.bioguide_id !== leg.references.bioguide_id,
    );
    if (other?.seniority) {
      // Lower seniority number = more senior
      seniorityRank = Number(leg.seniority) <= Number(other.seniority) ? 1 : 2;
    }
  }

  return getSenatorNextElection(state, seniorityRank);
}

function transformLegislator(
  leg: GeocodioLegislator,
  district: GeocodioDistrict,
  state: string,
  allSenators: GeocodioLegislator[],
): Representative {
  const chamber: "house" | "senate" = leg.type === "senator" ? "senate" : "house";

  return {
    id: leg.references.bioguide_id.toLowerCase(),
    name: `${leg.bio.first_name} ${leg.bio.last_name}`,
    chamber,
    party: parseParty(leg.bio.party),
    state,
    district: chamber === "house" ? String(district.district_number) : undefined,
    photoUrl: leg.bio.photo_url || "",
    phone: leg.contact.phone || "",
    office: leg.contact.address || "",
    website: leg.contact.url || "",
    contactFormUrl: leg.contact.contact_form || (leg.contact.url ? `${leg.contact.url.replace(/\/$/, "")}/contact` : ""),
    nextElection: getNextElectionYear(leg, state, allSenators),
    lisId: leg.references.lis_id || undefined,
  };
}

export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
  const { allowed, retryAfterSeconds } = await checkRateLimit(ip, "representatives", 20);
  if (!allowed) {
    logApi({ route: "/api/representatives", event: "rate_limit_hit" });
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds ?? 60) } },
    );
  }

  const zip = request.nextUrl.searchParams.get("zip");

  if (!zip || !ZIP_REGEX.test(zip)) {
    return NextResponse.json(
      { error: "A valid ZIP code is required" },
      { status: 400 },
    );
  }

  if (GEOCODIO_API_KEY === "DEMO" && process.env.NODE_ENV === "production") {
    return NextResponse.json({ fallback: true, representatives: null });
  }

  try {
    const url = `${GEOCODIO_URL}?q=${encodeURIComponent(zip)}&fields=cd&api_key=${GEOCODIO_API_KEY}`;
    const res = await trackedFetch(url, "/api/representatives", "geocodio", { next: { revalidate: 86400 } });

    if (!res) {
      logApi({ route: "/api/representatives", event: "fallback_activated", dependency: "geocodio" });
      return NextResponse.json({ fallback: true, representatives: null });
    }

    const data = await res.json();
    const result = data.results?.[0];
    if (!result) {
      return NextResponse.json({ fallback: true, representatives: null });
    }

    const state = result.address_components?.state || "";
    const districts: GeocodioDistrict[] = result.fields?.congressional_districts || [];

    if (districts.length === 0) {
      return NextResponse.json({ fallback: true, representatives: null });
    }

    // Deduplicate legislators (senators appear in every district)
    const seen = new Set<string>();
    const representatives: Representative[] = [];

    // Sort districts by proportion descending so the most likely district comes first
    const sortedDistricts = [...districts].sort((a, b) => b.proportion - a.proportion);
    const isMultiDistrict = sortedDistricts.length > 1;

    // Collect all senators across districts for seniority comparison
    const allSenators: GeocodioLegislator[] = [];
    const senatorSeen = new Set<string>();
    for (const district of sortedDistricts) {
      for (const leg of district.current_legislators) {
        if (leg.type === "senator" && !senatorSeen.has(leg.references.bioguide_id)) {
          senatorSeen.add(leg.references.bioguide_id);
          allSenators.push(leg);
        }
      }
    }

    for (const district of sortedDistricts) {
      for (const leg of district.current_legislators) {
        const id = leg.references.bioguide_id.toLowerCase();
        if (seen.has(id)) continue;
        seen.add(id);

        const rep = transformLegislator(leg, district, state, allSenators);

        // For multi-district ZIPs, mark house reps with their proportion
        if (isMultiDistrict && rep.chamber === "house") {
          rep.district = `${district.district_number} (~${Math.round(district.proportion * 100)}% of ZIP)`;
        }

        representatives.push(rep);
      }
    }

    // Sort: senators first, then house by district
    representatives.sort((a, b) => {
      if (a.chamber !== b.chamber) return a.chamber === "senate" ? -1 : 1;
      return (a.district || "").localeCompare(b.district || "");
    });

    return NextResponse.json({
      fallback: false,
      state,
      representatives,
    });
  } catch (err) {
    logApi({
      route: "/api/representatives",
      event: "fallback_activated",
      dependency: "geocodio",
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ fallback: true, representatives: null });
  }
}
