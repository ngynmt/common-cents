#!/usr/bin/env npx tsx
/**
 * Refresh pending bill metadata from Congress.gov API.
 *
 * Usage:
 *   npm run bills:refresh                   # refresh all, write changes
 *   npm run bills:refresh -- --dry-run      # show what would change
 *   npm run bills:refresh -- --bill hr8070  # refresh a specific bill
 */

import * as fs from "fs";
import * as path from "path";
import { config } from "dotenv";
config({ path: ".env.local" });

import { pendingBills } from "../src/data/pending-bills";
import { refreshAllBills, type BillDiff, type FieldChange } from "./lib/bill-refresher";

const PENDING_BILLS_PATH = path.resolve(
  __dirname,
  "../src/data/pending-bills.ts"
);

function parseArgs(): { dryRun: boolean; bill?: string } {
  const args = process.argv.slice(2);
  let dryRun = false;
  let bill: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dry-run") dryRun = true;
    if (args[i] === "--bill" && args[i + 1]) {
      bill = args[i + 1];
      i++;
    }
  }

  return { dryRun, bill };
}

function printDiff(diff: BillDiff): void {
  console.log(`  ${diff.billNumber} — ${diff.shortTitle}`);

  if (diff.enacted) {
    console.log(
      `    ⚠ Bill was signed into law on ${diff.enacted} — consider removing from pending-bills`
    );
    return;
  }

  if (diff.changes.length === 0) {
    console.log(`    No changes.`);
    return;
  }

  for (const change of diff.changes) {
    console.log(`    ${change.field}: ${change.oldValue} → ${change.newValue}`);
  }
}

/**
 * Apply diffs to pending-bills.ts using targeted string replacement.
 * Preserves manual content (summary, shortTitle, spendingImpacts, etc.).
 */
function applyDiffs(diffs: BillDiff[]): number {
  let source = fs.readFileSync(PENDING_BILLS_PATH, "utf-8");
  let updatedCount = 0;

  for (const diff of diffs) {
    if (diff.enacted || diff.changes.length === 0) continue;

    for (const change of diff.changes) {
      const updated = replaceField(source, diff.billNumber, change);
      if (updated !== null) {
        source = updated;
      }
    }
    updatedCount++;
  }

  fs.writeFileSync(PENDING_BILLS_PATH, source);
  return updatedCount;
}

/**
 * Replace a single field value for a specific bill in the source file.
 * Finds the bill by its billNumber, then replaces the field value.
 */
function replaceField(
  source: string,
  billNumber: string,
  change: FieldChange
): string | null {
  // Find the bill's object block by its billNumber
  const billNumberEscaped = billNumber.replace(/\./g, "\\.");
  const billBlockStart = source.search(
    new RegExp(`billNumber:\\s*"${billNumberEscaped}"`)
  );
  if (billBlockStart === -1) return null;

  // Find the enclosing object boundaries (the { before and } after)
  const openBrace = source.lastIndexOf("{", billBlockStart);
  const closeBrace = findMatchingBrace(source, openBrace);
  if (closeBrace === -1) return null;

  const block = source.slice(openBrace, closeBrace + 1);
  const { field } = change;

  let newBlock: string;
  if (typeof change.newValue === "number") {
    // Numeric field: cosponsors
    const fieldRegex = new RegExp(`(${field}:\\s*)\\d+`);
    newBlock = block.replace(fieldRegex, `$1${change.newValue}`);
  } else {
    // String field: status, lastActionDate, lastAction, passageLikelihood
    const fieldRegex = new RegExp(`(${field}:\\s*)"[^"]*"`);
    const escaped = String(change.newValue).replace(/"/g, '\\"');
    newBlock = block.replace(fieldRegex, `$1"${escaped}"`);
  }

  if (newBlock === block) return null;
  return source.slice(0, openBrace) + newBlock + source.slice(closeBrace + 1);
}

/**
 * Find the matching closing brace for an opening brace, handling nesting.
 */
function findMatchingBrace(source: string, openPos: number): number {
  let depth = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = openPos; i < source.length; i++) {
    const ch = source[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (ch === "\\") {
      escapeNext = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }

  return -1;
}

async function main() {
  const { dryRun, bill } = parseArgs();

  console.log(`Refreshing ${bill ? bill : `${pendingBills.length} pending bills`}...\n`);

  const diffs = await refreshAllBills(pendingBills, bill);

  for (const diff of diffs) {
    printDiff(diff);
    console.log();
  }

  const changedCount = diffs.filter(
    (d) => d.enacted || d.changes.length > 0
  ).length;

  if (dryRun) {
    console.log(
      `${changedCount} of ${diffs.length} bills have updates. Run without --dry-run to apply.`
    );
  } else if (changedCount > 0) {
    const written = applyDiffs(diffs);
    console.log(`Updated ${written} of ${diffs.length} bills in pending-bills.ts.`);

    const enacted = diffs.filter((d) => d.enacted);
    if (enacted.length > 0) {
      console.log(
        `\n⚠ ${enacted.length} bill(s) were enacted — review and remove from pending-bills manually.`
      );
    }
  } else {
    console.log("All bills are up to date.");
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
