/**
 * Fetches and parses tax bracket data from Tax Foundation's annual post.
 *
 * Primary source: taxfoundation.org/data/all/federal/YYYY-tax-brackets/
 * These posts follow a consistent HTML table format published shortly
 * after the IRS Revenue Procedure each October/November.
 */

import * as cheerio from "cheerio";

export type FilingStatus = "single" | "married" | "head_of_household";
const FILING_STATUSES: FilingStatus[] = ["single", "married", "head_of_household"];

export interface TaxBracket {
  min: number;
  max: number;
  rate: number;
}

export interface TaxYearData {
  year: number;
  brackets: Record<FilingStatus, TaxBracket[]>;
  standardDeduction: Record<FilingStatus, number>;
  socialSecurityWageBase: number;
  sourceUrl: string;
}

const TAX_FOUNDATION_URL = (year: number) =>
  `https://taxfoundation.org/data/all/federal/${year}-tax-brackets/`;

/**
 * Parse a dollar string like "$11,925" or "$626,350+" into a number.
 * Returns Infinity for values ending with "+".
 */
function parseDollar(text: string): number {
  const cleaned = text.trim().replace(/\s/g, "");
  if (cleaned.endsWith("+")) {
    return Infinity;
  }
  const num = Number(cleaned.replace(/[$,]/g, ""));
  if (isNaN(num)) {
    throw new Error(`Could not parse dollar value: "${text}"`);
  }
  return num;
}

/**
 * Parse a rate string like "10%" into 0.10.
 */
function parseRate(text: string): number {
  const num = Number(text.trim().replace(/%/g, ""));
  if (isNaN(num)) {
    throw new Error(`Could not parse rate: "${text}"`);
  }
  return num / 100;
}

/**
 * Parse an income range like "$11,925 to $48,475" or "$626,350 and up"
 * into { min, max }.
 */
function parseRange(text: string): { min: number; max: number } {
  const cleaned = text.trim();

  // Handle "X and up" or "X+" or "over X" patterns
  const andUpMatch = cleaned.match(
    /\$?([\d,]+)\s*(?:and\s+up|\+|or\s+more)/i
  );
  if (andUpMatch) {
    return { min: parseDollar(andUpMatch[1]), max: Infinity };
  }

  const overMatch = cleaned.match(/over\s+\$?([\d,]+)/i);
  if (overMatch) {
    return { min: parseDollar(overMatch[1]), max: Infinity };
  }

  // Handle range separators: "to", "–", "—", "-"
  const parts = cleaned.split(/\s+to\s+|\s*[–—‐-]\s*/);
  if (parts.length === 2) {
    return { min: parseDollar(parts[0]), max: parseDollar(parts[1]) };
  }

  // Single value like "$0" (first bracket min)
  if (parts.length === 1) {
    return { min: parseDollar(parts[0]), max: parseDollar(parts[0]) };
  }

  throw new Error(`Could not parse range: "${text}"`);
}

/**
 * Find and parse the main bracket table from the page.
 * Expects columns: Rate | Single | Married | Head of Household
 */
function parseBracketTable(
  $: cheerio.CheerioAPI
): Record<FilingStatus, TaxBracket[]> {
  const brackets: Record<FilingStatus, TaxBracket[]> = {
    single: [],
    married: [],
    head_of_household: [],
  };

  // Find tables that contain "Tax Rate" or "Rate" in headers
  const tables = $("table");
  let bracketTable: ReturnType<typeof $> | null = null;

  tables.each((_, table) => {
    const headerText = $(table).find("th, thead td").text().toLowerCase();
    if (
      headerText.includes("rate") &&
      (headerText.includes("single") || headerText.includes("filer"))
    ) {
      bracketTable = $(table);
      return false; // break
    }
  });

  if (!bracketTable) {
    throw new Error(
      "Could not find bracket table on page. The Tax Foundation page structure may have changed."
    );
  }

  // Determine column order from headers
  const headers: string[] = [];
  $(bracketTable!)
    .find("thead tr:last-child th, thead tr:last-child td")
    .each((_, th) => {
      headers.push($(th).text().toLowerCase().trim());
    });

  // If no thead, try first row
  if (headers.length === 0) {
    $(bracketTable!)
      .find("tr:first-child th, tr:first-child td")
      .each((_, th) => {
        headers.push($(th).text().toLowerCase().trim());
      });
  }

  const colMap = {
    rate: -1,
    single: -1,
    married: -1,
    head_of_household: -1,
  };

  headers.forEach((h, i) => {
    if (h.includes("rate")) colMap.rate = i;
    // Check married/joint BEFORE single — "Married Individuals" contains
    // "individual" which would false-match the single check.
    else if (h.includes("married") || h.includes("joint")) colMap.married = i;
    else if (h.includes("single") || h.includes("filer"))
      colMap.single = i;
    else if (h.includes("head")) colMap.head_of_household = i;
  });

  if (colMap.rate === -1 || colMap.single === -1) {
    throw new Error(
      `Could not identify table columns. Headers found: ${headers.join(", ")}`
    );
  }

  // Parse data rows
  const rows = $(bracketTable!).find("tbody tr");
  if (rows.length === 0) {
    throw new Error("No data rows found in bracket table");
  }

  rows.each((_, row) => {
    const cells: string[] = [];
    $(row)
      .find("td")
      .each((_, td) => {
        cells.push($(td).text().trim());
      });

    if (cells.length < 3) return; // skip malformed rows

    const rate = parseRate(cells[colMap.rate]);

    for (const status of ["single", "married", "head_of_household"] as const) {
      const col = colMap[status];
      if (col === -1) continue;

      const range = parseRange(cells[col]);
      brackets[status].push({
        min: range.min,
        max: range.max,
        rate,
      });
    }
  });

  // Normalize $1 gaps between brackets. Some Tax Foundation pages present
  // ranges as "$0–$12,400", "$12,401–$50,400" instead of contiguous
  // "$0–$12,400", "$12,400–$50,400". Our tax engine expects contiguous
  // boundaries (bracket[n].max === bracket[n+1].min).
  for (const status of FILING_STATUSES) {
    const b = brackets[status];
    for (let i = 1; i < b.length; i++) {
      if (b[i].min === b[i - 1].max + 1) {
        b[i].min = b[i - 1].max;
      }
    }
  }

  return brackets;
}

