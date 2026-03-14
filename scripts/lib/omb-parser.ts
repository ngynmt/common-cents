/**
 * Downloads and parses OMB Historical Table 3.2 (Outlays by Function and Subfunction).
 *
 * Source: whitehouse.gov/omb/budget/historical-tables/
 * The Excel file contains outlays in millions of dollars by budget function code.
 */

import * as XLSX from "xlsx";

export interface OmbOutlayRow {
  functionCode: number;
  functionName: string;
  subfunctionCode: number;
  subfunctionName: string;
  amount: number; // billions
}

export interface OmbParseResult {
  year: number;
  rows: OmbOutlayRow[];
  totalOutlays: number; // billions
  availableYears: number[];
  warnings: string[];
}

const OMB_TABLE_32_URL =
  "https://www.whitehouse.gov/wp-content/uploads/2025/02/hist03z2.xlsx";

/**
 * Download the OMB Historical Table 3.2 Excel workbook.
 */
export async function fetchOmbWorkbook(): Promise<Buffer> {
  const response = await fetch(OMB_TABLE_32_URL, {
    headers: {
      "User-Agent": "CommonCents-BudgetUpdater/1.0 (civic-tech; open-source)",
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch OMB Table 3.2: ${response.status} ${response.statusText}\n  URL: ${OMB_TABLE_32_URL}`
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Parse OMB Historical Table 3.2 from an Excel buffer or file path.
 *
 * The spreadsheet layout:
 * - A header row contains "Function" or "Subfunction" in column A
 * - Fiscal year columns follow, with year numbers in the header row
 * - Function rows have a 3-digit code (e.g., "050") in a pattern like "National Defense (050)"
 * - Subfunction rows are indented or have codes like "051", "053"
 * - A "Total" row contains total outlays
 * - Amounts are in millions of dollars
 */
export function parseOmbTable32(
  source: Buffer | string,
  year: number
): OmbParseResult {
  const workbook =
    typeof source === "string"
      ? XLSX.readFile(source)
      : XLSX.read(source, { type: "buffer" });

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const raw: (string | number | null)[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
  });

  const warnings: string[] = [];

  // Find the header row (contains "Function" or column headers with years)
  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(raw.length, 20); i++) {
    const row = raw[i];
    if (!row) continue;
    const firstCell = String(row[0] ?? "").toLowerCase();
    if (
      firstCell.includes("function") ||
      firstCell.includes("subfunction") ||
      firstCell.includes("superfunction")
    ) {
      headerRowIdx = i;
      break;
    }
  }

  if (headerRowIdx === -1) {
    // Fallback: find row where subsequent cells look like years (4-digit numbers)
    for (let i = 0; i < Math.min(raw.length, 20); i++) {
      const row = raw[i];
      if (!row) continue;
      const yearCells = row.filter(
        (c) => typeof c === "number" && c >= 1960 && c <= 2040
      );
      if (yearCells.length >= 5) {
        headerRowIdx = i;
        break;
      }
    }
  }

  if (headerRowIdx === -1) {
    throw new Error(
      "Could not locate header row in OMB Table 3.2. The spreadsheet format may have changed."
    );
  }

  const headerRow = raw[headerRowIdx];

  // Find the column index for the requested fiscal year
  const availableYears: number[] = [];
  let yearColIdx = -1;

  for (let c = 1; c < headerRow.length; c++) {
    const cell = headerRow[c];
    const cellNum =
      typeof cell === "number"
        ? cell
        : typeof cell === "string"
          ? parseInt(cell.replace(/[^0-9]/g, ""), 10)
          : NaN;

    if (!isNaN(cellNum) && cellNum >= 1960 && cellNum <= 2040) {
      availableYears.push(cellNum);
      if (cellNum === year) {
        yearColIdx = c;
      }
    }
  }

  if (yearColIdx === -1) {
    const yearRange =
      availableYears.length > 0
        ? `${availableYears[0]}–${availableYears[availableYears.length - 1]}`
        : "none found";
    throw new Error(
      `Year ${year} not found in OMB Table 3.2. Available years: ${yearRange}`
    );
  }

  // Parse data rows
  const rows: OmbOutlayRow[] = [];
  let totalOutlays = 0;
  let currentFunction = { code: 0, name: "" };

  for (let i = headerRowIdx + 1; i < raw.length; i++) {
    const row = raw[i];
    if (!row || !row[0]) continue;

    const label = String(row[0]).trim();
    if (!label) continue;

    // Parse the amount for the target year column
    const rawAmount = row[yearColIdx];
    let amount = 0;
    if (rawAmount === null || rawAmount === undefined) {
      continue;
    } else if (typeof rawAmount === "number") {
      amount = rawAmount;
    } else {
      const strVal = String(rawAmount).trim();
      if (strVal === "..." || strVal === "—" || strVal === "-" || strVal === "") {
        if (strVal === "...") {
          warnings.push(`Row "${label}": value is "..." — treated as 0`);
        }
        amount = 0;
      } else {
        const parsed = parseFloat(strVal.replace(/,/g, ""));
        if (isNaN(parsed)) continue;
        amount = parsed;
      }
    }

    // Check for total row
    if (label.toLowerCase().includes("total") && !label.match(/\d{3}/)) {
      totalOutlays = amount / 1000; // millions → billions
      continue;
    }

    // Detect function vs subfunction by code pattern
    // Function rows typically: "National Defense: (050)" or "050 National Defense"
    // Subfunction rows: "Department of Defense—Military: (051)" or "051 ..."
    const codeMatch = label.match(/\((\d{3})\)\s*$/) || label.match(/^(\d{3})\s/);
    if (!codeMatch) continue;

    const code = parseInt(codeMatch[1], 10);
    const name = label
      .replace(/\(\d{3}\)\s*$/, "")
      .replace(/^\d{3}\s+/, "")
      .replace(/:\s*$/, "")
      .trim();

    // OMB function codes — not all are multiples of 50
    const OMB_FUNCTION_CODES = new Set([
      50, 150, 250, 270, 300, 350, 370, 400, 450, 500,
      550, 570, 600, 650, 700, 750, 800, 900, 920, 950,
    ]);
    const isFunction = OMB_FUNCTION_CODES.has(code);

    if (isFunction) {
      currentFunction = { code, name };
    }

    // Convert millions → billions
    const amountBillions = amount / 1000;

    if (!isFunction && currentFunction.code > 0) {
      rows.push({
        functionCode: currentFunction.code,
        functionName: currentFunction.name,
        subfunctionCode: code,
        subfunctionName: name,
        amount: amountBillions,
      });
    } else if (isFunction) {
      // Store function-level row for reference (used for totals)
      rows.push({
        functionCode: code,
        functionName: name,
        subfunctionCode: code,
        subfunctionName: name,
        amount: amountBillions,
      });
    }
  }

  if (rows.length === 0) {
    throw new Error(
      "No data rows parsed from OMB Table 3.2. The spreadsheet format may have changed."
    );
  }

  // If we didn't find a total row, sum function-level rows
  if (totalOutlays === 0) {
    totalOutlays = rows
      .filter((r) => r.functionCode === r.subfunctionCode)
      .reduce((sum, r) => sum + r.amount, 0);
    warnings.push(
      "Total outlays row not found — computed from function-level sums"
    );
  }

  return {
    year,
    rows,
    totalOutlays: Math.round(totalOutlays * 10) / 10,
    availableYears,
    warnings,
  };
}
