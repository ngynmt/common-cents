import { describe, it, expect } from "vitest";
import {
  getRepresentatives,
  getVotesForCategory,
  generateContactScript,
  sampleVotes,
} from "./representatives";

describe("getRepresentatives", () => {
  it("returns null for empty string", () => {
    expect(getRepresentatives("")).toBeNull();
  });

  it("returns null for short ZIP", () => {
    expect(getRepresentatives("10")).toBeNull();
  });

  it("returns null for unknown ZIP prefix", () => {
    expect(getRepresentatives("99999")).toBeNull();
  });

  it("returns representatives for NYC ZIP prefix", () => {
    const reps = getRepresentatives("10001");
    expect(reps).not.toBeNull();
    expect(reps!.length).toBe(3);
    // Should have 1 house + 2 senate
    const house = reps!.filter((r) => r.chamber === "house");
    const senate = reps!.filter((r) => r.chamber === "senate");
    expect(house.length).toBe(1);
    expect(senate.length).toBe(2);
  });

  it("returns representatives for LA ZIP prefix", () => {
    const reps = getRepresentatives("90001");
    expect(reps).not.toBeNull();
    expect(reps!.length).toBe(3);
  });

  it("returns representatives for Houston ZIP prefix", () => {
    const reps = getRepresentatives("77001");
    expect(reps).not.toBeNull();
    expect(reps!.length).toBe(3);
  });

  it("all representatives have required fields", () => {
    const reps = getRepresentatives("10001")!;
    for (const rep of reps) {
      expect(rep.id).toBeTruthy();
      expect(rep.name).toBeTruthy();
      expect(["house", "senate"]).toContain(rep.chamber);
      expect(["D", "R", "I"]).toContain(rep.party);
      expect(rep.state).toBeTruthy();
      expect(rep.phone).toBeTruthy();
      expect(rep.website).toBeTruthy();
      expect(typeof rep.nextElection).toBe("number");
    }
  });

  it("house reps have district, senators do not", () => {
    const reps = getRepresentatives("10001")!;
    for (const rep of reps) {
      if (rep.chamber === "house") {
        expect(rep.district).toBeTruthy();
      } else {
        expect(rep.district).toBeUndefined();
      }
    }
  });
});

describe("getVotesForCategory", () => {
  it("returns empty array for unknown rep IDs", () => {
    const votes = getVotesForCategory(["unknown-id"], "defense");
    expect(votes).toEqual([]);
  });

  it("returns empty array for unknown category", () => {
    const votes = getVotesForCategory(["ny-12"], "unknown-category");
    expect(votes).toEqual([]);
  });

  it("returns votes for known rep and category", () => {
    const votes = getVotesForCategory(["ny-12"], "defense");
    expect(votes.length).toBeGreaterThan(0);
    votes.forEach((v) => {
      expect(v.representativeId).toBe("ny-12");
      expect(v.categoryId).toBe("defense");
    });
  });

  it("returns votes for multiple reps", () => {
    const votes = getVotesForCategory(["ny-12", "ny-sen-1"], "defense");
    expect(votes.length).toBe(2);
    const repIds = votes.map((v) => v.representativeId);
    expect(repIds).toContain("ny-12");
    expect(repIds).toContain("ny-sen-1");
  });
});

describe("generateContactScript", () => {
  it("generates too_much script with interpolated values", () => {
    const script = generateContactScript("Rep. Smith", "Defense", "too_much", "$1,980");
    expect(script).toContain("Rep. Smith");
    expect(script).toContain("Defense");
    expect(script).toContain("$1,980");
    expect(script).toContain("too high");
  });

  it("generates too_little script with interpolated values", () => {
    const script = generateContactScript("Sen. Jones", "Education", "too_little", "$450");
    expect(script).toContain("Sen. Jones");
    expect(script).toContain("Education");
    expect(script).toContain("$450");
    expect(script).toContain("investing more");
  });
});

describe("sampleVotes", () => {
  it("has votes for all 3 ZIP regions", () => {
    const nyVotes = sampleVotes.filter((v) => v.representativeId.startsWith("ny"));
    const caVotes = sampleVotes.filter((v) => v.representativeId.startsWith("ca"));
    const txVotes = sampleVotes.filter((v) => v.representativeId.startsWith("tx"));
    expect(nyVotes.length).toBeGreaterThan(0);
    expect(caVotes.length).toBeGreaterThan(0);
    expect(txVotes.length).toBeGreaterThan(0);
  });

  it("all votes have valid vote values", () => {
    const validVotes = ["yes", "no", "abstain", "not_voting"];
    sampleVotes.forEach((v) => {
      expect(validVotes).toContain(v.vote);
    });
  });
});
