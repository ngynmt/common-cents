import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/redis", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

vi.spyOn(console, "error").mockImplementation(() => {});
vi.spyOn(console, "log").mockImplementation(() => {});

// Set LDA_API_KEY before importing the route
vi.stubEnv("LDA_API_KEY", "test-lda-key");

const { GET } = await import("./route");

import { checkRateLimit } from "@/lib/redis";
const mockCheckRateLimit = vi.mocked(checkRateLimit);

function ldaResponse(results: unknown[], count = results.length) {
  return { ok: true, json: async () => ({ results, count }) };
}

const SAMPLE_FILING = {
  client: { name: "ACME Corp" },
  registrant: { name: "K Street Lobby Inc" },
  income: "500000",
  expenses: null,
  filing_year: 2025,
  filing_period_display: "1st Quarter",
  filing_document_url: "https://lda.senate.gov/filings/123",
  lobbying_activities: [
    {
      description: "Lobbying on S. 770 regarding social security reform",
      general_issue_code: "RET",
      general_issue_code_display: "Retirement",
      lobbyists: [
        {
          lobbyist: { first_name: "Jane", last_name: "Doe" },
          covered_position: "Former Senate Aide",
        },
        {
          lobbyist: { first_name: "John", last_name: "Smith" },
          covered_position: null,
        },
      ],
      government_entities: [{ name: "U.S. Senate" }, { name: "U.S. House of Representatives" }],
    },
    {
      description: "Unrelated healthcare lobbying activity",
      general_issue_code: "HCR",
      general_issue_code_display: "Health Issues",
      lobbyists: [],
      government_entities: [],
    },
  ],
};

const SAMPLE_FILING_2 = {
  client: { name: "ACME Corp" },
  registrant: { name: "K Street Lobby Inc" },
  income: "300000",
  expenses: null,
  filing_year: 2025,
  filing_period_display: "2nd Quarter",
  filing_document_url: "https://lda.senate.gov/filings/456",
  lobbying_activities: [
    {
      description: "Continued advocacy on S. 770",
      general_issue_code: "RET",
      general_issue_code_display: "Retirement",
      lobbyists: [],
      government_entities: [],
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("LDA_API_KEY", "test-lda-key");
  mockCheckRateLimit.mockResolvedValue({ allowed: true });
});

describe("GET /api/lobbying", () => {
  it("returns 400 when bill parameter is missing", async () => {
    const req = new NextRequest("http://localhost/api/lobbying");
    const res = await GET(req);

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("bill parameter required");
  });

  it("returns parsed lobbying data with activity filtering", async () => {
    // The route searches 3 years — mock all 3 requests
    mockFetch
      .mockResolvedValueOnce(ldaResponse([SAMPLE_FILING], 1))
      .mockResolvedValueOnce(ldaResponse([], 0))
      .mockResolvedValueOnce(ldaResponse([], 0));

    const req = new NextRequest("http://localhost/api/lobbying?bill=S.+770&year=2025");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.billNumber).toBe("S. 770");
    expect(body.data.totalFilings).toBe(1);
    expect(body.data.totalSpending).toBe(500000);
    expect(body.data.filings).toHaveLength(1);
    expect(body.data.clients).toEqual(["ACME Corp"]);

    // Only the activity mentioning S. 770 should be included
    const filing = body.data.filings[0];
    expect(filing.activities).toHaveLength(1);
    expect(filing.activities[0].issueCode).toBe("RET");
    expect(filing.activities[0].lobbyists).toHaveLength(2);
    expect(filing.activities[0].lobbyists[0].name).toBe("Jane Doe");
    expect(filing.activities[0].lobbyists[0].coveredPosition).toBe("Former Senate Aide");
    expect(filing.activities[0].governmentEntities).toEqual([
      "U.S. Senate",
      "U.S. House of Representatives",
    ]);
  });

  it("aggregates multiple filings from the same client", async () => {
    mockFetch
      .mockResolvedValueOnce(ldaResponse([SAMPLE_FILING, SAMPLE_FILING_2], 2))
      .mockResolvedValueOnce(ldaResponse([], 0))
      .mockResolvedValueOnce(ldaResponse([], 0));

    const req = new NextRequest("http://localhost/api/lobbying?bill=S.+770&year=2025");
    const res = await GET(req);
    const body = await res.json();

    // Both filings from ACME Corp should be included
    expect(body.data.filings).toHaveLength(2);
    // But only one unique client
    expect(body.data.clients).toEqual(["ACME Corp"]);
    // Total spending = 500000 + 300000
    expect(body.data.totalSpending).toBe(800000);
  });

  it("searches 3 years for broader coverage", async () => {
    mockFetch
      .mockResolvedValueOnce(ldaResponse([], 0))
      .mockResolvedValueOnce(ldaResponse([], 0))
      .mockResolvedValueOnce(ldaResponse([SAMPLE_FILING], 1));

    const req = new NextRequest("http://localhost/api/lobbying?bill=S.+770&year=2026");
    const res = await GET(req);
    const body = await res.json();

    expect(body.data.totalFilings).toBe(1);

    // Verify fetch was called 3 times with years 2026, 2025, 2024
    expect(mockFetch).toHaveBeenCalledTimes(3);
    const urls = mockFetch.mock.calls.map((c: unknown[]) => String(c[0]));
    expect(urls[0]).toContain("filing_year=2026");
    expect(urls[1]).toContain("filing_year=2025");
    expect(urls[2]).toContain("filing_year=2024");
  });

  it("skips filings with no relevant activities", async () => {
    const irrelevantFiling = {
      ...SAMPLE_FILING,
      lobbying_activities: [
        {
          description: "Unrelated lobbying on H.R. 999",
          general_issue_code: "HCR",
          general_issue_code_display: "Health Issues",
          lobbyists: [],
          government_entities: [],
        },
      ],
    };

    mockFetch
      .mockResolvedValueOnce(ldaResponse([irrelevantFiling], 1))
      .mockResolvedValueOnce(ldaResponse([], 0))
      .mockResolvedValueOnce(ldaResponse([], 0));

    const req = new NextRequest("http://localhost/api/lobbying?bill=S.+770&year=2025");
    const res = await GET(req);
    const body = await res.json();

    expect(body.data.filings).toHaveLength(0);
    expect(body.data.totalSpending).toBe(0);
  });

  it("returns 429 when rate limited", async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 60 });

    const req = new NextRequest("http://localhost/api/lobbying?bill=S.+770");
    const res = await GET(req);

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
  });

  it("continues when one year fetch fails", async () => {
    mockFetch
      .mockResolvedValueOnce(null) // 2025 fails
      .mockResolvedValueOnce(ldaResponse([SAMPLE_FILING], 1)) // 2024 succeeds
      .mockResolvedValueOnce(ldaResponse([], 0)); // 2023

    const req = new NextRequest("http://localhost/api/lobbying?bill=S.+770&year=2025");
    const res = await GET(req);
    const body = await res.json();

    expect(body.data.filings).toHaveLength(1);
  });

  it("returns fallback when no API key is set", async () => {
    vi.stubEnv("LDA_API_KEY", "");

    const req = new NextRequest("http://localhost/api/lobbying?bill=S.+770");
    const res = await GET(req);
    const body = await res.json();

    expect(body.data).toBeNull();
    expect(body.fallback).toBe(true);
  });
});
