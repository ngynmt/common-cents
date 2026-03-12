import { NextRequest, NextResponse } from "next/server";
import { trackedVotes } from "@/data/tracked-votes";
import type { VoteRecord } from "@/data/representatives";

const HOUSE_XML_URL = "https://clerk.house.gov/evs";
const SENATE_XML_URL = "https://www.senate.gov/legislative/LIS/roll_call_votes";

// Cache parsed XML results in-memory for the lifetime of the serverless function
const voteCache = new Map<string, Map<string, string>>();

/**
 * Parse House roll call XML and extract individual votes.
 * Returns a map of bioguideId (lowercase) -> vote string.
 *
 * House XML structure:
 * <rollcall-vote>
 *   <vote-data>
 *     <recorded-vote>
 *       <legislator name-id="B000574">Mr. Blumenauer</legislator>
 *       <vote>Yea</vote>
 *     </recorded-vote>
 *   </vote-data>
 * </rollcall-vote>
 */
async function fetchHouseVotes(year: number, rollCall: number): Promise<Map<string, string>> {
  const cacheKey = `house:${year}:${rollCall}`;
  if (voteCache.has(cacheKey)) return voteCache.get(cacheKey)!;

  const url = `${HOUSE_XML_URL}/${year}/roll${rollCall}.xml`;
  const res = await fetch(url, { next: { revalidate: 86400 } });

  if (!res.ok) {
    console.error(`House vote fetch failed: ${url} → ${res.status}`);
    return new Map();
  }

  const xml = await res.text();
  const votes = new Map<string, string>();

  // Match each <recorded-vote> block
  const voteRegex = /<legislator\s[^>]*name-id="([^"]+)"[^>]*>[^<]*<\/legislator>\s*<vote>([^<]+)<\/vote>/g;
  let match;
  while ((match = voteRegex.exec(xml)) !== null) {
    const bioguideId = match[1].toLowerCase();
    const voteText = match[2].trim().toLowerCase();
    votes.set(bioguideId, normalizeVote(voteText));
  }

  voteCache.set(cacheKey, votes);
  return votes;
}

/**
 * Parse Senate roll call XML and extract individual votes.
 * Returns a map of lisId -> vote string.
 *
 * Senate XML structure:
 * <roll_call_vote>
 *   <members>
 *     <member>
 *       <vote_cast>Yea</vote_cast>
 *       <lis_member_id>S270</lis_member_id>
 *     </member>
 *   </members>
 * </roll_call_vote>
 */
async function fetchSenateVotes(
  congress: number,
  session: number,
  rollCall: number,
): Promise<Map<string, string>> {
  const cacheKey = `senate:${congress}:${session}:${rollCall}`;
  if (voteCache.has(cacheKey)) return voteCache.get(cacheKey)!;

  const paddedRoll = String(rollCall).padStart(5, "0");
  const url = `${SENATE_XML_URL}/vote${congress}${session}/vote_${congress}_${session}_${paddedRoll}.xml`;
  const res = await fetch(url, { next: { revalidate: 86400 } });

  if (!res.ok) {
    console.error(`Senate vote fetch failed: ${url} → ${res.status}`);
    return new Map();
  }

  const xml = await res.text();
  const votes = new Map<string, string>();

  // Match each <member> block — vote_cast appears before lis_member_id in Senate XML
  const memberRegex = /<vote_cast>([^<]+)<\/vote_cast>[\s\S]*?<lis_member_id>([^<]+)<\/lis_member_id>/g;
  let match;
  while ((match = memberRegex.exec(xml)) !== null) {
    const voteText = match[1].trim().toLowerCase();
    const lisId = match[2].trim();
    votes.set(lisId, normalizeVote(voteText));
  }

  voteCache.set(cacheKey, votes);
  return votes;
}

/**
 * Normalize vote text from XML to our VoteRecord format.
 * House uses: Yea, Nay, Not Voting, Present
 * Senate uses: Yea, Nay, Not Voting, Present
 */
function normalizeVote(voteText: string): string {
  switch (voteText) {
    case "yea":
    case "aye":
      return "yes";
    case "nay":
    case "no":
      return "no";
    case "present":
      return "abstain";
    case "not voting":
      return "not_voting";
    default:
      return "not_voting";
  }
}

/**
 * GET /api/votes?bioguideIds=B000574,S000148&lisIds=S270,S331
 *
 * Fetches real vote records for the given legislators across all tracked bills.
 * bioguideIds are used for House votes, lisIds for Senate votes.
 */
export async function GET(request: NextRequest) {
  const bioguideIdsParam = request.nextUrl.searchParams.get("bioguideIds") || "";
  const lisIdsParam = request.nextUrl.searchParams.get("lisIds") || "";

  const bioguideIds = bioguideIdsParam
    .split(",")
    .map((id) => id.trim().toLowerCase())
    .filter(Boolean);
  const lisIds = lisIdsParam
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (bioguideIds.length === 0 && lisIds.length === 0) {
    return NextResponse.json({ votes: [] });
  }

  try {
    // Fetch all vote XMLs in parallel
    const fetchPromises = trackedVotes.flatMap((tv) => [
      fetchHouseVotes(tv.houseVote.year, tv.houseVote.rollCall).then(
        (votes) => ({ type: "house" as const, tv, votes }),
      ),
      fetchSenateVotes(tv.congress, tv.senateVote.session, tv.senateVote.rollCall).then(
        (votes) => ({ type: "senate" as const, tv, votes }),
      ),
    ]);

    const results = await Promise.all(fetchPromises);
    const voteRecords: VoteRecord[] = [];

    for (const { type, tv, votes } of results) {
      if (type === "house") {
        // Match House votes by bioguide ID
        for (const bioguideId of bioguideIds) {
          const vote = votes.get(bioguideId);
          if (vote) {
            voteRecords.push({
              representativeId: bioguideId,
              legislationTitle: tv.legislationTitle,
              categoryId: tv.categoryId,
              vote: vote as VoteRecord["vote"],
              date: tv.date,
            });
          }
        }
      } else {
        // Match Senate votes by LIS ID
        for (const lisId of lisIds) {
          const vote = votes.get(lisId);
          if (vote) {
            // We need to map lisId back to bioguideId for the representativeId field.
            // The caller provides both, so we'll include the lisId and let the client match.
            voteRecords.push({
              representativeId: `lis:${lisId}`,
              legislationTitle: tv.legislationTitle,
              categoryId: tv.categoryId,
              vote: vote as VoteRecord["vote"],
              date: tv.date,
            });
          }
        }
      }
    }

    return NextResponse.json({ votes: voteRecords });
  } catch (err) {
    console.error("Failed to fetch votes:", err);
    return NextResponse.json({ votes: [] });
  }
}
