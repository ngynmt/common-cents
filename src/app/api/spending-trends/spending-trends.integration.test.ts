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

function treasuryResponse(data: unknown[]) {
  return { ok: true, json: async () => ({ data }) };
}

const SAMPLE_ROWS = [
  {
    record_date: "2025-12-31",
    classification_desc: "National Defense",
    current_fytd_rcpt_outly_amt: "400000",
    prior_fytd_rcpt_outly_amt: "350000",
    data_type_cd: "D",
  },
  {
    record_date: "2025-12-31",
    classification_desc: "Medicare",
    current_fytd_rcpt_outly_amt: "500000",
    prior_fytd_rcpt_outly_amt: "480000",
    data_type_cd: "D",
  },
  {
    record_date: "2025-12-31",
    classification_desc: "Customs Duties",
    current_fytd_rcpt_outly_amt: "80000",
    prior_fytd_rcpt_outly_amt: "20000",
    data_type_cd: "D",
  },
  // Summary row — should be filtered out (data_type_cd !== "D")
  {
    record_date: "2025-12-31",
    classification_desc: "National Defense",
    current_fytd_rcpt_outly_amt: "400000",
    prior_fytd_rcpt_outly_amt: "350000",
    data_type_cd: "T",
  },
  // Different date — should be filtered out
  {
    record_date: "2025-11-30",
    classification_desc: "Medicare",
    current_fytd_rcpt_outly_amt: "450000",
    prior_fytd_rcpt_outly_amt: "430000",
    data_type_cd: "D",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckRateLimit.mockResolvedValue({ allowed: true });
});

describe("GET /api/spending-trends", () => {
  it("returns parsed spending trends from Treasury MTS data", async () => {
    mockFetch.mockResolvedValue(treasuryResponse(SAMPLE_ROWS));

    const req = new NextRequest("http://localhost/api/spending-trends");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.trends).toHaveLength(3);
    expect(body.recordDate).toBe("2025-12-31");

    // Sorted by absolute change percent descending
    // Customs: (80000-20000)/20000 = 300%
    // Defense: (400000-350000)/350000 = 14.3%
    // Medicare: (500000-480000)/480000 = 4.2%
    expect(body.trends[0].classification).toBe("Customs Duties");
    expect(body.trends[0].changePercent).toBe(300);
    expect(body.trends[0].type).toBe("receipt");
    expect(body.trends[0].categoryId).toBe("customs");

    expect(body.trends[1].classification).toBe("National Defense");
    expect(body.trends[1].type).toBe("outlay");
    expect(body.trends[1].categoryId).toBe("defense");
  });

  it("filters out non-detail rows and older dates", async () => {
    mockFetch.mockResolvedValue(treasuryResponse(SAMPLE_ROWS));

    const req = new NextRequest("http://localhost/api/spending-trends");
    const res = await GET(req);
    const body = await res.json();

    // Only 3 detail rows from latest date (not T-type or older date)
    expect(body.trends).toHaveLength(3);
  });

  it("filters out unmapped classifications", async () => {
    mockFetch.mockResolvedValue(
      treasuryResponse([
        {
          record_date: "2025-12-31",
          classification_desc: "Some Unknown Category",
          current_fytd_rcpt_outly_amt: "100000",
          prior_fytd_rcpt_outly_amt: "50000",
          data_type_cd: "D",
        },
      ]),
    );

    const req = new NextRequest("http://localhost/api/spending-trends");
    const res = await GET(req);
    const body = await res.json();

    expect(body.trends).toHaveLength(0);
  });

  it("skips rows with zero prior year amount", async () => {
    mockFetch.mockResolvedValue(
      treasuryResponse([
        {
          record_date: "2025-12-31",
          classification_desc: "National Defense",
          current_fytd_rcpt_outly_amt: "400000",
          prior_fytd_rcpt_outly_amt: "0",
          data_type_cd: "D",
        },
      ]),
    );

    const req = new NextRequest("http://localhost/api/spending-trends");
    const res = await GET(req);
    const body = await res.json();

    expect(body.trends).toHaveLength(0);
  });

  it("returns fallback when Treasury API fails", async () => {
    mockFetch.mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/spending-trends");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.trends).toEqual([]);
    expect(body.fallback).toBe(true);
  });

  it("returns fallback when response has no data array", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });

    const req = new NextRequest("http://localhost/api/spending-trends");
    const res = await GET(req);
    const body = await res.json();

    expect(body.trends).toEqual([]);
    expect(body.fallback).toBe(true);
  });

  it("returns 429 when rate limited", async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 45 });

    const req = new NextRequest("http://localhost/api/spending-trends");
    const res = await GET(req);

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("45");
  });
});
