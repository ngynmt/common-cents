import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { FEC_CANDIDATE_IDS } from "@/data/fec-candidate-ids";

// Mock Redis so Upstash HTTP calls don't hit the global fetch mock
vi.mock("@/lib/redis", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
}));

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const { GET } = await import("./route");

vi.spyOn(console, "error").mockImplementation(() => {});
vi.spyOn(console, "log").mockImplementation(() => {});

// Find a bioguide ID that has a known FEC mapping
const knownBioguideId = Object.keys(FEC_CANDIDATE_IDS)[0];
const knownFecId = FEC_CANDIDATE_IDS[knownBioguideId];

function fecResponse(results: unknown[]) {
  return { ok: true, json: async () => ({ results }) };
}

function mockFecApis(overrides: { candidate?: object; totals?: object; employers?: object[]; committees?: object[]; outsideSpending?: object[] } = {}) {
  mockFetch.mockImplementation(async (url: string) => {
    const u = typeof url === "string" ? url : String(url);

    if (u.includes("/candidates/search/")) {
      return fecResponse(overrides.candidate ? [overrides.candidate] : [{
        candidate_id: "H0OR03000",
        name: "BLUMENAUER, EARL",
        party: "DEM",
        office: "H",
        state: "OR",
      }]);
    }

    if (u.includes("/candidate/") && u.includes("/totals/")) {
      return fecResponse(overrides.totals ? [overrides.totals] : [{
        receipts: 1500000,
        contributions: 1400000,
        individual_contributions: 1200000,
        cycle: 2024,
      }]);
    }

    if (u.includes("/candidate/") && u.includes("/committees/")) {
      return fecResponse(overrides.committees ?? [{
        committee_id: "C00012345",
        designation: "P",
        committee_type: "H",
      }]);
    }

    if (u.includes("/candidate/") && !u.includes("/totals/") && !u.includes("/committees/")) {
      return fecResponse([overrides.candidate ?? {
        candidate_id: knownFecId || "H0OR03000",
        name: "BLUMENAUER, EARL",
        party: "DEM",
        office: "H",
        state: "OR",
      }]);
    }

    if (u.includes("/schedules/schedule_a/by_employer/")) {
      return fecResponse(overrides.employers ?? [
        { employer: "MICROSOFT", total: 50000, count: 20 },
        { employer: "GOOGLE", total: 40000, count: 15 },
        { employer: "N/A", total: 30000, count: 100 },
        { employer: "INFORMATION REQUESTED", total: 25000, count: 80 },
      ]);
    }

    if (u.includes("/schedules/schedule_e/by_candidate/")) {
      return fecResponse(overrides.outsideSpending ?? [
        { committee_name: "AMERICANS FOR PROSPERITY", total: 100000, count: 5, support_oppose_indicator: "O" },
      ]);
    }

    return { ok: false, status: 404, json: async () => ({}) };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/campaign-finance", () => {
  it("returns 400 when no params provided", async () => {
    const req = new NextRequest("http://localhost/api/campaign-finance");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("returns finance data using search param", async () => {
    mockFecApis();

    const req = new NextRequest("http://localhost/api/campaign-finance?search=Blumenauer");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.search).toBeDefined();
    expect(body.data.search.totalRaised).toBe(1500000);
    expect(body.data.search.party).toBe("D");
    expect(body.data.search.chamber).toBe("house");
  });

  it("returns finance data by bioguideId with FEC mapping", async () => {
    if (!knownBioguideId) return; // skip if no FEC mappings exist
    mockFecApis();

    const req = new NextRequest(
      `http://localhost/api/campaign-finance?bioguideIds=${knownBioguideId}`,
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data[knownBioguideId]).toBeDefined();
    expect(body.data[knownBioguideId].totalRaised).toBeGreaterThan(0);
  });

  it("falls back to name search when no FEC ID mapping exists", async () => {
    mockFecApis();

    const req = new NextRequest(
      "http://localhost/api/campaign-finance?bioguideIds=x999999&names=Jane%20Doe&states=OR&chambers=house",
    );
    const res = await GET(req);
    const body = await res.json();

    expect(body.data["x999999"]).toBeDefined();
    // Should have used name search fallback
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/candidates/search/"),
      expect.anything(),
    );
  });

  it("filters junk employers from top employers list", async () => {
    mockFecApis({
      employers: [
        { employer: "MICROSOFT", total: 50000, count: 20 },
        { employer: "N/A", total: 30000, count: 100 },
        { employer: "NONE", total: 28000, count: 90 },
        { employer: "INFORMATION REQUESTED", total: 25000, count: 80 },
        { employer: "REFUSED", total: 20000, count: 60 },
        { employer: "GOOGLE", total: 15000, count: 10 },
      ],
    });

    const req = new NextRequest("http://localhost/api/campaign-finance?search=Test");
    const res = await GET(req);
    const body = await res.json();

    const employers = body.data.search.topEmployers;
    const employerNames = employers.map((e: { employer: string }) => e.employer);

    expect(employerNames).toContain("Microsoft");
    expect(employerNames).toContain("Google");
    expect(employerNames).not.toContain("N/A");
    expect(employerNames).not.toContain("None");
    expect(employerNames).not.toContain("Information Requested");
  });

  it("returns null when all FEC calls fail", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });

    const req = new NextRequest(
      "http://localhost/api/campaign-finance?bioguideIds=x999999&names=Nobody",
    );
    const res = await GET(req);
    const body = await res.json();

    expect(body.data["x999999"]).toBeNull();
  });

  it("selects the most recent cycle with receipts", async () => {
    let callIndex = 0;
    mockFetch.mockImplementation(async (url: string) => {
      const u = String(url);

      if (u.includes("/candidate/") && u.includes("/totals/")) {
        callIndex++;
        // First cycle (2026) has zero receipts, second (2024) has data
        if (u.includes("cycle=2026")) {
          return fecResponse([{ receipts: 0, cycle: 2026 }]);
        }
        if (u.includes("cycle=2024")) {
          return fecResponse([{ receipts: 500000, cycle: 2024 }]);
        }
        return fecResponse([]);
      }

      // Default mocks for other endpoints
      if (u.includes("/candidates/search/") || (u.includes("/candidate/") && !u.includes("/totals/") && !u.includes("/committees/"))) {
        return fecResponse([{
          candidate_id: "H0TEST00",
          name: "TEST CANDIDATE",
          party: "DEM",
          office: "H",
          state: "OR",
        }]);
      }
      if (u.includes("/committees/")) return fecResponse([{ committee_id: "C00099", designation: "P" }]);
      if (u.includes("/schedule_a/")) return fecResponse([]);
      if (u.includes("/schedule_e/")) return fecResponse([]);
      return { ok: false, status: 404, json: async () => ({}) };
    });

    const req = new NextRequest("http://localhost/api/campaign-finance?search=Test");
    const res = await GET(req);
    const body = await res.json();

    expect(body.data.search.cycle).toBe(2024);
    expect(body.data.search.totalRaised).toBe(500000);
  });

  it("title-cases employer and candidate names", async () => {
    mockFecApis({
      employers: [{ employer: "ACME CORPORATION", total: 50000, count: 20 }],
    });

    const req = new NextRequest("http://localhost/api/campaign-finance?search=Test");
    const res = await GET(req);
    const body = await res.json();

    expect(body.data.search.name).toBe("Blumenauer, Earl");
    expect(body.data.search.topEmployers[0].employer).toBe("Acme Corporation");
  });
});
