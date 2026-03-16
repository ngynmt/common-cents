import { describe, it, expect } from "vitest";

/**
 * Test the scroll direction decision logic in isolation.
 * This mirrors the logic inside StickyNav's scroll handler.
 */
function computeVisibility(opts: {
  currentY: number;
  lastY: number;
  threshold: number;
  receiptBottom: number;
  suppressUntil: number;
  now: number;
}): "show" | "hide" | "no-change" {
  // Suppressed during programmatic scroll
  if (opts.now < opts.suppressUntil) return "no-change";

  // Near top of page
  if (opts.currentY < opts.receiptBottom - 200) return "hide";

  const delta = opts.currentY - opts.lastY;
  if (Math.abs(delta) <= opts.threshold) return "no-change";

  return delta < 0 ? "show" : "hide";
}

describe("StickyNav scroll direction logic", () => {
  const base = {
    threshold: 5,
    receiptBottom: 400,
    suppressUntil: 0,
    now: 1000,
  };

  it("shows on scroll-up when past receipt", () => {
    expect(
      computeVisibility({ ...base, currentY: 500, lastY: 520 }),
    ).toBe("show");
  });

  it("hides on scroll-down when past receipt", () => {
    expect(
      computeVisibility({ ...base, currentY: 520, lastY: 500 }),
    ).toBe("hide");
  });

  it("hides when near top of page", () => {
    expect(
      computeVisibility({ ...base, currentY: 100, lastY: 120 }),
    ).toBe("hide");
  });

  it("returns no-change when delta is below threshold", () => {
    expect(
      computeVisibility({ ...base, currentY: 500, lastY: 498 }),
    ).toBe("no-change");
  });

  it("returns no-change during suppression window", () => {
    expect(
      computeVisibility({
        ...base,
        currentY: 520,
        lastY: 500,
        suppressUntil: 2000,
        now: 1500,
      }),
    ).toBe("no-change");
  });

  it("resumes detection after suppression expires", () => {
    expect(
      computeVisibility({
        ...base,
        currentY: 500,
        lastY: 520,
        suppressUntil: 1000,
        now: 1500,
      }),
    ).toBe("show");
  });
});
