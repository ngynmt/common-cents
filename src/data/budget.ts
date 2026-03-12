/**
 * Federal budget spending data (FY 2024 & FY 2025)
 *
 * Source: OMB Historical Tables, CBO Budget & Economic Outlook
 * FY 2024 total: ~$6.75 trillion
 * FY 2025 total: ~$7.00 trillion (CBO Jan 2025 projection)
 *
 * Each category includes subcategories with agency/program-level detail.
 * Amounts are in billions of dollars.
 */

export interface BudgetSubcategory {
  name: string;
  amount: number; // billions
  description: string;
  agencies?: string[];
}

export interface BudgetCategory {
  id: string;
  name: string;
  amount: number; // billions (sum of subcategories)
  color: string;
  icon: string;
  description: string;
  subcategories: BudgetSubcategory[];
  legislation: Legislation[];
}

export interface Legislation {
  title: string;
  summary: string;
  status: "enacted" | "passed_house" | "passed_senate" | "in_committee" | "introduced";
  sponsors: string[];
  url: string;
  impact: string; // how it affects this spending category
}

import type { TaxYear } from "@/lib/tax";

export const TOTAL_FEDERAL_SPENDING: Record<TaxYear, number> = {
  2024: 6750,
  2025: 7000,
};

/**
 * FY2025 category amounts (billions). CBO January 2025 projections.
 * Key changes from FY2024:
 * - Interest: +$60B (higher rates, larger debt)
 * - Social Security: +$79B (2.5% COLA increase)
 * - Healthcare: +$79B (Medicare/Medicaid growth)
 * - Veterans: +$15B (PACT Act ramp-up)
 * - Defense: +$9B (NDAA FY2025 at $895B)
 */
const FY2025_AMOUNTS: Record<string, number> = {
  "social-security": 1540,
  "healthcare": 1810,
  "defense": 895,
  "interest": 952,
  "income-security": 660,
  "veterans": 190,
  "education": 265,
  "infrastructure": 175,
  "immigration": 68,
  "science": 75,
  "international": 65,
  "justice": 82,
  "agriculture": 42,
  "government": 181,
};

/**
 * FY2025 subcategory amounts. Scaled proportionally from FY2024 base,
 * with notable adjustments for known policy changes.
 */
const FY2025_SUBCATEGORY_OVERRIDES: Record<string, Record<string, number>> = {
  "social-security": {
    "Old-Age & Survivors Insurance (OASI)": 1297,
    "Disability Insurance (SSDI)": 156,
    "Supplemental Security Income (SSI)": 66,
    "Administration & Operations": 21,
  },
  "healthcare": {
    "Medicare": 916,
    "Medicaid": 645,
    "ACA Marketplace Subsidies": 115,
    "Veterans Health Administration": 112,
    "CHIP (Children's Health Insurance)": 15,
    "Other Health Programs": 7,
  },
  "interest": {
    "Interest on Treasury Securities": 898,
    "Other Interest": 54,
  },
  "defense": {
    "Military Personnel": 178,
    "Operations & Maintenance": 300,
    "Procurement": 170,
    "Research & Development": 114,
    "Military Construction & Housing": 18,
    "Nuclear Weapons Programs": 33,
    "Other Defense": 82,
  },
};

