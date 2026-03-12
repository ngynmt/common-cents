/**
 * Core discovery logic — shared between CLI and automation.
 */

import {
  fetchRecentEnactedBills,
  fetchBillActions,
  extractVotesFromActions,
  fetchHouseVoteTotals,
  fetchSenateVoteTotals,
  type DiscoveredVote,
} from "./congress-api";
import { trackedVotes } from "../../src/data/tracked-votes";

export interface DiscoveredBill {
  type: string;
  number: number;
  title: string;
  congress: number;
  signedDate: string;
  houseVote: DiscoveredVote | null;
  senateVote: DiscoveredVote | null;
  houseTotals: { yea: number; nay: number } | null;
  senateTotals: { yea: number; nay: number } | null;
}

function isAlreadyTracked(title: string, votes: DiscoveredVote[]): boolean {
  const titleLower = title.toLowerCase();
  for (const tv of trackedVotes) {
    if (tv.legislationTitle.toLowerCase().includes(titleLower.slice(0, 30))) {
      return true;
    }
    if (titleLower.includes(tv.legislationTitle.toLowerCase().slice(0, 30))) {
      return true;
    }
  }

  for (const vote of votes) {
    for (const tv of trackedVotes) {
      if (
        vote.chamber === "House" &&
        tv.houseVote.year === vote.year &&
        tv.houseVote.rollCall === vote.rollNumber
      ) {
        return true;
      }
      if (
        vote.chamber === "Senate" &&
        tv.senateVote.session === vote.sessionNumber &&
        tv.senateVote.rollCall === vote.rollNumber &&
        tv.congress === vote.congress
      ) {
        return true;
      }
    }
  }

  return false;
}

export async function discoverNewBills(congress: number): Promise<DiscoveredBill[]> {
  const bills = await fetchRecentEnactedBills(congress);

  const enacted = bills.filter((b) => {
    const text = b.latestAction?.text ?? "";
    return (
      text.includes("Became Public Law") ||
      text.includes("Became Private Law") ||
      text.includes("Signed by President")
    );
  });

  const discovered: DiscoveredBill[] = [];

  for (const bill of enacted) {
    const actions = await fetchBillActions(congress, bill.type, bill.number);
    const votes = extractVotesFromActions(actions);

    if (isAlreadyTracked(bill.title, votes)) continue;

    const houseVote = votes.find((v) => v.chamber === "House") ?? null;
    const senateVote = votes.find((v) => v.chamber === "Senate") ?? null;

    if (!houseVote && !senateVote) continue;

    let houseTotals: { yea: number; nay: number } | null = null;
    let senateTotals: { yea: number; nay: number } | null = null;

    if (houseVote) {
      houseTotals = await fetchHouseVoteTotals(houseVote.year, houseVote.rollNumber);
    }
    if (senateVote) {
      senateTotals = await fetchSenateVoteTotals(
        senateVote.congress,
        senateVote.sessionNumber,
        senateVote.rollNumber
      );
    }

    discovered.push({
      type: bill.type,
      number: bill.number,
      title: bill.title,
      congress,
      signedDate: bill.latestAction.actionDate,
      houseVote,
      senateVote,
      houseTotals,
      senateTotals,
    });
  }

  return discovered;
}
