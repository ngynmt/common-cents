#!/usr/bin/env npx tsx
/**
 * Discover recent enacted bills that aren't yet in tracked-votes.ts.
 *
 * Usage:
 *   npm run bills:discover
 *   npm run bills:discover -- --congress 119
 *   npm run bills:discover -- --json          # machine-readable output
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { discoverNewBills, type DiscoveredBill } from "./lib/discover";

function parseArgs(): { congress: number; json: boolean } {
  const args = process.argv.slice(2);
  let congress = 119;
  let json = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--congress" && args[i + 1]) {
      congress = parseInt(args[i + 1], 10);
      if (isNaN(congress)) {
        console.error("Error: --congress must be a number");
        process.exit(1);
      }
    }
    if (args[i] === "--json") json = true;
  }

  return { congress, json };
}

function printHuman(discovered: DiscoveredBill[]) {
  if (discovered.length === 0) {
    console.log("All enacted bills with roll call votes are already tracked.");
    return;
  }

  console.log(
    `Found ${discovered.length} new bill${discovered.length > 1 ? "s" : ""} not yet tracked:\n`
  );

  for (const bill of discovered) {
    const id = `${bill.type.toLowerCase()}${bill.number}-${bill.congress}`;
    console.log(`  ${bill.type} ${bill.number} - ${bill.title}`);

    if (bill.houseVote) {
      const totals = bill.houseTotals
        ? ` — ${bill.houseTotals.yea}-${bill.houseTotals.nay}`
        : "";
      console.log(
        `    House: Roll ${bill.houseVote.rollNumber} (${bill.houseVote.year})${totals}`
      );
    }

    if (bill.senateVote) {
      const totals = bill.senateTotals
        ? ` — ${bill.senateTotals.yea}-${bill.senateTotals.nay}`
        : "";
      console.log(
        `    Senate: Vote ${bill.senateVote.rollNumber} (${bill.congress}-${bill.senateVote.sessionNumber})${totals}`
      );
    }

    console.log(`    Signed: ${bill.signedDate}`);
    console.log();
    console.log(`  Run: npm run bills:draft -- --bill ${id}`);
    console.log();
  }
}

async function main() {
  const { congress, json } = parseArgs();

  if (!json) {
    console.log(`Searching Congress ${congress} for enacted bills...\n`);
  }

  const discovered = await discoverNewBills(congress);

  if (json) {
    console.log(JSON.stringify(discovered, null, 2));
  } else {
    printHuman(discovered);
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