/** FY2024 budget data (base). */
const budgetData2024: BudgetCategory[] = [
  {
    id: "social-security",
    name: "Social Security",
    amount: 1461,
    color: "#6366f1", // indigo
    icon: "🏦",
    description:
      "Social Security provides retirement, disability, and survivor benefits to eligible Americans. It is the single largest federal program.",
    subcategories: [
      {
        name: "Old-Age & Survivors Insurance (OASI)",
        amount: 1230,
        description: "Monthly benefits for retirees and survivors of deceased workers.",
        agencies: ["Social Security Administration"],
      },
      {
        name: "Disability Insurance (SSDI)",
        amount: 148,
        description: "Benefits for workers who become disabled before retirement age.",
        agencies: ["Social Security Administration"],
      },
      {
        name: "Supplemental Security Income (SSI)",
        amount: 63,
        description: "Means-tested benefits for aged, blind, and disabled individuals with limited income.",
        agencies: ["Social Security Administration"],
      },
      {
        name: "Administration & Operations",
        amount: 20,
        description: "Operating costs for the Social Security Administration.",
        agencies: ["Social Security Administration"],
      },
    ],
    legislation: [
      {
        title: "Social Security Fairness Act of 2023",
        summary:
          "Repeals the Windfall Elimination Provision (WEP) and Government Pension Offset (GPO), which reduced Social Security benefits for public sector workers.",
        status: "enacted",
        sponsors: ["Rep. Garret Graves (R-LA)", "Rep. Abigail Spanberger (D-VA)"],
        url: "https://www.congress.gov/bill/118th-congress/house-bill/82",
        impact: "Increases Social Security payouts for affected public sector retirees.",
      },
    ],
  },
  {
    id: "healthcare",
    name: "Healthcare",
    amount: 1731,
    color: "#ec4899", // pink
    icon: "🏥",
    description:
      "Federal healthcare spending covers Medicare, Medicaid, CHIP, ACA marketplace subsidies, and veterans' health care.",
    subcategories: [
      {
        name: "Medicare",
        amount: 874,
        description:
          "Health insurance for Americans 65+ and certain younger people with disabilities.",
        agencies: ["Centers for Medicare & Medicaid Services (CMS)"],
      },
      {
        name: "Medicaid",
        amount: 616,
        description:
          "Joint federal-state program providing health coverage to low-income individuals and families.",
        agencies: ["Centers for Medicare & Medicaid Services (CMS)", "State Medicaid Agencies"],
      },
      {
        name: "ACA Marketplace Subsidies",
        amount: 110,
        description:
          "Premium tax credits and cost-sharing reductions for health insurance purchased through the ACA exchanges.",
        agencies: ["Centers for Medicare & Medicaid Services (CMS)", "IRS"],
      },
      {
        name: "Veterans Health Administration",
        amount: 106,
        description: "Healthcare services for eligible military veterans through the VA hospital system.",
        agencies: ["Department of Veterans Affairs"],
      },
      {
        name: "CHIP (Children's Health Insurance)",
        amount: 18,
        description:
          "Health coverage for children in families with incomes too high for Medicaid but who can't afford private coverage.",
        agencies: ["Centers for Medicare & Medicaid Services (CMS)"],
      },
      {
        name: "Other Health Programs",
        amount: 7,
        description: "NIH, CDC, FDA, and other public health agencies and programs.",
        agencies: ["NIH", "CDC", "FDA", "SAMHSA"],
      },
    ],
    legislation: [
      {
        title: "Inflation Reduction Act — Healthcare Provisions",
        summary:
          "Extended enhanced ACA premium subsidies through 2025, allowed Medicare to negotiate prices for certain prescription drugs.",
        status: "enacted",
        sponsors: ["Sen. Chuck Schumer (D-NY)", "Sen. Joe Manchin (D-WV)"],
        url: "https://www.congress.gov/bill/117th-congress/house-bill/5376",
        impact:
          "Increased ACA subsidy spending while projected to reduce Medicare drug costs over time.",
      },
    ],
  },
  {
    id: "defense",
    name: "Defense",
    amount: 886,
    color: "#ef4444", // red
    icon: "🛡️",
    description:
      "National defense spending covers military operations, personnel, weapons systems, and related programs across the Department of Defense and other agencies.",
    subcategories: [
      {
        name: "Military Personnel",
        amount: 176,
        description:
          "Pay, benefits, and housing for 1.3 million active duty service members.",
        agencies: ["Department of Defense"],
      },
      {
        name: "Operations & Maintenance",
        amount: 296,
        description:
          "Day-to-day military operations, training, equipment maintenance, and base operations.",
        agencies: ["Department of Defense"],
      },
      {
        name: "Procurement",
        amount: 168,
        description:
          "Purchasing weapons systems, vehicles, aircraft, ships, and other military equipment.",
        agencies: ["Department of Defense"],
      },
      {
        name: "Research & Development",
        amount: 112,
        description:
          "Development of new military technologies, weapons systems, and capabilities.",
        agencies: ["DARPA", "Department of Defense", "Military Service Labs"],
      },
      {
        name: "Military Construction & Housing",
        amount: 18,
        description: "Building and maintaining military bases, facilities, and family housing.",
        agencies: ["Army Corps of Engineers", "Department of Defense"],
      },
      {
        name: "Nuclear Weapons Programs",
        amount: 32,
        description:
          "Maintaining and modernizing the U.S. nuclear weapons stockpile.",
        agencies: ["National Nuclear Security Administration (NNSA)", "Department of Energy"],
      },
      {
        name: "Other Defense",
        amount: 84,
        description: "Intelligence agencies, defense-related activities in other departments.",
        agencies: ["CIA", "NSA", "DIA", "Defense Intelligence"],
      },
    ],
    legislation: [
      {
        title: "National Defense Authorization Act for FY 2024",
        summary:
          "Authorized $886 billion in defense spending, including a 5.2% military pay raise and investments in Pacific deterrence.",
        status: "enacted",
        sponsors: ["Rep. Mike Rogers (R-AL)", "Sen. Jack Reed (D-RI)"],
        url: "https://www.congress.gov/bill/118th-congress/house-bill/2670",
        impact: "Set the overall defense spending authorization for the fiscal year.",
      },
    ],
  },
  {
    id: "interest",
    name: "Interest on National Debt",
    amount: 892,
    color: "#f59e0b", // amber
    icon: "💳",
    description:
      "Interest payments on the $34+ trillion national debt. This is the fastest-growing category of federal spending.",
    subcategories: [
      {
        name: "Interest on Treasury Securities",
        amount: 840,
        description:
          "Interest paid to holders of Treasury bonds, notes, and bills — including foreign governments, domestic investors, and the Federal Reserve.",
        agencies: ["Department of the Treasury"],
      },
      {
        name: "Other Interest",
        amount: 52,
        description: "Interest on other federal borrowing and debt-related costs.",
        agencies: ["Department of the Treasury"],
      },
    ],
    legislation: [
      {
        title: "Fiscal Responsibility Act of 2023",
        summary:
          "Suspended the debt ceiling through January 2025, imposed caps on discretionary spending for FY 2024-2025.",
        status: "enacted",
        sponsors: ["Rep. Patrick McHenry (R-NC)", "Sen. Chuck Schumer (D-NY)"],
        url: "https://www.congress.gov/bill/118th-congress/house-bill/3746",
        impact:
          "Prevented a debt default but did not reduce the debt itself; interest costs continue to grow with rising rates.",
      },
    ],
  },
  {
    id: "income-security",
    name: "Income Security & Social Programs",
    amount: 671,
    color: "#8b5cf6", // violet
    icon: "🤝",
    description:
      "Programs that provide a safety net for Americans facing poverty, unemployment, food insecurity, and housing instability.",
    subcategories: [
      {
        name: "SNAP (Food Stamps)",
        amount: 113,
        description:
          "Supplemental Nutrition Assistance Program providing food purchasing assistance to low-income individuals and families.",
        agencies: ["USDA Food and Nutrition Service"],
      },
      {
        name: "Earned Income Tax Credit (EITC)",
        amount: 64,
        description:
          "Refundable tax credit for low-to-moderate income working individuals and families.",
        agencies: ["IRS"],
      },
      {
        name: "Child Tax Credit",
        amount: 122,
        description: "Tax credit for families with qualifying children.",
        agencies: ["IRS"],
      },
      {
        name: "Unemployment Compensation",
        amount: 37,
        description:
          "Federal share of unemployment insurance benefits for workers who lose their jobs.",
        agencies: ["Department of Labor"],
      },
      {
        name: "Housing Assistance",
        amount: 68,
        description:
          "Section 8 vouchers, public housing, and other rental assistance programs.",
        agencies: ["HUD (Department of Housing and Urban Development)"],
      },
      {
        name: "Federal Employee Retirement",
        amount: 173,
        description: "Retirement and disability benefits for federal civilian employees and military retirees.",
        agencies: ["OPM", "Department of Defense"],
      },
      {
        name: "Other Income Security",
        amount: 94,
        description:
          "TANF, WIC, school lunch programs, foster care, and other assistance programs.",
        agencies: ["USDA", "HHS", "State Agencies"],
      },
    ],
    legislation: [
      {
        title: "Farm Bill Reauthorization",
        summary:
          "Reauthorizes SNAP and other nutrition programs, sets agricultural policy and funding levels.",
        status: "in_committee",
        sponsors: ["Sen. Debbie Stabenow (D-MI)", "Rep. GT Thompson (R-PA)"],
        url: "https://www.congress.gov/bill/118th-congress/house-bill/8467",
        impact:
          "Determines SNAP benefit levels and eligibility rules for the next 5 years.",
      },
    ],
  },
  {
    id: "veterans",
    name: "Veterans Benefits",
    amount: 175,
    color: "#14b8a6", // teal
    icon: "🎖️",
    description:
      "Non-healthcare benefits for veterans including disability compensation, education benefits, and pensions.",
    subcategories: [
      {
        name: "Disability Compensation",
        amount: 120,
        description:
          "Monthly payments to veterans with service-connected disabilities.",
        agencies: ["Veterans Benefits Administration"],
      },
      {
        name: "Education Benefits (GI Bill)",
        amount: 13,
        description:
          "Tuition, housing, and book stipends for veterans and service members pursuing education.",
        agencies: ["Veterans Benefits Administration"],
      },
      {
        name: "Veterans Pensions",
        amount: 12,
        description:
          "Needs-based pension for wartime veterans with limited income.",
        agencies: ["Veterans Benefits Administration"],
      },
      {
        name: "Other Veterans Programs",
        amount: 30,
        description:
          "Vocational rehabilitation, home loan guarantees, life insurance, and burial benefits.",
        agencies: ["Veterans Benefits Administration", "National Cemetery Administration"],
      },
    ],
    legislation: [
      {
        title: "PACT Act (Promise to Address Comprehensive Toxics Act)",
        summary:
          "Expanded VA healthcare and benefits for veterans exposed to burn pits and other toxic substances during military service.",
        status: "enacted",
        sponsors: ["Sen. Jon Tester (D-MT)", "Rep. Mark Takano (D-CA)"],
        url: "https://www.congress.gov/bill/117th-congress/senate-bill/3373",
        impact:
          "Significantly expanded eligibility for VA disability benefits, adding ~$280B in projected spending over 10 years.",
      },
    ],
  },
  {
    id: "education",
    name: "Education",
    amount: 274,
    color: "#3b82f6", // blue
    icon: "🎓",
    description:
      "Federal spending on education includes student financial aid, K-12 grants, Head Start, and research.",
    subcategories: [
      {
        name: "Student Financial Aid (Pell Grants)",
        amount: 28,
        description:
          "Need-based grants for low-income undergraduate students.",
        agencies: ["Department of Education"],
      },
      {
        name: "Student Loan Programs",
        amount: 173,
        description:
          "Federal student loan originations, subsidies, and income-driven repayment plan costs.",
        agencies: ["Department of Education", "Federal Student Aid"],
      },
      {
        name: "K-12 Education Grants (Title I, IDEA)",
        amount: 42,
        description:
          "Federal grants to states for disadvantaged students and special education.",
        agencies: ["Department of Education"],
      },
      {
        name: "Head Start & Early Childhood",
        amount: 12,
        description:
          "Preschool and early childhood development programs for low-income families.",
        agencies: ["HHS Administration for Children and Families"],
      },
      {
        name: "Research & Other Education",
        amount: 19,
        description:
          "NSF education programs, Department of Education research, and other education initiatives.",
        agencies: ["NSF", "Department of Education"],
      },
    ],
    legislation: [
      {
        title: "SAVE Plan (Student Loan Repayment)",
        summary:
          "New income-driven repayment plan that caps payments at 5% of discretionary income for undergraduate loans and provides faster forgiveness.",
        status: "enacted",
        sponsors: ["Department of Education (Executive Action)"],
        url: "https://studentaid.gov/save-plan",
        impact:
          "Projected to increase federal student loan costs by reducing payments collected.",
      },
    ],
  },
  {
    id: "infrastructure",
    name: "Infrastructure & Transportation",
    amount: 165,
    color: "#f97316", // orange
    icon: "🏗️",
    description:
      "Federal investment in roads, bridges, public transit, broadband, water systems, and energy infrastructure.",
    subcategories: [
      {
        name: "Highways & Roads",
        amount: 62,
        description:
          "Federal Highway Administration grants to states for highway construction and maintenance.",
        agencies: ["Federal Highway Administration", "Department of Transportation"],
      },
      {
        name: "Public Transit",
        amount: 18,
        description:
          "Federal Transit Administration grants for bus, rail, and other public transit systems.",
        agencies: ["Federal Transit Administration"],
      },
      {
        name: "Aviation (FAA)",
        amount: 20,
        description:
          "Air traffic control, airport improvements, and aviation safety.",
        agencies: ["Federal Aviation Administration"],
      },
      {
        name: "Water Infrastructure",
        amount: 16,
        description:
          "Clean water and drinking water systems, flood control, and water resource management.",
        agencies: ["EPA", "Army Corps of Engineers"],
      },
      {
        name: "Broadband & Digital",
        amount: 12,
        description:
          "Expanding broadband internet access to underserved communities.",
        agencies: ["NTIA", "FCC", "USDA Rural Utilities Service"],
      },
      {
        name: "Energy Infrastructure",
        amount: 22,
        description:
          "Power grid modernization, clean energy deployment, and energy efficiency programs.",
        agencies: ["Department of Energy"],
      },
      {
        name: "Other Infrastructure",
        amount: 15,
        description:
          "Rail (Amtrak), ports, waterways, and other infrastructure investments.",
        agencies: ["Amtrak", "Maritime Administration", "Army Corps of Engineers"],
      },
    ],
    legislation: [
      {
        title: "Infrastructure Investment and Jobs Act (IIJA)",
        summary:
          "Authorized $1.2 trillion in infrastructure spending over 5 years, including $550B in new federal investment in roads, bridges, broadband, and water.",
        status: "enacted",
        sponsors: ["Sen. Rob Portman (R-OH)", "Sen. Kyrsten Sinema (I-AZ)"],
        url: "https://www.congress.gov/bill/117th-congress/house-bill/3684",
        impact:
          "Significantly increased annual infrastructure spending across all subcategories through FY 2026.",
      },
    ],
  },
  {
    id: "immigration",
    name: "Immigration & Border Security",
    amount: 62,
    color: "#10b981", // emerald
    icon: "🌐",
    description:
      "Federal spending on border security, immigration enforcement, immigration courts, and refugee resettlement.",
    subcategories: [
      {
        name: "Customs & Border Protection (CBP)",
        amount: 22,
        description:
          "Border patrol agents, ports of entry, border wall maintenance, and surveillance technology.",
        agencies: ["CBP (Department of Homeland Security)"],
      },
      {
        name: "Immigration & Customs Enforcement (ICE)",
        amount: 10,
        description:
          "Interior immigration enforcement, detention facilities, and deportation operations.",
        agencies: ["ICE (Department of Homeland Security)"],
      },
      {
        name: "USCIS (Immigration Services)",
        amount: 5,
        description:
          "Processing immigration applications, naturalization, and asylum claims. Largely fee-funded.",
        agencies: ["USCIS (Department of Homeland Security)"],
      },
      {
        name: "Immigration Courts",
        amount: 4,
        description:
          "Executive Office for Immigration Review — handles deportation and asylum proceedings.",
        agencies: ["Department of Justice"],
      },
      {
        name: "Refugee & Asylum Programs",
        amount: 7,
        description:
          "Refugee resettlement, asylum seeker services, and unaccompanied minor care.",
        agencies: ["HHS Office of Refugee Resettlement", "State Department"],
      },
      {
        name: "Other Immigration",
        amount: 14,
        description:
          "E-Verify, immigration-related state grants, visa processing, and other programs.",
        agencies: ["DHS", "State Department", "Department of Labor"],
      },
    ],
    legislation: [
      {
        title: "DHS Appropriations Act, FY 2024",
        summary:
          "Funded the Department of Homeland Security including CBP, ICE, and border security operations.",
        status: "enacted",
        sponsors: ["Rep. David Joyce (R-OH)"],
        url: "https://www.congress.gov/bill/118th-congress/house-bill/4367",
        impact:
          "Set funding levels for all immigration-related agencies for the fiscal year.",
      },
    ],
  },
  {
    id: "science",
    name: "Science, Energy & Environment",
    amount: 72,
    color: "#22c55e", // green
    icon: "🔬",
    description:
      "Federal investment in scientific research, space exploration, environmental protection, and clean energy.",
    subcategories: [
      {
        name: "NASA",
        amount: 26,
        description:
          "Space exploration, Artemis program, James Webb Space Telescope operations, and aeronautics research.",
        agencies: ["NASA"],
      },
      {
        name: "National Science Foundation (NSF)",
        amount: 10,
        description:
          "Fundamental research grants across all scientific disciplines.",
        agencies: ["NSF"],
      },
      {
        name: "Environmental Protection (EPA)",
        amount: 12,
        description:
          "Clean air and water enforcement, Superfund cleanups, and environmental research.",
        agencies: ["EPA"],
      },
      {
        name: "Department of Energy — Science",
        amount: 9,
        description:
          "National laboratories, particle physics, fusion research, and basic energy science.",
        agencies: ["DOE Office of Science"],
      },
      {
        name: "Clean Energy & Climate",
        amount: 15,
        description:
          "Clean energy tax credits, emissions reduction programs, and climate research (IRA funding).",
        agencies: ["DOE", "EPA", "NOAA"],
      },
    ],
    legislation: [
      {
        title: "CHIPS and Science Act",
        summary:
          "Authorized $280B for domestic semiconductor manufacturing and scientific research, including significant increases for NSF.",
        status: "enacted",
        sponsors: ["Sen. Todd Young (R-IN)", "Sen. Chuck Schumer (D-NY)"],
        url: "https://www.congress.gov/bill/117th-congress/house-bill/4346",
        impact:
          "Boosted science research authorizations, though annual appropriations still determine actual spending.",
      },
    ],
  },
  {
    id: "international",
    name: "International Affairs",
    amount: 73,
    color: "#a855f7", // purple
    icon: "🌍",
    description:
      "Foreign aid, diplomatic operations, international development, and global health programs.",
    subcategories: [
      {
        name: "Foreign Aid & Development (USAID)",
        amount: 30,
        description:
          "Economic development, humanitarian assistance, and disaster relief in developing countries.",
        agencies: ["USAID", "State Department"],
      },
      {
        name: "Diplomatic Operations",
        amount: 17,
        description:
          "Embassy operations, diplomatic security, and consular services worldwide.",
        agencies: ["State Department"],
      },
      {
        name: "Military & Security Assistance",
        amount: 14,
        description:
          "Foreign military financing, security cooperation, and international peacekeeping.",
        agencies: ["State Department", "Department of Defense"],
      },
      {
        name: "Global Health (PEPFAR, etc.)",
        amount: 12,
        description:
          "HIV/AIDS relief, malaria prevention, global health security, and pandemic preparedness.",
        agencies: ["State Department", "USAID", "CDC"],
      },
    ],
    legislation: [
      {
        title: "Ukraine Security Supplemental Appropriations",
        summary:
          "Provided military and economic assistance to Ukraine as part of broader national security supplemental.",
        status: "enacted",
        sponsors: ["Sen. Patty Murray (D-WA)", "Rep. Kay Granger (R-TX)"],
        url: "https://www.congress.gov/bill/118th-congress/house-bill/815",
        impact:
          "Added significant one-time spending for military aid and economic support to Ukraine.",
      },
    ],
  },
  {
    id: "justice",
    name: "Justice & Law Enforcement",
    amount: 78,
    color: "#64748b", // slate
    icon: "⚖️",
    description:
      "Federal spending on law enforcement, the federal court system, prisons, and justice programs.",
    subcategories: [
      {
        name: "FBI",
        amount: 11,
        description:
          "Federal criminal investigations, counterterrorism, and counterintelligence.",
        agencies: ["FBI (Department of Justice)"],
      },
      {
        name: "Federal Prisons (BOP)",
        amount: 9,
        description:
          "Operation of the federal prison system housing ~155,000 inmates.",
        agencies: ["Bureau of Prisons (Department of Justice)"],
      },
      {
        name: "DEA",
        amount: 3,
        description:
          "Drug enforcement operations and combating drug trafficking.",
        agencies: ["DEA (Department of Justice)"],
      },
      {
        name: "Federal Courts",
        amount: 9,
        description:
          "Operation of the federal court system including the Supreme Court, appeals courts, and district courts.",
        agencies: ["Administrative Office of the U.S. Courts"],
      },
      {
        name: "ATF, Marshals & Other DOJ",
        amount: 14,
        description:
          "Bureau of Alcohol, Tobacco, Firearms and Explosives, U.S. Marshals Service, and other DOJ components.",
        agencies: ["ATF", "U.S. Marshals Service", "Department of Justice"],
      },
      {
        name: "State & Local Law Enforcement Grants",
        amount: 5,
        description:
          "Federal grants to state and local police, community policing programs, and violence prevention.",
        agencies: ["DOJ Office of Justice Programs"],
      },
      {
        name: "Other Justice",
        amount: 27,
        description:
          "Secret Service, cybersecurity, other federal law enforcement and justice programs.",
        agencies: ["Secret Service", "DHS", "Department of Justice"],
      },
    ],
    legislation: [
      {
        title: "Bipartisan Safer Communities Act",
        summary:
          "Enhanced background checks for gun buyers under 21, funded mental health programs and school safety, and closed the 'boyfriend loophole'.",
        status: "enacted",
        sponsors: ["Sen. Chris Murphy (D-CT)", "Sen. John Cornyn (R-TX)"],
        url: "https://www.congress.gov/bill/117th-congress/senate-bill/2938",
        impact: "Increased funding for school safety, mental health services, and crisis intervention programs.",
      },
    ],
  },
  {
    id: "agriculture",
    name: "Agriculture",
    amount: 46,
    color: "#84cc16", // lime
    icon: "🌾",
    description:
      "Federal farm subsidies, crop insurance, agricultural research, and rural development (excluding SNAP, which is in Social Programs).",
    subcategories: [
      {
        name: "Crop Insurance",
        amount: 18,
        description: "Federal subsidies for crop insurance premiums to protect farmers from losses.",
        agencies: ["USDA Risk Management Agency"],
      },
      {
        name: "Farm Commodity Programs",
        amount: 12,
        description: "Price supports, marketing loans, and direct payments to agricultural producers.",
        agencies: ["USDA Farm Service Agency"],
      },
      {
        name: "Agricultural Research",
        amount: 4,
        description: "Research into crop science, animal health, food safety, and sustainable agriculture.",
        agencies: ["USDA Agricultural Research Service", "Land-Grant Universities"],
      },
      {
        name: "Rural Development",
        amount: 7,
        description: "Loans and grants for rural housing, utilities, and economic development.",
        agencies: ["USDA Rural Development"],
      },
      {
        name: "Other Agriculture",
        amount: 5,
        description: "Forest Service, conservation programs, and other USDA activities.",
        agencies: ["USDA Forest Service", "Natural Resources Conservation Service"],
      },
    ],
    legislation: [
      {
        title: "Farm Bill (Agricultural Improvement Act)",
        summary:
          "Omnibus legislation reauthorizing farm subsidies, crop insurance, conservation, and agricultural programs every 5 years.",
        status: "in_committee",
        sponsors: ["Sen. Debbie Stabenow (D-MI)", "Rep. GT Thompson (R-PA)"],
        url: "https://www.congress.gov/bill/118th-congress/house-bill/8467",
        impact: "Sets farm subsidy levels and program structures for the next 5 years.",
      },
    ],
  },
  {
    id: "government",
    name: "General Government",
    amount: 164,
    color: "#78716c", // stone
    icon: "🏛️",
    description:
      "Costs of running the federal government — Congress, the White House, IRS, GSA, and other administrative functions.",
    subcategories: [
      {
        name: "IRS & Tax Collection",
        amount: 14,
        description:
          "Tax administration, enforcement, and taxpayer services.",
        agencies: ["Internal Revenue Service"],
      },
      {
        name: "Congress",
        amount: 6,
        description:
          "Operating costs for the House, Senate, Capitol Police, Library of Congress, CBO, and GAO.",
        agencies: ["U.S. Congress"],
      },
      {
        name: "Executive Office of the President",
        amount: 1,
        description:
          "White House operations, OMB, Council of Economic Advisers, and NSC.",
        agencies: ["Executive Office of the President"],
      },
      {
        name: "Federal Buildings & Property (GSA)",
        amount: 12,
        description:
          "Managing and maintaining federal buildings and property.",
        agencies: ["General Services Administration"],
      },
      {
        name: "Other Government Operations",
        amount: 131,
        description:
          "OPM, Treasury operations, regulatory agencies, and miscellaneous government functions.",
        agencies: ["OPM", "Treasury", "Various Independent Agencies"],
      },
    ],
    legislation: [
      {
        title: "IRS Funding (Inflation Reduction Act)",
        summary:
          "Provided $80B in additional IRS funding over 10 years for enforcement, technology modernization, and taxpayer services.",
        status: "enacted",
        sponsors: ["Sen. Chuck Schumer (D-NY)"],
        url: "https://www.congress.gov/bill/117th-congress/house-bill/5376",
        impact:
          "Significantly increased IRS budget for tax enforcement and IT modernization, though some funding was subsequently rescinded.",
      },
    ],
  },
];

/**
 * Generate FY2025 budget data by adjusting FY2024 amounts.
 * Subcategory amounts are scaled proportionally unless overridden.
 */
function generateFY2025Data(): BudgetCategory[] {
  return budgetData2024.map((category) => {
    const newAmount = FY2025_AMOUNTS[category.id] ?? category.amount;
    const ratio = newAmount / category.amount;
    const subOverrides = FY2025_SUBCATEGORY_OVERRIDES[category.id];

    return {
      ...category,
      amount: newAmount,
      subcategories: category.subcategories.map((sub) => ({
        ...sub,
        amount: subOverrides?.[sub.name] ?? Math.round(sub.amount * ratio),
      })),
    };
  });
}

const budgetData2025 = generateFY2025Data();

/**
 * Get budget data for a specific fiscal year.
 */
export function getBudgetData(year: TaxYear = 2025): BudgetCategory[] {
  return year === 2024 ? budgetData2024 : budgetData2025;
}

/** @deprecated Use getBudgetData(year) instead */
export const budgetData = budgetData2024;
