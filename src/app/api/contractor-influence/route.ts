import { NextRequest, NextResponse } from "next/server";
import { logApi, trackedFetch } from "@/lib/api-logger";
import { checkRateLimit } from "@/lib/redis";
import { normalizeContractorName, type ContractorDonation, type ContractorInfluence } from "@/lib/influence";

const FEC_BASE = "https://api.open.fec.gov/v1";
const FEC_API_KEY = process.env.FEC_API_KEY || "DEMO_KEY";
const ROUTE = "/api/contractor-influence";

/** Try these cycles in order — most recent first */
const CYCLES = [2026, 2024, 2022];

function fecUrl(path: string, params: Record<string, string | number> = {}): string {
  const url = new URL(`${FEC_BASE}${path}`);
  url.searchParams.set("api_key", FEC_API_KEY);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }
  return url.toString();
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

/**
 * Try multiple employer name variants to match FEC data.
 * USASpending uses long legal names; FEC uses shorter common names.
 */
function getSearchVariants(normalized: string): string[] {
  const variants = [normalized];

  // Try first two words (e.g. "GENERAL DYNAMICS" from "GENERAL DYNAMICS INFORMATION TECHNOLOGY")
  const words = normalized.split(" ");
  if (words.length > 2) {
    variants.push(words.slice(0, 2).join(" "));
  }

  // Try first word if it's a well-known single-name company (BOEING, RAYTHEON, etc.)
  if (words.length > 1 && words[0].length > 4) {
    variants.push(words[0]);
  }

  return variants;
}

interface AggregatedRecipient {
  committeeId: string;
  candidateId: string;
  committeeName: string;
  total: number;
  count: number;
}

/**
 * GET /api/contractor-influence?contractor=LOCKHEED+MARTIN
 *
 * Searches FEC Schedule A (individual contributions) by employer name
 * to find which members of Congress received donations from a contractor's employees.
 */
export async function GET(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const { allowed, retryAfterSeconds } = await checkRateLimit(ip, "contractor-influence", 20);
  if (!allowed) {
    logApi({ route: ROUTE, event: "rate_limit_hit" });
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds ?? 60) } },
    );
  }

  const { searchParams } = new URL(request.url);
  const contractor = searchParams.get("contractor");

  if (!contractor || contractor.trim().length === 0) {
    return NextResponse.json(
      { error: "Provide a contractor name" },
      { status: 400 },
    );
  }

  const normalizedName = normalizeContractorName(contractor);
  const nameVariants = getSearchVariants(normalizedName);

  // Search FEC Schedule A filtered by contributor_employer.
  // Try name variants × cycles until we get results.
  for (const variant of nameVariants) {
    for (const cycle of CYCLES) {
      const res = await trackedFetch(
        fecUrl("/schedules/schedule_a/", {
          contributor_employer: variant,
          two_year_transaction_period: cycle,
          sort: "-contribution_receipt_amount",
          per_page: 100,
          is_individual: "true",
        }),
        ROUTE,
        "fec",
        { next: { revalidate: 86400 } },
      );

      if (!res) continue;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: { results?: any[] } = await res.json();
      if (!data?.results || data.results.length === 0) continue;

      // Aggregate contributions by committee
      const byCommittee = new Map<string, AggregatedRecipient>();

      for (const r of data.results) {
        const commId = r.committee_id || "";
        if (!commId) continue;
        const existing = byCommittee.get(commId);
        const amount = r.contribution_receipt_amount || 0;
        if (existing) {
          existing.total += amount;
          existing.count += 1;
        } else {
          byCommittee.set(commId, {
            committeeId: commId,
            candidateId: r.candidate_id || "",
            committeeName: r.committee?.name || commId,
            total: amount,
            count: 1,
          });
        }
      }

      if (byCommittee.size === 0) continue;

      // Resolve top committees to candidates
      const topCommittees = Array.from(byCommittee.values())
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);

      const recipientPromises = topCommittees.map(async (info) => {
        // Try candidate ID first
        if (info.candidateId) {
          const candRes = await trackedFetch(
            fecUrl(`/candidate/${info.candidateId}/`),
            ROUTE,
            "fec",
            { next: { revalidate: 86400 } },
          );
          if (candRes) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const candData: { results?: any[] } = await candRes.json();
            const cand = candData?.results?.[0];
            if (cand) {
              return {
                recipientName: titleCase(cand.name),
                recipientParty: parseParty(cand.party || ""),
                recipientState: cand.state || "",
                recipientOffice: parseOffice(cand.office || "H"),
                candidateId: cand.candidate_id,
                total: info.total,
                count: info.count,
              } satisfies ContractorDonation;
            }
          }
        }

        // Fallback: resolve committee → candidate
        const commRes = await trackedFetch(
          fecUrl(`/committee/${info.committeeId}/candidates/`),
          ROUTE,
          "fec",
          { next: { revalidate: 86400 } },
        );
        if (commRes) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const commData: { results?: any[] } = await commRes.json();
          const cand = commData?.results?.[0];
          if (cand) {
            return {
              recipientName: titleCase(cand.name),
              recipientParty: parseParty(cand.party || ""),
              recipientState: cand.state || "",
              recipientOffice: parseOffice(cand.office || "H"),
              candidateId: cand.candidate_id,
              total: info.total,
              count: info.count,
            } satisfies ContractorDonation;
          }
        }

        // Last resort: show committee name
        return {
          recipientName: titleCase(info.committeeName),
          recipientParty: "I" as const,
          recipientState: "",
          recipientOffice: "house" as const,
          candidateId: "",
          total: info.total,
          count: info.count,
        } satisfies ContractorDonation;
      });

      const recipients = (await Promise.all(recipientPromises))
        .filter((r) => r.total > 0)
        .sort((a, b) => b.total - a.total);

      if (recipients.length > 0) {
        const totalDonations = recipients.reduce((sum, r) => sum + r.total, 0);
        const donationCount = recipients.reduce((sum, r) => sum + r.count, 0);

        const result: ContractorInfluence = {
          contractorName: contractor,
          normalizedName: variant,
          totalDonations,
          donationCount,
          topRecipients: recipients,
          cycle,
        };

        logApi({ route: ROUTE, event: "success", success: true, count: recipients.length });
        return NextResponse.json({ influence: result });
      }
    }
  }

  // No data found
  logApi({ route: ROUTE, event: "no_data", success: true });
  return NextResponse.json({ influence: null });
}
