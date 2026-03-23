/**
 * Curated pending/active bills with CBO-sourced spending impact projections.
 *
 * Each bill includes:
 * - Basic bill info (title, status, sponsors, summary)
 * - Projected spending changes by budget category (annual, in billions)
 * - Champion info for the lead sponsor
 *
 * In production, this would be assembled from Congress.gov API + CBO cost estimates.
 */

export interface BillChampion {
  name: string;
  party: "D" | "R" | "I";
  chamber: "house" | "senate";
  state: string;
  title: string; // e.g. "Senator" or "Representative"
}

export interface SpendingImpact {
  categoryId: string;
  annualChange: number; // billions, positive = increase, negative = decrease
  description: string;
}

export type BillStatus =
  | "passed_house"
  | "passed_senate"
  | "in_committee"
  | "introduced"
  | "floor_vote_scheduled"
  | "enacted";

export type PassageLikelihood = "high" | "medium" | "low" | "enacted";

export interface PendingBill {
  id: string;
  congress: number; // e.g. 119 — used to detect expired bills when a Congress ends
  title: string;
  shortTitle: string;
  billNumber: string;
  summary: string;
  status: BillStatus;
  passageLikelihood: PassageLikelihood;
  champion: BillChampion;
  cosponsors: number;
  bipartisan: boolean;
  impactedCategories: string[]; // category IDs
  spendingImpacts: SpendingImpact[];
  totalAnnualImpact: number; // billions, net change
  cboScoreUrl: string;
  congressUrl: string;
  lastAction: string;
  lastActionDate: string;
  enactedDate?: string; // ISO date when signed into law
  publicLawNumber?: string; // e.g. "P.L. 118-63"
  /** Annual deficit impact in billions (positive = adds to deficit). Includes revenue changes not captured in spendingImpacts. */
  deficitImpact?: number;
}

export const landmarkBills: PendingBill[] = [
  {
    id: "hr-1-obbba-119",
    congress: 119,
    title: "One Big Beautiful Bill Act",
    shortTitle: "One Big Beautiful Bill",
    billNumber: "H.R. 1",
    summary:
      "Massive reconciliation package signed into law July 4, 2025. Extends 2017 tax cuts ($4.5T revenue loss over 10 years), cuts Medicaid by $911B via work requirements and per-capita caps, reduces SNAP by $295B, increases defense spending by $150B, adds $132B for border security and immigration enforcement, and includes energy provisions. CBO projects $3.4T added to deficits over the next decade.",
    status: "enacted",
    passageLikelihood: "enacted",
    champion: {
      name: "Speaker Mike Johnson",
      party: "R",
      chamber: "house",
      state: "LA",
      title: "Speaker of the House",
    },
    cosponsors: 0,
    bipartisan: false,
    impactedCategories: ["healthcare", "income-security", "defense", "immigration", "science"],
    spendingImpacts: [
      {
        categoryId: "healthcare",
        annualChange: -91,
        description:
          "Cuts Medicaid spending by ~$91B/year through work requirements, per-capita caps, and reduced federal matching rates.",
      },
      {
        categoryId: "income-security",
        annualChange: -30,
        description:
          "Reduces SNAP (food stamps) spending by ~$30B/year through stricter eligibility and benefit reductions.",
      },
      {
        categoryId: "defense",
        annualChange: 15,
        description:
          "Increases defense spending by ~$15B/year for military modernization and readiness.",
      },
      {
        categoryId: "immigration",
        annualChange: 13,
        description:
          "Adds ~$13B/year for border wall construction, ICE enforcement, and immigration court expansion.",
      },
      {
        categoryId: "science",
        annualChange: -5,
        description:
          "Reduces clean energy tax credits by ~$5B/year by rolling back portions of the Inflation Reduction Act.",
      },
    ],
    totalAnnualImpact: -98,
    deficitImpact: 340, // $3.4T over 10 years: -$98B spending cuts + $450B/yr revenue loss from tax cut extensions
    cboScoreUrl: "https://www.cbo.gov/publication/61697",
    congressUrl: "https://www.congress.gov/bill/119th-congress/house-bill/1",
    lastAction: "Became Public Law No: 119-21.",
    lastActionDate: "2025-07-04",
    enactedDate: "2025-07-04",
    publicLawNumber: "P.L. 119-21",
  },
];

