import { describe, it, expect, vi, afterEach } from "vitest";
import {
  fetchIndicator,
  fetchAllIndicators,
  INDICATORS,
} from "./worldbank-fetcher";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeWbResponse(
  entries: Array<{ countryId: string; date: string; value: number | null }>
) {
  return [
    { page: 1, pages: 1, total: entries.length },
    entries.map((e) => ({
      country: { id: e.countryId, value: "" },
      indicator: { id: "TEST", value: "" },
      date: e.date,
      value: e.value,
    })),
  ];
}

function mockFetchOk(body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(body),
  });
}

function mockFetchError(status: number, statusText: string) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    statusText,
  });
}

// ---------------------------------------------------------------------------
// fetchIndicator
// ---------------------------------------------------------------------------

describe("fetchIndicator", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns the most recent non-null value per country", async () => {
    const body = makeWbResponse([
      { countryId: "GBR", date: "2022", value: 81.0 },
      { countryId: "GBR", date: "2021", value: 80.5 },
      { countryId: "USA", date: "2022", value: null },
      { countryId: "USA", date: "2021", value: 77.5 },
    ]);
    globalThis.fetch = mockFetchOk(body);

    const result = await fetchIndicator("SP.DYN.LE00.IN", ["GBR", "USA"]);

    expect(result.get("GBR")).toEqual({ value: 81.0, year: 2022 });
    expect(result.get("USA")).toEqual({ value: 77.5, year: 2021 });
  });

  it("skips countries with all null values", async () => {
    const body = makeWbResponse([
      { countryId: "GBR", date: "2022", value: null },
      { countryId: "GBR", date: "2021", value: null },
    ]);
    globalThis.fetch = mockFetchOk(body);

    const result = await fetchIndicator("SP.DYN.LE00.IN", ["GBR"]);

    expect(result.size).toBe(0);
  });

  it("returns empty map when API returns no data array", async () => {
    globalThis.fetch = mockFetchOk([{ page: 1 }]);

    const result = await fetchIndicator("SP.DYN.LE00.IN", ["GBR"]);

    expect(result.size).toBe(0);
  });

  it("throws on non-ok response", async () => {
    globalThis.fetch = mockFetchError(500, "Internal Server Error");

    await expect(
      fetchIndicator("SP.DYN.LE00.IN", ["GBR"])
    ).rejects.toThrow("World Bank API error: 500");
  });

  it("builds correct URL with semicolon-separated country codes", async () => {
    const body = makeWbResponse([]);
    globalThis.fetch = mockFetchOk(body);

    await fetchIndicator("TEST.IND", ["USA", "GBR", "DEU"], "2019:2023");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("country/USA;GBR;DEU/indicator/TEST.IND")
    );
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("date=2019:2023")
    );
  });

  it("picks the latest year when multiple non-null values exist", async () => {
    const body = makeWbResponse([
      { countryId: "GBR", date: "2020", value: 79.0 },
      { countryId: "GBR", date: "2023", value: 82.0 },
      { countryId: "GBR", date: "2021", value: 80.0 },
    ]);
    globalThis.fetch = mockFetchOk(body);

    const result = await fetchIndicator("SP.DYN.LE00.IN", ["GBR"]);

    expect(result.get("GBR")).toEqual({ value: 82.0, year: 2023 });
  });
});

// ---------------------------------------------------------------------------
// fetchAllIndicators
// ---------------------------------------------------------------------------

describe("fetchAllIndicators", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("aggregates results from multiple indicators into country records", async () => {
    // Mock fetch to return different data for each indicator call
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      const body = makeWbResponse([
        { countryId: "GBR", date: "2022", value: 42.0 + callCount },
      ]);
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(body),
      });
    });

    const result = await fetchAllIndicators(["GBR"]);

    expect(result.has("GBR")).toBe(true);
    const gbr = result.get("GBR")!;
    // Should have an entry for each indicator
    expect(Object.keys(gbr).length).toBe(INDICATORS.length);
    // Each entry should have value, year, unit
    for (const ind of INDICATORS) {
      expect(gbr[ind.key]).toBeDefined();
      expect(gbr[ind.key].unit).toBe(ind.unit);
      expect(gbr[ind.key].year).toBe(2022);
    }
  });

  it("handles countries with partial indicator coverage", async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      // Only return data for the first indicator
      const entries =
        callCount === 1
          ? [{ countryId: "GBR", date: "2022", value: 81.0 }]
          : [];
      const body = makeWbResponse(entries);
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(body),
      });
    });

    const result = await fetchAllIndicators(["GBR"]);

    expect(result.has("GBR")).toBe(true);
    const gbr = result.get("GBR")!;
    expect(Object.keys(gbr).length).toBe(1);
    expect(gbr[INDICATORS[0].key]).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// INDICATORS registry
// ---------------------------------------------------------------------------

describe("INDICATORS", () => {
  it("has 12 indicators", () => {
    expect(INDICATORS).toHaveLength(12);
  });

  it("has unique keys", () => {
    const keys = INDICATORS.map((i) => i.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("has unique codes", () => {
    const codes = INDICATORS.map((i) => i.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("maps to known categories", () => {
    const validCategories = [
      "healthcare",
      "education",
      "income-security",
      "social-security",
      "infrastructure",
      "defense",
      "science",
    ];
    for (const ind of INDICATORS) {
      expect(validCategories).toContain(ind.category);
    }
  });
});
