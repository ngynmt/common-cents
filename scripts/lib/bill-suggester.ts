/**
 * Core logic for suggesting new pending bills from Congress.gov API.
 *
 * Discovers high-signal bills (momentum + budget category relevance),
 * deduplicates against existing data, and generates skeleton PendingBill entries.
 */

import {
  fetchRecentBills,
  fetchBillSponsors,
  fetchBillDetail,
  fetchBillCommittees,
  fetchBillCosponsors,
  type Sponsor,
} from "./congress-api";
import {
  mapActionToStatus,
  computeLikelihood,
  parseBillNumber,
  getCurrentCongress,
  type BillStatus,
} from "./bill-refresher";
import { suggestCategory, type CategorySuggestion } from "./category-suggester";
import { pendingBills, type PendingBill } from "../../src/data/pending-bills";
import { trackedVotes } from "../../src/data/tracked-votes";

// API bill type → display format
const TYPE_DISPLAY: Record<string, string> = {
  hr: "H.R.",
  s: "S.",
  hjres: "H.J.Res.",
  sjres: "S.J.Res.",
};

// API bill type → congress.gov URL slug
const TYPE_URL_SLUG: Record<string, string> = {
  hr: "house-bill",
  s: "senate-bill",
  hjres: "house-joint-resolution",
  sjres: "senate-joint-resolution",
};

export interface SuggestedBill {
  entry: PendingBill;
  categorySuggestion: CategorySuggestion;
  whySuggested: string;
}

export interface SuggestOptions {
  congress: number;
  minCosponsorsHouse: number;
  minCosponsorsSenate: number;
  since: string; // ISO date
  category?: string;
  dryRun: boolean;
}

export function defaultSuggestOptions(): SuggestOptions {
  const since = new Date();
  since.setDate(since.getDate() - 30);
  return {
    congress: getCurrentCongress(),
    minCosponsorsHouse: 50,
    minCosponsorsSenate: 15,
    since: since.toISOString().slice(0, 10),
    dryRun: false,
  };
}

/**
 * Build a set of normalized bill identifiers already tracked.
 */
function buildDedupSet(): Set<string> {
  const seen = new Set<string>();

  for (const bill of pendingBills) {
    try {
      const parsed = parseBillNumber(bill.billNumber);
      seen.add(`${parsed.type}${parsed.number}`);
    } catch {
      // skip unparseable
    }
  }

  // For tracked votes, use title-based matching (same approach as discover.ts)
  // We store titles normalized for fuzzy matching later
  return seen;
}

