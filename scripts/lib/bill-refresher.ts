/**
 * Core logic for refreshing pending bill status from Congress.gov API.
 */

import { fetchBillDetail, fetchBillCosponsors } from "./congress-api";
import type { PendingBill } from "../../src/data/pending-bills";

export type BillStatus = PendingBill["status"];
export type Likelihood = PendingBill["passageLikelihood"];

export interface BillDiff {
  billNumber: string;
  shortTitle: string;
  enacted?: string; // date if bill was signed into law
  changes: FieldChange[];
}

export interface FieldChange {
  field: string;
  oldValue: string | number;
  newValue: string | number;
}

/**
 * Parse a display bill number like "H.R. 8070" or "S. 393" into API parameters.
 */
export function parseBillNumber(billNumber: string): {
  type: string;
  number: number;
} {
  const match = billNumber.match(
    /^(H\.R\.|S\.|H\.J\.Res\.|S\.J\.Res\.)\s*(\d+)$/i
  );
  if (!match) {
    throw new Error(`Cannot parse bill number: "${billNumber}"`);
  }

  const typeMap: Record<string, string> = {
    "h.r.": "hr",
    "s.": "s",
    "h.j.res.": "hjres",
    "s.j.res.": "sjres",
  };

  const type = typeMap[match[1].toLowerCase()];
  if (!type) throw new Error(`Unknown bill type: "${match[1]}"`);

  return { type, number: parseInt(match[2], 10) };
}

/**
 * Convert bill number to the CLI --bill format (e.g., "hr8070").
 */
export function toBillSlug(billNumber: string): string {
  const parsed = parseBillNumber(billNumber);
  return `${parsed.type}${parsed.number}`;
}

/**
 * Map Congress.gov latest action text to our status enum.
 * Returns null if the bill was enacted (should be removed from pending).
 */
export function mapActionToStatus(actionText: string): BillStatus | null {
  const text = actionText.toLowerCase();

  if (text.includes("became public law") || text.includes("signed by president")) {
    return null; // enacted
  }
  if (text.includes("passed house") || text.includes("received in senate")) {
    return "passed_house";
  }
  if (text.includes("passed senate") || text.includes("received in house")) {
    return "passed_senate";
  }
  if (text.includes("placed on calendar") || text.includes("cloture invoked")) {
    return "floor_vote_scheduled";
  }
  if (text.includes("referred to committee") || text.includes("reported by committee")) {
    return "in_committee";
  }

  return "introduced";
}

/**
 * Compute passage likelihood heuristic.
 */
export function computeLikelihood(
  status: BillStatus,
  cosponsors: number,
  bipartisan: boolean,
  chamber: "house" | "senate"
): Likelihood {
  let level: Likelihood = "low";

  if (status === "passed_house" || status === "passed_senate") {
    level = "high";
  } else if (status === "floor_vote_scheduled") {
    level = "medium";
  } else {
    const threshold = chamber === "house" ? 100 : 30;
    if (cosponsors >= threshold) {
      level = "medium";
    }
  }

  // Bipartisan bump
  if (bipartisan && level === "low") {
    level = "medium";
  } else if (bipartisan && level === "medium") {
    level = "high";
  }

  return level;
}

/**
 * Determine which Congress number a bill belongs to based on its congress.gov URL.
 */
function extractCongress(congressUrl: string): number {
  const match = congressUrl.match(/(\d+)(?:th|st|nd|rd)-congress/);
  if (match) return parseInt(match[1], 10);
  // Default to current congress
  return 119;
}

/**
 * Refresh a single bill's metadata from Congress.gov.
 * Returns a diff of changed fields, or null if no changes.
 */
export async function refreshBill(bill: PendingBill): Promise<BillDiff> {
  const { type, number } = parseBillNumber(bill.billNumber);
  const congress = extractCongress(bill.congressUrl);

  const [detail, cosponsorCount] = await Promise.all([
    fetchBillDetail(congress, type, number),
    fetchBillCosponsors(congress, type, number),
  ]);

  const diff: BillDiff = {
    billNumber: bill.billNumber,
    shortTitle: bill.shortTitle,
    changes: [],
  };

  const actionText = detail.latestAction.text;
  const newStatus = mapActionToStatus(actionText);

  // Bill was enacted
  if (newStatus === null) {
    diff.enacted = detail.latestAction.actionDate;
    return diff;
  }

  if (newStatus !== bill.status) {
    diff.changes.push({
      field: "status",
      oldValue: bill.status,
      newValue: newStatus,
    });
  }

  if (detail.latestAction.actionDate !== bill.lastActionDate) {
    diff.changes.push({
      field: "lastActionDate",
      oldValue: bill.lastActionDate,
      newValue: detail.latestAction.actionDate,
    });
  }

  if (actionText !== bill.lastAction) {
    diff.changes.push({
      field: "lastAction",
      oldValue: bill.lastAction,
      newValue: actionText,
    });
  }

  if (cosponsorCount !== bill.cosponsors) {
    diff.changes.push({
      field: "cosponsors",
      oldValue: bill.cosponsors,
      newValue: cosponsorCount,
    });
  }

  // Compute new likelihood based on (potentially updated) status and cosponsors
  const effectiveStatus = newStatus !== bill.status ? newStatus : bill.status;
  const effectiveCosponsors =
    cosponsorCount !== bill.cosponsors ? cosponsorCount : bill.cosponsors;
  const chamber = bill.champion.chamber;

  const newLikelihood = computeLikelihood(
    effectiveStatus,
    effectiveCosponsors,
    bill.bipartisan,
    chamber
  );

  if (newLikelihood !== bill.passageLikelihood) {
    diff.changes.push({
      field: "passageLikelihood",
      oldValue: bill.passageLikelihood,
      newValue: newLikelihood,
    });
  }

  return diff;
}

/**
 * Refresh all bills (or a filtered set) and return diffs.
 */
export async function refreshAllBills(
  bills: PendingBill[],
  filterSlug?: string
): Promise<BillDiff[]> {
  const filtered = filterSlug
    ? bills.filter((b) => toBillSlug(b.billNumber) === filterSlug.toLowerCase())
    : bills;

  if (filtered.length === 0) {
    throw new Error(
      filterSlug
        ? `No bill found matching "${filterSlug}"`
        : "No pending bills to refresh"
    );
  }

  const diffs: BillDiff[] = [];

  // Process sequentially to respect rate limits
  for (const bill of filtered) {
    try {
      const diff = await refreshBill(bill);
      diffs.push(diff);
    } catch (err) {
      console.error(
        `  ✗ Failed to refresh ${bill.billNumber}: ${(err as Error).message}`
      );
    }
  }

  return diffs;
}
