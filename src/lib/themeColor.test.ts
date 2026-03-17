import { describe, it, expect } from "vitest";
import { resolveThemeColor } from "./themeColor";

describe("resolveThemeColor", () => {
  const color = { dark: "#6366f1", light: "#4f46e5" };

  it("returns dark value for dark theme", () => {
    expect(resolveThemeColor(color, "dark")).toBe("#6366f1");
  });

  it("returns light value for light theme", () => {
    expect(resolveThemeColor(color, "light")).toBe("#4f46e5");
  });

  it("defaults to dark for undefined theme", () => {
    expect(resolveThemeColor(color, undefined as unknown as string)).toBe("#6366f1");
  });

  it("defaults to dark for unknown theme string", () => {
    expect(resolveThemeColor(color, "system")).toBe("#6366f1");
  });
});
