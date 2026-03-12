import { describe, it, expect } from "vitest";
import { generateContactScript } from "./representatives";

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
