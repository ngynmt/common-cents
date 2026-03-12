#!/usr/bin/env npx tsx
/**
 * Generate a draft TrackedVote entry for a specific bill.
 *
 * Usage:
 *   npm run bills:draft -- --bill hr1234-119
 *   npm run bills:draft -- --bill s567-119
 *   npm run bills:draft -- --bill hr1234-119 --json
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { draftBillEntry } from "./lib/draft";

function parseArgs(): { bill: string; json: boolean } {
  const args = process.argv.slice(2);
  let bill = "";
  let json = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--bill" && args[i + 1]) {
      bill = args[i + 1];
    }
    if (args[i] === "--json") json = true;
  }

  if (!bill) {
    console.error("Usage: npm run bills:draft -- --bill hr1234-119");
    process.exit(1);
  }

  return { bill, json };
}

async function main() {
  const { bill: billId, json } = parseArgs();
  const { entry, categorySuggestion, warnings } = await draftBillEntry(billId);

  if (json) {
    console.log(JSON.stringify({ entry, categorySuggestion, warnings }, null, 2));
    return;
  }

  // Human-readable output
  for (const w of warnings) {
    console.warn(`Warning: ${w}`);
  }

  const categoryComment =
    categorySuggestion.confidence === "high"
      ? `// suggested via ${categorySuggestion.source}`
      : `// low confidence (${categorySuggestion.source}) — verify`;

  console.log("\n// DRAFT — review categoryId, yesEffect, and noEffect before adding");
  console.log("// Copy this into src/data/tracked-votes.ts\n");

  console.log("{");
  console.log(`  legislationTitle: ${JSON.stringify(entry.legislationTitle)},`);
  console.log(`  categoryId: ${JSON.stringify(entry.categoryId)}, ${categoryComment}`);
  console.log(`  congress: ${entry.congress},`);

  if (entry.houseVote.rollCall > 0) {
    console.log(
      `  houseVote: { year: ${entry.houseVote.year}, rollCall: ${entry.houseVote.rollCall} },`
    );
  } else {
    console.log(`  houseVote: { year: ???, rollCall: ??? }, // MISSING`);
  }

  if (entry.senateVote.rollCall > 0) {
    console.log(
      `  senateVote: { session: ${entry.senateVote.session}, rollCall: ${entry.senateVote.rollCall} },`
    );
  } else {
    console.log(`  senateVote: { session: ???, rollCall: ??? }, // MISSING`);
  }

  console.log(`  date: ${JSON.stringify(entry.date)},`);
  console.log(`  yesEffect: ${JSON.stringify(entry.yesEffect)}, // draft — edit`);
  console.log(`  noEffect: ${JSON.stringify(entry.noEffect)}, // draft — edit`);
  console.log("}");
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
