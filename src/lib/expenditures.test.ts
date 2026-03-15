import { describe, it, expect } from "vitest";
import { agencyToCategory, CATEGORY_LABELS, calculatePersonalCost, calculateBillPersonalCost } from "./expenditures";
import type { PendingBill } from "@/data/pending-bills";

describe("agencyToCategory", () => {
  it("maps known agencies exactly", () => {
    expect(agencyToCategory("Department of Defense")).toBe("defense");
    expect(agencyToCategory("Department of Health and Human Services")).toBe("healthcare");
    expect(agencyToCategory("Social Security Administration")).toBe("social-security");
    expect(agencyToCategory("Department of Veterans Affairs")).toBe("veterans");
    expect(agencyToCategory("National Aeronautics and Space Administration")).toBe("science");
    expect(agencyToCategory("Department of the Army")).toBe("defense");
  });

  it("matches partial agency names via substring", () => {
    // USASpending sometimes appends qualifiers to agency names
    expect(agencyToCategory("Department of Defense - Military")).toBe("defense");
    expect(agencyToCategory("Department of Health and Human Services (HHS)")).toBe("healthcare");
  });

  it("falls back to government for unknown agencies", () => {
    expect(agencyToCategory("Unknown Agency")).toBe("government");
    expect(agencyToCategory("Some Random Organization")).toBe("government");
  });
});

describe("CATEGORY_LABELS", () => {
  it("has labels for all common category IDs", () => {
    const expectedIds = [
      "defense", "healthcare", "social-security", "income-security",
      "infrastructure", "immigration", "education", "science",
      "veterans", "interest", "international", "justice",
      "agriculture", "government",
    ];
    for (const id of expectedIds) {
      expect(CATEGORY_LABELS[id]).toBeDefined();
      expect(typeof CATEGORY_LABELS[id]).toBe("string");
    }
  });
});

describe("calculatePersonalCost", () => {
  it("calculates proportional cost", () => {
    // $1B expenditure, $10K federal tax, ~$4.9T total revenue
    const cost = calculatePersonalCost(1e9, 10_000);
    // Expected: (1e9 / 4.9e12) * 10000 ≈ $2.04
    expect(cost).toBeGreaterThan(1);
    expect(cost).toBeLessThan(5);
  });

  it("returns 0 for zero tax", () => {
    expect(calculatePersonalCost(1e9, 0)).toBe(0);
  });

  it("returns 0 for negative tax", () => {
    expect(calculatePersonalCost(1e9, -100)).toBe(0);
  });

  it("scales linearly with expenditure amount", () => {
    const small = calculatePersonalCost(1e9, 10_000);
    const large = calculatePersonalCost(2e9, 10_000);
    expect(large).toBeCloseTo(small * 2, 5);
  });

  it("scales linearly with user tax", () => {
    const low = calculatePersonalCost(1e9, 5_000);
    const high = calculatePersonalCost(1e9, 10_000);
    expect(high).toBeCloseTo(low * 2, 5);
  });
});

describe("calculateBillPersonalCost", () => {
  it("converts bill totalAnnualImpact from billions to dollars", () => {
    const bill = { totalAnnualImpact: 10 } as PendingBill; // $10B
    const cost = calculateBillPersonalCost(bill, 10_000);
    // Should be equivalent to calculatePersonalCost(10e9, 10_000)
    const directCost = calculatePersonalCost(10e9, 10_000);
    expect(cost).toBeCloseTo(directCost, 5);
  });

  it("uses absolute value of negative impacts", () => {
    const bill = { totalAnnualImpact: -20 } as PendingBill; // -$20B (savings)
    const cost = calculateBillPersonalCost(bill, 10_000);
    expect(cost).toBeGreaterThan(0);
  });
});
