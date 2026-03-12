import { describe, it, expect } from "vitest";
import { calculatePersonalSpending, calculateSubcategorySpending } from "./spending";
import { getBudgetData } from "@/data/budget";

const budgetData = getBudgetData(2025);

describe("calculatePersonalSpending", () => {
  it("returns all budget categories", () => {
    const result = calculatePersonalSpending(10000);
    expect(result.length).toBe(budgetData.length);
  });

  it("amounts sum to total federal tax", () => {
    const totalTax = 15000;
    const result = calculatePersonalSpending(totalTax);
    const sum = result.reduce((acc, item) => acc + item.amount, 0);
    expect(sum).toBeCloseTo(totalTax, 2);
  });

  it("percentages sum to 100", () => {
    const result = calculatePersonalSpending(10000);
    const sum = result.reduce((acc, item) => acc + item.percentage, 0);
    expect(sum).toBeCloseTo(100, 1);
  });

  it("is sorted by amount descending", () => {
    const result = calculatePersonalSpending(10000);
    for (let i = 1; i < result.length; i++) {
      expect(result[i].amount).toBeLessThanOrEqual(result[i - 1].amount);
    }
  });

  it("returns zero amounts for zero tax", () => {
    const result = calculatePersonalSpending(0);
    result.forEach((item) => {
      expect(item.amount).toBe(0);
    });
  });

  it("scales linearly with tax amount", () => {
    const result1 = calculatePersonalSpending(10000);
    const result2 = calculatePersonalSpending(20000);
    // Same category order, double the amounts
    for (let i = 0; i < result1.length; i++) {
      const match = result2.find((r) => r.category.id === result1[i].category.id)!;
      expect(match.amount).toBeCloseTo(result1[i].amount * 2, 2);
    }
  });
});

describe("calculateSubcategorySpending", () => {
  const category = budgetData[0]; // Use first category
  const categoryAmount = 5000;

  it("returns all subcategories for a category", () => {
    const result = calculateSubcategorySpending(categoryAmount, category);
    expect(result.length).toBe(category.subcategories.length);
  });

  it("subcategory amounts sum to category amount", () => {
    const result = calculateSubcategorySpending(categoryAmount, category);
    const sum = result.reduce((acc, item) => acc + item.amount, 0);
    expect(sum).toBeCloseTo(categoryAmount, 2);
  });

  it("subcategory percentages sum to 100", () => {
    const result = calculateSubcategorySpending(categoryAmount, category);
    const sum = result.reduce((acc, item) => acc + item.percentage, 0);
    expect(sum).toBeCloseTo(100, 1);
  });

  it("is sorted by amount descending", () => {
    const result = calculateSubcategorySpending(categoryAmount, category);
    for (let i = 1; i < result.length; i++) {
      expect(result[i].amount).toBeLessThanOrEqual(result[i - 1].amount);
    }
  });
});
