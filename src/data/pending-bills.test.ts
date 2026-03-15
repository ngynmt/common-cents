import { describe, it, expect } from "vitest";
import {
  pendingBills,
  landmarkBills,
  getBillsForCategory,
  getBillImpactForCategory,
  type BillStatus,
  type PassageLikelihood,
  type PendingBill,
} from "./pending-bills";

const VALID_STATUSES: BillStatus[] = [
  "passed_house",
  "passed_senate",
  "in_committee",
  "introduced",
  "floor_vote_scheduled",
  "enacted",
];

const VALID_LIKELIHOODS: PassageLikelihood[] = ["high", "medium", "low", "enacted"];

/** Shared validation for any bill (pending or landmark) */
function validateBill(bill: PendingBill) {
  expect(bill.id).toBeTruthy();
  expect(bill.title).toBeTruthy();
  expect(bill.billNumber).toBeTruthy();
  expect(bill.congress).toBeGreaterThan(0);
  expect(VALID_STATUSES).toContain(bill.status);
  expect(VALID_LIKELIHOODS).toContain(bill.passageLikelihood);
  expect(bill.champion).toBeDefined();
  expect(bill.champion.name).toBeTruthy();
  expect(["D", "R", "I"]).toContain(bill.champion.party);
  expect(["house", "senate"]).toContain(bill.champion.chamber);

  for (const impact of bill.spendingImpacts) {
    expect(impact.categoryId).toBeTruthy();
    expect(typeof impact.annualChange).toBe("number");
    expect(impact.description).toBeTruthy();
  }

  const impactCategoryIds = bill.spendingImpacts.map((s) => s.categoryId);
  for (const catId of bill.impactedCategories) {
    expect(impactCategoryIds).toContain(catId);
  }
}

describe("pendingBills data integrity", () => {
  it("has at least one bill", () => {
    expect(pendingBills.length).toBeGreaterThan(0);
  });

  it("every bill has required fields and valid values", () => {
    for (const bill of pendingBills) {
      validateBill(bill);
    }
  });

  it("has unique bill IDs", () => {
    const ids = pendingBills.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("no pending bill has enacted status", () => {
    for (const bill of pendingBills) {
      expect(bill.status).not.toBe("enacted");
    }
  });
});

describe("landmarkBills data integrity", () => {
  it("has at least one landmark bill", () => {
    expect(landmarkBills.length).toBeGreaterThan(0);
  });

  it("every landmark bill has required fields and valid values", () => {
    for (const bill of landmarkBills) {
      validateBill(bill);
    }
  });

  it("all landmark bills are enacted", () => {
    for (const bill of landmarkBills) {
      expect(bill.status).toBe("enacted");
      expect(bill.passageLikelihood).toBe("enacted");
      expect(bill.enactedDate).toBeTruthy();
      expect(bill.publicLawNumber).toBeTruthy();
    }
  });

  it("landmark bill IDs are unique and don't collide with pending bills", () => {
    const allIds = [
      ...landmarkBills.map((b) => b.id),
      ...pendingBills.map((b) => b.id),
    ];
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it("OBBBA has multi-category spending impacts", () => {
    const obbba = landmarkBills.find((b) => b.id === "hr-1-obbba-119");
    expect(obbba).toBeDefined();
    expect(obbba!.spendingImpacts.length).toBeGreaterThanOrEqual(5);
    expect(obbba!.impactedCategories.length).toBeGreaterThanOrEqual(5);
  });

  it("OBBBA has deficit impact", () => {
    const obbba = landmarkBills.find((b) => b.id === "hr-1-obbba-119");
    expect(obbba).toBeDefined();
    expect(obbba!.deficitImpact).toBeDefined();
    expect(obbba!.deficitImpact).toBeGreaterThan(0);
  });

  it("OBBBA totalAnnualImpact is net negative (spending cuts)", () => {
    const obbba = landmarkBills.find((b) => b.id === "hr-1-obbba-119");
    expect(obbba).toBeDefined();
    expect(obbba!.totalAnnualImpact).toBeLessThan(0);
  });

  it("OBBBA deficit impact exceeds spending savings (revenue loss > cuts)", () => {
    const obbba = landmarkBills.find((b) => b.id === "hr-1-obbba-119");
    expect(obbba).toBeDefined();
    expect(obbba!.deficitImpact!).toBeGreaterThan(Math.abs(obbba!.totalAnnualImpact));
  });
});

describe("getBillsForCategory", () => {
  it("returns bills impacting a given category", () => {
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
    if (!bill) return;

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
