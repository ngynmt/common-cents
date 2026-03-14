import { describe, it, expect } from "vitest";
import { parseOmbTable32, type OmbParseResult } from "./omb-parser";
import {
  mapOmbToCategories,
  type MappedBudgetData,
} from "./budget-mapper";
import { validateBudgetData } from "./budget-validator";
import { getBudgetData } from "../../src/data/budget";
import * as XLSX from "xlsx";

// ---------------------------------------------------------------------------
// Helpers — build a minimal OMB-style Excel workbook in memory
// ---------------------------------------------------------------------------

interface MockRow {
  label: string;
  amount: number; // in millions
}

function buildOmbWorkbook(
  rows: MockRow[],
  year: number,
  extraYears: number[] = []
): Buffer {
  const years = [year, ...extraYears].sort();
  const headerRow = ["Function/Subfunction", ...years.map(String)];
  const yearIdx = years.indexOf(year);

  const data: (string | number)[][] = [headerRow];
  for (const row of rows) {
    const cells: (string | number)[] = [row.label];
    for (let i = 0; i < years.length; i++) {
      cells.push(i === yearIdx ? row.amount : 0);
    }
    data.push(cells);
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, "Table 3.2");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

/**
 * A minimal but realistic OMB-style sheet with two functions + subfunctions.
 * Amounts are in millions.
 */
const BASIC_ROWS: MockRow[] = [
  { label: "National Defense: (050)", amount: 900_000 },
  { label: "Department of Defense—Military: (051)", amount: 800_000 },
  { label: "Other Defense: (053)", amount: 100_000 },
  { label: "International Affairs: (150)", amount: 65_000 },
  { label: "International Development: (151)", amount: 30_000 },
  { label: "International Security: (152)", amount: 35_000 },
  { label: "General Science, Space, and Technology: (250)", amount: 40_000 },
  { label: "General Science: (251)", amount: 40_000 },
  { label: "Energy: (270)", amount: 10_000 },
  { label: "Energy Supply: (271)", amount: 10_000 },
  { label: "Natural Resources and Environment: (300)", amount: 25_000 },
  { label: "Water Resources: (301)", amount: 25_000 },
  { label: "Agriculture: (350)", amount: 42_000 },
  { label: "Farm Income Stabilization: (351)", amount: 42_000 },
  { label: "Commerce and Housing Credit: (370)", amount: 20_000 },
  { label: "Mortgage Credit: (371)", amount: 20_000 },
  { label: "Transportation: (400)", amount: 120_000 },
  { label: "Ground Transportation: (401)", amount: 120_000 },
  { label: "Community and Regional Development: (450)", amount: 35_000 },
  { label: "Community Development: (451)", amount: 35_000 },
  { label: "Education, Training, Employment, Social Services: (500)", amount: 265_000 },
  { label: "Elementary, Secondary, and Vocational Education: (501)", amount: 265_000 },
  { label: "Health: (550)", amount: 800_000 },
  { label: "Health Care Services: (551)", amount: 800_000 },
  { label: "Medicare: (570)", amount: 900_000 },
  { label: "Medicare: (571)", amount: 900_000 },
  { label: "Income Security: (600)", amount: 660_000 },
  { label: "General Retirement and Disability Insurance: (601)", amount: 660_000 },
  { label: "Social Security: (650)", amount: 1_500_000 },
  { label: "OASDI: (651)", amount: 1_500_000 },
  { label: "Veterans Benefits and Services: (700)", amount: 190_000 },
  { label: "Income Security for Veterans: (701)", amount: 190_000 },
  { label: "Administration of Justice: (750)", amount: 82_000 },
  { label: "Federal Law Enforcement Activities: (751)", amount: 40_000 },
  { label: "Federal Correctional Activities: (753)", amount: 10_000 },
  { label: "Criminal Justice Assistance: (754)", amount: 32_000 },
  { label: "General Government: (800)", amount: 30_000 },
  { label: "Legislative Functions: (801)", amount: 30_000 },
  { label: "Net Interest: (900)", amount: 950_000 },
  { label: "Interest on the Public Debt: (901)", amount: 950_000 },
  { label: "Allowances: (920)", amount: 1_000 },
  { label: "Allowances: (921)", amount: 1_000 },
  { label: "Undistributed Offsetting Receipts: (950)", amount: -150_000 },
  { label: "Employer Share, Employee Retirement: (951)", amount: -150_000 },
];

// ---------------------------------------------------------------------------
// omb-parser tests
// ---------------------------------------------------------------------------

describe("parseOmbTable32", () => {
  it("parses a basic workbook and finds the requested year", () => {
    const buf = buildOmbWorkbook(BASIC_ROWS, 2025, [2024]);
    const result = parseOmbTable32(buf, 2025);

    expect(result.year).toBe(2025);
    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.availableYears).toContain(2024);
    expect(result.availableYears).toContain(2025);
  });

  it("converts amounts from millions to billions", () => {
    const buf = buildOmbWorkbook(BASIC_ROWS, 2025);
    const result = parseOmbTable32(buf, 2025);

    // National Defense 900_000 millions = 900 billions
    const defenseRow = result.rows.find(
      (r) => r.functionCode === 50 && r.subfunctionCode === 50
    );
    expect(defenseRow).toBeDefined();
    expect(defenseRow!.amount).toBe(900);
  });

  it("throws when the requested year is not found", () => {
    const buf = buildOmbWorkbook(BASIC_ROWS, 2025);
    expect(() => parseOmbTable32(buf, 2030)).toThrow(/Year 2030 not found/);
  });

  it("parses function codes correctly from labels", () => {
    const buf = buildOmbWorkbook(BASIC_ROWS, 2025);
    const result = parseOmbTable32(buf, 2025);

    const functionCodes = new Set(result.rows.map((r) => r.functionCode));
    expect(functionCodes).toContain(50); // defense
    expect(functionCodes).toContain(150); // international
    expect(functionCodes).toContain(650); // social security
    expect(functionCodes).toContain(900); // interest
  });

  it("distinguishes function rows from subfunction rows", () => {
    const buf = buildOmbWorkbook(BASIC_ROWS, 2025);
    const result = parseOmbTable32(buf, 2025);

    // Function rows: functionCode === subfunctionCode
    const functionRows = result.rows.filter(
      (r) => r.functionCode === r.subfunctionCode
    );
    // Subfunction rows: different codes
    const subRows = result.rows.filter(
      (r) => r.functionCode !== r.subfunctionCode
    );

    expect(functionRows.length).toBeGreaterThan(0);
    expect(subRows.length).toBeGreaterThan(0);

    // Subfunction 051 should have functionCode 050
    const sub051 = subRows.find((r) => r.subfunctionCode === 51);
    expect(sub051).toBeDefined();
    expect(sub051!.functionCode).toBe(50);
  });

  it("handles negative amounts (offsetting receipts)", () => {
    const buf = buildOmbWorkbook(BASIC_ROWS, 2025);
    const result = parseOmbTable32(buf, 2025);

    const offsetRow = result.rows.find(
      (r) => r.functionCode === 950 && r.subfunctionCode === 950
    );
    expect(offsetRow).toBeDefined();
    expect(offsetRow!.amount).toBe(-150);
  });

  it("treats '...' cells as 0 and emits a warning", () => {
    const rows: MockRow[] = [
      { label: "National Defense: (050)", amount: 900_000 },
    ];
    // Build manually with "..." cell
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ["Function/Subfunction", "2025"],
      ["National Defense: (050)", "..."],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const buf = Buffer.from(
      XLSX.write(wb, { type: "buffer", bookType: "xlsx" })
    );

    const result = parseOmbTable32(buf, 2025);
    // The "..." row should be treated as 0 or skipped
    expect(result.warnings.some((w) => w.includes("..."))).toBe(true);
  });

  it("reports available years when requested year not found", () => {
    const buf = buildOmbWorkbook(BASIC_ROWS, 2025, [2023, 2024]);
    try {
      parseOmbTable32(buf, 2030);
    } catch (e) {
      expect((e as Error).message).toContain("2023");
      expect((e as Error).message).toContain("2025");
    }
  });
});

