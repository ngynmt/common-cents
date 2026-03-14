import { describe, it, expect, vi, beforeEach } from "vitest";
import type { BillSummary, BillDetail, Sponsor } from "./congress-api";

// Mock all API modules before importing bill-suggester
vi.mock("./congress-api", () => ({
  fetchRecentBills: vi.fn(),
  fetchBillSponsors: vi.fn(),
  fetchBillDetail: vi.fn(),
  fetchBillCommittees: vi.fn(),
  fetchBillCosponsors: vi.fn(),
}));

vi.mock("./bill-refresher", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./bill-refresher")>();
  return {
    ...actual,
    getCurrentCongress: () => 119,
  };
});

import {
  suggestNewBills,
  defaultSuggestOptions,
  type SuggestOptions,
} from "./bill-suggester";
import {
  fetchRecentBills,
  fetchBillSponsors,
  fetchBillDetail,
  fetchBillCommittees,
  fetchBillCosponsors,
} from "./congress-api";

// Helper to create a mock async generator from pages
async function* mockPages(pages: BillSummary[][]) {
  for (const page of pages) yield page;
}

function makeBill(overrides: Partial<BillSummary> = {}): BillSummary {
  return {
    number: 9999,
    type: "HR",
    title: "Test Defense Spending Act",
    congress: 119,
    originChamber: "House",
    latestAction: {
      actionDate: "2026-03-01",
      text: "Reported by committee",
    },
    url: "https://api.congress.gov/v3/bill/119/hr/9999",
    ...overrides,
  };
}

function makeDetail(overrides: Partial<BillDetail> = {}): BillDetail {
  return {
    number: 9999,
    type: "HR",
    title: "Test Defense Spending Act",
    congress: 119,
    actions: { url: "" },
    latestAction: {
      actionDate: "2026-03-01",
      text: "Reported by committee",
    },
    sponsors: [
      {
        bioguideId: "S001234",
        firstName: "Jane",
        lastName: "Smith",
        party: "D",
        state: "CA",
        district: 12,
        fullName: "Rep. Jane Smith",
      },
    ],
    ...overrides,
  };
}

