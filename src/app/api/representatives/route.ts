import { NextRequest, NextResponse } from "next/server";
import type { Representative } from "@/data/representatives";

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

function estimateNextElection(
  type: "representative" | "senator",
  bioguideId: string,
  allDistricts: GeocodioDistrict[],
): number {
  const currentYear = new Date().getFullYear();
  const nextEvenYear = currentYear % 2 === 0 ? currentYear : currentYear + 1;

  if (type === "representative") {
    return nextEvenYear;
  }

  // For senators, we need to determine their class.
  // Geocod.io doesn't provide this directly, so we use a heuristic:
  // Senate classes cycle on 2024/2026/2028 pattern.
  // Without term start data, default to next even year.
  return nextEvenYear;
}

function transformLegislator(
  leg: GeocodioLegislator,
  district: GeocodioDistrict,
  state: string,
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
    nextElection: estimateNextElection(leg.type, leg.references.bioguide_id, [district]),
  };
}

export async function GET(request: NextRequest) {
  const zip = request.nextUrl.searchParams.get("zip");

  if (!zip || zip.length < 5) {
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
    const res = await fetch(url, { next: { revalidate: 86400 } });

    if (!res.ok) {
      console.error("Geocodio error:", res.status, await res.text().catch(() => ""));
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

    for (const district of sortedDistricts) {
      for (const leg of district.current_legislators) {
        const id = leg.references.bioguide_id.toLowerCase();
        if (seen.has(id)) continue;
        seen.add(id);

        const rep = transformLegislator(leg, district, state);

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
    console.error("Failed to fetch representatives:", err);
    return NextResponse.json({ fallback: true, representatives: null });
  }
}
