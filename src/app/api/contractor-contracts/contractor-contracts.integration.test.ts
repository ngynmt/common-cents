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

function usaSpendingResponse(results: unknown[]) {
  return { ok: true, json: async () => ({ results }) };
}

const SAMPLE_CONTRACT = {
  "Award ID": "W56HZV-20-C-0001",
  "Description": "COMBAT VEHICLE MODERNIZATION",
  "Award Amount": 5000000,
  "Funding Agency": "Department of Defense",
  "Awarding Agency": "Department of Defense",
  "Start Date": "2024-01-15",
  "generated_internal_id": "CONT_AWD_123",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckRateLimit.mockResolvedValue({ allowed: true });
});

describe("GET /api/contractor-contracts", () => {
  it("returns 400 when names parameter is missing", async () => {
    const req = new NextRequest("http://localhost/api/contractor-contracts");
    const res = await GET(req);

    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("employer names");
  });

  it("returns contracts for a single employer", async () => {
    mockFetch.mockResolvedValue(usaSpendingResponse([SAMPLE_CONTRACT]));

    const req = new NextRequest("http://localhost/api/contractor-contracts?names=LOCKHEED+MARTIN");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.results).toHaveLength(1);
    expect(body.results[0].employer).toBe("LOCKHEED MARTIN");
    expect(body.results[0].contracts).toHaveLength(1);
    expect(body.results[0].contracts[0].awardId).toBe("W56HZV-20-C-0001");
    expect(body.results[0].contracts[0].amount).toBe(5000000);
    expect(body.results[0].contracts[0].agency).toBe("Department of Defense");
    expect(body.results[0].contracts[0].url).toContain("CONT_AWD_123");
    expect(body.results[0].totalAmount).toBe(5000000);
  });

  it("fetches contracts for multiple employers in parallel", async () => {
    mockFetch
      .mockResolvedValueOnce(usaSpendingResponse([SAMPLE_CONTRACT]))
      .mockResolvedValueOnce(usaSpendingResponse([]));

    const req = new NextRequest("http://localhost/api/contractor-contracts?names=BOEING,RAYTHEON");
    const res = await GET(req);
    const body = await res.json();

    expect(body.results).toHaveLength(2);
    expect(body.results[0].contracts).toHaveLength(1);
    expect(body.results[1].contracts).toHaveLength(0);
    expect(body.results[1].totalAmount).toBe(0);
  });

  it("limits to 5 employer names", async () => {
    mockFetch.mockResolvedValue(usaSpendingResponse([]));

    const names = "A,B,C,D,E,F,G".split(",").map(encodeURIComponent).join(",");
    const req = new NextRequest(`http://localhost/api/contractor-contracts?names=${names}`);
    const res = await GET(req);
    const body = await res.json();

    // Should only process 5 employers
    expect(body.results).toHaveLength(5);
    expect(mockFetch).toHaveBeenCalledTimes(5);
  });

  it("returns empty results when names are empty strings", async () => {
    const req = new NextRequest("http://localhost/api/contractor-contracts?names=,,,");
    const res = await GET(req);
    const body = await res.json();

    expect(body.results).toEqual([]);
  });

  it("handles API failure gracefully", async () => {
    mockFetch.mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/contractor-contracts?names=BOEING");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.results[0].contracts).toEqual([]);
    expect(body.results[0].totalAmount).toBe(0);
  });

  it("maps agency to budget category", async () => {
    mockFetch.mockResolvedValue(
      usaSpendingResponse([
        { ...SAMPLE_CONTRACT, "Funding Agency": "Department of Health and Human Services" },
      ]),
    );

    const req = new NextRequest("http://localhost/api/contractor-contracts?names=PFIZER");
    const res = await GET(req);
    const body = await res.json();

    expect(body.results[0].contracts[0].category).toBe("healthcare");
  });

  it("returns 429 when rate limited", async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 20 });

    const req = new NextRequest("http://localhost/api/contractor-contracts?names=BOEING");
    const res = await GET(req);

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("20");
  });
});
