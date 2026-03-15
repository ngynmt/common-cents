/**
 * Utilities for the Recent Expenditures feature.
 *
 * Provides:
 * - FederalContract type for USASpending.gov awards
 * - Agency → budget category mapping
 * - Personal cost calculation for any expenditure amount
 * - Unified RecentExpenditure discriminated union
 */

import type { PendingBill } from "@/data/pending-bills";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FederalContract {
  id: string;
  awardId: string;
  recipientName: string;
  description: string;
  amount: number; // dollars
  awardingAgency: string;
  categoryId: string; // mapped from agency
  startDate: string; // ISO date
  url: string; // USASpending award page
}

export type RecentExpenditure =
  | { type: "bill"; data: PendingBill }
  | { type: "contract"; data: FederalContract };

// ---------------------------------------------------------------------------
// Agency → Category mapping
// ---------------------------------------------------------------------------

/**
 * Maps top-tier federal agency names (as returned by USASpending.gov) to our
 * 14 budget category IDs. Agencies that span multiple categories use the
 * primary mapping.
 */
const AGENCY_CATEGORY_MAP: Record<string, string> = {
  "Department of Defense": "defense",
  "Department of the Army": "defense",
  "Department of the Navy": "defense",
  "Department of the Air Force": "defense",
  "Department of Health and Human Services": "healthcare",
  "Department of the Treasury": "interest",
  "Social Security Administration": "social-security",
  "Department of Veterans Affairs": "veterans",
  "Department of Homeland Security": "immigration",
  "Department of Education": "education",
  "Department of Agriculture": "agriculture",
  "Department of Transportation": "infrastructure",
  "Department of Energy": "science",
  "Department of Housing and Urban Development": "income-security",
  "Department of Justice": "justice",
  "Department of State": "international",
  "Department of the Interior": "government",
  "Department of Commerce": "government",
  "Department of Labor": "income-security",
  "National Aeronautics and Space Administration": "science",
  "Environmental Protection Agency": "science",
  "National Science Foundation": "science",
  "General Services Administration": "government",
  "Office of Personnel Management": "government",
  "Small Business Administration": "government",
  "Corps of Engineers - Civil Works": "infrastructure",
};

/**
 * Look up the budget category for a given agency name.
 * Falls back to "government" for unknown agencies.
 */
export function agencyToCategory(agencyName: string): string {
  // Try exact match first
  if (AGENCY_CATEGORY_MAP[agencyName]) {
    return AGENCY_CATEGORY_MAP[agencyName];
  }
  // Try partial match (agency names vary slightly in USASpending responses)
  const lower = agencyName.toLowerCase();
  for (const [key, value] of Object.entries(AGENCY_CATEGORY_MAP)) {
    if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) {
      return value;
    }
  }
  return "government";
}

// ---------------------------------------------------------------------------
// Category display labels
// ---------------------------------------------------------------------------

/**
 * Human-readable labels for budget category IDs.
 * Must match the `name` field in `data/budget.ts` categories.
 */
export const CATEGORY_LABELS: Record<string, string> = {
  defense: "Defense",
  healthcare: "Healthcare",
  "social-security": "Social Security",
  "income-security": "Income Security & Social Programs",
  infrastructure: "Infrastructure & Transportation",
  immigration: "Immigration & Border Security",
  education: "Education",
  science: "Science, Energy & Environment",
  veterans: "Veterans Benefits",
  interest: "Interest on National Debt",
  international: "International Affairs",
  justice: "Justice & Law Enforcement",
  agriculture: "Agriculture",
  government: "General Government",
};

// ---------------------------------------------------------------------------
// Personal cost calculation
// ---------------------------------------------------------------------------

/**
 * Estimated total federal revenue for FY 2025 (in dollars).
 * Source: CBO Budget & Economic Outlook, January 2025.
 */
const TOTAL_FEDERAL_REVENUE = 4.9e12; // ~$4.9 trillion

/**
 * Calculate how much a given expenditure costs the user personally,
 * proportional to their share of federal tax revenue.
 *
 * personalCost = (expenditureAmount / totalFederalRevenue) × userFederalTax
 */
export function calculatePersonalCost(
  expenditureAmount: number,
  userFederalTax: number,
): number {
  if (TOTAL_FEDERAL_REVENUE <= 0 || userFederalTax <= 0) return 0;
  return (expenditureAmount / TOTAL_FEDERAL_REVENUE) * userFederalTax;
}

/**
 * Calculate personal cost for a bill using its totalAnnualImpact (in billions).
 */
export function calculateBillPersonalCost(
  bill: PendingBill,
  userFederalTax: number,
): number {
  return calculatePersonalCost(
    Math.abs(bill.totalAnnualImpact) * 1e9,
    userFederalTax,
  );
}
