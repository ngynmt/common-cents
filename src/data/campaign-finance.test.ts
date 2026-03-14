import { describe, it, expect } from "vitest";
import { FEC_CANDIDATE_IDS } from "./fec-candidate-ids";

describe("FEC_CANDIDATE_IDS", () => {
  const entries = Object.entries(FEC_CANDIDATE_IDS);

  it("has 538 mappings (100 senators + 438 representatives)", () => {
    expect(entries.length).toBe(538);
  });

  it("all bioguide IDs are lowercase", () => {
    for (const [bioguide] of entries) {
      expect(bioguide).toBe(bioguide.toLowerCase());
    }
  });

  it("all FEC IDs match expected format", () => {
    // FEC candidate IDs: H/S/P + digit + state abbreviation + digits
    for (const [bioguide, fecId] of entries) {
      expect(fecId).toMatch(
        /^[HSP]\d[A-Z]{2}\d{5}$/,
      );
      if (!fecId.match(/^[HSP]\d[A-Z]{2}\d{5}$/)) {
        throw new Error(`Invalid FEC ID for ${bioguide}: ${fecId}`);
      }
    }
  });

  it("has no duplicate FEC IDs", () => {
    const fecIds = entries.map(([, fecId]) => fecId);
    const dupes = fecIds.filter((id, i) => fecIds.indexOf(id) !== i);
    expect(dupes).toEqual([]);
  });

  it("has no duplicate bioguide IDs", () => {
    const bioguideIds = entries.map(([bioguide]) => bioguide);
    expect(new Set(bioguideIds).size).toBe(bioguideIds.length);
  });

  it("senate FEC IDs start with S or H", () => {
    // Senators who previously served in the House may have H-prefixed IDs
    const senateIds = entries.filter(([, fecId]) => fecId.startsWith("S") || fecId.startsWith("H"));
    expect(senateIds.length).toBe(entries.length);
  });

  it("contains known senators", () => {
    expect(FEC_CANDIDATE_IDS["s000148"]).toBe("S8NY00082"); // Charles Schumer
    expect(FEC_CANDIDATE_IDS["g000555"]).toBe("S0NY00410"); // Kirsten Gillibrand
    expect(FEC_CANDIDATE_IDS["s000033"]).toBe("S4VT00033"); // Bernie Sanders
  });

  it("contains known house members", () => {
    expect(FEC_CANDIDATE_IDS["p000197"]).toBe("H8CA05035"); // Nancy Pelosi
    expect(FEC_CANDIDATE_IDS["n000002"]).toBe("H2NY17071"); // Jerrold Nadler
    expect(FEC_CANDIDATE_IDS["d000230"]).toBe("H2NC02287"); // Don Davis
  });
});
