#!/usr/bin/env npx tsx
/**
 * Bill suggestion pipeline — discovers high-signal pending bills and
 * generates skeleton entries for pending-bills.ts.
 *
 * Usage:
 *   npm run bills:suggest -- --dry-run
 *   npm run bills:suggest -- --min-cosponsors 30 --congress 119
 *   npm run bills:suggest -- --category defense
 */

import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import {
  suggestNewBills,
  defaultSuggestOptions,
  type SuggestedBill,
  type SuggestOptions,
} from "./lib/bill-suggester";
import type { PendingBill } from "../src/data/pending-bills";

const PENDING_BILLS_PATH = path.resolve(
  __dirname,
  "../src/data/pending-bills.ts"
);
const SUMMARY_PATH = path.resolve(__dirname, "../.bill-suggestions-summary.md");

function parseArgs(): SuggestOptions {
  const defaults = defaultSuggestOptions();
  const args = process.argv.slice(2);

  const opts: SuggestOptions = { ...defaults };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--dry-run":
        opts.dryRun = true;
        break;
      case "--congress":
        opts.congress = parseInt(args[++i], 10);
        break;
      case "--min-cosponsors":
        opts.minCosponsorsHouse = parseInt(args[++i], 10);
        opts.minCosponsorsSenate = Math.max(
          15,
          Math.round(opts.minCosponsorsHouse * 0.3)
        );
        break;
      case "--min-cosponsors-house":
        opts.minCosponsorsHouse = parseInt(args[++i], 10);
        break;
      case "--min-cosponsors-senate":
        opts.minCosponsorsSenate = parseInt(args[++i], 10);
        break;
      case "--category":
        opts.category = args[++i];
        break;
      case "--since":
        opts.since = args[++i];
        break;
    }
  }

  return opts;
}

function formatSkeletonEntry(entry: PendingBill): string {
  const lines = [
    `  {`,
    `    id: ${JSON.stringify(entry.id)},`,
    `    congress: ${entry.congress},`,
    `    title: ${JSON.stringify(entry.title)},`,
    `    shortTitle: "NEEDS EDIT", // NEEDS EDIT`,
    `    billNumber: ${JSON.stringify(entry.billNumber)},`,
    `    summary: ${JSON.stringify(entry.summary)}, // NEEDS EDIT`,
    `    status: ${JSON.stringify(entry.status)},`,
    `    passageLikelihood: ${JSON.stringify(entry.passageLikelihood)},`,
    `    champion: {`,
    `      name: ${JSON.stringify(entry.champion.name)},`,
    `      party: ${JSON.stringify(entry.champion.party)},`,
    `      chamber: ${JSON.stringify(entry.champion.chamber)},`,
    `      state: ${JSON.stringify(entry.champion.state)},`,
    `      title: ${JSON.stringify(entry.champion.title)},`,
    `    },`,
    `    cosponsors: ${entry.cosponsors},`,
    `    bipartisan: ${entry.bipartisan},`,
    `    impactedCategories: ${JSON.stringify(entry.impactedCategories)},`,
    `    spendingImpacts: [], // NEEDS EDIT`,
    `    totalAnnualImpact: 0, // NEEDS EDIT`,
    `    cboScoreUrl: "",`,
    `    congressUrl: ${JSON.stringify(entry.congressUrl)},`,
    `    lastAction: ${JSON.stringify(entry.lastAction)},`,
    `    lastActionDate: ${JSON.stringify(entry.lastActionDate)},`,
    `  },`,
  ];
  return lines.join("\n");
}

