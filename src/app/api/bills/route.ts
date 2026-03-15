import { NextRequest, NextResponse } from "next/server";
import { logApi, trackedFetch } from "@/lib/api-logger";
import { checkRateLimit } from "@/lib/redis";
import type { PendingBill } from "@/data/pending-bills";

const CONGRESS_API_BASE = "https://api.congress.gov/v3";

const DEFAULT_DAYS = 90;
const MAX_RESULTS = 10;

/**
 * GET /api/bills?status=enacted&days=90
 *
 * Fetches recently enacted bills from the Congress.gov API.
 * Requires CONGRESS_API_KEY env var (free from api.congress.gov).
 * Falls back to empty array if key is missing or API fails.
 */
export async function GET(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const { allowed, retryAfterSeconds } = await checkRateLimit(ip, "bills", 30);
  if (!allowed) {
    logApi({ route: "/api/bills", event: "rate_limit_hit" });
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds ?? 60) } },
    );
  }

  const apiKey = process.env.CONGRESS_API_KEY || "DEMO_KEY";

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "enacted";
  const days = Math.min(
    parseInt(searchParams.get("days") || String(DEFAULT_DAYS), 10) || DEFAULT_DAYS,
    365,
  );

  if (status !== "enacted") {
    return NextResponse.json(
      { error: "Only status=enacted is currently supported" },
      { status: 400 },
    );
  }

  const fromDate = new Date(Date.now() - days * 86_400_000).toISOString().split("T")[0];
  const toDate = new Date().toISOString().split("T")[0];

  // Fetch recently enacted laws
  const url =
    `${CONGRESS_API_BASE}/bill?format=json` +
    `&api_key=${apiKey}` +
    `&limit=${MAX_RESULTS}` +
    `&fromDateTime=${fromDate}T00:00:00Z` +
    `&toDateTime=${toDate}T23:59:59Z` +
    `&sort=updateDate+desc`;

  const res = await trackedFetch(url, "/api/bills", "congress_gov", {
    next: { revalidate: 86400 },
  });

  if (!res) {
    logApi({ route: "/api/bills", event: "congress_api_failed", success: false });
    return NextResponse.json({ bills: [], fallback: true });
  }

  const data = await res.json();

  if (!data.bills || !Array.isArray(data.bills)) {
    return NextResponse.json({ bills: [], fallback: true });
  }

  // Filter to only enacted (signed into law) bills
  const enactedBills = data.bills.filter(
    (b: Record<string, unknown>) => {
      const latestAction = b.latestAction as Record<string, unknown> | undefined;
      const actionText = String(latestAction?.text ?? "").toLowerCase();
      return actionText.includes("became public law") || actionText.includes("signed by president");
    },
  );

  // Map to our PendingBill shape (skeleton — spending impacts need manual curation)
  const bills: PendingBill[] = enactedBills.map(
    (b: Record<string, unknown>) => {
      const latestAction = b.latestAction as Record<string, unknown> | undefined;
      const billType = String(b.type ?? "").toLowerCase();
      const billNumber = `${String(b.type ?? "")}. ${b.number}`;
      const congress = Number(b.congress) || 119;
      const id = `${billType}${b.number}-${congress}-enacted`;

      // Extract public law number from action text if available
      const actionText = String(latestAction?.text ?? "");
      const plMatch = actionText.match(/Public Law No:\s*([\d-]+)/i)
        || actionText.match(/P\.?L\.?\s*([\d-]+)/i);
      const publicLawNumber = plMatch ? `P.L. ${plMatch[1]}` : undefined;

      return {
        id,
        congress,
        title: String(b.title ?? ""),
        shortTitle: String(b.title ?? "").slice(0, 60),
        billNumber,
        summary: "", // Would need a separate API call to /bill/{congress}/{type}/{number}/summaries
        status: "enacted" as const,
        passageLikelihood: "enacted" as const,
        champion: {
          name: "",
          party: "D" as const,
          chamber: "house" as const,
          state: "",
          title: "",
        },
        cosponsors: 0,
        bipartisan: false,
        impactedCategories: [],
        spendingImpacts: [],
        totalAnnualImpact: 0,
        cboScoreUrl: "",
        congressUrl: String(b.url ?? "").replace(/\?.*/, ""),
        lastAction: String(latestAction?.text ?? ""),
        lastActionDate: String(latestAction?.actionDate ?? ""),
        enactedDate: String(latestAction?.actionDate ?? ""),
        publicLawNumber,
      };
    },
  );

  logApi({
    route: "/api/bills",
    event: "success",
    success: true,
    count: bills.length,
    total_fetched: data.bills.length,
  });

  return NextResponse.json({ bills });
}
