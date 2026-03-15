import { describe, it, expect } from "vitest";
import {
  STATE_SENATE_CLASSES,
  getNextElectionYear,
  getSenatorNextElection,
  type SenateClass,
} from "./senate-classes";

describe("STATE_SENATE_CLASSES", () => {
  it("covers all 50 states", () => {
    expect(Object.keys(STATE_SENATE_CLASSES)).toHaveLength(50);
  });

  it("each state has two valid classes", () => {
    for (const [, classes] of Object.entries(STATE_SENATE_CLASSES)) {
      expect(classes).toHaveLength(2);
      expect([1, 2, 3]).toContain(classes[0]);
      expect([1, 2, 3]).toContain(classes[1]);
      // Two senators from same state are always in different classes
      expect(classes[0]).not.toBe(classes[1]);
    }
  });
});

describe("getNextElectionYear", () => {
  it("returns a future or current year", () => {
    const classes: SenateClass[] = [1, 2, 3];
    for (const c of classes) {
      const year = getNextElectionYear(c);
      expect(year).toBeGreaterThanOrEqual(new Date().getFullYear());
    }
  });

  it("returns an even year (senate elections are even years)", () => {
    const classes: SenateClass[] = [1, 2, 3];
    for (const c of classes) {
      expect(getNextElectionYear(c) % 2).toBe(0);
    }
  });

  it("returns years on 6-year cycles", () => {
    // Class I: 2024, 2030, 2036...
    // Class II: 2026, 2032, 2038...
    // Class III: 2028, 2034, 2040...
    const year1 = getNextElectionYear(1);
    const year2 = getNextElectionYear(2);
    const year3 = getNextElectionYear(3);

    expect((year1 - 2024) % 6).toBe(0);
    expect((year2 - 2026) % 6).toBe(0);
    expect((year3 - 2028) % 6).toBe(0);
  });
});

describe("getSenatorNextElection", () => {
  it("returns the senior senator election year for rank 1", () => {
    // CA: classes [3, 1]
    const year = getSenatorNextElection("CA", 1);
    expect(year).toBe(getNextElectionYear(3));
  });

  it("returns the junior senator election year for rank 2", () => {
    // CA: classes [3, 1]
    const year = getSenatorNextElection("CA", 2);
    expect(year).toBe(getNextElectionYear(1));
  });

  it("returns the sooner election when rank is unknown", () => {
    // CA: classes [3, 1]
    const year = getSenatorNextElection("CA");
    const class3 = getNextElectionYear(3);
    const class1 = getNextElectionYear(1);
    expect(year).toBe(Math.min(class3, class1));
  });

  it("handles lowercase state codes", () => {
    const upper = getSenatorNextElection("CA", 1);
    const lower = getSenatorNextElection("ca", 1);
    expect(upper).toBe(lower);
  });

  it("falls back to next even year for unknown state", () => {
    const year = getSenatorNextElection("XX");
    expect(year % 2).toBe(0);
    expect(year).toBeGreaterThanOrEqual(new Date().getFullYear());
  });
});
