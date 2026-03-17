import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock canvas in Node environment
const mockCtx = {
  createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  fillRect: vi.fn(),
  fillText: vi.fn(),
  measureText: vi.fn((text: string) => ({ width: text.length * 10 })),
  beginPath: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  stroke: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  translate: vi.fn(),
  rotate: vi.fn(),
  set font(_v: string) {},
  set fillStyle(_v: string | CanvasGradient) {},
  set strokeStyle(_v: string) {},
  set textAlign(_v: string) {},
  set textBaseline(_v: string) {},
  set lineWidth(_v: number) {},
  set lineCap(_v: string) {},
};

const mockCanvas = {
  width: 0,
  height: 0,
  getContext: vi.fn(() => mockCtx),
};

vi.stubGlobal("document", {
  createElement: vi.fn(() => mockCanvas),
});

// Import after mocking
const { renderShareCard, mapSpendingToCard } = await import("./share-card");

const SAMPLE_SPENDING = [
  { name: "Social Security", percentage: 23.5, color: "#6366f1" },
  { name: "Health", percentage: 14.8, color: "#ec4899" },
  { name: "Net Interest", percentage: 13.2, color: "#ef4444" },
  { name: "National Defense", percentage: 13.1, color: "#f59e0b" },
  { name: "Income Security", percentage: 11.4, color: "#8b5cf6" },
  { name: "Other", percentage: 24.0, color: "#475569" },
];

describe("renderShareCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCanvas.width = 0;
    mockCanvas.height = 0;
  });

  it("creates a 1080x1080 canvas", () => {
    renderShareCard({
      spending: SAMPLE_SPENDING,
      effectiveRate: 0.22,
      taxYear: 2025,
      mode: "share",
    });
    expect(mockCanvas.width).toBe(1080);
    expect(mockCanvas.height).toBe(1080);
  });

  it("draws CTA text for share mode", () => {
    renderShareCard({
      spending: SAMPLE_SPENDING,
      effectiveRate: 0.22,
      taxYear: 2025,
      mode: "share",
    });
    const ctaCalls = mockCtx.fillText.mock.calls.filter(
      (call: unknown[]) => typeof call[0] === "string" && (call[0] as string).includes("commoncents"),
    );
    expect(ctaCalls.length).toBeGreaterThan(0);
    expect(ctaCalls[0][0]).toContain("See yours");
  });

  it("draws classified CTA and watermark", () => {
    renderShareCard({
      spending: SAMPLE_SPENDING,
      effectiveRate: 0.22,
      taxYear: 2025,
      mode: "classified",
    });
    const ctaCalls = mockCtx.fillText.mock.calls.filter(
      (call: unknown[]) => typeof call[0] === "string" && (call[0] as string).includes("commoncents"),
    );
    expect(ctaCalls[0][0]).toContain("Declassify");

    // Watermark drawn with rotation
    expect(mockCtx.rotate).toHaveBeenCalled();
    const watermarkCalls = mockCtx.fillText.mock.calls.filter(
      (call: unknown[]) => call[0] === "CLASSIFIED",
    );
    expect(watermarkCalls.length).toBe(1);
  });

  it("draws effective rate only in share mode", () => {
    renderShareCard({
      spending: SAMPLE_SPENDING,
      effectiveRate: 0.22,
      taxYear: 2025,
      mode: "share",
    });
    const rateCalls = mockCtx.fillText.mock.calls.filter(
      (call: unknown[]) => typeof call[0] === "string" && (call[0] as string).includes("Effective rate"),
    );
    expect(rateCalls.length).toBe(1);
    expect(rateCalls[0][0]).toContain("22.0%");
  });

  it("does not draw effective rate in classified mode", () => {
    renderShareCard({
      spending: SAMPLE_SPENDING,
      effectiveRate: 0.22,
      taxYear: 2025,
      mode: "classified",
    });
    const rateCalls = mockCtx.fillText.mock.calls.filter(
      (call: unknown[]) => typeof call[0] === "string" && (call[0] as string).includes("Effective rate"),
    );
    expect(rateCalls.length).toBe(0);
  });

  it("draws redaction bars in classified mode", () => {
    renderShareCard({
      spending: SAMPLE_SPENDING,
      effectiveRate: 0.22,
      taxYear: 2025,
      mode: "classified",
    });
    // fillRect called for background + one per category redaction bar
    // Background = 1, redaction bars = spending.length
    expect(mockCtx.fillRect.mock.calls.length).toBe(1 + SAMPLE_SPENDING.length);
  });

  it("includes fiscal year in output", () => {
    renderShareCard({
      spending: SAMPLE_SPENDING,
      effectiveRate: 0.22,
      taxYear: 2025,
      mode: "share",
    });
    const fyCalls = mockCtx.fillText.mock.calls.filter(
      (call: unknown[]) => call[0] === "FY 2025",
    );
    expect(fyCalls.length).toBe(1);
  });
});

describe("mapSpendingToCard", () => {
  const mockSpending = Array.from({ length: 9 }, (_, i) => ({
    category: { name: `Cat ${i + 1}`, color: { dark: `#${i}${i}${i}`, light: `#${i}${i}${i}` } },
    percentage: i === 0 ? 30 : 70 / 8,
  }));

  it("returns top 5 + Other when more than 5 categories", () => {
    const result = mapSpendingToCard(mockSpending);
    expect(result.length).toBe(6);
    expect(result[5].name).toBe("Other");
    expect(result[5].color).toBe("#475569");
  });

  it("rolls up remaining percentages into Other", () => {
    const result = mapSpendingToCard(mockSpending);
    const otherPct = mockSpending.slice(5).reduce((sum, s) => sum + s.percentage, 0);
    expect(result[5].percentage).toBeCloseTo(otherPct);
  });

  it("returns all items when 5 or fewer categories", () => {
    const fewCats = mockSpending.slice(0, 4);
    const result = mapSpendingToCard(fewCats);
    expect(result.length).toBe(4);
    expect(result.every((r) => r.name !== "Other")).toBe(true);
  });

  it("maps category name and color correctly", () => {
    const result = mapSpendingToCard(mockSpending);
    expect(result[0].name).toBe("Cat 1");
    expect(result[0].color).toBe("#000");
  });
});
