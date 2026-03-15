import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock Redis so Upstash HTTP calls don't hit the global fetch mock
vi.mock("@/lib/redis", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  getCached: vi.fn().mockResolvedValue(null),
  setCached: vi.fn().mockResolvedValue(undefined),
  keys: {
    geoCache: (zip: string) => `geo:${zip}`,
  },
}));

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Must import after mocking fetch
const { GET } = await import("./route");

vi.spyOn(console, "error").mockImplementation(() => {});
vi.spyOn(console, "log").mockImplementation(() => {});

function geocodioResponse(districts: object[]) {
  return {
    results: [
      {
        address_components: { state: "OR" },
        fields: { congressional_districts: districts },
      },
    ],
  };
}

function makeLegislator(
  overrides: Partial<{
    type: string;
    bioguide_id: string;
    lis_id: string;
    last_name: string;
    first_name: string;
    party: string;
    seniority: string;
  }> = {},
) {
  const type = overrides.type ?? "representative";
  return {
    type,
    seniority: overrides.seniority ?? "10",
    bio: {
      last_name: overrides.last_name ?? "Smith",
      first_name: overrides.first_name ?? "Jane",
      birthday: "1970-01-01",
      gender: "F",
      party: overrides.party ?? "Democrat",
      photo_url: "https://example.com/photo.jpg",
    },
    contact: {
      url: "https://example.com",
      address: "123 Capitol",
      phone: "202-555-0100",
      contact_form: "https://example.com/contact",
    },
    references: {
      bioguide_id: overrides.bioguide_id ?? "S000001",
      lis_id: overrides.lis_id,
    },
  };
}

function makeDistrict(districtNumber: number, proportion: number, legislators: object[]) {
  return {
    name: `Congressional District ${districtNumber}`,
    district_number: districtNumber,
    ocd_id: `ocd-division/country:us/state:or/cd:${districtNumber}`,
    proportion,
    current_legislators: legislators,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/representatives", () => {
  it("returns 400 when ZIP is missing", async () => {
    const req = new NextRequest("http://localhost/api/representatives");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when ZIP is too short", async () => {
    const req = new NextRequest("http://localhost/api/representatives?zip=123");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("returns fallback when Geocodio returns non-OK status", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, text: async () => "error" });

    const req = new NextRequest("http://localhost/api/representatives?zip=97201");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.fallback).toBe(true);
    expect(body.representatives).toBeNull();
  });

  it("returns fallback when Geocodio returns empty results", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    });

    const req = new NextRequest("http://localhost/api/representatives?zip=00000");
    const res = await GET(req);
    const body = await res.json();

    expect(body.fallback).toBe(true);
    expect(body.representatives).toBeNull();
  });

  it("returns fallback when fetch throws", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    const req = new NextRequest("http://localhost/api/representatives?zip=97201");
    const res = await GET(req);
    const body = await res.json();

    expect(body.fallback).toBe(true);
    expect(body.representatives).toBeNull();
  });

  it("returns representatives for a single-district ZIP", async () => {
    const senator1 = makeLegislator({
      type: "senator",
      bioguide_id: "W000779",
      lis_id: "S247",
      first_name: "Ron",
      last_name: "Wyden",
      party: "Democrat",
      seniority: "5",
    });
    const senator2 = makeLegislator({
      type: "senator",
      bioguide_id: "M001176",
      lis_id: "S322",
      first_name: "Jeff",
      last_name: "Merkley",
      party: "Democrat",
      seniority: "20",
    });
    const houseRep = makeLegislator({
      type: "representative",
      bioguide_id: "B000574",
      first_name: "Earl",
      last_name: "Blumenauer",
      party: "Democrat",
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => geocodioResponse([makeDistrict(3, 1, [senator1, senator2, houseRep])]),
    });

    const req = new NextRequest("http://localhost/api/representatives?zip=97201");
    const res = await GET(req);
    const body = await res.json();

    expect(body.fallback).toBe(false);
    expect(body.state).toBe("OR");
    expect(body.representatives).toHaveLength(3);

    // Senators should come first
    expect(body.representatives[0].chamber).toBe("senate");
    expect(body.representatives[1].chamber).toBe("senate");
    expect(body.representatives[2].chamber).toBe("house");

    // bioguide IDs should be lowercased
    expect(body.representatives[0].id).toBe("w000779");

    // Party should be parsed
    expect(body.representatives[0].party).toBe("D");

    // LIS ID should be present for senators
    expect(body.representatives[0].lisId).toBe("S247");
  });

  it("deduplicates senators across multi-district ZIPs", async () => {
    const senator = makeLegislator({
      type: "senator",
      bioguide_id: "W000779",
      lis_id: "S247",
      first_name: "Ron",
      last_name: "Wyden",
      party: "Democrat",
    });
    const rep1 = makeLegislator({
      type: "representative",
      bioguide_id: "B000574",
      first_name: "Earl",
      last_name: "Blumenauer",
    });
    const rep2 = makeLegislator({
      type: "representative",
      bioguide_id: "S000510",
      first_name: "Kurt",
      last_name: "Schrader",
      party: "Republican",
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () =>
        geocodioResponse([
          makeDistrict(3, 0.7, [senator, rep1]),
          makeDistrict(5, 0.3, [senator, rep2]),
        ]),
    });

    const req = new NextRequest("http://localhost/api/representatives?zip=97068");
    const res = await GET(req);
    const body = await res.json();

    // Senator appears only once despite being in both districts
    const senators = body.representatives.filter(
      (r: { chamber: string }) => r.chamber === "senate",
    );
    expect(senators).toHaveLength(1);

    // Both house reps present
    const houseReps = body.representatives.filter(
      (r: { chamber: string }) => r.chamber === "house",
    );
    expect(houseReps).toHaveLength(2);

    // Multi-district house reps should show proportion
    expect(houseReps[0].district).toContain("70%");
    expect(houseReps[1].district).toContain("30%");
  });

  it("parses Republican party correctly", async () => {
    const rep = makeLegislator({
      type: "representative",
      bioguide_id: "R000001",
      party: "Republican",
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => geocodioResponse([makeDistrict(1, 1, [rep])]),
    });

    const req = new NextRequest("http://localhost/api/representatives?zip=97201");
    const res = await GET(req);
    const body = await res.json();

    expect(body.representatives[0].party).toBe("R");
  });
});