// ---------------------------------------------------------------------------
// budget-mapper tests
// ---------------------------------------------------------------------------

describe("mapOmbToCategories", () => {
  function getParseResult(): OmbParseResult {
    const buf = buildOmbWorkbook(BASIC_ROWS, 2025);
    return parseOmbTable32(buf, 2025);
  }

  it("maps all expected category IDs", () => {
    const parsed = getParseResult();
    const mapped = mapOmbToCategories(parsed);

    const expectedIds = [
      "defense",
      "international",
      "science",
      "agriculture",
      "infrastructure",
      "education",
      "healthcare",
      "income-security",
      "social-security",
      "veterans",
      "justice",
      "government",
      "interest",
    ];

    for (const id of expectedIds) {
      expect(mapped.amounts[id]).toBeDefined();
      // Most categories should have positive amounts
      if (id !== "government") {
        // government includes negative offsetting receipts
        expect(mapped.amounts[id]).toBeGreaterThan(0);
      }
    }
  });

  it("aggregates multi-function categories correctly", () => {
    const parsed = getParseResult();
    const mapped = mapOmbToCategories(parsed);

    // science = 250 (40B) + 270 (10B) + 300 (25B) = 75B
    expect(mapped.amounts["science"]).toBe(75);

    // infrastructure = 370 (20B) + 400 (120B) + 450 (35B) = 175B
    expect(mapped.amounts["infrastructure"]).toBe(175);

    // healthcare = 550 (800B) + 570 (900B) = 1700B
    expect(mapped.amounts["healthcare"]).toBe(1700);
  });

  it("computes totalSpending from mapped categories", () => {
    const parsed = getParseResult();
    const mapped = mapOmbToCategories(parsed);

    const sum = Object.values(mapped.amounts).reduce((a, b) => a + b, 0);
    expect(mapped.totalSpending).toBe(sum);
  });

  it("generates subcategory overrides when prior year data is provided", () => {
    const parsed = getParseResult();
    const priorData = getBudgetData(2024);
    const mapped = mapOmbToCategories(parsed, priorData);

    // Should have subcategory overrides for categories present in prior year
    expect(Object.keys(mapped.subcategoryOverrides).length).toBeGreaterThan(0);

    // Defense subcategories should exist
    expect(mapped.subcategoryOverrides["defense"]).toBeDefined();
    const defSubs = mapped.subcategoryOverrides["defense"];
    const defSubSum = Object.values(defSubs).reduce((a, b) => a + b, 0);
    // Subcategory sum should match parent amount
    expect(defSubSum).toBe(mapped.amounts["defense"]);
  });

  it("warns about immigration being synthesized", () => {
    const parsed = getParseResult();
    const priorData = getBudgetData(2024);
    const mapped = mapOmbToCategories(parsed, priorData);

    expect(
      mapped.warnings.some((w) => w.toLowerCase().includes("immigration"))
    ).toBe(true);
  });

  it("works without prior year data", () => {
    const parsed = getParseResult();
    const mapped = mapOmbToCategories(parsed);

    expect(mapped.amounts["defense"]).toBe(900);
    expect(Object.keys(mapped.subcategoryOverrides).length).toBe(0);
  });

  it("rounds category amounts to whole billions", () => {
    const parsed = getParseResult();
    const mapped = mapOmbToCategories(parsed);

    for (const amount of Object.values(mapped.amounts)) {
      expect(Number.isInteger(amount)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// budget-validator tests
// ---------------------------------------------------------------------------

describe("validateBudgetData", () => {
  function makeMappedData(
    overrides: Partial<MappedBudgetData> = {}
  ): MappedBudgetData {
    return {
      year: 2026,
      totalSpending: 7200,
      amounts: {
        defense: 900,
        international: 65,
        science: 75,
        agriculture: 42,
        infrastructure: 175,
        education: 265,
        healthcare: 1810,
        "income-security": 660,
        "social-security": 1540,
        veterans: 190,
        justice: 82,
        government: 181,
        interest: 952,
        immigration: 68,
      },
      subcategoryOverrides: {},
      unmappedRows: [],
      warnings: [],
      ...overrides,
    };
  }

  it("passes all checks for reasonable data with no prior year", () => {
    const data = makeMappedData();
    const { results, allPassed } = validateBudgetData(data);

    expect(allPassed).toBe(true);
    expect(results.length).toBeGreaterThan(0);
  });

  it("passes when total spending is within 20% of prior year", () => {
    const data = makeMappedData({ totalSpending: 7200 });
    const { results } = validateBudgetData(data, 7000);

    const totalCheck = results.find((r) => r.message.includes("Total spending"));
    expect(totalCheck?.pass).toBe(true);
  });

  it("fails when total spending exceeds 20% change", () => {
    const data = makeMappedData({ totalSpending: 10000 });
    const { results, allPassed } = validateBudgetData(data, 7000);

    expect(allPassed).toBe(false);
    const totalCheck = results.find((r) => r.message.includes("exceeds 20%"));
    expect(totalCheck).toBeDefined();
  });

  it("fails when a category is missing", () => {
    const data = makeMappedData();
    delete data.amounts["defense"];

    const { results, allPassed } = validateBudgetData(data);
    expect(allPassed).toBe(false);

    const missingCheck = results.find((r) => r.message.includes("Missing"));
    expect(missingCheck).toBeDefined();
    expect(missingCheck!.message).toContain("defense");
  });

  it("fails when a category decreases more than 20%", () => {
    const data = makeMappedData();
    const priorAmounts = { ...data.amounts, defense: 1200 };
    // defense is 900 now, was 1200 → -25%

    const { results } = validateBudgetData(data, 7000, priorAmounts);
    const defCheck = results.find(
      (r) => r.message.includes("defense") && r.message.includes("decreased")
    );
    expect(defCheck).toBeDefined();
    expect(defCheck!.pass).toBe(false);
  });

  it("passes when no category decreases more than 20%", () => {
    const data = makeMappedData();
    const priorAmounts = { ...data.amounts };
    // Slightly reduce one category (within 20%)
    priorAmounts.defense = 950;

    const { results } = validateBudgetData(data, 7000, priorAmounts);
    const decreaseChecks = results.filter((r) =>
      r.message.includes("No category decreased")
    );
    expect(decreaseChecks.length).toBe(1);
    expect(decreaseChecks[0].pass).toBe(true);
  });

  it("flags subcategory sums that differ from parent by >2%", () => {
    const data = makeMappedData({
      subcategoryOverrides: {
        defense: {
          "Military Personnel": 200,
          "Operations": 300,
          // Sum = 500, parent = 900 → way off
        },
      },
    });

    const { results } = validateBudgetData(data);
    const subCheck = results.find(
      (r) => r.message.includes("defense") && r.message.includes("subcategories")
    );
    expect(subCheck).toBeDefined();
    expect(subCheck!.pass).toBe(false);
  });

  it("passes when subcategory sums are within 2% of parent", () => {
    const data = makeMappedData({
      subcategoryOverrides: {
        interest: {
          "Interest on Treasury Securities": 898,
          "Other Interest": 54,
          // Sum = 952, parent = 952 → exact match
        },
      },
    });

    const { results } = validateBudgetData(data);
    const subChecks = results.filter((r) =>
      r.message.includes("subcategory sums within 2%")
    );
    expect(subChecks.length).toBe(1);
    expect(subChecks[0].pass).toBe(true);
  });

  it("flags immigration estimate >30% different from prior year", () => {
    const data = makeMappedData();
    data.amounts["immigration"] = 100; // 100B vs prior 68B → +47%
    const priorAmounts = { ...data.amounts, immigration: 68 };

    const { results } = validateBudgetData(data, 7000, priorAmounts);
    const immCheck = results.find((r) =>
      r.message.includes("Immigration") && r.message.includes("MANUAL REVIEW")
    );
    expect(immCheck).toBeDefined();
    expect(immCheck!.pass).toBe(false);
  });

  it("passes immigration check when change is under 30%", () => {
    const data = makeMappedData();
    data.amounts["immigration"] = 72; // 72B vs prior 68B → +5.9%
    const priorAmounts = { ...data.amounts, immigration: 68 };

    const { results } = validateBudgetData(data, 7000, priorAmounts);
    const immCheck = results.find((r) =>
      r.message.includes("Immigration estimate")
    );
    expect(immCheck).toBeDefined();
    expect(immCheck!.pass).toBe(true);
  });

  it("checks category sum vs total spending", () => {
    const data = makeMappedData();
    // totalSpending matches sum by default
    const sum = Object.values(data.amounts).reduce((a, b) => a + b, 0);
    data.totalSpending = sum;

    const { results } = validateBudgetData(data);
    const sumCheck = results.find((r) => r.message.includes("Category sum"));
    expect(sumCheck?.pass).toBe(true);
  });

  it("fails category sum check when sum diverges from total by >5%", () => {
    const data = makeMappedData({ totalSpending: 10000 });
    // amounts sum to ~7005, total is 10000 → ~30% off

    const { results } = validateBudgetData(data);
    const sumCheck = results.find(
      (r) => r.message.includes("Category sum") && r.message.includes("differs")
    );
    expect(sumCheck).toBeDefined();
    expect(sumCheck!.pass).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Integration: parse → map → validate pipeline
// ---------------------------------------------------------------------------

describe("end-to-end pipeline", () => {
  it("parse → map → validate with prior year data from budget.ts", () => {
    const buf = buildOmbWorkbook(BASIC_ROWS, 2025);
    const parsed = parseOmbTable32(buf, 2025);
    const priorData = getBudgetData(2024);
    const mapped = mapOmbToCategories(parsed, priorData);
    const { results } = validateBudgetData(
      mapped,
      6750,
      Object.fromEntries(priorData.map((c) => [c.id, c.amount]))
    );

    // Should produce actual validation results
    expect(results.length).toBeGreaterThan(0);
    // All 14 categories should be present (or warned)
    const catCheck = results.find((r) => r.message.includes("categories"));
    expect(catCheck).toBeDefined();
  });

  it("mapped data has immigration estimate when prior year has it", () => {
    const buf = buildOmbWorkbook(BASIC_ROWS, 2025);
    const parsed = parseOmbTable32(buf, 2025);
    const priorData = getBudgetData(2024);
    const mapped = mapOmbToCategories(parsed, priorData);

    // Immigration should be estimated from prior year + subfunctions
    expect(mapped.amounts["immigration"]).toBeGreaterThan(0);
  });

  it("subcategory overrides sum to parent amounts", () => {
    const buf = buildOmbWorkbook(BASIC_ROWS, 2025);
    const parsed = parseOmbTable32(buf, 2025);
    const priorData = getBudgetData(2024);
    const mapped = mapOmbToCategories(parsed, priorData);

    for (const [catId, subs] of Object.entries(mapped.subcategoryOverrides)) {
      const subSum = Object.values(subs).reduce((a, b) => a + b, 0);
      const parentAmount = mapped.amounts[catId];
      if (parentAmount) {
        expect(subSum).toBe(parentAmount);
      }
    }
  });
});
