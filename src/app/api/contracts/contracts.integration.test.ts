import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/redis", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const { GET } = await import("./route");

vi.spyOn(console, "error").mockImplementation(() => {});
vi.spyOn(console, "log").mockImplementation(() => {});

import { checkRateLimit } from "@/lib/redis";
const mockCheckRateLimit = vi.mocked(checkRateLimit);

function usaSpendingResponse(results: unknown[], hasNext = false) {
  return {
    ok: true,
    json: async () => ({
      results,
      page_metadata: { hasNext },
    }),
  };
}

const SAMPLE_CONTRACT = {
  "Award ID": "FA8732-25-C-0001",
  "Recipient Name": "LOCKHEED MARTIN CORP",
  "Award Amount": 500000000,
  "Total Outlays": 150000000,
  "Description": "FIGHTER JET MODERNIZATION PROGRAM",
  "Start Date": "2023-01-01",
  "End Date": "2028-01-01",
  "Awarding Agency": "Department of Defense",
  "Funding Agency": "Department of Defense",
  "generated_internal_id": "CONT_AWD_456",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckRateLimit.mockResolvedValue({ allowed: true });
});

describe("GET /api/contracts", () => {
  it("returns parsed contracts with all fields", async () => {
    mockFetch.mockResolvedValue(usaSpendingResponse([SAMPLE_CONTRACT]));

    const req = new NextRequest("http://localhost/api/contracts");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.contracts).toHaveLength(1);

    const contract = body.contracts[0];
    expect(contract.awardId).toBe("FA8732-25-C-0001");
    expect(contract.recipientName).toBe("LOCKHEED MARTIN CORP");
    expect(contract.amount).toBe(500000000);
    expect(contract.description).toBe("FIGHTER JET MODERNIZATION PROGRAM");
    expect(contract.categoryId).toBe("defense");
    expect(contract.url).toContain("CONT_AWD_456");
  });

  it("calculates annualized amount from outlays and duration", async () => {
    mockFetch.mockResolvedValue(usaSpendingResponse([SAMPLE_CONTRACT]));

    const req = new NextRequest("http://localhost/api/contracts");
    const res = await GET(req);
    const body = await res.json();

    // Has Total Outlays of $150M, contract started 2023-01-01
    // annualizedAmount = outlays / elapsed years
    expect(body.contracts[0].annualizedAmount).toBeGreaterThan(0);
    expect(body.contracts[0].annualizedAmount).toBeLessThan(500000000);
  });

  it("returns null annualized amount for short contracts", async () => {
    const shortContract = {
      ...SAMPLE_CONTRACT,
      "Start Date": "2025-01-01",
      "End Date": "2025-06-01",
      "Total Outlays": 0,
    };
    mockFetch.mockResolvedValue(usaSpendingResponse([shortContract]));

    const req = new NextRequest("http://localhost/api/contracts");
    const res = await GET(req);
    const body = await res.json();

    // Duration < 1 year, so annualizedAmount should be null
    expect(body.contracts[0].annualizedAmount).toBeNull();
  });

  it("passes hasMore from page metadata", async () => {
    mockFetch.mockResolvedValue(usaSpendingResponse([SAMPLE_CONTRACT], true));

    const req = new NextRequest("http://localhost/api/contracts");
    const res = await GET(req);
    const body = await res.json();

    expect(body.hasMore).toBe(true);
  });

  it("accepts page parameter", async () => {
    mockFetch.mockResolvedValue(usaSpendingResponse([]));

    const req = new NextRequest("http://localhost/api/contracts?page=3");
    await GET(req);

    const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(fetchBody.page).toBe(3);
  });

  it("accepts days and min_amount parameters", async () => {
    mockFetch.mockResolvedValue(usaSpendingResponse([]));

    const req = new NextRequest("http://localhost/api/contracts?days=30&min_amount=500000000");
    await GET(req);

    const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(fetchBody.filters.award_amounts[0].lower_bound).toBe(500000000);
  });

  it("caps days at 365", async () => {
    mockFetch.mockResolvedValue(usaSpendingResponse([]));

    const req = new NextRequest("http://localhost/api/contracts?days=9999");
    await GET(req);

    // The route caps days at 365, which affects the date filter
    const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    const startDate = new Date(fetchBody.filters.time_period[0].start_date);
    const endDate = new Date(fetchBody.filters.time_period[0].end_date);
    const diffDays = (endDate.getTime() - startDate.getTime()) / 86_400_000;
    expect(diffDays).toBeLessThanOrEqual(366); // allow 1 day rounding
  });

  it("returns fallback when API fails", async () => {
    mockFetch.mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/contracts");
    const res = await GET(req);
    const body = await res.json();

    expect(body.contracts).toEqual([]);
    expect(body.hasMore).toBe(false);
    expect(body.fallback).toBe(true);
  });

  it("returns 429 when rate limited", async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 30 });

    const req = new NextRequest("http://localhost/api/contracts");
    const res = await GET(req);

    expect(res.status).toBe(429);
  });

  it("prefers Funding Agency for category mapping", async () => {
    const contract = {
      ...SAMPLE_CONTRACT,
      "Funding Agency": "Department of Health and Human Services",
      "Awarding Agency": "General Services Administration",
    };
    mockFetch.mockResolvedValue(usaSpendingResponse([contract]));

    const req = new NextRequest("http://localhost/api/contracts");
    const res = await GET(req);
    const body = await res.json();

    expect(body.contracts[0].categoryId).toBe("healthcare");
  });
});