export const pendingBills: PendingBill[] = [
  {
    id: "s-770-social-security-expansion",
    congress: 119,
    title: "Social Security Expansion Act",
    shortTitle: "Social Security Expansion",
    billNumber: "S. 770",
    summary:
      "Increases Social Security benefits by adjusting the primary insurance formula, switches to CPI-E for cost-of-living adjustments, and extends solvency by applying payroll taxes to earnings above $250,000. Also increases the net investment income tax.",
    status: "introduced",
    passageLikelihood: "low",
    champion: {
      name: "Sen. Bernie Sanders",
      party: "I",
      chamber: "senate",
      state: "VT",
      title: "Senator",
    },
    cosponsors: 10,
    bipartisan: false,
    impactedCategories: ["social-security"],
    spendingImpacts: [
      {
        categoryId: "social-security",
        annualChange: 30,
        description:
          "Increases Social Security benefit payments via adjusted PIA formula and CPI-E COLA, adding ~$30B/year in outlays. Funded by new payroll taxes on earnings above $250,000.",
      },
    ],
    totalAnnualImpact: 30,
    cboScoreUrl: "",
    congressUrl: "https://www.congress.gov/bill/119th-congress/senate-bill/770",
    lastAction: "Read twice and referred to the Committee on Finance.",
    lastActionDate: "2025-02-27",
  },
  {
    id: "hr-6166-lowering-drug-costs",
    congress: 119,
    title: "Lowering Drug Costs for American Families Act",
    shortTitle: "Lower Drug Costs",
    billNumber: "H.R. 6166",
    summary:
      "Expands Medicare's drug price negotiation program, repeals the One Big Beautiful Bill's orphan drug exclusion, applies prescription drug inflation rebates to the commercial market, and establishes out-of-pocket limits for private insurance.",
    status: "introduced",
    passageLikelihood: "low",
    champion: {
      name: "Rep. Frank Pallone",
      party: "D",
      chamber: "house",
      state: "NJ",
      title: "Ranking Member, Energy & Commerce Committee",
    },
    cosponsors: 49,
    bipartisan: false,
    impactedCategories: ["healthcare"],
    spendingImpacts: [
      {
        categoryId: "healthcare",
        annualChange: -20,
        description:
          "Reduces Medicare drug spending by ~$20B/year through expanded price negotiation, commercial market inflation rebates, and out-of-pocket caps on private insurance.",
      },
    ],
    totalAnnualImpact: -20,
    cboScoreUrl: "",
    congressUrl: "https://www.congress.gov/bill/119th-congress/house-bill/6166",
    lastAction: "Referred to the Committee on Energy and Commerce, and in addition to the Committees on Ways and Means, and Education and Workforce, for a period to be subsequently determined by the Speaker, in each case for consideration of such provisions as fall within the jurisdiction of the committee concerned.",
    lastActionDate: "2025-11-20",
  },
  {
    id: "s-1832-college-for-all",
    congress: 119,
    title: "College for All Act of 2025",
    shortTitle: "College for All",
    billNumber: "S. 1832",
    summary:
      "Nearly doubles the maximum Pell Grant to $14,790, creates a federal-state partnership for tuition-free public college, and expands eligibility for DREAMers.",
    status: "introduced",
    passageLikelihood: "low",
    champion: {
      name: "Sen. Bernie Sanders",
      party: "I",
      chamber: "senate",
      state: "VT",
      title: "Senator",
    },
    cosponsors: 11,
    bipartisan: false,
    impactedCategories: ["education"],
    spendingImpacts: [
      {
        categoryId: "education",
        annualChange: 30,
        description:
          "Increases Pell Grant maximum to $14,790 (~$15B/year) and funds a federal-state tuition-free public college partnership (~$15B/year).",
      },
    ],
    totalAnnualImpact: 30,
    cboScoreUrl: "",
    congressUrl: "https://www.congress.gov/bill/119th-congress/senate-bill/1832",
    lastAction: "Read twice and referred to the Committee on Finance.",
    lastActionDate: "2025-05-21",
  },
  {
    id: "hr-318-border-safety",
    congress: 119,
    title: "Border Safety and Security Act of 2025",
    shortTitle: "Border Safety Act",
    billNumber: "H.R. 318",
    summary:
      "Requires DHS to suspend entry of non-citizens without valid documents when it cannot detain or return them. Allows states to sue DHS to enforce the requirement.",
    status: "introduced",
    passageLikelihood: "low",
    champion: {
      name: "Rep. Chip Roy",
      party: "R",
      chamber: "house",
      state: "TX",
      title: "Representative",
    },
    cosponsors: 46,
    bipartisan: false,
    impactedCategories: ["immigration"],
    spendingImpacts: [
      {
        categoryId: "immigration",
        annualChange: 5,
        description:
          "Increases DHS operational costs by ~$5B/year for mandatory detention and return processing when capacity is exceeded.",
      },
    ],
    totalAnnualImpact: 5,
    cboScoreUrl: "",
    congressUrl: "https://www.congress.gov/bill/119th-congress/house-bill/318",
    lastAction: "Referred to the Subcommittee on Border Security and Enforcement.",
    lastActionDate: "2025-01-09",
  },
  {
    id: "s-2712-clean-future-fund",
    congress: 119,
    title: "America's Clean Future Fund Act",
    shortTitle: "Clean Future Fund",
    billNumber: "S. 2712",
    summary:
      "Creates an independent Climate Change Finance Corporation to finance clean energy deployment, climate-resilient infrastructure, and support clean energy projects with low- and zero-emissions technologies.",
    status: "introduced",
    passageLikelihood: "low",
    champion: {
      name: "Sen. Chris Van Hollen",
      party: "D",
      chamber: "senate",
      state: "MD",
      title: "Senator",
    },
    cosponsors: 0,
    bipartisan: false,
    impactedCategories: ["science"],
    spendingImpacts: [
      {
        categoryId: "science",
        annualChange: 10,
        description:
          "Capitalizes a new Climate Change Finance Corporation with ~$10B/year for clean energy deployment, grid modernization, and climate-resilient infrastructure.",
      },
    ],
    totalAnnualImpact: 10,
    cboScoreUrl: "",
    congressUrl: "https://www.congress.gov/bill/119th-congress/senate-bill/2712",
    lastAction: "Read twice and referred to the Committee on Finance. (text: CR S6321-6329)",
    lastActionDate: "2025-09-04",
  },
  {
    id: "hr-1700-social-security-expansion-house",
    congress: 119,
    title: "Social Security Expansion Act",
    shortTitle: "Social Security Expansion (House)",
    billNumber: "H.R. 1700",
    summary:
      "House companion to S. 770. Increases Social Security benefits, applies payroll taxes to earnings above $250,000, extends student child benefits to age 22, and establishes a new minimum benefit for low earners.",
    status: "introduced",
    passageLikelihood: "low",
    champion: {
      name: "Rep. Jan Schakowsky",
      party: "D",
      chamber: "house",
      state: "IL",
      title: "Representative",
    },
    cosponsors: 36,
    bipartisan: false,
    impactedCategories: ["social-security"],
    spendingImpacts: [
      {
        categoryId: "social-security",
        annualChange: 30,
        description:
          "House companion to S. 770 — increases Social Security benefits by ~$30B/year via adjusted PIA formula, CPI-E COLA, and new minimum benefit for low earners.",
      },
    ],
    totalAnnualImpact: 30,
    cboScoreUrl: "",
    congressUrl: "https://www.congress.gov/bill/119th-congress/house-bill/1700",
    lastAction: "Referred to the Subcommittee on Railroads, Pipelines, and Hazardous Materials.",
    lastActionDate: "2025-02-27",
  },
  {
    id: "hr-7973-placeholder",
    congress: 119,
    title: "To end preventable maternal mortality, severe maternal morbidity, and maternal health disparities in the United States, and for other purposes.",
    shortTitle: "NEEDS EDIT", // NEEDS EDIT
    billNumber: "H.R. 7973",
    summary: "NEEDS EDIT — see https://www.congress.gov/bill/119th-congress/house-bill/7973", // NEEDS EDIT
    status: "introduced",
    passageLikelihood: "medium",
    champion: {
      name: "Rep. Underwood, Lauren [D-IL-14]",
      party: "D",
      chamber: "house",
      state: "IL",
      title: "Representative",
    },
    cosponsors: 201,
    bipartisan: false,
    impactedCategories: ["justice"],
    spendingImpacts: [], // NEEDS EDIT
    totalAnnualImpact: 0, // NEEDS EDIT
    cboScoreUrl: "",
    congressUrl: "https://www.congress.gov/bill/119th-congress/house-bill/7973",
    lastAction: "Referred to the Committee on Energy and Commerce, and in addition to the Committees on Education and Workforce, Veterans' Affairs, Natural Resources, and the Judiciary, for a period to be subsequently determined by the Speaker, in each case for consideration of such provisions as fall within the jurisdiction of the committee concerned.",
    lastActionDate: "2026-03-18",
  },
  {
    id: "hr-7678-placeholder",
    congress: 119,
    title: "Gun Owner Registration Information Protection Act",
    shortTitle: "NEEDS EDIT", // NEEDS EDIT
    billNumber: "H.R. 7678",
    summary: "NEEDS EDIT — see https://www.congress.gov/bill/119th-congress/house-bill/7678", // NEEDS EDIT
    status: "introduced",
    passageLikelihood: "low",
    champion: {
      name: "Rep. Gosar, Paul A. [R-AZ-9]",
      party: "R",
      chamber: "house",
      state: "AZ",
      title: "Representative",
    },
    cosponsors: 85,
    bipartisan: false,
    impactedCategories: ["justice"],
    spendingImpacts: [], // NEEDS EDIT
    totalAnnualImpact: 0, // NEEDS EDIT
    cboScoreUrl: "",
    congressUrl: "https://www.congress.gov/bill/119th-congress/house-bill/7678",
    lastAction: "Referred to the House Committee on the Judiciary.",
    lastActionDate: "2026-02-25",
  },
  {
    id: "hr-556-placeholder",
    congress: 119,
    title: "Protecting Access for Hunters and Anglers Act",
    shortTitle: "NEEDS EDIT", // NEEDS EDIT
    billNumber: "H.R. 556",
    summary: "NEEDS EDIT — see https://www.congress.gov/bill/119th-congress/house-bill/556", // NEEDS EDIT
    status: "introduced",
    passageLikelihood: "low",
    champion: {
      name: "Rep. Wittman, Robert J. [R-VA-1]",
      party: "R",
      chamber: "house",
      state: "VA",
      title: "Representative",
    },
    cosponsors: 83,
    bipartisan: false,
    impactedCategories: ["agriculture"],
    spendingImpacts: [], // NEEDS EDIT
    totalAnnualImpact: 0, // NEEDS EDIT
    cboScoreUrl: "",
    congressUrl: "https://www.congress.gov/bill/119th-congress/house-bill/556",
    lastAction: "Received in the Senate and Read twice and referred to the Committee on Environment and Public Works.",
    lastActionDate: "2026-03-19",
  },
  {
    id: "hr-5688-placeholder",
    congress: 119,
    title: "Non-Domiciled CDL Integrity Act",
    shortTitle: "NEEDS EDIT", // NEEDS EDIT
    billNumber: "H.R. 5688",
    summary: "NEEDS EDIT — see https://www.congress.gov/bill/119th-congress/house-bill/5688", // NEEDS EDIT
    status: "introduced",
    passageLikelihood: "low",
    champion: {
      name: "Rep. Rouzer, David [R-NC-7]",
      party: "R",
      chamber: "house",
      state: "NC",
      title: "Representative",
    },
    cosponsors: 62,
    bipartisan: false,
    impactedCategories: ["infrastructure"],
    spendingImpacts: [], // NEEDS EDIT
    totalAnnualImpact: 0, // NEEDS EDIT
    cboScoreUrl: "",
    congressUrl: "https://www.congress.gov/bill/119th-congress/house-bill/5688",
    lastAction: "Ordered to be Reported (Amended) by the Yeas and Nays: 35 - 26.",
    lastActionDate: "2026-03-18",
  },
  {
    id: "s-4139-placeholder",
    congress: 119,
    title: "A bill to require the Secretary of State, in coordination with the Secretary of Defense, to submit a report on emerging threats posed to Estonia, Latvia, and Lithuania, and for other purposes.",
    shortTitle: "NEEDS EDIT", // NEEDS EDIT
    billNumber: "S. 4139",
    summary: "NEEDS EDIT — see https://www.congress.gov/bill/119th-congress/senate-bill/4139", // NEEDS EDIT
    status: "introduced",
    passageLikelihood: "medium",
    champion: {
      name: "Sen. Durbin, Richard J. [D-IL]",
      party: "D",
      chamber: "senate",
      state: "IL",
      title: "Senator",
    },
    cosponsors: 19,
    bipartisan: true,
    impactedCategories: ["international"],
    spendingImpacts: [], // NEEDS EDIT
    totalAnnualImpact: 0, // NEEDS EDIT
    cboScoreUrl: "",
    congressUrl: "https://www.congress.gov/bill/119th-congress/senate-bill/4139",
    lastAction: "Read twice and referred to the Committee on Foreign Relations. (text: CR S1207)",
    lastActionDate: "2026-03-18",
  },
  {
    id: "s-4123-placeholder",
    congress: 119,
    title: "End Special Treatment for Congress at Airports Act of 2026",
    shortTitle: "NEEDS EDIT", // NEEDS EDIT
    billNumber: "S. 4123",
    summary: "NEEDS EDIT — see https://www.congress.gov/bill/119th-congress/senate-bill/4123", // NEEDS EDIT
    status: "passed_senate",
    passageLikelihood: "high",
    champion: {
      name: "Sen. Cornyn, John [R-TX]",
      party: "R",
      chamber: "senate",
      state: "TX",
      title: "Senator",
    },
    cosponsors: 0,
    bipartisan: false,
    impactedCategories: ["infrastructure"],
    spendingImpacts: [], // NEEDS EDIT
    totalAnnualImpact: 0, // NEEDS EDIT
    cboScoreUrl: "",
    congressUrl: "https://www.congress.gov/bill/119th-congress/senate-bill/4123",
    lastAction: "Passed Senate with an amendment by Unanimous Consent. (text: CR S1356)",
    lastActionDate: "2026-03-19",
  },
];

/**
 * Get pending bills that impact a specific spending category.
 */
export function getBillsForCategory(categoryId: string): PendingBill[] {
  return pendingBills.filter((bill) =>
    bill.impactedCategories.includes(categoryId)
  );
}

/**
 * Get the spending impact of a bill on a specific category.
 */
export function getBillImpactForCategory(
  bill: PendingBill,
  categoryId: string
): SpendingImpact | undefined {
  return bill.spendingImpacts.find((impact) => impact.categoryId === categoryId);
}
