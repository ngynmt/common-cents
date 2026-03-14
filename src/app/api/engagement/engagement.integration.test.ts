import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/redis", () => ({
  incrementCounter: vi.fn(),
  getCounters: vi.fn(),
  checkRateLimit: vi.fn(),
  keys: {
    billSupport: (id: string) => `bill:${id}:support`,
    billOppose: (id: string) => `bill:${id}:oppose`,
    billContacted: (id: string) => `bill:${id}:contacted`,
    rateLimit: (ip: string) => `ratelimit:engagement:${ip}`,
  },
}));

import { GET, POST } from "./route";
import { incrementCounter, getCounters, checkRateLimit } from "@/lib/redis";
import { pendingBills } from "@/data/pending-bills";

const mockGetCounters = vi.mocked(getCounters);
const mockIncrementCounter = vi.mocked(incrementCounter);
const mockCheckRateLimit = vi.mocked(checkRateLimit);

// Use a real bill ID from the data
const VALID_BILL_ID = pendingBills[0].id;

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckRateLimit.mockResolvedValue({ allowed: true });
});

describe("GET /api/engagement", () => {
  it("returns empty counts when no bill IDs provided", async () => {
    const req = new NextRequest("http://localhost/api/engagement");
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ counts: {} });
  });

  it("returns empty counts for invalid bill IDs", async () => {
    const req = new NextRequest("http://localhost/api/engagement?bills=fake-id-123");
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ counts: {} });
  });

  it("returns counts for valid bill IDs", async () => {
    mockGetCounters.mockResolvedValue({
      [`bill:${VALID_BILL_ID}:support`]: 10,
      [`bill:${VALID_BILL_ID}:oppose`]: 3,
      [`bill:${VALID_BILL_ID}:contacted`]: 5,
    });

    const req = new NextRequest(`http://localhost/api/engagement?bills=${VALID_BILL_ID}`);
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.counts[VALID_BILL_ID]).toEqual({
      support: 10,
      oppose: 3,
      contacted: 5,
    });
  });

  it("filters out invalid IDs but returns valid ones", async () => {
    mockGetCounters.mockResolvedValue({
      [`bill:${VALID_BILL_ID}:support`]: 1,
      [`bill:${VALID_BILL_ID}:oppose`]: 0,
      [`bill:${VALID_BILL_ID}:contacted`]: 0,
    });

    const req = new NextRequest(
      `http://localhost/api/engagement?bills=${VALID_BILL_ID},nonexistent-bill`,
    );
    const res = await GET(req);
    const body = await res.json();

    expect(body.counts[VALID_BILL_ID]).toBeDefined();
    expect(body.counts["nonexistent-bill"]).toBeUndefined();
  });
});

describe("POST /api/engagement", () => {
  it("returns 429 when rate limited", async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 30 });

    const req = new NextRequest("http://localhost/api/engagement", {
      method: "POST",
      body: JSON.stringify({ billId: VALID_BILL_ID, action: "support" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("30");
  });

  it("returns 400 for invalid bill ID", async () => {
    const req = new NextRequest("http://localhost/api/engagement", {
      method: "POST",
      body: JSON.stringify({ billId: "fake-id", action: "support" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Invalid bill ID");
  });

  it("returns 400 for invalid action", async () => {
    const req = new NextRequest("http://localhost/api/engagement", {
      method: "POST",
      body: JSON.stringify({ billId: VALID_BILL_ID, action: "invalid" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Invalid action");
  });

  it("increments support counter and returns new count", async () => {
    mockIncrementCounter.mockResolvedValue(42);

    const req = new NextRequest("http://localhost/api/engagement", {
      method: "POST",
      body: JSON.stringify({ billId: VALID_BILL_ID, action: "support" }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.count).toBe(42);
    expect(mockIncrementCounter).toHaveBeenCalledWith(`bill:${VALID_BILL_ID}:support`);
  });

  it("increments oppose counter", async () => {
    mockIncrementCounter.mockResolvedValue(7);

    const req = new NextRequest("http://localhost/api/engagement", {
      method: "POST",
      body: JSON.stringify({ billId: VALID_BILL_ID, action: "oppose" }),
    });
    const res = await POST(req);

    expect((await res.json()).count).toBe(7);
    expect(mockIncrementCounter).toHaveBeenCalledWith(`bill:${VALID_BILL_ID}:oppose`);
  });

  it("increments contacted counter", async () => {
    mockIncrementCounter.mockResolvedValue(15);

    const req = new NextRequest("http://localhost/api/engagement", {
      method: "POST",
      body: JSON.stringify({ billId: VALID_BILL_ID, action: "contacted" }),
    });
    const res = await POST(req);

    expect((await res.json()).count).toBe(15);
    expect(mockIncrementCounter).toHaveBeenCalledWith(`bill:${VALID_BILL_ID}:contacted`);
  });

  it("extracts IP from x-forwarded-for header", async () => {
    mockIncrementCounter.mockResolvedValue(1);

    const req = new NextRequest("http://localhost/api/engagement", {
      method: "POST",
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
      body: JSON.stringify({ billId: VALID_BILL_ID, action: "support" }),
    });
    await POST(req);

    expect(mockCheckRateLimit).toHaveBeenCalledWith("1.2.3.4");
  });
});
