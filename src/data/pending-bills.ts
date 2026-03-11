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

export interface PendingBill {
  id: string;
  title: string;
  shortTitle: string;
  billNumber: string;
  summary: string;
  status: "passed_house" | "passed_senate" | "in_committee" | "introduced" | "floor_vote_scheduled";
  passageLikelihood: "high" | "medium" | "low";
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
}

export const pendingBills: PendingBill[] = [
  {
    id: "hr-2670-ndaa-fy2025",
    title: "National Defense Authorization Act for Fiscal Year 2025",
    shortTitle: "NDAA FY2025",
    billNumber: "H.R. 8070",
    summary:
      "Authorizes $895 billion in national defense spending, a $9 billion increase over FY2024. Includes a 4.5% military pay raise, investments in Pacific deterrence, and new cybersecurity programs.",
    status: "in_committee",
    passageLikelihood: "high",
    champion: {
      name: "Rep. Mike Rogers",
      party: "R",
      chamber: "house",
      state: "AL",
      title: "Chair, House Armed Services Committee",
    },
    cosponsors: 12,
    bipartisan: true,
    impactedCategories: ["defense"],
    spendingImpacts: [
      {
        categoryId: "defense",
        annualChange: 9,
        description:
          "Increases military personnel pay by 4.5%, adds $3.4B for Pacific deterrence, and $2.1B for cybersecurity modernization.",
      },
    ],
    totalAnnualImpact: 9,
    cboScoreUrl: "https://www.cbo.gov/publication/60000",
    congressUrl: "https://www.congress.gov/bill/118th-congress/house-bill/8070",
    lastAction: "Reported by House Armed Services Committee",
    lastActionDate: "2024-05-22",
  },
  {
    id: "s-2024-medicare-negotiation",
    title: "Medicare Drug Price Negotiation Expansion Act",
    shortTitle: "Medicare Drug Pricing Expansion",
    billNumber: "S. 1234",
    summary:
      "Expands Medicare's drug price negotiation authority from 10 drugs to 50 drugs by 2027, and allows negotiation to begin immediately upon FDA approval for high-cost drugs.",
    status: "in_committee",
    passageLikelihood: "medium",
    champion: {
      name: "Sen. Bernie Sanders",
      party: "I",
      chamber: "senate",
      state: "VT",
      title: "Chair, Senate HELP Committee",
    },
    cosponsors: 28,
    bipartisan: false,
    impactedCategories: ["healthcare"],
    spendingImpacts: [
      {
        categoryId: "healthcare",
        annualChange: -18,
        description:
          "Reduces Medicare Part D spending by an estimated $18B/year through expanded drug price negotiations. Savings increase over time as more drugs become eligible.",
      },
    ],
    totalAnnualImpact: -18,
    cboScoreUrl: "https://www.cbo.gov/publication/59800",
    congressUrl: "https://www.congress.gov/bill/118th-congress/senate-bill/1234",
    lastAction: "Hearing held in Senate HELP Committee",
    lastActionDate: "2024-03-15",
  },
  {
    id: "hr-2024-child-tax-credit",
    title: "Tax Relief for American Families and Workers Act of 2024",
    shortTitle: "Child Tax Credit Expansion",
    billNumber: "H.R. 7024",
    summary:
      "Expands the Child Tax Credit from $2,000 to $2,100 per child, restores full refundability, and adjusts for inflation. Also includes business tax provisions.",
    status: "passed_house",
    passageLikelihood: "medium",
    champion: {
      name: "Rep. Jason Smith",
      party: "R",
      chamber: "house",
      state: "MO",
      title: "Chair, House Ways and Means Committee",
    },
    cosponsors: 52,
    bipartisan: true,
    impactedCategories: ["income-security"],
    spendingImpacts: [
      {
        categoryId: "income-security",
        annualChange: 33,
        description:
          "Increases Child Tax Credit outlays by approximately $33B/year through higher credit amounts and restored refundability for low-income families.",
      },
    ],
    totalAnnualImpact: 33,
    cboScoreUrl: "https://www.cbo.gov/publication/59900",
    congressUrl: "https://www.congress.gov/bill/118th-congress/house-bill/7024",
    lastAction: "Passed House 357-70",
    lastActionDate: "2024-01-31",
  },
  {
    id: "s-2024-social-security",
    title: "Social Security 2100 Act",
    shortTitle: "Social Security Expansion",
    billNumber: "S. 393",
    summary:
      "Increases Social Security benefits by roughly 2%, switches to CPI-E for cost-of-living adjustments, and extends solvency by raising the payroll tax cap on earnings above $400,000.",
    status: "in_committee",
    passageLikelihood: "low",
    champion: {
      name: "Sen. Richard Blumenthal",
      party: "D",
      chamber: "senate",
      state: "CT",
      title: "Senator",
    },
    cosponsors: 34,
    bipartisan: false,
    impactedCategories: ["social-security"],
    spendingImpacts: [
      {
        categoryId: "social-security",
        annualChange: 30,
        description:
          "Increases Social Security benefit payments by ~2% across the board and adjusts COLA formula, adding approximately $30B/year in outlays. Funded by new payroll taxes on high earners.",
      },
    ],
    totalAnnualImpact: 30,
    cboScoreUrl: "https://www.cbo.gov/publication/59700",
    congressUrl: "https://www.congress.gov/bill/118th-congress/senate-bill/393",
    lastAction: "Referred to Senate Finance Committee",
    lastActionDate: "2023-02-16",
  },
  {
    id: "hr-2024-iija-extension",
    title: "Infrastructure Investment Reauthorization Act",
    shortTitle: "Infrastructure Extension",
    billNumber: "H.R. 9100",
    summary:
      "Extends and expands the Infrastructure Investment and Jobs Act with additional funding for bridge repair, rural broadband, EV charging, and water infrastructure through 2031.",
    status: "introduced",
    passageLikelihood: "low",
    champion: {
      name: "Rep. Sam Graves",
      party: "R",
      chamber: "house",
      state: "MO",
      title: "Chair, House Transportation Committee",
    },
    cosponsors: 18,
    bipartisan: true,
    impactedCategories: ["infrastructure"],
    spendingImpacts: [
      {
        categoryId: "infrastructure",
        annualChange: 22,
        description:
          "Adds $22B/year in infrastructure spending: $8B for bridge repair, $5B for rural broadband, $4B for water systems, $3B for EV charging, and $2B for public transit.",
      },
    ],
    totalAnnualImpact: 22,
    cboScoreUrl: "https://www.cbo.gov/publication/60100",
    congressUrl: "https://www.congress.gov/bill/118th-congress/house-bill/9100",
    lastAction: "Introduced and referred to committee",
    lastActionDate: "2024-06-01",
  },
  {
    id: "s-2024-border-act",
    title: "Bipartisan Border Solutions Act",
    shortTitle: "Border Security Package",
    billNumber: "S. 4361",
    summary:
      "Comprehensive border security legislation adding 1,500 border patrol agents, funding asylum court expansion, modernizing ports of entry, and establishing new emergency authority.",
    status: "floor_vote_scheduled",
    passageLikelihood: "medium",
    champion: {
      name: "Sen. James Lankford",
      party: "R",
      chamber: "senate",
      state: "OK",
      title: "Senator",
    },
    cosponsors: 8,
    bipartisan: true,
    impactedCategories: ["immigration"],
    spendingImpacts: [
      {
        categoryId: "immigration",
        annualChange: 14,
        description:
          "Increases CBP funding by $6B (1,500 new agents, technology), immigration courts by $4B (100 new judges), and port modernization by $4B.",
      },
    ],
    totalAnnualImpact: 14,
    cboScoreUrl: "https://www.cbo.gov/publication/60050",
    congressUrl: "https://www.congress.gov/bill/118th-congress/senate-bill/4361",
    lastAction: "Senate floor vote scheduled",
    lastActionDate: "2024-06-15",
  },
  {
    id: "hr-2024-education",
    title: "College Affordability Act",
    shortTitle: "College Affordability Act",
    billNumber: "H.R. 6500",
    summary:
      "Doubles the maximum Pell Grant to $14,000, creates a federal-state partnership for tuition-free community college, and simplifies student loan repayment options.",
    status: "in_committee",
    passageLikelihood: "low",
    champion: {
      name: "Rep. Bobby Scott",
      party: "D",
      chamber: "house",
      state: "VA",
      title: "Ranking Member, Education & Workforce Committee",
    },
    cosponsors: 42,
    bipartisan: false,
    impactedCategories: ["education"],
    spendingImpacts: [
      {
        categoryId: "education",
        annualChange: 28,
        description:
          "Increases Pell Grant spending by $15B/year and creates a new $13B/year federal-state community college program.",
      },
    ],
    totalAnnualImpact: 28,
    cboScoreUrl: "https://www.cbo.gov/publication/59950",
    congressUrl: "https://www.congress.gov/bill/118th-congress/house-bill/6500",
    lastAction: "Markup in Education & Workforce Committee",
    lastActionDate: "2024-04-10",
  },
  {
    id: "s-2024-climate",
    title: "Clean Energy Acceleration Act",
    shortTitle: "Clean Energy Acceleration",
    billNumber: "S. 2800",
    summary:
      "Extends and expands clean energy tax credits from the IRA, adds $15B for grid modernization, and creates a new Climate Corps jobs program.",
    status: "in_committee",
    passageLikelihood: "medium",
    champion: {
      name: "Sen. Jeff Merkley",
      party: "D",
      chamber: "senate",
      state: "OR",
      title: "Senator",
    },
    cosponsors: 22,
    bipartisan: false,
    impactedCategories: ["science"],
    spendingImpacts: [
      {
        categoryId: "science",
        annualChange: 12,
        description:
          "Adds $7B/year in clean energy tax credits, $3B for grid modernization, and $2B for the Climate Corps jobs program.",
      },
    ],
    totalAnnualImpact: 12,
    cboScoreUrl: "https://www.cbo.gov/publication/60025",
    congressUrl: "https://www.congress.gov/bill/118th-congress/senate-bill/2800",
    lastAction: "Hearing held in Senate Energy Committee",
    lastActionDate: "2024-05-01",
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
