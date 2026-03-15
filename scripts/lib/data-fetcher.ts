/**
 * Fetches raw data from USASpending.gov and Treasury Fiscal Data API.
 * Replicates the same queries used by the app's API routes,
 * adapted for a Node.js script context (no Next.js dependencies).
 */

const USASPENDING_URL = "https://api.usaspending.gov/api/v2/search/spending_by_award/";
const MTS_BASE = "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/mts/mts_table_9";

// Same mapping used in /api/spending-trends
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
  "Individual Income Taxes": { categoryId: "income-tax", type: "receipt" },
  "Corporation Income Taxes": { categoryId: "corp-tax", type: "receipt" },
  "Customs Duties": { categoryId: "customs", type: "receipt" },
};

const ANOMALY_THRESHOLD = 15; // percent

export interface RawContract {
  awardId: string;
  recipientName: string;
  description: string;
  amount: number;
  awardingAgency: string;
  fundingAgency: string;
  internalId: string;
}

export interface RawSpendingTrend {
  classification: string;
  categoryId: string;
  currentFytd: number;
  priorFytd: number;
  changePercent: number;
  type: "receipt" | "outlay";
}

/**
 * Fetches recent large federal contracts from USASpending.gov.
 * Returns up to 100 contracts across multiple pages.
 */
export async function fetchRecentContracts(maxPages = 5): Promise<RawContract[]> {
  const endDate = new Date().toISOString().split("T")[0];
  const startDate = new Date(Date.now() - 180 * 86_400_000).toISOString().split("T")[0];
  const all: RawContract[] = [];

  for (let page = 1; page <= maxPages; page++) {
    console.log(`  Fetching contracts page ${page}...`);
    try {
      const res = await fetch(USASPENDING_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filters: {
            award_type_codes: ["A", "B", "C", "D"],
            time_period: [{ start_date: startDate, end_date: endDate }],
            award_amounts: [{ lower_bound: 100_000_000 }],
          },
          fields: [
            "Award ID",
            "Recipient Name",
            "Award Amount",
            "Description",
            "Awarding Agency",
            "Funding Agency",
            "generated_internal_id",
          ],
          limit: 25,
          page,
          sort: "Award Amount",
          order: "desc",
        }),
      });

      if (!res.ok) {
        console.error(`  USASpending API error: ${res.status}`);
        break;
      }

      const data = await res.json();
      if (!data.results?.length) break;

      for (const r of data.results) {
        all.push({
          awardId: String(r["generated_internal_id"] ?? r["Award ID"] ?? ""),
          recipientName: String(r["Recipient Name"] ?? "Unknown"),
          description: String(r["Description"] ?? ""),
          amount: Number(r["Award Amount"]) || 0,
          awardingAgency: String(r["Awarding Agency"] ?? "Unknown"),
          fundingAgency: String(r["Funding Agency"] ?? ""),
        } as RawContract);
      }

      if (!data.page_metadata?.hasNext) break;
    } catch (err) {
      console.error(`  Fetch error on page ${page}: ${(err as Error).message}`);
      break;
    }
  }

  console.log(`  Fetched ${all.length} contracts total`);
  return all;
}

/**
 * Fetches spending trends from Treasury MTS Table 9.
 * Returns only anomalies above the threshold.
 */
export async function fetchSpendingTrends(): Promise<RawSpendingTrend[]> {
  console.log("  Fetching Treasury MTS Table 9...");
  const url = `${MTS_BASE}?sort=-record_date&page%5Bsize%5D=100&fields=record_date,classification_desc,current_fytd_rcpt_outly_amt,prior_fytd_rcpt_outly_amt,data_type_cd`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`  Treasury API error: ${res.status}`);
      return [];
    }

    const data = await res.json();
    if (!data.data?.length) return [];

    const latestDate = data.data[0]?.record_date;
    if (!latestDate) return [];

    const trends: RawSpendingTrend[] = [];

    for (const row of data.data) {
      if (row.record_date !== latestDate) continue;
      if (row.data_type_cd !== "D") continue;

      const desc = row.classification_desc;
      const mapping = CLASSIFICATION_TO_CATEGORY[desc];
      if (!mapping) continue;

      const current = parseFloat(row.current_fytd_rcpt_outly_amt);
      const prior = parseFloat(row.prior_fytd_rcpt_outly_amt);
      if (isNaN(current) || isNaN(prior) || prior === 0) continue;

      const changePercent = Math.round(((current - prior) / Math.abs(prior)) * 1000) / 10;
      if (Math.abs(changePercent) < ANOMALY_THRESHOLD) continue;

      trends.push({
        classification: desc,
        categoryId: mapping.categoryId,
        currentFytd: current,
        priorFytd: prior,
        changePercent,
        type: mapping.type,
      });
    }

    trends.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));
    console.log(`  Found ${trends.length} anomalies above ${ANOMALY_THRESHOLD}% threshold`);
    return trends;
  } catch (err) {
    console.error(`  Treasury fetch error: ${(err as Error).message}`);
    return [];
  }
}
