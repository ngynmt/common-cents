import { describe, it, expect } from "vitest";
import { trackedVotes } from "./tracked-votes";

describe("trackedVotes", () => {
  it("has 8 tracked bills", () => {
    expect(trackedVotes.length).toBe(8);
  });

  it("all entries have required fields", () => {
    for (const tv of trackedVotes) {
      expect(tv.legislationTitle).toBeTruthy();
      expect(tv.categoryId).toBeTruthy();
      expect(tv.congress).toBeGreaterThanOrEqual(117);
      expect(tv.houseVote.year).toBeGreaterThanOrEqual(2021);
      expect(tv.houseVote.rollCall).toBeGreaterThan(0);
      expect(tv.senateVote.session).toBeGreaterThanOrEqual(1);
      expect(tv.senateVote.session).toBeLessThanOrEqual(2);
      expect(tv.senateVote.rollCall).toBeGreaterThan(0);
      expect(tv.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(tv.yesEffect).toBeTruthy();
      expect(tv.noEffect).toBeTruthy();
    }
  });

  it("has unique legislation titles", () => {
    const titles = trackedVotes.map((tv) => tv.legislationTitle);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("covers expected spending categories", () => {
    const categories = trackedVotes.map((tv) => tv.categoryId);
    expect(categories).toContain("defense");
    expect(categories).toContain("healthcare");
    expect(categories).toContain("social-security");
    expect(categories).toContain("infrastructure");
  });

  it("house roll call URLs are constructable", () => {
    for (const tv of trackedVotes) {
      const url = `https://clerk.house.gov/evs/${tv.houseVote.year}/roll${tv.houseVote.rollCall}.xml`;
      expect(url).toMatch(/^https:\/\/clerk\.house\.gov\/evs\/\d{4}\/roll\d+\.xml$/);
    }
  });

  it("senate roll call URLs are constructable", () => {
    for (const tv of trackedVotes) {
      const padded = String(tv.senateVote.rollCall).padStart(5, "0");
      const url = `https://www.senate.gov/legislative/LIS/roll_call_votes/vote${tv.congress}${tv.senateVote.session}/vote_${tv.congress}_${tv.senateVote.session}_${padded}.xml`;
      expect(url).toMatch(/^https:\/\/www\.senate\.gov\/legislative\/LIS\/roll_call_votes\/vote\d+\/vote_\d+_\d+_\d{5}\.xml$/);
    }
  });
});
