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

function congressResponse(bills: unknown[]) {
  return { ok: true, json: async () => ({ bills }) };
}

const SAMPLE_ENACTED_BILL = {
  type: "HR",
  number: 1234,
  congress: 119,
  title: "A bill to do something important",
  url: "https://api.congress.gov/v3/bill/119/hr/1234?format=json",
  latestAction: {
    text: "Became Public Law No: 119-42.",
    actionDate: "2025-10-15",
  },
};

const SAMPLE_NON_ENACTED_BILL = {
  type: "S",
  number: 567,
  congress: 119,
  title: "Another bill",
  url: "https://api.congress.gov/v3/bill/119/s/567?format=json",
  latestAction: {
    text: "Referred to the Committee on Finance.",
    actionDate: "2025-09-01",
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckRateLimit.mockResolvedValue({ allowed: true });
});

describe("GET /api/bills", () => {
  it("returns only enacted bills", async () => {
    mockFetch.mockResolvedValue(
      congressResponse([SAMPLE_ENACTED_BILL, SAMPLE_NON_ENACTED_BILL]),
    );

    const req = new NextRequest("http://localhost/api/bills?status=enacted");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    // Only the enacted bill should be returned
    expect(body.bills).toHaveLength(1);
    expect(body.bills[0].billNumber).toBe("HR. 1234");
    expect(body.bills[0].publicLawNumber).toBe("P.L. 119-42");
    expect(body.bills[0].status).toBe("enacted");
  });

  it("returns 400 for non-enacted status", async () => {
    const req = new NextRequest("http://localhost/api/bills?status=pending");
    const res = await GET(req);

    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("enacted");
  });

  it("defaults to enacted status when not specified", async () => {
    mockFetch.mockResolvedValue(congressResponse([SAMPLE_ENACTED_BILL]));

    const req = new NextRequest("http://localhost/api/bills");
    const res = await GET(req);
    const body = await res.json();

    expect(body.bills).toHaveLength(1);
  });

  it("returns fallback when API fails", async () => {
    mockFetch.mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/bills?status=enacted");
    const res = await GET(req);
    const body = await res.json();

    expect(body.bills).toEqual([]);
    expect(body.fallback).toBe(true);
  });

  it("returns fallback when response has no bills array", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });

    const req = new NextRequest("http://localhost/api/bills?status=enacted");
    const res = await GET(req);
    const body = await res.json();

    expect(body.bills).toEqual([]);
    expect(body.fallback).toBe(true);
  });

  it("extracts public law number from action text", async () => {
    mockFetch.mockResolvedValue(congressResponse([SAMPLE_ENACTED_BILL]));

    const req = new NextRequest("http://localhost/api/bills?status=enacted");
    const res = await GET(req);
    const body = await res.json();

    expect(body.bills[0].publicLawNumber).toBe("P.L. 119-42");
  });

  it("also detects signed by president action text", async () => {
    const signedBill = {
      ...SAMPLE_ENACTED_BILL,
      latestAction: {
        text: "Signed by President.",
        actionDate: "2025-10-15",
      },
    };
    mockFetch.mockResolvedValue(congressResponse([signedBill]));

    const req = new NextRequest("http://localhost/api/bills?status=enacted");
    const res = await GET(req);
    const body = await res.json();

    expect(body.bills).toHaveLength(1);
  });

  it("accepts days parameter", async () => {
    mockFetch.mockResolvedValue(congressResponse([]));

    const req = new NextRequest("http://localhost/api/bills?status=enacted&days=30");
    await GET(req);

    const fetchUrl = String(mockFetch.mock.calls[0][0]);
    // Verify the fromDateTime reflects ~30 days ago
    expect(fetchUrl).toContain("fromDateTime=");
  });

  it("caps days at 365", async () => {
    mockFetch.mockResolvedValue(congressResponse([]));

    const req = new NextRequest("http://localhost/api/bills?status=enacted&days=9999");
    await GET(req);

    const fetchUrl = String(mockFetch.mock.calls[0][0]);
    const fromMatch = fetchUrl.match(/fromDateTime=(\d{4}-\d{2}-\d{2})/);
    expect(fromMatch).toBeTruthy();
    const fromDate = new Date(fromMatch![1]);
    const now = new Date();
    const diffDays = (now.getTime() - fromDate.getTime()) / 86_400_000;
    expect(diffDays).toBeLessThanOrEqual(366);
  });

  it("returns 429 when rate limited", async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 10 });

    const req = new NextRequest("http://localhost/api/bills?status=enacted");
    const res = await GET(req);

    expect(res.status).toBe(429);
  });
});