function writeSummaryFile(suggestions: SuggestedBill[]): void {
  const tableRows = suggestions.map((s) => {
    const bill = s.entry.billNumber;
    const title = s.entry.title.slice(0, 50);
    const cosponsors = s.entry.bipartisan
      ? `${s.entry.cosponsors} (bipartisan)`
      : `${s.entry.cosponsors}`;
    const category = `\`${s.categorySuggestion.categoryId}\``;
    return `| ${bill} | ${title} | ${cosponsors} | ${category} | ${s.whySuggested} |`;
  });

  const content = `## Suggested pending bills

| Bill | Title | Cosponsors | Category | Why suggested |
|------|-------|-----------|----------|---------------|
${tableRows.join("\n")}

---

## Should I keep this bill?

A bill belongs in pending-bills if it meets **all three** criteria:

1. **Spending relevance** — the bill would meaningfully change spending in one of our
   budget categories. A post office renaming doesn't qualify; a $10B infrastructure
   package does.
2. **Realistic trajectory** — it has committee activity, significant cosponsors, or
   leadership support suggesting it could actually move. Bills introduced as messaging
   vehicles with no cosponsors aren't worth tracking.
3. **User value** — a Common Cents user would find it interesting to see how this bill
   would change their tax receipt. Ask: "would someone share this?"

If a bill doesn't meet all three, delete its entry from the diff before merging.

---

## How to fill in each field

### \`shortTitle\`
A 2-5 word name users will see in the UI. Keep it informal and recognizable.

### \`summary\`
1-2 sentences explaining what the bill does in plain English. Focus on what changes
for taxpayers, not legislative procedure. Write at an 8th-grade reading level.

### \`spendingImpacts\`
An array of per-category spending changes in **billions per year**. Each entry needs:
- \`categoryId\` — must match an existing category in the app
- \`annualChange\` — positive = spending increase, negative = decrease
- \`description\` — 1 sentence explaining the impact

**Where to find this:** CBO cost estimate for the bill.

### \`totalAnnualImpact\`
Sum of all \`annualChange\` values in \`spendingImpacts\`.

### \`passageLikelihood\`
The script sets this with a heuristic, but override it if you know better.

### \`cboScoreUrl\`
Link to the CBO cost estimate page. Leave empty string if no score exists yet.

---

### Checklist

${suggestions.map((s) => `#### ${s.entry.billNumber}: ${s.entry.title.slice(0, 50)}
- [ ] **Keep or remove** — does it meet all three criteria above?
- [ ] Fill in \`shortTitle\` (2-5 word informal name)
- [ ] Write \`summary\` (1-2 plain-English sentences)
- [ ] Add \`spendingImpacts\` from CBO cost estimate
- [ ] Set \`totalAnnualImpact\` (sum of annualChange values)
- [ ] Review \`passageLikelihood\` — override heuristic if needed
- [ ] Add \`cboScoreUrl\` if available
`).join("\n")}
- [ ] Run \`npm run build\` to verify no type errors
`;

  fs.writeFileSync(SUMMARY_PATH, content);
  console.log("Wrote PR summary to .bill-suggestions-summary.md");
}

async function main() {
  const opts = parseArgs();

  console.log("Bill Suggestion Pipeline");
  console.log("========================");
  console.log(`Congress: ${opts.congress}`);
  console.log(
    `Min cosponsors: ${opts.minCosponsorsHouse} (House), ${opts.minCosponsorsSenate} (Senate)`
  );
  console.log(`Since: ${opts.since}`);
  if (opts.category) console.log(`Category filter: ${opts.category}`);
  if (opts.dryRun) console.log("Mode: dry run\n");
  else console.log("");

  const suggestions = await suggestNewBills(opts);

  if (suggestions.length === 0) {
    console.log("\nNo new bills to suggest. Nothing to do.");
    process.exit(0);
  }

  console.log(`\n--- Suggestions ---\n`);
  for (const s of suggestions) {
    console.log(
      `${s.entry.billNumber}: ${s.entry.title.slice(0, 70)}`
    );
    console.log(
      `  Category: ${s.categorySuggestion.categoryId} | Cosponsors: ${s.entry.cosponsors} | ${s.whySuggested}`
    );
  }

  if (opts.dryRun) {
    console.log("\nDry run — no files modified.");
    process.exit(0);
  }

  // Insert skeleton entries into pending-bills.ts
  const source = fs.readFileSync(PENDING_BILLS_PATH, "utf-8");
  const insertionPoint = source.lastIndexOf("];");

  if (insertionPoint === -1) {
    console.error("Could not find closing ]; in pending-bills.ts");
    process.exit(1);
  }

  const entries = suggestions.map((s) => formatSkeletonEntry(s.entry));
  const newSource =
    source.slice(0, insertionPoint) +
    entries.join("\n") +
    "\n" +
    source.slice(insertionPoint);

  fs.writeFileSync(PENDING_BILLS_PATH, newSource);
  console.log(
    `\nInserted ${suggestions.length} skeleton entries into pending-bills.ts`
  );

  writeSummaryFile(suggestions);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
