/**
 * Static mapping of bills we track votes for.
 * Each entry includes the roll call vote numbers needed to fetch
 * individual legislator votes from House and Senate XML endpoints.
 */

export interface TrackedVote {
  legislationTitle: string;
  categoryId: string;
  congress: number;
  houseVote: { year: number; rollCall: number };
  senateVote: { session: number; rollCall: number };
  date: string; // approximate date of final passage
  yesEffect: string;
  noEffect: string;
}

export const trackedVotes: TrackedVote[] = [
  {
    legislationTitle: "National Defense Authorization Act for FY 2024",
    categoryId: "defense",
    congress: 118,
    houseVote: { year: 2023, rollCall: 723 },
    senateVote: { session: 1, rollCall: 343 },
    date: "2023-12-14",
    yesEffect: "Voted to authorize $886B in defense spending",
    noEffect: "Voted against authorizing $886B in defense spending",
  },
  {
    legislationTitle: "Inflation Reduction Act — Healthcare Provisions",
    categoryId: "healthcare",
    congress: 117,
    houseVote: { year: 2022, rollCall: 420 },
    senateVote: { session: 2, rollCall: 325 },
    date: "2022-08-12",
    yesEffect: "Voted to expand ACA subsidies and allow Medicare drug negotiation",
    noEffect: "Voted against ACA subsidy expansion and Medicare drug negotiation",
  },
  {
    legislationTitle: "Social Security Fairness Act of 2023",
    categoryId: "social-security",
    congress: 118,
    houseVote: { year: 2024, rollCall: 456 },
    senateVote: { session: 2, rollCall: 338 },
    date: "2024-12-21",
    yesEffect: "Voted to increase Social Security benefits for public sector workers",
    noEffect: "Voted against increasing Social Security benefits for public sector workers",
  },
  {
    legislationTitle: "Infrastructure Investment and Jobs Act (IIJA)",
    categoryId: "infrastructure",
    congress: 117,
    houseVote: { year: 2021, rollCall: 369 },
    senateVote: { session: 1, rollCall: 314 },
    date: "2021-11-05",
    yesEffect: "Voted to invest $1.2T in roads, bridges, broadband, and water",
    noEffect: "Voted against the $1.2T infrastructure investment package",
  },
  {
    legislationTitle: "CHIPS and Science Act",
    categoryId: "science",
    congress: 117,
    houseVote: { year: 2022, rollCall: 404 },
    senateVote: { session: 2, rollCall: 271 },
    date: "2022-07-28",
    yesEffect: "Voted to fund $280B for semiconductor manufacturing and research",
    noEffect: "Voted against $280B for semiconductor and science investment",
  },
  {
    legislationTitle: "Bipartisan Safer Communities Act",
    categoryId: "justice",
    congress: 117,
    houseVote: { year: 2022, rollCall: 299 },
    senateVote: { session: 2, rollCall: 242 },
    date: "2022-06-24",
    yesEffect: "Voted to fund school safety, mental health, and background checks",
    noEffect: "Voted against gun safety and mental health funding",
  },
  {
    legislationTitle: "PACT Act (Promise to Address Comprehensive Toxics Act)",
    categoryId: "veterans",
    congress: 117,
    houseVote: { year: 2022, rollCall: 309 },
    senateVote: { session: 2, rollCall: 280 },
    date: "2022-08-02",
    yesEffect: "Voted to expand VA benefits for veterans exposed to toxic substances",
    noEffect: "Voted against expanding VA benefits for toxic-exposed veterans",
  },
  {
    legislationTitle: "Fiscal Responsibility Act of 2023",
    categoryId: "interest",
    congress: 118,
    houseVote: { year: 2023, rollCall: 243 },
    senateVote: { session: 1, rollCall: 146 },
    date: "2023-06-01",
    yesEffect: "Voted to suspend the debt ceiling and cap discretionary spending",
    noEffect: "Voted against suspending the debt ceiling",
  },
  {
    legislationTitle: "SUPPORT for Patients and Communities Reauthorization Act of 2025",
    categoryId: "healthcare", // suggested via committee: Health, Education, Labor, and Pensions Committee
    congress: 119,
    houseVote: { year: 0, rollCall: 0 }, // MISSING — needs manual lookup
    senateVote: { session: 1, rollCall: 151 },
    date: "2025-12-01",
    yesEffect: "Voted to pass the SUPPORT for Patients and Communities Reauthorization Act of 2025", // draft — edit
    noEffect: "Voted against the SUPPORT for Patients and Communities Reauthorization Act of 2025", // draft — edit
  },
  {
    legislationTitle: "Epstein Files Transparency Act",
    categoryId: "justice", // suggested via committee: Judiciary Committee
    congress: 119,
    houseVote: { year: 0, rollCall: 0 }, // MISSING — needs manual lookup
    senateVote: { session: 1, rollCall: 289 },
    date: "2025-11-19",
    yesEffect: "Voted to pass the Epstein Files Transparency Act", // draft — edit
    noEffect: "Voted against the Epstein Files Transparency Act", // draft — edit
  },
  {
    legislationTitle: "Providing for congressional disapproval under chapter 8 of title 5, United States Code, of the rule submitted by the Bureau of Land Management relating to \"Coastal Plain Oil and Gas Leasing Program Record of Decision\".",
    categoryId: "unknown", // ⚠ low confidence — verify
    congress: 119,
    houseVote: { year: 0, rollCall: 0 }, // MISSING — needs manual lookup
    senateVote: { session: 1, rollCall: 632 },
    date: "2025-12-11",
    yesEffect: "Voted to pass the Providing for congressional disapproval under chapter 8 of title 5, United States Code, of the rule submitted by the Bureau of Land Management relating to \"Coastal Plain Oil and Gas Leasing Program Record of Decision\".", // draft — edit
    noEffect: "Voted against the Providing for congressional disapproval under chapter 8 of title 5, United States Code, of the rule submitted by the Bureau of Land Management relating to \"Coastal Plain Oil and Gas Leasing Program Record of Decision\".", // draft — edit
  },
];
