#!/usr/bin/env npx tsx
/**
 * Automated bill tracker — discovers new enacted bills and appends
 * draft entries to tracked-votes.ts. Designed to run in CI.
 *
 * Usage:
 *   npx tsx scripts/auto-track-bills.ts
 *   npx tsx scripts/auto-track-bills.ts --congress 119
 */

import * as fs from "fs";
import * as path from "path";
import { discoverNewBills } from "./lib/discover";
import { draftBillEntry } from "./lib/draft";
import type { TrackedVote } from "../src/data/tracked-votes";

const TRACKED_VOTES_PATH = path.resolve(
  __dirname,
  "../src/data/tracked-votes.ts"
);

function parseArgs(): { congress: number } {
  const args = process.argv.slice(2);
  let congress = 119;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--congress" && args[i + 1]) {
      congress = parseInt(args[i + 1], 10);
    }
  }

  return { congress };
}

function formatEntry(entry: TrackedVote, categoryComment: string): string {
  const lines = [
    `  {`,
    `    legislationTitle: ${JSON.stringify(entry.legislationTitle)},`,
    `    categoryId: ${JSON.stringify(entry.categoryId)}, ${categoryComment}`,
    `    congress: ${entry.congress},`,
  ];

  if (entry.houseVote.rollCall > 0) {
    lines.push(
      `    houseVote: { year: ${entry.houseVote.year}, rollCall: ${entry.houseVote.rollCall} },`
    );
  } else {
    lines.push(
      `    houseVote: { year: 0, rollCall: 0 }, // MISSING — needs manual lookup`
    );
  }

  if (entry.senateVote.rollCall > 0) {
    lines.push(
      `    senateVote: { session: ${entry.senateVote.session}, rollCall: ${entry.senateVote.rollCall} },`
    );
  } else {
    lines.push(
      `    senateVote: { session: 0, rollCall: 0 }, // MISSING — needs manual lookup`
    );
  }

  lines.push(
    `    date: ${JSON.stringify(entry.date)},`,
    `    yesEffect: ${JSON.stringify(entry.yesEffect)}, // draft — edit`,
    `    noEffect: ${JSON.stringify(entry.noEffect)}, // draft — edit`,
    `  },`
  );

  return lines.join("\n");
}

async function main() {
  const { congress } = parseArgs();

  console.log(`Discovering new bills for Congress ${congress}...`);
  const discovered = await discoverNewBills(congress);

  if (discovered.length === 0) {
    console.log("No new bills found. Nothing to do.");
    process.exit(0);
  }

  console.log(`Found ${discovered.length} new bill(s). Drafting entries...\n`);

  const entries: string[] = [];
  const summaries: string[] = [];

  for (const bill of discovered) {
    const billId = `${bill.type.toLowerCase()}${bill.number}-${bill.congress}`;
    console.log(`  Drafting ${billId}: ${bill.title}`);

    try {
      const { entry, categorySuggestion, warnings } = await draftBillEntry(billId);

      const categoryComment =
        categorySuggestion.confidence === "high"
          ? `// suggested via ${categorySuggestion.source}`
          : `// ⚠ low confidence — verify`;

      entries.push(formatEntry(entry, categoryComment));

      const warningText = warnings.length > 0 ? ` (${warnings.join("; ")})` : "";
      summaries.push(`- **${entry.legislationTitle}** → \`${entry.categoryId}\`${warningText}`);
    } catch (err) {
      console.error(`  Failed to draft ${billId}:`, (err as Error).message);
    }
  }

  if (entries.length === 0) {
    console.log("\nNo entries could be drafted.");
    process.exit(0);
  }

  // Insert entries into tracked-votes.ts right before the closing ];
  const source = fs.readFileSync(TRACKED_VOTES_PATH, "utf-8");
  const insertionPoint = source.lastIndexOf("];");

  if (insertionPoint === -1) {
    console.error("Could not find closing ]; in tracked-votes.ts");
    process.exit(1);
  }

  const newSource =
    source.slice(0, insertionPoint) +
    entries.join("\n") +
    "\n" +
    source.slice(insertionPoint);

  fs.writeFileSync(TRACKED_VOTES_PATH, newSource);

  console.log(`\nInserted ${entries.length} draft entries into tracked-votes.ts`);

  // Write summary for the PR body
  const summaryPath = path.resolve(__dirname, "../.bill-tracker-summary.md");
  const summaryContent = [
    "## New bills discovered\n",
    ...summaries,
    "",
    "### Review checklist",
    "- [ ] Verify each `categoryId` matches the correct spending category",
    "- [ ] Edit `yesEffect` and `noEffect` to be specific and accurate",
    "- [ ] Confirm vote data (roll call numbers, dates) are correct",
    "- [ ] Run `npm test` to validate the entries",
  ].join("\n");

  fs.writeFileSync(summaryPath, summaryContent);
  console.log("Wrote PR summary to .bill-tracker-summary.md");
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
