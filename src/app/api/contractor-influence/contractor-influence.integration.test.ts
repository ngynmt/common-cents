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

function fecResponse(results: unknown[]) {
  return { ok: true, json: async () => ({ results }) };
}

const SAMPLE_CONTRIBUTIONS = [
  {
    committee_id: "C00012345",
    candidate_id: "H0CA28046",
    committee: { name: "SMITH FOR CONGRESS" },
    contribution_receipt_amount: 2800,
  },
  {
    committee_id: "C00012345",
    candidate_id: "H0CA28046",
    committee: { name: "SMITH FOR CONGRESS" },
    contribution_receipt_amount: 1500,
  },
  {
    committee_id: "C00067890",
    candidate_id: "S0NY00001",
    committee: { name: "JONES FOR SENATE" },
    contribution_receipt_amount: 5000,
  },
];

const SAMPLE_CANDIDATE = {
  candidate_id: "H0CA28046",
  name: "SMITH, JOHN",
  party: "DEM",
  office: "H",
  state: "CA",
};

const SAMPLE_CANDIDATE_2 = {
  candidate_id: "S0NY00001",
  name: "JONES, MARY",
  party: "REP",
  office: "S",
  state: "NY",
};

function mockFecApis() {
  mockFetch.mockImplementation(async (url: string) => {
    const u = typeof url === "string" ? url : String(url);

    if (u.includes("/schedules/schedule_a/")) {
      return fecResponse(SAMPLE_CONTRIBUTIONS);
    }
    if (u.includes("/candidate/H0CA28046/")) {
      return fecResponse([SAMPLE_CANDIDATE]);
    }
    if (u.includes("/candidate/S0NY00001/")) {
      return fecResponse([SAMPLE_CANDIDATE_2]);
    }
    if (u.includes("/committee/")) {
      return fecResponse([]);
    }
    return fecResponse([]);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckRateLimit.mockResolvedValue({ allowed: true });
});

describe("GET /api/contractor-influence", () => {
  it("returns 400 when contractor parameter is missing", async () => {
    const req = new NextRequest("http://localhost/api/contractor-influence");
    const res = await GET(req);

    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("contractor name");
  });

  it("returns 400 for empty contractor parameter", async () => {
    const req = new NextRequest("http://localhost/api/contractor-influence?contractor=");
    const res = await GET(req);

    expect(res.status).toBe(400);
  });

  it("returns aggregated donation data by recipient", async () => {
    mockFecApis();

    const req = new NextRequest("http://localhost/api/contractor-influence?contractor=LOCKHEED+MARTIN");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.influence).not.toBeNull();
    expect(body.influence.contractorName).toBe("LOCKHEED MARTIN");
    expect(body.influence.topRecipients.length).toBeGreaterThan(0);

    // Jones got $5000, Smith got $4300 — Jones should be first
    expect(body.influence.topRecipients[0].recipientName).toBe("Jones, Mary");
    expect(body.influence.topRecipients[0].total).toBe(5000);
    expect(body.influence.topRecipients[0].recipientParty).toBe("R");
    expect(body.influence.topRecipients[0].recipientOffice).toBe("senate");

    expect(body.influence.topRecipients[1].recipientName).toBe("Smith, John");
    expect(body.influence.topRecipients[1].total).toBe(4300);
    expect(body.influence.topRecipients[1].recipientParty).toBe("D");
  });

  it("returns null when no FEC data found", async () => {
    mockFetch.mockResolvedValue(fecResponse([]));

    const req = new NextRequest("http://localhost/api/contractor-influence?contractor=UNKNOWN+CORP");
    const res = await GET(req);
    const body = await res.json();

    expect(body.influence).toBeNull();
  });

  it("tries name variants for multi-word contractors", async () => {
    // First variant returns nothing, second works
    let callCount = 0;
    mockFetch.mockImplementation(async (url: string) => {
      const u = typeof url === "string" ? url : String(url);
      if (u.includes("/schedules/schedule_a/")) {
        callCount++;
        if (callCount <= 3) return fecResponse([]); // First variant × 3 cycles
        return fecResponse(SAMPLE_CONTRIBUTIONS);
      }
      if (u.includes("/candidate/")) return fecResponse([SAMPLE_CANDIDATE]);
      return fecResponse([]);
    });

    const req = new NextRequest(
      "http://localhost/api/contractor-influence?contractor=GENERAL+DYNAMICS+INFORMATION+TECHNOLOGY",
    );
    const res = await GET(req);
    const body = await res.json();

    // Should have eventually found data with a shorter variant
    expect(body.influence).not.toBeNull();
  });

  it("falls back to committee name when candidate lookup fails", async () => {
    mockFetch.mockImplementation(async (url: string) => {
      const u = typeof url === "string" ? url : String(url);
      if (u.includes("/schedules/schedule_a/")) {
        return fecResponse([
          {
            committee_id: "C00099999",
            candidate_id: "",
            committee: { name: "MYSTERY PAC" },
            contribution_receipt_amount: 1000,
          },
        ]);
      }
      // All candidate/committee lookups return empty
      return fecResponse([]);
    });

    const req = new NextRequest("http://localhost/api/contractor-influence?contractor=BOEING");
    const res = await GET(req);
    const body = await res.json();

    expect(body.influence).not.toBeNull();
    expect(body.influence.topRecipients[0].recipientName).toBe("Mystery Pac");
  });

  it("returns 429 when rate limited", async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 15 });

    const req = new NextRequest("http://localhost/api/contractor-influence?contractor=BOEING");
    const res = await GET(req);

    expect(res.status).toBe(429);
  });
});
