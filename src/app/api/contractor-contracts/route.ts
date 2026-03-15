import { NextRequest, NextResponse } from "next/server";
import { logApi, trackedFetch } from "@/lib/api-logger";
import { checkRateLimit } from "@/lib/redis";
import { agencyToCategory, CATEGORY_LABELS } from "@/lib/expenditures";

const USASPENDING_URL = "https://api.usaspending.gov/api/v2/search/spending_by_award/";
const ROUTE = "/api/contractor-contracts";

export interface DonorContract {
  awardId: string;
  description: string;
  amount: number;
  agency: string;
  category: string;
  categoryLabel: string;
  startDate: string;
  url: string;
}

export interface DonorContractsResult {
  employer: string;
  contracts: DonorContract[];
  totalAmount: number;
}

/**
 * GET /api/contractor-contracts?names=LOCKHEED+MARTIN,BOEING
 *
 * For each employer name, fetches their largest recent federal contracts
 * from USASpending.gov. Used by the rep card to show what a rep's
 * top donor employers receive in federal contracts.
 */
export async function GET(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const { allowed, retryAfterSeconds } = await checkRateLimit(ip, "contractor-contracts", 15);
  if (!allowed) {
    logApi({ route: ROUTE, event: "rate_limit_hit" });
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds ?? 60) } },
    );
  }

  const { searchParams } = new URL(request.url);
  const namesParam = searchParams.get("names");

  if (!namesParam) {
    return NextResponse.json(
      { error: "Provide employer names as comma-separated list" },
      { status: 400 },
    );
  }

  const names = namesParam.split(",").map((n) => decodeURIComponent(n.trim())).filter(Boolean).slice(0, 5);

  if (names.length === 0) {
    return NextResponse.json({ results: [] });
  }

  // Query USASpending for each employer in parallel
  const results = await Promise.all(
    names.map(async (employer): Promise<DonorContractsResult> => {
      const body = {
        filters: {
          award_type_codes: ["A", "B", "C", "D"],
          recipient_search_text: [employer.toUpperCase()],
          award_amounts: [{ lower_bound: 1_000_000 }], // $1M+ contracts
        },
        fields: [
          "Award ID",
          "Description",
          "Award Amount",
          "Funding Agency",
          "Awarding Agency",
          "Start Date",
          "generated_internal_id",
        ],
        limit: 5,
        page: 1,
        sort: "Award Amount",
        order: "desc",
      };

      const res = await trackedFetch(USASPENDING_URL, ROUTE, "usaspending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        next: { revalidate: 86400 },
      });

      if (!res) {
        return { employer, contracts: [], totalAmount: 0 };
      }

      const data = await res.json();
      if (!data.results || !Array.isArray(data.results)) {
        return { employer, contracts: [], totalAmount: 0 };
      }

      const contracts: DonorContract[] = data.results.map(
        (r: Record<string, unknown>) => {
          const fundingAgency = String(r["Funding Agency"] ?? "");
          const awardingAgency = String(r["Awarding Agency"] ?? "Unknown");
          const categoryAgency = fundingAgency || awardingAgency;
          const categoryId = agencyToCategory(categoryAgency);
          const internalId = String(r["generated_internal_id"] ?? "");
          return {
            awardId: String(r["Award ID"] ?? ""),
            description: String(r["Description"] ?? "Federal contract"),
            amount: Number(r["Award Amount"]) || 0,
            agency: awardingAgency,
            category: categoryId,
            categoryLabel: CATEGORY_LABELS[categoryId] || categoryId,
            startDate: String(r["Start Date"] ?? ""),
            url: internalId
              ? `https://www.usaspending.gov/award/${internalId}`
              : "https://www.usaspending.gov",
          };
        },
      );

      const totalAmount = contracts.reduce((sum, c) => sum + c.amount, 0);

      return { employer, contracts, totalAmount };
    }),
  );

  logApi({
    route: ROUTE,
    event: "success",
    success: true,
    count: results.length,
  });

  return NextResponse.json({ results });
}
