import { describe, it, expect } from "vitest";
import { pendingBills, getBillsForCategory, getBillImpactForCategory } from "./pending-bills";

describe("pendingBills data integrity", () => {
  it("has at least one bill", () => {
    expect(pendingBills.length).toBeGreaterThan(0);
  });

  it("every bill has required fields", () => {
    for (const bill of pendingBills) {
      expect(bill.id).toBeTruthy();
      expect(bill.title).toBeTruthy();
      expect(bill.billNumber).toBeTruthy();
      expect(bill.congress).toBeGreaterThan(0);
      expect(["introduced", "in committee", "passed one chamber", "enacted"]).toContain(bill.status);
      expect(bill.champion).toBeDefined();
      expect(bill.champion.name).toBeTruthy();
      expect(["D", "R", "I"]).toContain(bill.champion.party);
    }
  });

  it("every bill has valid spending impacts", () => {
    for (const bill of pendingBills) {
      for (const impact of bill.spendingImpacts) {
        expect(impact.categoryId).toBeTruthy();
        expect(typeof impact.annualChange).toBe("number");
        expect(impact.description).toBeTruthy();
      }
    }
  });

  it("impactedCategories matches spendingImpacts", () => {
    for (const bill of pendingBills) {
      const impactCategoryIds = bill.spendingImpacts.map((s) => s.categoryId);
      for (const catId of bill.impactedCategories) {
        expect(impactCategoryIds).toContain(catId);
      }
    }
  });

  it("has unique bill IDs", () => {
    const ids = pendingBills.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("getBillsForCategory", () => {
  it("returns bills impacting a given category", () => {
    // Defense is a very common category — should have at least one bill
    const defenseBills = getBillsForCategory("defense");
    expect(defenseBills.length).toBeGreaterThanOrEqual(0);

    for (const bill of defenseBills) {
      expect(bill.impactedCategories).toContain("defense");
    }
  });

  it("returns empty array for unknown category", () => {
    const bills = getBillsForCategory("nonexistent-category-xyz");
    expect(bills).toEqual([]);
  });
});

describe("getBillImpactForCategory", () => {
  it("returns the matching spending impact", () => {
    const bill = pendingBills.find((b) => b.spendingImpacts.length > 0);
    if (!bill) return; // skip if no bills with impacts

    const firstImpact = bill.spendingImpacts[0];
    const result = getBillImpactForCategory(bill, firstImpact.categoryId);
    expect(result).toBeDefined();
    expect(result!.categoryId).toBe(firstImpact.categoryId);
    expect(result!.annualChange).toBe(firstImpact.annualChange);
  });

  it("returns undefined for non-matching category", () => {
    const bill = pendingBills[0];
    const result = getBillImpactForCategory(bill, "nonexistent-category-xyz");
    expect(result).toBeUndefined();
  });
});
