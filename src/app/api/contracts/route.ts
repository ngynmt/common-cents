import { NextRequest, NextResponse } from "next/server";
import { logApi, trackedFetch } from "@/lib/api-logger";
import { checkRateLimit } from "@/lib/redis";
import { agencyToCategory, type FederalContract } from "@/lib/expenditures";

const USASPENDING_URL = "https://api.usaspending.gov/api/v2/search/spending_by_award/";

const DEFAULT_DAYS = 180;
const DEFAULT_MIN_AMOUNT = 100_000_000; // $100M
const MAX_RESULTS = 20;

/**
 * GET /api/contracts?days=180&min_amount=100000000&page=1
 *
 * Fetches large federal contracts from USASpending.gov.
 * No API key required. Uses Funding Agency (not Awarding Agency)
 * for more accurate budget category mapping.
 */
export async function GET(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const { allowed, retryAfterSeconds } = await checkRateLimit(ip, "contracts", 60);
  if (!allowed) {
    logApi({ route: "/api/contracts", event: "rate_limit_hit" });
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds ?? 60) } },
    );
  }

  const { searchParams } = new URL(request.url);
  const days = Math.min(parseInt(searchParams.get("days") || String(DEFAULT_DAYS), 10) || DEFAULT_DAYS, 365);
  const minAmount = parseInt(searchParams.get("min_amount") || String(DEFAULT_MIN_AMOUNT), 10) || DEFAULT_MIN_AMOUNT;
  const page = Math.max(parseInt(searchParams.get("page") || "1", 10) || 1, 1);

  const endDate = new Date().toISOString().split("T")[0];
  const startDate = new Date(Date.now() - days * 86_400_000).toISOString().split("T")[0];

  const body = {
    filters: {
      award_type_codes: ["A", "B", "C", "D"], // contracts only
      time_period: [{ start_date: startDate, end_date: endDate }],
      award_amounts: [{ lower_bound: minAmount }],
    },
    fields: [
      "Award ID",
      "Recipient Name",
      "Award Amount",
      "Total Outlays",
      "Description",
      "Start Date",
      "End Date",
      "Awarding Agency",
      "Funding Agency",
      "generated_internal_id",
    ],
    limit: MAX_RESULTS,
    page,
    sort: "Award Amount",
    order: "desc",
  };

  const res = await trackedFetch(USASPENDING_URL, "/api/contracts", "usaspending", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    next: { revalidate: 86400 },
  });

  if (!res) {
    logApi({ route: "/api/contracts", event: "usaspending_failed", success: false });
    return NextResponse.json({ contracts: [], hasMore: false, fallback: true });
  }

  const data = await res.json();

  if (!data.results || !Array.isArray(data.results)) {
    return NextResponse.json({ contracts: [], hasMore: false, fallback: true });
  }

  const hasMore = data.page_metadata?.hasNext ?? false;

  const contracts: FederalContract[] = data.results.map(
    (r: Record<string, unknown>) => {
      // Prefer Funding Agency for categorization — it reflects who pays,
      // not who administers the contract. Falls back to Awarding Agency.
      const fundingAgency = String(r["Funding Agency"] ?? "");
      const awardingAgency = String(r["Awarding Agency"] ?? "Unknown");
      const categoryAgency = fundingAgency || awardingAgency;
      const internalId = String(r["generated_internal_id"] ?? "");
      const awardAmount = Number(r["Award Amount"]) || 0;
      const totalOutlays = Number(r["Total Outlays"]) || 0;
      const contractStart = String(r["Start Date"] ?? "");
      const contractEnd = String(r["End Date"] ?? "");

      // Estimate annualized spending from outlays or award amount / duration
      let annualizedAmount: number | null = null;
      const startMs = Date.parse(contractStart);
      const endMs = Date.parse(contractEnd);
      if (startMs && endMs && endMs > startMs) {
        const durationYears = (endMs - startMs) / (365.25 * 86_400_000);
        if (durationYears >= 1) {
          // Prefer actual outlays; fall back to award amount spread over duration
          const basis = totalOutlays > 0 ? totalOutlays : awardAmount;
          const elapsedYears = totalOutlays > 0
            ? Math.max((Date.now() - startMs) / (365.25 * 86_400_000), 1)
            : durationYears;
          annualizedAmount = Math.round(basis / elapsedYears);
        }
      }

      return {
        id: internalId || String(r["Award ID"] ?? ""),
        awardId: String(r["Award ID"] ?? ""),
        recipientName: String(r["Recipient Name"] ?? "Unknown"),
        description: String(r["Description"] ?? ""),
        amount: awardAmount,
        annualizedAmount,
        awardingAgency,
        categoryId: agencyToCategory(categoryAgency),
        startDate: contractStart,
        endDate: contractEnd,
        url: internalId
          ? `https://www.usaspending.gov/award/${internalId}`
          : "https://www.usaspending.gov",
      };
    },
  );

  logApi({
    route: "/api/contracts",
    event: "success",
    success: true,
    count: contracts.length,
    page,
  });

  return NextResponse.json({ contracts, hasMore });
}
