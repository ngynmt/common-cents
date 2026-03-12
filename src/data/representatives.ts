/**
 * Representative and vote record types.
 * Live data comes from Geocodio (/api/representatives) and
 * House/Senate roll call XML (/api/votes).
 */

export interface Representative {
  id: string; // bioguide ID (lowercase)
  name: string;
  chamber: "house" | "senate";
  party: "D" | "R" | "I";
  state: string;
  district?: string; // only for House
  photoUrl: string;
  phone: string;
  office: string;
  website: string;
  contactFormUrl: string;
  nextElection: number; // year, e.g. 2026
  lisId?: string; // LIS member ID for senators (used for Senate vote lookups)
}

export interface VoteRecord {
  representativeId: string;
  legislationTitle: string;
  categoryId: string;
  vote: "yes" | "no" | "abstain" | "not_voting";
  date: string;
  /** What a YES vote means for spending, e.g. "authorized $886B in defense spending" */
  yesEffect?: string;
}

/**
 * Generate a contact script based on the category and user sentiment.
 */
export function generateContactScript(
  repName: string,
  categoryName: string,
  sentiment: "too_much" | "too_little",
  userAmount: string
): string {
  if (sentiment === "too_much") {
    return `Hello, my name is [Your Name] and I'm a constituent. I'm calling because I recently learned that approximately ${userAmount} of my federal taxes goes toward ${categoryName}. I believe this level of spending is too high and I'd like to know what ${repName} is doing to ensure these funds are being spent efficiently and responsibly. I'd appreciate a response on the representative's position. Thank you for your time.`;
  }
  return `Hello, my name is [Your Name] and I'm a constituent. I'm calling because I recently learned that only about ${userAmount} of my federal taxes goes toward ${categoryName}. I believe we should be investing more in this area and I'd like to know what ${repName} is doing to support increased funding. I'd appreciate a response on the representative's position. Thank you for your time.`;
}