function isTrackedByTitle(title: string): boolean {
  const titleLower = title.toLowerCase();
  for (const tv of trackedVotes) {
    if (tv.legislationTitle.toLowerCase().includes(titleLower.slice(0, 30))) {
      return true;
    }
    if (titleLower.includes(tv.legislationTitle.toLowerCase().slice(0, 30))) {
      return true;
    }
  }
  return false;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function chamberFromType(type: string): "house" | "senate" {
  const t = type.toLowerCase();
  return t === "hr" || t === "hjres" ? "house" : "senate";
}

/**
 * Discover and filter high-signal pending bills.
 */
export async function suggestNewBills(
  opts: SuggestOptions
): Promise<SuggestedBill[]> {
  const dedupSet = buildDedupSet();
  const suggestions: SuggestedBill[] = [];

  console.log(
    `Scanning bills from Congress ${opts.congress} updated since ${opts.since}...\n`
  );

  let scanned = 0;

  for await (const page of fetchRecentBills(opts.congress, {
    since: opts.since,
  })) {
    for (const bill of page) {
      scanned++;
      const type = bill.type.toLowerCase();
      const slug = `${type}${bill.number}`;
      const displayType = TYPE_DISPLAY[type];
      if (!displayType) continue;

      // Skip already tracked
      if (dedupSet.has(slug)) continue;
      if (isTrackedByTitle(bill.title)) continue;

      const chamber = chamberFromType(type);
      const minCosponsors =
        chamber === "house"
          ? opts.minCosponsorsHouse
          : opts.minCosponsorsSenate;

      // Check momentum: cosponsor count or committee progress
      let cosponsorCount: number;
      try {
        cosponsorCount = await fetchBillCosponsors(
          opts.congress,
          type,
          bill.number
        );
      } catch {
        continue;
      }

      const actionStatus = mapActionToStatus(
        bill.latestAction?.text ?? ""
      );
      const hasMomentum =
        cosponsorCount >= minCosponsors ||
        (actionStatus !== "introduced" && actionStatus !== null);

      if (!hasMomentum) continue;

      // Check category relevance
      let committees: string[];
      try {
        const committeeInfos = await fetchBillCommittees(
          opts.congress,
          type,
          bill.number
        );
        committees = committeeInfos.map((c) => c.name);
      } catch {
        committees = [];
      }

      const categorySuggestion = suggestCategory(committees, bill.title);
      if (categorySuggestion.categoryId === "unknown") continue;
      if (opts.category && categorySuggestion.categoryId !== opts.category)
        continue;

      // Fetch sponsor details for bipartisan detection and champion info
      let sponsors: Sponsor[] = [];
      try {
        sponsors = await fetchBillSponsors(opts.congress, type, bill.number);
      } catch {
        // continue without sponsor data
      }

      const parties = new Set(sponsors.map((s) => s.party));
      const bipartisan = parties.has("D") && parties.has("R");

      // Fetch full bill detail for title and lead sponsor
      let detail;
      try {
        detail = await fetchBillDetail(opts.congress, type, bill.number);
      } catch {
        continue;
      }

      const status: BillStatus = actionStatus ?? "introduced";
      const likelihood = computeLikelihood(
        status,
        cosponsorCount,
        bipartisan,
        chamber
      );

      // Build champion from lead sponsor
      const leadSponsor = detail.sponsors?.[0];
      const champion = leadSponsor
        ? {
            name: leadSponsor.fullName ??
              `${leadSponsor.firstName} ${leadSponsor.lastName}`,
            party: leadSponsor.party as "D" | "R" | "I",
            chamber,
            state: leadSponsor.state,
            title: chamber === "house" ? "Representative" : "Senator",
          }
        : {
            name: "Unknown",
            party: "D" as const,
            chamber,
            state: "",
            title: chamber === "house" ? "Representative" : "Senator",
          };

      const urlSlug = TYPE_URL_SLUG[type] ?? "house-bill";
      const congressUrl = `https://www.congress.gov/bill/${ordinal(opts.congress)}-congress/${urlSlug}/${bill.number}`;

      const entry: PendingBill = {
        id: `${type}-${bill.number}-placeholder`,
        congress: opts.congress,
        title: detail.title,
        shortTitle: "NEEDS EDIT",
        billNumber: `${displayType} ${bill.number}`,
        summary: `NEEDS EDIT — see ${congressUrl}`,
        status,
        passageLikelihood: likelihood,
        champion,
        cosponsors: cosponsorCount,
        bipartisan,
        impactedCategories: [categorySuggestion.categoryId],
        spendingImpacts: [],
        totalAnnualImpact: 0,
        cboScoreUrl: "",
        congressUrl,
        lastAction: detail.latestAction.text,
        lastActionDate: detail.latestAction.actionDate,
      };

      const reasons: string[] = [];
      if (cosponsorCount >= minCosponsors) {
        reasons.push(`${cosponsorCount} cosponsors`);
      }
      if (actionStatus && actionStatus !== "introduced") {
        reasons.push(
          `status: ${actionStatus.replace(/_/g, " ")}`
        );
      }
      if (bipartisan) reasons.push("bipartisan");

      suggestions.push({
        entry,
        categorySuggestion,
        whySuggested: reasons.join(", "),
      });

      const label = `${displayType} ${bill.number}`;
      console.log(`  ✓ ${label}: ${detail.title.slice(0, 60)}...`);
      console.log(
        `    → ${categorySuggestion.categoryId} (${categorySuggestion.confidence}) | ${reasons.join(", ")}`
      );
    }
  }

  console.log(`\nScanned ${scanned} bills, found ${suggestions.length} suggestion(s).`);

  // Sort by cosponsor count descending
  suggestions.sort((a, b) => b.entry.cosponsors - a.entry.cosponsors);

  return suggestions;
}
