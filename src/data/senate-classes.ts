/**
 * Senate class assignments by state.
 *
 * Each state has two senators in two different classes (I, II, or III).
 * Classes determine the 6-year election cycle:
 *   Class I  → elected 2024, next in 2030
 *   Class II → elected 2020, next in 2026
 *   Class III → elected 2022, next in 2028
 *
 * These class-to-state assignments are PERMANENT — they never change
 * regardless of who holds the seat.
 *
 * Source: https://www.senate.gov/senators/senators-up-for-election.htm
 */

export type SenateClass = 1 | 2 | 3;

/**
 * Which two senate classes each state has.
 * Order: [class of senior-seniority seat, class of junior-seniority seat].
 *
 * "Senior seat" = the seat whose current occupant has served longer.
 * This is determined at runtime via Geocodio's seniority field; the
 * ordering here reflects the 119th Congress (Jan 2025) and is used
 * only as a tiebreaker if seniority data is unavailable.
 */
export const STATE_SENATE_CLASSES: Record<string, [SenateClass, SenateClass]> = {
  AL: [3, 2], AK: [2, 3], AZ: [1, 3], AR: [3, 2], CA: [3, 1],
  CO: [2, 3], CT: [3, 1], DE: [2, 1], FL: [1, 3], GA: [2, 3],
  HI: [1, 3], ID: [2, 3], IL: [2, 3], IN: [1, 3], IA: [2, 3],
  KS: [2, 3], KY: [2, 3], LA: [2, 3], ME: [1, 2], MD: [1, 3],
  MA: [1, 2], MI: [1, 2], MN: [1, 2], MS: [1, 2], MO: [1, 3],
  MT: [1, 2], NE: [1, 2], NV: [1, 3], NH: [2, 3], NJ: [1, 2],
  NM: [1, 2], NY: [1, 3], NC: [2, 3], ND: [1, 3], OH: [1, 3],
  OK: [2, 3], OR: [2, 3], PA: [1, 3], RI: [1, 2], SC: [2, 3],
  SD: [2, 3], TN: [1, 2], TX: [1, 2], UT: [1, 3], VT: [1, 3],
  VA: [1, 2], WA: [1, 3], WV: [1, 2], WI: [1, 3], WY: [1, 2],
};

/**
 * Get the next election year for a given senate class.
 */
export function getNextElectionYear(senateClass: SenateClass): number {
  // Class I: 2024, 2030, 2036 …
  // Class II: 2026, 2032, 2038 …
  // Class III: 2028, 2034, 2040 …
  const baseYear: Record<SenateClass, number> = { 1: 2024, 2: 2026, 3: 2028 };
  const base = baseYear[senateClass];
  const currentYear = new Date().getFullYear();

  let year = base;
  while (year < currentYear) {
    year += 6;
  }
  return year;
}

/**
 * Determine a senator's next election year using state + seniority rank.
 *
 * @param state Two-letter state abbreviation
 * @param seniorityRank 1 = more senior senator in this state, 2 = junior.
 *   If unknown, returns the sooner of the two possible election years.
 */
export function getSenatorNextElection(
  state: string,
  seniorityRank?: 1 | 2,
): number {
  const classes = STATE_SENATE_CLASSES[state.toUpperCase()];
  if (!classes) {
    // Unknown state — fallback to next even year
    const currentYear = new Date().getFullYear();
    return currentYear % 2 === 0 ? currentYear : currentYear + 1;
  }

  if (seniorityRank === 1) return getNextElectionYear(classes[0]);
  if (seniorityRank === 2) return getNextElectionYear(classes[1]);

  // Unknown seniority — return the sooner election year
  return Math.min(getNextElectionYear(classes[0]), getNextElectionYear(classes[1]));
}
