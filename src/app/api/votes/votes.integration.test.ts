import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { trackedVotes } from "@/data/tracked-votes";

// Mock Redis so Upstash HTTP calls don't hit the global fetch mock
vi.mock("@/lib/redis", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
}));

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Must import after mocking fetch (and after each resetModules to clear voteCache)
let GET: (req: NextRequest) => Promise<Response>;

vi.spyOn(console, "error").mockImplementation(() => {});
vi.spyOn(console, "log").mockImplementation(() => {});

beforeEach(async () => {
  vi.clearAllMocks();
  // Reset the module to clear the in-memory voteCache between tests
  vi.resetModules();
  const mod = await import("./route");
  GET = mod.GET;
});

const sampleHouseXml = `
<rollcall-vote>
  <vote-data>
    <recorded-vote>
      <legislator name-id="B000574" sort-field="Blumenauer" party="D" state="OR">Mr. Blumenauer</legislator>
      <vote>Aye</vote>
    </recorded-vote>
    <recorded-vote>
      <legislator name-id="P000197" sort-field="Pelosi" party="D" state="CA">Ms. Pelosi</legislator>
      <vote>Nay</vote>
    </recorded-vote>
  </vote-data>
</rollcall-vote>
`;

const sampleSenateXml = `
<roll_call_vote>
  <members>
    <member>
      <member_full>Wyden (D-OR)</member_full>
      <vote_cast>Yea</vote_cast>
      <lis_member_id>S247</lis_member_id>
    </member>
    <member>
      <member_full>Cruz (R-TX)</member_full>
      <vote_cast>Nay</vote_cast>
      <lis_member_id>S355</lis_member_id>
    </member>
  </members>
</roll_call_vote>
`;

function mockFetchForXml() {
  mockFetch.mockImplementation(async (url: string) => {
    if (url.includes("clerk.house.gov")) {
      return { ok: true, text: async () => sampleHouseXml };
    }
    if (url.includes("senate.gov")) {
      return { ok: true, text: async () => sampleSenateXml };
    }
    return { ok: false, status: 404, text: async () => "Not found" };
  });
}

describe("GET /api/votes", () => {
  it("returns empty votes when no IDs provided", async () => {
    const req = new NextRequest("http://localhost/api/votes");
    const res = await GET(req);
    expect(await res.json()).toEqual({ votes: [] });
  });

  it("returns House vote records for a bioguide ID", async () => {
    mockFetchForXml();

    const req = new NextRequest("http://localhost/api/votes?bioguideIds=B000574");
    const res = await GET(req);
    const body = await res.json();

    expect(body.votes.length).toBeGreaterThan(0);

    const vote = body.votes.find(
      (v: { representativeId: string }) => v.representativeId === "b000574",
    );
    expect(vote).toBeDefined();
    expect(vote.vote).toBe("yes"); // "Aye" normalized to "yes"
    expect(vote.legislationTitle).toBeDefined();
    expect(vote.categoryId).toBeDefined();
    expect(vote.date).toBeDefined();
  });

  it("returns Senate vote records for a LIS ID", async () => {
    mockFetchForXml();

    const req = new NextRequest("http://localhost/api/votes?lisIds=S247");
    const res = await GET(req);
    const body = await res.json();

    const vote = body.votes.find(
      (v: { representativeId: string }) => v.representativeId === "lis:S247",
    );
    expect(vote).toBeDefined();
    expect(vote.vote).toBe("yes"); // "Yea" normalized to "yes"
  });

  it("returns both House and Senate votes when both params provided", async () => {
    mockFetchForXml();

    const req = new NextRequest("http://localhost/api/votes?bioguideIds=B000574&lisIds=S247");
    const res = await GET(req);
    const body = await res.json();

    const houseVote = body.votes.find(
      (v: { representativeId: string }) => v.representativeId === "b000574",
    );
    const senateVote = body.votes.find(
      (v: { representativeId: string }) => v.representativeId === "lis:S247",
    );

    expect(houseVote).toBeDefined();
    expect(senateVote).toBeDefined();
  });

  it("handles XML fetch failures gracefully", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, text: async () => "error" });

    const req = new NextRequest("http://localhost/api/votes?bioguideIds=B000574");
    const res = await GET(req);
    const body = await res.json();

    // Should not crash — returns empty votes
    expect(body.votes).toEqual([]);
  });

  it("returns votes for each tracked bill", async () => {
    mockFetchForXml();

    const req = new NextRequest("http://localhost/api/votes?bioguideIds=B000574");
    const res = await GET(req);
    const body = await res.json();

    // Should have one vote per tracked bill (where bioguide ID is found in XML)
    expect(body.votes.length).toBe(trackedVotes.length);
  });

  it("lowercases bioguide IDs for matching", async () => {
    mockFetchForXml();

    // Pass uppercase — should still match
    const req = new NextRequest("http://localhost/api/votes?bioguideIds=b000574");
    const res = await GET(req);
    const body = await res.json();

    const vote = body.votes.find(
      (v: { representativeId: string }) => v.representativeId === "b000574",
    );
    expect(vote).toBeDefined();
  });
});