/**
 * Find and parse the standard deduction table.
 */
function parseStandardDeduction(
  $: cheerio.CheerioAPI
): Record<FilingStatus, number> {
  const result: Record<FilingStatus, number> = {
    single: 0,
    married: 0,
    head_of_household: 0,
  };

  // Look for a table near text mentioning "standard deduction"
  const tables = $("table");
  let deductionTable: ReturnType<typeof $> | null = null;

  tables.each((_, table) => {
    const tableText = $(table).text().toLowerCase();
    if (
      tableText.includes("standard deduction") ||
      tableText.includes("deduction amount")
    ) {
      deductionTable = $(table);
      return false;
    }
  });

  // Fallback: look for a table preceded by a heading about standard deductions
  if (!deductionTable) {
    $("h2, h3, h4").each((_, heading) => {
      if ($(heading).text().toLowerCase().includes("standard deduction")) {
        const nextTable = $(heading).nextAll("table").first();
        if (nextTable.length) {
          deductionTable = nextTable;
          return false;
        }
      }
    });
  }

  if (!deductionTable) {
    throw new Error(
      "Could not find standard deduction table. The Tax Foundation page structure may have changed."
    );
  }

  // Parse rows — expect "Filing Status" | "Deduction Amount" or similar
  $(deductionTable!)
    .find("tbody tr, tr")
    .each((_, row) => {
      const cells: string[] = [];
      $(row)
        .find("td, th")
        .each((_, cell) => {
          cells.push($(cell).text().trim());
        });

      if (cells.length < 2) return;

      const label = cells[0].toLowerCase();
      const value = cells[cells.length - 1]; // amount is usually last column

      if (label.includes("single") && !label.includes("married")) {
        result.single = parseDollar(value);
      } else if (label.includes("married") && label.includes("joint")) {
        result.married = parseDollar(value);
      } else if (label.includes("head")) {
        result.head_of_household = parseDollar(value);
      }
    });

  if (result.single === 0 || result.married === 0) {
    throw new Error(
      "Could not parse all standard deduction values from table"
    );
  }

  return result;
}

const IRS_TOPIC_751_URL = "https://www.irs.gov/taxtopics/tc751";

/**
 * Fetch Social Security wage base from IRS Topic 751.
 * The page contains text like "For earnings in 2026, this base limit is $184,500."
 */
async function fetchSocialSecurityWageBase(year: number): Promise<number> {
  const response = await fetch(IRS_TOPIC_751_URL, {
    headers: {
      "User-Agent": "CommonCents-TaxUpdater/1.0 (civic-tech; open-source)",
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch IRS Topic 751: ${response.status} ${response.statusText}`
    );
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const bodyText = $("body").text();

  // Match year-specific patterns like "For earnings in 2026, this base limit is $184,500"
  const yearPatterns = [
    new RegExp(`(?:for\\s+(?:earnings\\s+in\\s+)?${year})[^$]*\\$([\\d,]+)`, "i"),
    new RegExp(`${year}[^$]*(?:base\\s+limit|wage\\s+base)[^$]*\\$([\\d,]+)`, "i"),
    new RegExp(`\\$([\\d,]+)[^.]*${year}`, "i"),
  ];

  for (const pattern of yearPatterns) {
    const match = bodyText.match(pattern);
    if (match) {
      const value = parseDollar(match[1]);
      if (value > 100_000 && value < 500_000) {
        return value;
      }
    }
  }

  throw new Error(
    `Could not find ${year} Social Security wage base on IRS Topic 751. Provide it manually with --ss-wage-base.`
  );
}

/**
 * Fetch and parse tax year data from Tax Foundation.
 */
export async function fetchTaxYearData(year: number): Promise<TaxYearData> {
  const url = TAX_FOUNDATION_URL(year);

  const response = await fetch(url, {
    headers: {
      "User-Agent": "CommonCents-TaxUpdater/1.0 (civic-tech; open-source)",
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(
        `Tax Foundation page not found for ${year}. The ${year} brackets may not be published yet.\n  Expected URL: ${url}`
      );
    }
    throw new Error(
      `Failed to fetch Tax Foundation page: ${response.status} ${response.statusText}`
    );
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  const brackets = parseBracketTable($);
  const standardDeduction = parseStandardDeduction($);

  let socialSecurityWageBase: number;
  try {
    socialSecurityWageBase = await fetchSocialSecurityWageBase(year);
  } catch {
    // IRS page may not have the requested year yet — caller can provide it
    socialSecurityWageBase = 0;
  }

  return {
    year,
    brackets,
    standardDeduction,
    socialSecurityWageBase,
    sourceUrl: url,
  };
}
