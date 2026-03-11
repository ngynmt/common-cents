/**
 * Sample representative data for MVP.
 *
 * In production, this would come from the Google Civic Information API
 * or ProPublica Congress API based on the user's ZIP code.
 */

export interface Representative {
  id: string;
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
 * Sample representatives keyed by ZIP code prefix (first 3 digits).
 * In production, this would be a real API call.
 */
const SAMPLE_REPS: Record<string, Representative[]> = {
  // New York area
  "100": [
    {
      id: "ny-12",
      name: "Jerry Nadler",
      chamber: "house",
      party: "D",
      state: "NY",
      district: "12",
      photoUrl: "",
      phone: "(202) 225-5635",
      office: "2132 Rayburn House Office Building, Washington, DC 20515",
      website: "https://nadler.house.gov",
      contactFormUrl: "https://nadler.house.gov/contact",
      nextElection: 2026,
    },
    {
      id: "ny-sen-1",
      name: "Chuck Schumer",
      chamber: "senate",
      party: "D",
      state: "NY",
      photoUrl: "",
      phone: "(202) 224-6542",
      office: "322 Hart Senate Office Building, Washington, DC 20510",
      website: "https://www.schumer.senate.gov",
      contactFormUrl: "https://www.schumer.senate.gov/contact/email-chuck",
      nextElection: 2028,
    },
    {
      id: "ny-sen-2",
      name: "Kirsten Gillibrand",
      chamber: "senate",
      party: "D",
      state: "NY",
      photoUrl: "",
      phone: "(202) 224-4451",
      office: "478 Russell Senate Office Building, Washington, DC 20510",
      website: "https://www.gillibrand.senate.gov",
      contactFormUrl: "https://www.gillibrand.senate.gov/contact/email-me",
      nextElection: 2030,
    },
  ],
  // Los Angeles area
  "900": [
    {
      id: "ca-34",
      name: "Jimmy Gomez",
      chamber: "house",
      party: "D",
      state: "CA",
      district: "34",
      photoUrl: "",
      phone: "(202) 225-6235",
      office: "1530 Longworth House Office Building, Washington, DC 20515",
      website: "https://gomez.house.gov",
      contactFormUrl: "https://gomez.house.gov/contact",
      nextElection: 2026,
    },
    {
      id: "ca-sen-1",
      name: "Alex Padilla",
      chamber: "senate",
      party: "D",
      state: "CA",
      photoUrl: "",
      phone: "(202) 224-3553",
      office: "112 Hart Senate Office Building, Washington, DC 20510",
      website: "https://www.padilla.senate.gov",
      contactFormUrl: "https://www.padilla.senate.gov/contact/",
      nextElection: 2028,
    },
    {
      id: "ca-sen-2",
      name: "Adam Schiff",
      chamber: "senate",
      party: "D",
      state: "CA",
      photoUrl: "",
      phone: "(202) 224-3841",
      office: "Russell Senate Office Building, Washington, DC 20510",
      website: "https://www.schiff.senate.gov",
      contactFormUrl: "https://www.schiff.senate.gov/contact",
      nextElection: 2030,
    },
  ],
  // Houston area
  "770": [
    {
      id: "tx-18",
      name: "Sheila Jackson Lee",
      chamber: "house",
      party: "D",
      state: "TX",
      district: "18",
      photoUrl: "",
      phone: "(202) 225-3816",
      office: "2426 Rayburn House Office Building, Washington, DC 20515",
      website: "https://jacksonlee.house.gov",
      contactFormUrl: "https://jacksonlee.house.gov/contact",
      nextElection: 2026,
    },
    {
      id: "tx-sen-1",
      name: "John Cornyn",
      chamber: "senate",
      party: "R",
      state: "TX",
      photoUrl: "",
      phone: "(202) 224-2934",
      office: "517 Hart Senate Office Building, Washington, DC 20510",
      website: "https://www.cornyn.senate.gov",
      contactFormUrl: "https://www.cornyn.senate.gov/contact",
      nextElection: 2026,
    },
    {
      id: "tx-sen-2",
      name: "Ted Cruz",
      chamber: "senate",
      party: "R",
      state: "TX",
      photoUrl: "",
      phone: "(202) 224-5922",
      office: "127A Russell Senate Office Building, Washington, DC 20510",
      website: "https://www.cruz.senate.gov",
      contactFormUrl: "https://www.cruz.senate.gov/contact",
      nextElection: 2030,
    },
  ],
};

/**
 * Sample vote records linking representatives to spending categories.
 */
export const sampleVotes: VoteRecord[] = [
  // Defense - NDAA FY2024
  { representativeId: "ny-12", legislationTitle: "National Defense Authorization Act for FY 2024", categoryId: "defense", vote: "no", date: "2023-12-14" },
  { representativeId: "ny-sen-1", legislationTitle: "National Defense Authorization Act for FY 2024", categoryId: "defense", vote: "yes", date: "2023-12-13" },
  { representativeId: "ny-sen-2", legislationTitle: "National Defense Authorization Act for FY 2024", categoryId: "defense", vote: "yes", date: "2023-12-13" },
  { representativeId: "ca-34", legislationTitle: "National Defense Authorization Act for FY 2024", categoryId: "defense", vote: "no", date: "2023-12-14" },
  { representativeId: "ca-sen-1", legislationTitle: "National Defense Authorization Act for FY 2024", categoryId: "defense", vote: "yes", date: "2023-12-13" },
  { representativeId: "ca-sen-2", legislationTitle: "National Defense Authorization Act for FY 2024", categoryId: "defense", vote: "yes", date: "2023-12-13" },
  { representativeId: "tx-18", legislationTitle: "National Defense Authorization Act for FY 2024", categoryId: "defense", vote: "no", date: "2023-12-14" },
  { representativeId: "tx-sen-1", legislationTitle: "National Defense Authorization Act for FY 2024", categoryId: "defense", vote: "yes", date: "2023-12-13" },
  { representativeId: "tx-sen-2", legislationTitle: "National Defense Authorization Act for FY 2024", categoryId: "defense", vote: "yes", date: "2023-12-13" },

  // Healthcare - Inflation Reduction Act
  { representativeId: "ny-12", legislationTitle: "Inflation Reduction Act — Healthcare Provisions", categoryId: "healthcare", vote: "yes", date: "2022-08-12" },
  { representativeId: "ny-sen-1", legislationTitle: "Inflation Reduction Act — Healthcare Provisions", categoryId: "healthcare", vote: "yes", date: "2022-08-07" },
  { representativeId: "ny-sen-2", legislationTitle: "Inflation Reduction Act — Healthcare Provisions", categoryId: "healthcare", vote: "yes", date: "2022-08-07" },
  { representativeId: "ca-34", legislationTitle: "Inflation Reduction Act — Healthcare Provisions", categoryId: "healthcare", vote: "yes", date: "2022-08-12" },
  { representativeId: "ca-sen-1", legislationTitle: "Inflation Reduction Act — Healthcare Provisions", categoryId: "healthcare", vote: "yes", date: "2022-08-07" },
  { representativeId: "ca-sen-2", legislationTitle: "Inflation Reduction Act — Healthcare Provisions", categoryId: "healthcare", vote: "yes", date: "2022-08-07" },
  { representativeId: "tx-18", legislationTitle: "Inflation Reduction Act — Healthcare Provisions", categoryId: "healthcare", vote: "yes", date: "2022-08-12" },
  { representativeId: "tx-sen-1", legislationTitle: "Inflation Reduction Act — Healthcare Provisions", categoryId: "healthcare", vote: "no", date: "2022-08-07" },
  { representativeId: "tx-sen-2", legislationTitle: "Inflation Reduction Act — Healthcare Provisions", categoryId: "healthcare", vote: "no", date: "2022-08-07" },

  // Social Security Fairness Act
  { representativeId: "ny-12", legislationTitle: "Social Security Fairness Act of 2023", categoryId: "social-security", vote: "yes", date: "2024-11-12" },
  { representativeId: "ny-sen-1", legislationTitle: "Social Security Fairness Act of 2023", categoryId: "social-security", vote: "yes", date: "2024-12-21" },
  { representativeId: "ny-sen-2", legislationTitle: "Social Security Fairness Act of 2023", categoryId: "social-security", vote: "yes", date: "2024-12-21" },
  { representativeId: "ca-34", legislationTitle: "Social Security Fairness Act of 2023", categoryId: "social-security", vote: "yes", date: "2024-11-12" },
  { representativeId: "ca-sen-1", legislationTitle: "Social Security Fairness Act of 2023", categoryId: "social-security", vote: "yes", date: "2024-12-21" },
  { representativeId: "ca-sen-2", legislationTitle: "Social Security Fairness Act of 2023", categoryId: "social-security", vote: "yes", date: "2024-12-21" },
  { representativeId: "tx-18", legislationTitle: "Social Security Fairness Act of 2023", categoryId: "social-security", vote: "yes", date: "2024-11-12" },
  { representativeId: "tx-sen-1", legislationTitle: "Social Security Fairness Act of 2023", categoryId: "social-security", vote: "yes", date: "2024-12-21" },
  { representativeId: "tx-sen-2", legislationTitle: "Social Security Fairness Act of 2023", categoryId: "social-security", vote: "no", date: "2024-12-21" },

  // Infrastructure - IIJA
  { representativeId: "ny-12", legislationTitle: "Infrastructure Investment and Jobs Act (IIJA)", categoryId: "infrastructure", vote: "yes", date: "2021-11-05" },
  { representativeId: "ny-sen-1", legislationTitle: "Infrastructure Investment and Jobs Act (IIJA)", categoryId: "infrastructure", vote: "yes", date: "2021-08-10" },
  { representativeId: "ny-sen-2", legislationTitle: "Infrastructure Investment and Jobs Act (IIJA)", categoryId: "infrastructure", vote: "yes", date: "2021-08-10" },
  { representativeId: "ca-34", legislationTitle: "Infrastructure Investment and Jobs Act (IIJA)", categoryId: "infrastructure", vote: "yes", date: "2021-11-05" },
  { representativeId: "ca-sen-1", legislationTitle: "Infrastructure Investment and Jobs Act (IIJA)", categoryId: "infrastructure", vote: "yes", date: "2021-08-10" },
  { representativeId: "ca-sen-2", legislationTitle: "Infrastructure Investment and Jobs Act (IIJA)", categoryId: "infrastructure", vote: "yes", date: "2021-08-10" },
  { representativeId: "tx-18", legislationTitle: "Infrastructure Investment and Jobs Act (IIJA)", categoryId: "infrastructure", vote: "yes", date: "2021-11-05" },
  { representativeId: "tx-sen-1", legislationTitle: "Infrastructure Investment and Jobs Act (IIJA)", categoryId: "infrastructure", vote: "yes", date: "2021-08-10" },
  { representativeId: "tx-sen-2", legislationTitle: "Infrastructure Investment and Jobs Act (IIJA)", categoryId: "infrastructure", vote: "no", date: "2021-08-10" },

  // CHIPS and Science Act
  { representativeId: "ny-12", legislationTitle: "CHIPS and Science Act", categoryId: "science", vote: "yes", date: "2022-07-28" },
  { representativeId: "ny-sen-1", legislationTitle: "CHIPS and Science Act", categoryId: "science", vote: "yes", date: "2022-07-27" },
  { representativeId: "ny-sen-2", legislationTitle: "CHIPS and Science Act", categoryId: "science", vote: "yes", date: "2022-07-27" },
  { representativeId: "ca-34", legislationTitle: "CHIPS and Science Act", categoryId: "science", vote: "yes", date: "2022-07-28" },
  { representativeId: "ca-sen-1", legislationTitle: "CHIPS and Science Act", categoryId: "science", vote: "yes", date: "2022-07-27" },
  { representativeId: "ca-sen-2", legislationTitle: "CHIPS and Science Act", categoryId: "science", vote: "yes", date: "2022-07-27" },
  { representativeId: "tx-18", legislationTitle: "CHIPS and Science Act", categoryId: "science", vote: "yes", date: "2022-07-28" },
  { representativeId: "tx-sen-1", legislationTitle: "CHIPS and Science Act", categoryId: "science", vote: "yes", date: "2022-07-27" },
  { representativeId: "tx-sen-2", legislationTitle: "CHIPS and Science Act", categoryId: "science", vote: "no", date: "2022-07-27" },

  // Bipartisan Safer Communities Act
  { representativeId: "ny-12", legislationTitle: "Bipartisan Safer Communities Act", categoryId: "justice", vote: "yes", date: "2022-06-24" },
  { representativeId: "ny-sen-1", legislationTitle: "Bipartisan Safer Communities Act", categoryId: "justice", vote: "yes", date: "2022-06-23" },
  { representativeId: "ny-sen-2", legislationTitle: "Bipartisan Safer Communities Act", categoryId: "justice", vote: "yes", date: "2022-06-23" },
  { representativeId: "ca-34", legislationTitle: "Bipartisan Safer Communities Act", categoryId: "justice", vote: "yes", date: "2022-06-24" },
  { representativeId: "ca-sen-1", legislationTitle: "Bipartisan Safer Communities Act", categoryId: "justice", vote: "yes", date: "2022-06-23" },
  { representativeId: "ca-sen-2", legislationTitle: "Bipartisan Safer Communities Act", categoryId: "justice", vote: "yes", date: "2022-06-23" },
  { representativeId: "tx-18", legislationTitle: "Bipartisan Safer Communities Act", categoryId: "justice", vote: "yes", date: "2022-06-24" },
  { representativeId: "tx-sen-1", legislationTitle: "Bipartisan Safer Communities Act", categoryId: "justice", vote: "yes", date: "2022-06-23" },
  { representativeId: "tx-sen-2", legislationTitle: "Bipartisan Safer Communities Act", categoryId: "justice", vote: "yes", date: "2022-06-23" },

  // PACT Act
  { representativeId: "ny-12", legislationTitle: "PACT Act (Promise to Address Comprehensive Toxics Act)", categoryId: "veterans", vote: "yes", date: "2022-08-02" },
  { representativeId: "ny-sen-1", legislationTitle: "PACT Act (Promise to Address Comprehensive Toxics Act)", categoryId: "veterans", vote: "yes", date: "2022-08-02" },
  { representativeId: "ny-sen-2", legislationTitle: "PACT Act (Promise to Address Comprehensive Toxics Act)", categoryId: "veterans", vote: "yes", date: "2022-08-02" },
  { representativeId: "ca-34", legislationTitle: "PACT Act (Promise to Address Comprehensive Toxics Act)", categoryId: "veterans", vote: "yes", date: "2022-08-02" },
  { representativeId: "ca-sen-1", legislationTitle: "PACT Act (Promise to Address Comprehensive Toxics Act)", categoryId: "veterans", vote: "yes", date: "2022-08-02" },
  { representativeId: "ca-sen-2", legislationTitle: "PACT Act (Promise to Address Comprehensive Toxics Act)", categoryId: "veterans", vote: "yes", date: "2022-08-02" },
  { representativeId: "tx-18", legislationTitle: "PACT Act (Promise to Address Comprehensive Toxics Act)", categoryId: "veterans", vote: "yes", date: "2022-08-02" },
  { representativeId: "tx-sen-1", legislationTitle: "PACT Act (Promise to Address Comprehensive Toxics Act)", categoryId: "veterans", vote: "yes", date: "2022-08-02" },
  { representativeId: "tx-sen-2", legislationTitle: "PACT Act (Promise to Address Comprehensive Toxics Act)", categoryId: "veterans", vote: "no", date: "2022-08-02" },

  // Fiscal Responsibility Act
  { representativeId: "ny-12", legislationTitle: "Fiscal Responsibility Act of 2023", categoryId: "interest", vote: "yes", date: "2023-05-31" },
  { representativeId: "ny-sen-1", legislationTitle: "Fiscal Responsibility Act of 2023", categoryId: "interest", vote: "yes", date: "2023-06-01" },
  { representativeId: "ny-sen-2", legislationTitle: "Fiscal Responsibility Act of 2023", categoryId: "interest", vote: "yes", date: "2023-06-01" },
  { representativeId: "ca-34", legislationTitle: "Fiscal Responsibility Act of 2023", categoryId: "interest", vote: "no", date: "2023-05-31" },
  { representativeId: "ca-sen-1", legislationTitle: "Fiscal Responsibility Act of 2023", categoryId: "interest", vote: "yes", date: "2023-06-01" },
  { representativeId: "ca-sen-2", legislationTitle: "Fiscal Responsibility Act of 2023", categoryId: "interest", vote: "yes", date: "2023-06-01" },
  { representativeId: "tx-18", legislationTitle: "Fiscal Responsibility Act of 2023", categoryId: "interest", vote: "no", date: "2023-05-31" },
  { representativeId: "tx-sen-1", legislationTitle: "Fiscal Responsibility Act of 2023", categoryId: "interest", vote: "yes", date: "2023-06-01" },
  { representativeId: "tx-sen-2", legislationTitle: "Fiscal Responsibility Act of 2023", categoryId: "interest", vote: "yes", date: "2023-06-01" },
];

/**
 * Look up representatives by ZIP code.
 * Falls back to a default set if the ZIP prefix isn't in our sample data.
 */
export function getRepresentatives(zipCode: string): Representative[] | null {
  if (!zipCode || zipCode.length < 3) return null;
  const prefix = zipCode.substring(0, 3);
  return SAMPLE_REPS[prefix] ?? null;
}

/**
 * Get vote records for specific representatives and a spending category.
 */
export function getVotesForCategory(
  representativeIds: string[],
  categoryId: string
): VoteRecord[] {
  return sampleVotes.filter(
    (v) => representativeIds.includes(v.representativeId) && v.categoryId === categoryId
  );
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
