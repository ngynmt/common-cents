import { describe, it, expect } from "vitest";

// ---- Pure functions duplicated from route.ts for testing ----

const JUNK_PATTERNS = [
  "N/A",
  "NONE",
  "NULL",
  "INFORMATION REQUESTED",
  "REFUSED",
  "NOT PROVIDED",
];

function isJunkEmployer(employer: string | null | undefined): boolean {
  if (!employer) return true;
  const normalized = employer.trim().toUpperCase();
  if (normalized.length === 0) return true;
  return JUNK_PATTERNS.some((p) => normalized === p || normalized.startsWith(p));
}

function parseParty(party: string): "D" | "R" | "I" {
  if (party === "DEM" || party === "D") return "D";
  if (party === "REP" || party === "R") return "R";
  return "I";
}

function parseOffice(office: string): "house" | "senate" {
  return office === "S" ? "senate" : "house";
}

function titleCase(s: string): string {
  if (!s) return s;
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---- Tests ----

describe("isJunkEmployer", () => {
  it("rejects null and undefined", () => {
    expect(isJunkEmployer(null)).toBe(true);
    expect(isJunkEmployer(undefined)).toBe(true);
  });

  it("rejects empty and whitespace-only strings", () => {
    expect(isJunkEmployer("")).toBe(true);
    expect(isJunkEmployer("   ")).toBe(true);
  });

  it("rejects known junk patterns", () => {
    expect(isJunkEmployer("N/A")).toBe(true);
    expect(isJunkEmployer("NONE")).toBe(true);
    expect(isJunkEmployer("NULL")).toBe(true);
    expect(isJunkEmployer("INFORMATION REQUESTED")).toBe(true);
    expect(isJunkEmployer("REFUSED")).toBe(true);
    expect(isJunkEmployer("NOT PROVIDED")).toBe(true);
  });

  it("rejects junk patterns case-insensitively", () => {
    expect(isJunkEmployer("n/a")).toBe(true);
    expect(isJunkEmployer("None")).toBe(true);
    expect(isJunkEmployer("information requested per best efforts")).toBe(true);
  });

  it("rejects junk patterns with leading/trailing whitespace", () => {
    expect(isJunkEmployer("  N/A  ")).toBe(true);
    expect(isJunkEmployer("  NONE")).toBe(true);
  });

  it("accepts legitimate employers", () => {
    expect(isJunkEmployer("Google")).toBe(false);
    expect(isJunkEmployer("Goldman Sachs")).toBe(false);
    expect(isJunkEmployer("Self Employed")).toBe(false);
    expect(isJunkEmployer("Not Employed")).toBe(false);
    expect(isJunkEmployer("Retired")).toBe(false);
  });
});

describe("parseParty", () => {
  it("parses FEC party codes", () => {
    expect(parseParty("DEM")).toBe("D");
    expect(parseParty("REP")).toBe("R");
  });

  it("parses short party codes", () => {
    expect(parseParty("D")).toBe("D");
    expect(parseParty("R")).toBe("R");
  });

  it("defaults to I for unknown parties", () => {
    expect(parseParty("LIB")).toBe("I");
    expect(parseParty("GRE")).toBe("I");
    expect(parseParty("IND")).toBe("I");
    expect(parseParty("")).toBe("I");
  });
});

describe("parseOffice", () => {
  it("maps S to senate", () => {
    expect(parseOffice("S")).toBe("senate");
  });

  it("maps H to house", () => {
    expect(parseOffice("H")).toBe("house");
  });

  it("defaults to house for unknown values", () => {
    expect(parseOffice("P")).toBe("house");
  });
});

describe("titleCase", () => {
  it("converts uppercase names", () => {
    expect(titleCase("SCHUMER, CHARLES E.")).toBe("Schumer, Charles E.");
    expect(titleCase("GOLDMAN SACHS")).toBe("Goldman Sachs");
  });

  it("handles single words", () => {
    expect(titleCase("GOOGLE")).toBe("Google");
  });

  it("handles empty string", () => {
    expect(titleCase("")).toBe("");
  });

  it("handles already title-cased strings", () => {
    expect(titleCase("Already Fine")).toBe("Already Fine");
  });
});
