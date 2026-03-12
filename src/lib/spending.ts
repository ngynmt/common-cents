/**
 * Calculates how a user's federal taxes are distributed across spending categories.
 *
 * Uses the proportion of each category's spending relative to total federal spending
 * to estimate how much of the user's taxes go to each category.
 */

import { getBudgetData, TOTAL_FEDERAL_SPENDING, type BudgetCategory, type BudgetSubcategory } from "@/data/budget";
import type { TaxYear } from "@/lib/tax";

export interface PersonalSpendingCategory {
  category: BudgetCategory;
  amount: number; // user's dollars going to this category
  percentage: number; // percentage of user's total tax
}

export interface PersonalSpendingSubcategory {
  subcategory: BudgetSubcategory;
  amount: number;
  percentage: number; // percentage of parent category
}

/**
 * Calculate how the user's total federal tax is distributed across spending categories.
 */
export function calculatePersonalSpending(
  totalFederalTax: number,
  taxYear: TaxYear = 2025,
): PersonalSpendingCategory[] {
  const data = getBudgetData(taxYear);
  const totalSpending = TOTAL_FEDERAL_SPENDING[taxYear];

  return data
    .map((category) => {
      const proportion = category.amount / totalSpending;
      return {
        category,
        amount: totalFederalTax * proportion,
        percentage: proportion * 100,
      };
    })
    .sort((a, b) => b.amount - a.amount);
}

/**
 * Calculate the user's spending on subcategories within a given category.
 */
export function calculateSubcategorySpending(
  categoryAmount: number,
  category: BudgetCategory
): PersonalSpendingSubcategory[] {
  const categoryTotal = category.subcategories.reduce((sum, sub) => sum + sub.amount, 0);

  return category.subcategories
    .map((subcategory) => {
      const proportion = subcategory.amount / categoryTotal;
      return {
        subcategory,
        amount: categoryAmount * proportion,
        percentage: proportion * 100,
      };
    })
    .sort((a, b) => b.amount - a.amount);
}
