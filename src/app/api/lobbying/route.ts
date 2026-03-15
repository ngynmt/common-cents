import { NextRequest, NextResponse } from "next/server";
import { logApi, trackedFetch } from "@/lib/api-logger";
import { checkRateLimit } from "@/lib/redis";

const ROUTE = "/api/lobbying";
const LDA_BASE = "https://lda.senate.gov/api/v1/filings/";

export interface LobbyistInfo {
  name: string;
  coveredPosition: string | null; // former government role
}

export interface LobbyingActivity {
  issueCode: string;
  issueLabel: string;
  description: string;
  lobbyists: LobbyistInfo[];
  governmentEntities: string[];
}

export interface LobbyingFiling {
  client: string;
  registrant: string; // lobbying firm
  amount: number; // income or expenses
  filingYear: number;
  filingPeriod: string;
  activities: LobbyingActivity[];
  filingUrl: string;
}

export interface LobbyingSummary {
  billNumber: string;
  totalFilings: number;
  totalSpending: number;
  filings: LobbyingFiling[];
  /** Unique client names for cross-referencing with FEC */
  clients: string[];
}

/**
 * GET /api/lobbying?bill=S.+770&year=2025
 *
 * Fetches lobbying filings from the Senate LDA API that mention a specific bill.
 * Returns aggregated lobbying data: who's lobbying, how much, and which lobbyists
 * have revolving-door government connections.
 */
export async function GET(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const { allowed, retryAfterSeconds } = await checkRateLimit(ip, "lobbying", 30);
  if (!allowed) {
    logApi({ route: ROUTE, event: "rate_limit_hit" });
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds ?? 60) } },
    );
  }

  const { searchParams } = new URL(request.url);
  const billNumber = searchParams.get("bill");
  const year = searchParams.get("year") || String(new Date().getFullYear());

  if (!billNumber) {
    return NextResponse.json({ error: "bill parameter required" }, { status: 400 });
  }

  const apiKey = process.env.LDA_API_KEY;
  if (!apiKey) {
    logApi({ route: ROUTE, event: "no_api_key", success: false });
    return NextResponse.json({ data: null, fallback: true });
  }

  // Search current and two previous years for broader coverage
  // (lobbying on a bill often spans multiple filing periods and congresses)
  const baseYear = parseInt(year, 10);
  const years = [baseYear, baseYear - 1, baseYear - 2];
  const allFilings: LobbyingFiling[] = [];
  let totalCount = 0;

  // Fetch all years in parallel to reduce latency (was serial)
  const yearResults = await Promise.all(
    years.map(async (y) => {
      const url = `${LDA_BASE}?filing_specific_lobbying_issues=${encodeURIComponent(billNumber)}&filing_year=${y}&page_size=25`;
      const res = await trackedFetch(url, ROUTE, "lda", {
        headers: { Authorization: `Token ${apiKey}` },
        next: { revalidate: 86400 },
      });
      if (!res) return null;
      return await res.json();
    }),
  );

  for (const data of yearResults) {
    if (!data?.results || !Array.isArray(data.results)) continue;

    totalCount += data.count || 0;

    for (const filing of data.results) {
      const amount = parseFloat(filing.income || filing.expenses || "0");
      if (isNaN(amount)) continue;

      // Filter lobbying activities to only those mentioning our bill
      const relevantActivities: LobbyingActivity[] = [];
      for (const activity of filing.lobbying_activities || []) {
        const desc: string = activity.description || "";
        if (!desc.toLowerCase().includes(billNumber.toLowerCase())) continue;

        relevantActivities.push({
          issueCode: activity.general_issue_code || "",
          issueLabel: activity.general_issue_code_display || "",
          description: desc,
          lobbyists: (activity.lobbyists || []).map((l: Record<string, unknown>) => {
            const lobbyist = l.lobbyist as Record<string, string> | null;
            const firstName = lobbyist?.first_name || "";
            const lastName = lobbyist?.last_name || "";
            return {
              name: `${firstName} ${lastName}`.trim(),
              coveredPosition: (l.covered_position as string) || null,
            };
          }),
          governmentEntities: (activity.government_entities || []).map(
            (g: Record<string, unknown>) => String(g.name || ""),
          ),
        });
      }

      if (relevantActivities.length === 0) continue;

      allFilings.push({
        client: filing.client?.name || "Unknown",
        registrant: filing.registrant?.name || "Unknown",
        amount,
        filingYear: filing.filing_year,
        filingPeriod: filing.filing_period_display || filing.filing_period || "",
        activities: relevantActivities,
        filingUrl: filing.filing_document_url || "",
      });
    }
  }

  // Aggregate by client — combine multiple quarterly filings from the same org
  const byClient = new Map<string, { totalAmount: number; filings: LobbyingFiling[] }>();
  for (const f of allFilings) {
    const key = f.client.toUpperCase();
    const existing = byClient.get(key);
    if (existing) {
      existing.totalAmount += f.amount;
      existing.filings.push(f);
    } else {
      byClient.set(key, { totalAmount: f.amount, filings: [f] });
    }
  }

  // Sort by total spending descending, take top results
  const sorted = Array.from(byClient.entries())
    .sort((a, b) => b[1].totalAmount - a[1].totalAmount)
    .slice(0, 15);

  const dedupedFilings = sorted.flatMap(([, v]) => v.filings);
  const totalSpending = sorted.reduce((s, [, v]) => s + v.totalAmount, 0);
  const clients = sorted.map(([, v]) => v.filings[0].client);

  logApi({
    route: ROUTE,
    event: "success",
    success: true,
    bill: billNumber,
    count: dedupedFilings.length,
    totalFilings: totalCount,
  });

  const summary: LobbyingSummary = {
    billNumber,
    totalFilings: totalCount,
    totalSpending,
    filings: dedupedFilings,
    clients,
  };

  return NextResponse.json({ data: summary });
}