const baseOpts: SuggestOptions = {
  congress: 119,
  minCosponsorsHouse: 50,
  minCosponsorsSenate: 15,
  since: "2026-02-01",
  dryRun: true,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("defaultSuggestOptions", () => {
  it("returns sane defaults", () => {
    const opts = defaultSuggestOptions();
    expect(opts.congress).toBe(119);
    expect(opts.minCosponsorsHouse).toBe(50);
    expect(opts.minCosponsorsSenate).toBe(15);
    expect(opts.dryRun).toBe(false);
    expect(opts.since).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("suggestNewBills", () => {
  it("returns suggestions for bills that pass all filters", async () => {
    const bill = makeBill();
    vi.mocked(fetchRecentBills).mockReturnValue(mockPages([[bill]]));
    vi.mocked(fetchBillCosponsors).mockResolvedValue(67);
    vi.mocked(fetchBillCommittees).mockResolvedValue([
      { name: "Committee on Armed Services", chamber: "House" },
    ]);
    vi.mocked(fetchBillSponsors).mockResolvedValue([
      { bioguideId: "A1", firstName: "A", lastName: "B", party: "D", state: "CA" },
      { bioguideId: "A2", firstName: "C", lastName: "D", party: "R", state: "TX" },
    ]);
    vi.mocked(fetchBillDetail).mockResolvedValue(makeDetail());

    const results = await suggestNewBills(baseOpts);

    expect(results).toHaveLength(1);
    expect(results[0].entry.billNumber).toBe("H.R. 9999");
    expect(results[0].entry.cosponsors).toBe(67);
    expect(results[0].entry.bipartisan).toBe(true);
    expect(results[0].entry.impactedCategories).toContain("defense");
    expect(results[0].entry.status).toBe("in_committee");
    expect(results[0].entry.shortTitle).toBe("NEEDS EDIT");
    expect(results[0].entry.spendingImpacts).toEqual([]);
    expect(results[0].entry.totalAnnualImpact).toBe(0);
  });

  it("skips bills below cosponsor threshold with no committee progress", async () => {
    const bill = makeBill({
      latestAction: { actionDate: "2026-03-01", text: "Introduced in House" },
    });
    vi.mocked(fetchRecentBills).mockReturnValue(mockPages([[bill]]));
    vi.mocked(fetchBillCosponsors).mockResolvedValue(10);

    const results = await suggestNewBills(baseOpts);
    expect(results).toHaveLength(0);
  });

  it("includes bills with committee progress even if below cosponsor threshold", async () => {
    const bill = makeBill({
      latestAction: {
        actionDate: "2026-03-01",
        text: "Reported by committee",
      },
    });
    vi.mocked(fetchRecentBills).mockReturnValue(mockPages([[bill]]));
    vi.mocked(fetchBillCosponsors).mockResolvedValue(5);
    vi.mocked(fetchBillCommittees).mockResolvedValue([
      { name: "Committee on Armed Services", chamber: "House" },
    ]);
    vi.mocked(fetchBillSponsors).mockResolvedValue([]);
    vi.mocked(fetchBillDetail).mockResolvedValue(makeDetail());

    const results = await suggestNewBills(baseOpts);
    expect(results).toHaveLength(1);
    expect(results[0].whySuggested).toContain("status: in committee");
  });

  it("skips bills with no matching budget category", async () => {
    const bill = makeBill({
      title: "Post Office Naming Act of 2026",
      latestAction: {
        actionDate: "2026-03-01",
        text: "Reported by committee",
      },
    });
    vi.mocked(fetchRecentBills).mockReturnValue(mockPages([[bill]]));
    vi.mocked(fetchBillCosponsors).mockResolvedValue(100);
    vi.mocked(fetchBillCommittees).mockResolvedValue([
      { name: "Committee on Oversight and Accountability", chamber: "House" },
    ]);

    const results = await suggestNewBills(baseOpts);
    expect(results).toHaveLength(0);
  });

  it("respects category filter option", async () => {
    const bill = makeBill();
    vi.mocked(fetchRecentBills).mockReturnValue(mockPages([[bill]]));
    vi.mocked(fetchBillCosponsors).mockResolvedValue(67);
    vi.mocked(fetchBillCommittees).mockResolvedValue([
      { name: "Committee on Armed Services", chamber: "House" },
    ]);
    vi.mocked(fetchBillSponsors).mockResolvedValue([]);
    vi.mocked(fetchBillDetail).mockResolvedValue(makeDetail());

    // Filter to healthcare — this defense bill should be excluded
    const results = await suggestNewBills({ ...baseOpts, category: "healthcare" });
    expect(results).toHaveLength(0);
  });

  it("skips bills already in pending-bills (dedup by bill number)", async () => {
    // S. 770 is already in pending-bills.ts
    const bill = makeBill({ number: 770, type: "S" });
    vi.mocked(fetchRecentBills).mockReturnValue(mockPages([[bill]]));
    vi.mocked(fetchBillCosponsors).mockResolvedValue(100);

    const results = await suggestNewBills(baseOpts);
    expect(results).toHaveLength(0);
  });

  it("generates correct congress URL with ordinal suffix", async () => {
    const bill = makeBill();
    vi.mocked(fetchRecentBills).mockReturnValue(mockPages([[bill]]));
    vi.mocked(fetchBillCosponsors).mockResolvedValue(67);
    vi.mocked(fetchBillCommittees).mockResolvedValue([
      { name: "Committee on Armed Services", chamber: "House" },
    ]);
    vi.mocked(fetchBillSponsors).mockResolvedValue([]);
    vi.mocked(fetchBillDetail).mockResolvedValue(makeDetail());

    const results = await suggestNewBills(baseOpts);
    expect(results[0].entry.congressUrl).toBe(
      "https://www.congress.gov/bill/119th-congress/house-bill/9999"
    );
  });

  it("handles Senate bills with correct chamber and thresholds", async () => {
    const bill = makeBill({ type: "S", number: 5000 });
    vi.mocked(fetchRecentBills).mockReturnValue(mockPages([[bill]]));
    vi.mocked(fetchBillCosponsors).mockResolvedValue(20);
    vi.mocked(fetchBillCommittees).mockResolvedValue([
      { name: "Committee on Armed Services", chamber: "Senate" },
    ]);
    vi.mocked(fetchBillSponsors).mockResolvedValue([]);
    vi.mocked(fetchBillDetail).mockResolvedValue(
      makeDetail({
        number: 5000,
        type: "S",
        sponsors: [
          {
            bioguideId: "S001",
            firstName: "John",
            lastName: "Doe",
            party: "R",
            state: "TX",
            fullName: "Sen. John Doe",
          },
        ],
      })
    );

    const results = await suggestNewBills(baseOpts);
    expect(results).toHaveLength(1);
    expect(results[0].entry.champion.chamber).toBe("senate");
    expect(results[0].entry.champion.title).toBe("Senator");
    expect(results[0].entry.billNumber).toBe("S. 5000");
    expect(results[0].entry.congressUrl).toContain("senate-bill");
  });

  it("sorts results by cosponsor count descending", async () => {
    const bill1 = makeBill({ number: 1001, title: "Defense Act A" });
    const bill2 = makeBill({ number: 1002, title: "Defense Act B" });
    vi.mocked(fetchRecentBills).mockReturnValue(mockPages([[bill1, bill2]]));
    vi.mocked(fetchBillCosponsors)
      .mockResolvedValueOnce(50)
      .mockResolvedValueOnce(120);
    vi.mocked(fetchBillCommittees).mockResolvedValue([
      { name: "Committee on Armed Services", chamber: "House" },
    ]);
    vi.mocked(fetchBillSponsors).mockResolvedValue([]);
    vi.mocked(fetchBillDetail)
      .mockResolvedValueOnce(makeDetail({ number: 1001, title: "Defense Act A" }))
      .mockResolvedValueOnce(makeDetail({ number: 1002, title: "Defense Act B" }));

    const results = await suggestNewBills(baseOpts);
    expect(results).toHaveLength(2);
    expect(results[0].entry.cosponsors).toBe(120);
    expect(results[1].entry.cosponsors).toBe(50);
  });

  it("detects bipartisan support from sponsor parties", async () => {
    const bill = makeBill();
    vi.mocked(fetchRecentBills).mockReturnValue(mockPages([[bill]]));
    vi.mocked(fetchBillCosponsors).mockResolvedValue(60);
    vi.mocked(fetchBillCommittees).mockResolvedValue([
      { name: "Committee on Armed Services", chamber: "House" },
    ]);
    // Only D sponsors — not bipartisan
    vi.mocked(fetchBillSponsors).mockResolvedValue([
      { bioguideId: "A1", firstName: "A", lastName: "B", party: "D", state: "CA" },
      { bioguideId: "A2", firstName: "C", lastName: "D", party: "D", state: "NY" },
    ]);
    vi.mocked(fetchBillDetail).mockResolvedValue(makeDetail());

    const results = await suggestNewBills(baseOpts);
    expect(results[0].entry.bipartisan).toBe(false);
  });

  it("builds champion from lead sponsor or falls back to unknown", async () => {
    const bill = makeBill();
    vi.mocked(fetchRecentBills).mockReturnValue(mockPages([[bill]]));
    vi.mocked(fetchBillCosponsors).mockResolvedValue(60);
    vi.mocked(fetchBillCommittees).mockResolvedValue([
      { name: "Committee on Armed Services", chamber: "House" },
    ]);
    vi.mocked(fetchBillSponsors).mockResolvedValue([]);
    vi.mocked(fetchBillDetail).mockResolvedValue(
      makeDetail({ sponsors: undefined })
    );

    const results = await suggestNewBills(baseOpts);
    expect(results[0].entry.champion.name).toBe("Unknown");
  });

  it("handles empty pages gracefully", async () => {
    vi.mocked(fetchRecentBills).mockReturnValue(mockPages([]));

    const results = await suggestNewBills(baseOpts);
    expect(results).toHaveLength(0);
  });

  it("skips unknown bill types", async () => {
    const bill = makeBill({ type: "HCONRES" });
    vi.mocked(fetchRecentBills).mockReturnValue(mockPages([[bill]]));

    const results = await suggestNewBills(baseOpts);
    expect(results).toHaveLength(0);
  });

  it("continues when fetchBillCosponsors fails for a bill", async () => {
    const bill1 = makeBill({ number: 2001 });
    const bill2 = makeBill({ number: 2002 });
    vi.mocked(fetchRecentBills).mockReturnValue(mockPages([[bill1, bill2]]));
    vi.mocked(fetchBillCosponsors)
      .mockRejectedValueOnce(new Error("API error"))
      .mockResolvedValueOnce(60);
    vi.mocked(fetchBillCommittees).mockResolvedValue([
      { name: "Committee on Armed Services", chamber: "House" },
    ]);
    vi.mocked(fetchBillSponsors).mockResolvedValue([]);
    vi.mocked(fetchBillDetail).mockResolvedValue(makeDetail({ number: 2002 }));

    const results = await suggestNewBills(baseOpts);
    // First bill skipped due to error, second succeeds
    expect(results).toHaveLength(1);
    expect(results[0].entry.id).toContain("2002");
  });

  it("skeleton entry has correct placeholder structure", async () => {
    const bill = makeBill();
    vi.mocked(fetchRecentBills).mockReturnValue(mockPages([[bill]]));
    vi.mocked(fetchBillCosponsors).mockResolvedValue(67);
    vi.mocked(fetchBillCommittees).mockResolvedValue([
      { name: "Committee on Armed Services", chamber: "House" },
    ]);
    vi.mocked(fetchBillSponsors).mockResolvedValue([]);
    vi.mocked(fetchBillDetail).mockResolvedValue(makeDetail());

    const results = await suggestNewBills(baseOpts);
    const entry = results[0].entry;

    expect(entry.id).toBe("hr-9999-placeholder");
    expect(entry.congress).toBe(119);
    expect(entry.shortTitle).toBe("NEEDS EDIT");
    expect(entry.summary).toContain("NEEDS EDIT");
    expect(entry.spendingImpacts).toEqual([]);
    expect(entry.totalAnnualImpact).toBe(0);
    expect(entry.cboScoreUrl).toBe("");
  });
});
