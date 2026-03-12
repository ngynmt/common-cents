/**
 * Core drafting logic — shared between CLI and automation.
 */

import {
  parseBillId,
  fetchBillDetail,
  fetchBillActions,
  fetchBillCommittees,
  extractVotesFromActions,
  fetchHouseVoteTotals,
  fetchSenateVoteTotals,
} from "./congress-api";
import { suggestCategory, type CategorySuggestion } from "./category-suggester";
import type { TrackedVote } from "../../src/data/tracked-votes";

export interface DraftResult {
  entry: TrackedVote;
  categorySuggestion: CategorySuggestion;
  warnings: string[];
}

export async function draftBillEntry(billId: string): Promise<DraftResult> {
  const { type, number, congress } = parseBillId(billId);
  const warnings: string[] = [];

  const [detail, actions, committees] = await Promise.all([
    fetchBillDetail(congress, type, number),
    fetchBillActions(congress, type, number),
    fetchBillCommittees(congress, type, number),
  ]);

  const votes = extractVotesFromActions(actions);
  const houseVote = votes.find((v) => v.chamber === "House");
  const senateVote = votes.find((v) => v.chamber === "Senate");

  // Verify vote XML is accessible
  if (houseVote) {
    const totals = await fetchHouseVoteTotals(houseVote.year, houseVote.rollNumber);
    if (!totals) {
      warnings.push(`Could not verify House vote XML for roll ${houseVote.rollNumber}`);
    }
  } else {
    warnings.push("No House roll call vote found");
  }

  if (senateVote) {
    const totals = await fetchSenateVoteTotals(
      senateVote.congress,
      senateVote.sessionNumber,
      senateVote.rollNumber
    );
    if (!totals) {
      warnings.push(`Could not verify Senate vote XML for vote ${senateVote.rollNumber}`);
    }
  } else {
    warnings.push("No Senate roll call vote found");
  }

  const committeeNames = committees.map((c) => c.name);
  const categorySuggestion = suggestCategory(committeeNames, detail.title);
  const signedDate = detail.latestAction?.actionDate ?? "UNKNOWN";
  const shortTitle = detail.title.replace(/\s*\(.*$/, "");

  const entry: TrackedVote = {
    legislationTitle: shortTitle,
    categoryId: categorySuggestion.categoryId,
    congress,
    houseVote: houseVote
      ? { year: houseVote.year, rollCall: houseVote.rollNumber }
      : { year: 0, rollCall: 0 },
    senateVote: senateVote
      ? { session: senateVote.sessionNumber, rollCall: senateVote.rollNumber }
      : { session: 0, rollCall: 0 },
    date: signedDate,
    yesEffect: `Voted to pass the ${shortTitle}`,
    noEffect: `Voted against the ${shortTitle}`,
  };

  return { entry, categorySuggestion, warnings };
}
