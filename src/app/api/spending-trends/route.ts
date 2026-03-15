import { NextRequest, NextResponse } from "next/server";
import { logApi, trackedFetch } from "@/lib/api-logger";
import { checkRateLimit } from "@/lib/redis";

const ROUTE = "/api/spending-trends";
const MTS_BASE = "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/mts/mts_table_9";

export interface SpendingTrend {
  classification: string;
  categoryId: string;
  currentFytd: number;
  priorFytd: number;
  changePercent: number;
  changeDollars: number;
  type: "receipt" | "outlay";
}

/**
 * Maps Treasury MTS Table 9 classification descriptions to our budget category IDs.
 * Only maps outlay categories (spending), not receipts.
 */
const CLASSIFICATION_TO_CATEGORY: Record<string, { categoryId: string; type: "receipt" | "outlay" }> = {
  "National Defense": { categoryId: "defense", type: "outlay" },
  "International Affairs": { categoryId: "international", type: "outlay" },
  "General Science, Space, and Technology": { categoryId: "science", type: "outlay" },
  "Energy": { categoryId: "science", type: "outlay" },
  "Natural Resources and Environment": { categoryId: "science", type: "outlay" },
  "Agriculture": { categoryId: "agriculture", type: "outlay" },
  "Transportation": { categoryId: "infrastructure", type: "outlay" },
  "Community and Regional Development": { categoryId: "infrastructure", type: "outlay" },
  "Education, Training, Employment, and Social Services": { categoryId: "education", type: "outlay" },
  "Health": { categoryId: "healthcare", type: "outlay" },
  "Medicare": { categoryId: "healthcare", type: "outlay" },
  "Income Security": { categoryId: "income-security", type: "outlay" },
  "Social Security": { categoryId: "social-security", type: "outlay" },
  "Veterans Benefits and Services": { categoryId: "veterans", type: "outlay" },
  "Administration of Justice": { categoryId: "justice", type: "outlay" },
  "General Government": { categoryId: "government", type: "outlay" },
  "Net Interest": { categoryId: "interest", type: "outlay" },
  // Receipt categories
  "Individual Income Taxes": { categoryId: "income-tax", type: "receipt" },
  "Corporation Income Taxes": { categoryId: "corp-tax", type: "receipt" },
  "Customs Duties": { categoryId: "customs", type: "receipt" },
};

/**
 * GET /api/spending-trends
 *
 * Fetches the latest Monthly Treasury Statement (Table 9) from Treasury Fiscal Data API.
 * Compares current FYTD spending to prior year FYTD, flags significant changes.
 * No API key required.
 */
export async function GET(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const { allowed, retryAfterSeconds } = await checkRateLimit(ip, "spending-trends", 10);
  if (!allowed) {
    logApi({ route: ROUTE, event: "rate_limit_hit" });
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds ?? 60) } },
    );
  }

  // Fetch most recent MTS data — sort by date descending, get enough rows
  const url = `${MTS_BASE}?sort=-record_date&page%5Bsize%5D=100&fields=record_date,classification_desc,current_fytd_rcpt_outly_amt,prior_fytd_rcpt_outly_amt,data_type_cd`;

  const res = await trackedFetch(url, ROUTE, "treasury", {
    next: { revalidate: 86400 },
  });

  if (!res) {
    logApi({ route: ROUTE, event: "treasury_failed", success: false });
    return NextResponse.json({ trends: [], fallback: true });
  }

  const data = await res.json();
  if (!data.data || !Array.isArray(data.data)) {
    return NextResponse.json({ trends: [], fallback: true });
  }

  // Get the most recent record date
  const latestDate = data.data[0]?.record_date;
  if (!latestDate) {
    return NextResponse.json({ trends: [], fallback: true });
  }

  // Filter to only the latest month's data and detail rows (data_type_cd = "D")
  const trends: SpendingTrend[] = [];

  for (const row of data.data) {
    if (row.record_date !== latestDate) continue;
    if (row.data_type_cd !== "D") continue;

    const desc = row.classification_desc;
    const mapping = CLASSIFICATION_TO_CATEGORY[desc];
    if (!mapping) continue;

    const current = parseFloat(row.current_fytd_rcpt_outly_amt);
    const prior = parseFloat(row.prior_fytd_rcpt_outly_amt);

    if (isNaN(current) || isNaN(prior) || prior === 0) continue;

    const changePercent = ((current - prior) / Math.abs(prior)) * 100;
    const changeDollars = current - prior;

    trends.push({
      classification: desc,
      categoryId: mapping.categoryId,
      currentFytd: current,
      priorFytd: prior,
      changePercent: Math.round(changePercent * 10) / 10,
      changeDollars,
      type: mapping.type,
    });
  }

  // Sort by absolute change percent descending (biggest anomalies first)
  trends.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));

  logApi({
    route: ROUTE,
    event: "success",
    success: true,
    count: trends.length,
    record_date: latestDate,
  });

  return NextResponse.json({ trends, recordDate: latestDate });
}
