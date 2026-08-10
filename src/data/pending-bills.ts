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
    id: "hr-2175-placeholder",
    congress: 119,
    title: "To designate the facility of the United States Postal Service located at 130 South Patterson Avenue in Santa Barbara, California, as the Brigadier General Frederick R. Lopez Post Office Building.",
    shortTitle: "NEEDS EDIT", // NEEDS EDIT
    billNumber: "H.R. 2175",
    summary: "NEEDS EDIT — see https://www.congress.gov/bill/119th-congress/house-bill/2175", // NEEDS EDIT
    status: "introduced",
    passageLikelihood: "medium",
    champion: {
      name: "Rep. Carbajal, Salud O. [D-CA-24]",
      party: "D",
      chamber: "house",
      state: "CA",
      title: "Representative",
    },
    cosponsors: 51,
    bipartisan: true,
    impactedCategories: ["immigration"],
    spendingImpacts: [], // NEEDS EDIT
    totalAnnualImpact: 0, // NEEDS EDIT
    cboScoreUrl: "",
    congressUrl: "https://www.congress.gov/bill/119th-congress/house-bill/2175",
    lastAction: "Committee on Homeland Security and Governmental Affairs. Ordered to be reported without amendment favorably.",
    lastActionDate: "2026-08-06",
  },
  {
    id: "s-4189-placeholder",
    congress: 119,
    title: "INSULIN Act of 2026",
    shortTitle: "NEEDS EDIT", // NEEDS EDIT
    billNumber: "S. 4189",
    summary: "NEEDS EDIT — see https://www.congress.gov/bill/119th-congress/senate-bill/4189", // NEEDS EDIT
    status: "introduced",
    passageLikelihood: "medium",
    champion: {
      name: "Sen. Shaheen, Jeanne [D-NH]",
      party: "D",
      chamber: "senate",
      state: "NH",
      title: "Senator",
    },
    cosponsors: 28,
    bipartisan: true,
    impactedCategories: ["healthcare"],
    spendingImpacts: [], // NEEDS EDIT
    totalAnnualImpact: 0, // NEEDS EDIT
    cboScoreUrl: "",
    congressUrl: "https://www.congress.gov/bill/119th-congress/senate-bill/4189",
    lastAction: "Placed on Senate Legislative Calendar under General Orders. Calendar No. 552.",
    lastActionDate: "2026-08-07",
  },
  {
    id: "s-2398-placeholder",
    congress: 119,
    title: "Kay Hagan Tick Reauthorization Act",
    shortTitle: "NEEDS EDIT", // NEEDS EDIT
    billNumber: "S. 2398",
    summary: "NEEDS EDIT — see https://www.congress.gov/bill/119th-congress/senate-bill/2398", // NEEDS EDIT
    status: "passed_senate",
    passageLikelihood: "high",
    champion: {
      name: "Sen. Collins, Susan M. [R-ME]",
      party: "R",
      chamber: "senate",
      state: "ME",
      title: "Senator",
    },
    cosponsors: 23,
    bipartisan: true,
    impactedCategories: ["healthcare"],
    spendingImpacts: [], // NEEDS EDIT
    totalAnnualImpact: 0, // NEEDS EDIT
    cboScoreUrl: "",
    congressUrl: "https://www.congress.gov/bill/119th-congress/senate-bill/2398",
    lastAction: "Passed Senate with an amendment by Voice Vote. (consideration: CR S4494-4495; text: CR S4494-4495)",
    lastActionDate: "2026-08-06",
  },
  {
    id: "s-3900-placeholder",
    congress: 119,
    title: "Iran Human Rights, Internet Freedom, and Accountability Act of 2026",
    shortTitle: "NEEDS EDIT", // NEEDS EDIT
    billNumber: "S. 3900",
    summary: "NEEDS EDIT — see https://www.congress.gov/bill/119th-congress/senate-bill/3900", // NEEDS EDIT
    status: "introduced",
    passageLikelihood: "medium",
    champion: {
      name: "Sen. McCormick, David [R-PA]",
      party: "R",
      chamber: "senate",
      state: "PA",
      title: "Senator",
    },
    cosponsors: 19,
    bipartisan: true,
    impactedCategories: ["international"],
    spendingImpacts: [], // NEEDS EDIT
    totalAnnualImpact: 0, // NEEDS EDIT
    cboScoreUrl: "",
    congressUrl: "https://www.congress.gov/bill/119th-congress/senate-bill/3900",
    lastAction: "Placed on Senate Legislative Calendar under General Orders. Calendar No. 504.",
    lastActionDate: "2026-07-27",
  },
  {
    id: "s-5201-placeholder",
    congress: 119,
    title: "A bill to amend title 18, United States Code, to protect more victims of domestic violence by preventing their abusers from possessing or receiving firearms, and for other purposes.",
    shortTitle: "NEEDS EDIT", // NEEDS EDIT
    billNumber: "S. 5201",
    summary: "NEEDS EDIT — see https://www.congress.gov/bill/119th-congress/senate-bill/5201", // NEEDS EDIT
    status: "introduced",
    passageLikelihood: "low",
    champion: {
      name: "Sen. Blumenthal, Richard [D-CT]",
      party: "D",
      chamber: "senate",
      state: "CT",
      title: "Senator",
    },
    cosponsors: 19,
    bipartisan: false,
    impactedCategories: ["justice"],
    spendingImpacts: [], // NEEDS EDIT
    totalAnnualImpact: 0, // NEEDS EDIT
    cboScoreUrl: "",
    congressUrl: "https://www.congress.gov/bill/119th-congress/senate-bill/5201",
    lastAction: "Read twice and referred to the Committee on the Judiciary.",
    lastActionDate: "2026-07-30",
  },
  {
    id: "s-5341-placeholder",
    congress: 119,
    title: "A bill to require the Secretary of the department in which the Coast Guard is operating to delegate to the Commandant of the Coast Guard authority to enter into intergovernmental support agreements relating to installation-support services, and for other purposes.",
    shortTitle: "NEEDS EDIT", // NEEDS EDIT
    billNumber: "S. 5341",
    summary: "NEEDS EDIT — see https://www.congress.gov/bill/119th-congress/senate-bill/5341", // NEEDS EDIT
    status: "introduced",
    passageLikelihood: "medium",
    champion: {
      name: "Sen. Murphy, Christopher [D-CT]",
      party: "D",
      chamber: "senate",
      state: "CT",
      title: "Senator",
    },
    cosponsors: 19,
    bipartisan: true,
    impactedCategories: ["infrastructure"],
    spendingImpacts: [], // NEEDS EDIT
    totalAnnualImpact: 0, // NEEDS EDIT
    cboScoreUrl: "",
    congressUrl: "https://www.congress.gov/bill/119th-congress/senate-bill/5341",
    lastAction: "Read twice and referred to the Committee on Commerce, Science, and Transportation.",
    lastActionDate: "2026-08-06",
  },
  {
    id: "s-5321-placeholder",
    congress: 119,
    title: "A bill to amend title XIX of the Social Security Act to require coverage of, and expand access to, home and community-based services under the Medicaid program, to award grants for the creation, recruitment, training and education, retention, and advancement of the direct care workforce and to award grants to support family caregivers, and for other purposes.",
    shortTitle: "NEEDS EDIT", // NEEDS EDIT
    billNumber: "S. 5321",
    summary: "NEEDS EDIT — see https://www.congress.gov/bill/119th-congress/senate-bill/5321", // NEEDS EDIT
    status: "introduced",
    passageLikelihood: "low",
    champion: {
      name: "Sen. Luján, Ben Ray [D-NM]",
      party: "D",
      chamber: "senate",
      state: "NM",
      title: "Senator",
    },
    cosponsors: 16,
    bipartisan: false,
    impactedCategories: ["healthcare"],
    spendingImpacts: [], // NEEDS EDIT
    totalAnnualImpact: 0, // NEEDS EDIT
    cboScoreUrl: "",
    congressUrl: "https://www.congress.gov/bill/119th-congress/senate-bill/5321",
    lastAction: "Read twice and referred to the Committee on Finance.",
    lastActionDate: "2026-08-06",
  },
  {
    id: "s-252-placeholder",
    congress: 119,
    title: "GOOD Act",
    shortTitle: "NEEDS EDIT", // NEEDS EDIT
    billNumber: "S. 252",
    summary: "NEEDS EDIT — see https://www.congress.gov/bill/119th-congress/senate-bill/252", // NEEDS EDIT
    status: "introduced",
    passageLikelihood: "low",
    champion: {
      name: "Sen. Johnson, Ron [R-WI]",
      party: "R",
      chamber: "senate",
      state: "WI",
      title: "Senator",
    },
    cosponsors: 15,
    bipartisan: false,
    impactedCategories: ["immigration"],
    spendingImpacts: [], // NEEDS EDIT
    totalAnnualImpact: 0, // NEEDS EDIT
    cboScoreUrl: "",
    congressUrl: "https://www.congress.gov/bill/119th-congress/senate-bill/252",
    lastAction: "Committee on Homeland Security and Governmental Affairs. Ordered to be reported with an amendment in the nature of a substitute favorably.",
    lastActionDate: "2026-08-06",
  },
  {
    id: "s-3897-placeholder",
    congress: 119,
    title: "Officer John Barnes and Chief Michael Ansbro Public Safety Officers' Benefit Program Expansion Act of 2026",
    shortTitle: "NEEDS EDIT", // NEEDS EDIT
    billNumber: "S. 3897",
    summary: "NEEDS EDIT — see https://www.congress.gov/bill/119th-congress/senate-bill/3897", // NEEDS EDIT
    status: "passed_senate",
    passageLikelihood: "high",
    champion: {
      name: "Sen. Gillibrand, Kirsten E. [D-NY]",
      party: "D",
      chamber: "senate",
      state: "NY",
      title: "Senator",
    },
    cosponsors: 14,
    bipartisan: true,
    impactedCategories: ["justice"],
    spendingImpacts: [], // NEEDS EDIT
    totalAnnualImpact: 0, // NEEDS EDIT
    cboScoreUrl: "",
    congressUrl: "https://www.congress.gov/bill/119th-congress/senate-bill/3897",
    lastAction: "Passed Senate with an amendment by Unanimous Consent.",
    lastActionDate: "2026-08-07",
  },
  {
    id: "hr-5366-placeholder",
    congress: 119,
    title: "Doug LaMalfa Federal Disaster Tax Relief Certainty Act",
    shortTitle: "NEEDS EDIT", // NEEDS EDIT
    billNumber: "H.R. 5366",
    summary: "NEEDS EDIT — see https://www.congress.gov/bill/119th-congress/house-bill/5366", // NEEDS EDIT
    status: "passed_senate",
    passageLikelihood: "high",
    champion: {
      name: "Rep. Steube, W. Gregory [R-FL-17]",
      party: "R",
      chamber: "house",
      state: "FL",
      title: "Representative",
    },
    cosponsors: 14,
    bipartisan: true,
    impactedCategories: ["government"],
    spendingImpacts: [], // NEEDS EDIT
    totalAnnualImpact: 0, // NEEDS EDIT
    cboScoreUrl: "",
    congressUrl: "https://www.congress.gov/bill/119th-congress/house-bill/5366",
    lastAction: "Passed Senate without amendment by Unanimous Consent.",
    lastActionDate: "2026-08-07",
  },
  {
    id: "s-1838-placeholder",
    congress: 119,
    title: "DeOndra Dixon INCLUDE Project Act of 2026",
    shortTitle: "NEEDS EDIT", // NEEDS EDIT
    billNumber: "S. 1838",
    summary: "NEEDS EDIT — see https://www.congress.gov/bill/119th-congress/senate-bill/1838", // NEEDS EDIT
    status: "passed_senate",
    passageLikelihood: "high",
    champion: {
      name: "Sen. Hickenlooper, John W. [D-CO]",
      party: "D",
      chamber: "senate",
      state: "CO",
      title: "Senator",
    },
    cosponsors: 9,
    bipartisan: true,
    impactedCategories: ["healthcare"],
    spendingImpacts: [], // NEEDS EDIT
    totalAnnualImpact: 0, // NEEDS EDIT
    cboScoreUrl: "",
    congressUrl: "https://www.congress.gov/bill/119th-congress/senate-bill/1838",
    lastAction: "Passed Senate with an amendment by Voice Vote. (text of amendment in the nature of a substitute: CR S4495-4496)",
    lastActionDate: "2026-08-06",
  },
  {
    id: "s-4850-placeholder",
    congress: 119,
    title: "Diversity Jurisdiction Inflation Adjustment Act",
    shortTitle: "NEEDS EDIT", // NEEDS EDIT
    billNumber: "S. 4850",
    summary: "NEEDS EDIT — see https://www.congress.gov/bill/119th-congress/senate-bill/4850", // NEEDS EDIT
    status: "passed_senate",
    passageLikelihood: "high",
    champion: {
      name: "Sen. Kennedy, John [R-LA]",
      party: "R",
      chamber: "senate",
      state: "LA",
      title: "Senator",
    },
    cosponsors: 4,
    bipartisan: true,
    impactedCategories: ["justice"],
    spendingImpacts: [], // NEEDS EDIT
    totalAnnualImpact: 0, // NEEDS EDIT
    cboScoreUrl: "",
    congressUrl: "https://www.congress.gov/bill/119th-congress/senate-bill/4850",
    lastAction: "Passed Senate without amendment by Unanimous Consent.",
    lastActionDate: "2026-08-07",
  },
  {
    id: "s-850-placeholder",
    congress: 119,
    title: "Northern Border Security Enhancement and Review Act",
    shortTitle: "NEEDS EDIT", // NEEDS EDIT
    billNumber: "S. 850",
    summary: "NEEDS EDIT — see https://www.congress.gov/bill/119th-congress/senate-bill/850", // NEEDS EDIT
    status: "passed_senate",
    passageLikelihood: "high",
    champion: {
      name: "Sen. Hassan, Margaret Wood [D-NH]",
      party: "D",
      chamber: "senate",
      state: "NH",
      title: "Senator",
    },
    cosponsors: 4,
    bipartisan: true,
    impactedCategories: ["immigration"],
    spendingImpacts: [], // NEEDS EDIT
    totalAnnualImpact: 0, // NEEDS EDIT
    cboScoreUrl: "",
    congressUrl: "https://www.congress.gov/bill/119th-congress/senate-bill/850",
    lastAction: "Passed Senate with amendments by Unanimous Consent. (text: CR S4481)",
    lastActionDate: "2026-08-05",
  },
  {
    id: "s-2542-placeholder",
    congress: 119,
    title: "Federal Building Threat Notification Act",
    shortTitle: "NEEDS EDIT", // NEEDS EDIT
    billNumber: "S. 2542",
    summary: "NEEDS EDIT — see https://www.congress.gov/bill/119th-congress/senate-bill/2542", // NEEDS EDIT
    status: "passed_senate",
    passageLikelihood: "high",
    champion: {
      name: "Sen. Peters, Gary C. [D-MI]",
      party: "D",
      chamber: "senate",
      state: "MI",
      title: "Senator",
    },
    cosponsors: 2,
    bipartisan: false,
    impactedCategories: ["immigration"],
    spendingImpacts: [], // NEEDS EDIT
    totalAnnualImpact: 0, // NEEDS EDIT
    cboScoreUrl: "",
    congressUrl: "https://www.congress.gov/bill/119th-congress/senate-bill/2542",
    lastAction: "Passed Senate with an amendment by Unanimous Consent.",
    lastActionDate: "2026-08-07",
  },
  {
    id: "s-434-placeholder",
    congress: 119,
    title: "Space Commerce Advisory Committee Act",
    shortTitle: "NEEDS EDIT", // NEEDS EDIT
    billNumber: "S. 434",
    summary: "NEEDS EDIT — see https://www.congress.gov/bill/119th-congress/senate-bill/434", // NEEDS EDIT
    status: "passed_senate",
    passageLikelihood: "high",
    champion: {
      name: "Sen. Peters, Gary C. [D-MI]",
      party: "D",
      chamber: "senate",
      state: "MI",
      title: "Senator",
    },
    cosponsors: 2,
    bipartisan: false,
    impactedCategories: ["infrastructure"],
    spendingImpacts: [], // NEEDS EDIT
    totalAnnualImpact: 0, // NEEDS EDIT
    cboScoreUrl: "",
    congressUrl: "https://www.congress.gov/bill/119th-congress/senate-bill/434",
    lastAction: "Passed Senate with an amendment by Unanimous Consent. (text: CR S4493-4494)",
    lastActionDate: "2026-08-06",
  },
  {
    id: "s-3266-placeholder",
    congress: 119,
    title: "USMMA Athletics Act of 2026",
    shortTitle: "NEEDS EDIT", // NEEDS EDIT
    billNumber: "S. 3266",
    summary: "NEEDS EDIT — see https://www.congress.gov/bill/119th-congress/senate-bill/3266", // NEEDS EDIT
    status: "passed_senate",
    passageLikelihood: "high",
    champion: {
      name: "Sen. Wicker, Roger F. [R-MS]",
      party: "R",
      chamber: "senate",
      state: "MS",
      title: "Senator",
    },
    cosponsors: 1,
    bipartisan: false,
    impactedCategories: ["infrastructure"],
    spendingImpacts: [], // NEEDS EDIT
    totalAnnualImpact: 0, // NEEDS EDIT
    cboScoreUrl: "",
    congressUrl: "https://www.congress.gov/bill/119th-congress/senate-bill/3266",
    lastAction: "Passed Senate with an amendment by Unanimous Consent. (consideration: CR S4492-4493; text: CR S4492-4493)",
    lastActionDate: "2026-08-06",
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
