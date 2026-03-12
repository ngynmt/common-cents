# Codebase Map

## App Shell

| File | Purpose |
|---|---|
| `src/app/layout.tsx` | Root layout, metadata, font loading |
| `src/app/page.tsx` | Main page — orchestrates form→receipt flow, URL param persistence |
| `src/app/globals.css` | Tailwind imports, global styles |

## Components

| File | Purpose | Key Props |
|---|---|---|
| `src/components/TaxForm.tsx` | Input form (income, filing status, ZIP) | `onSubmit` |
| `src/components/TaxReceipt.tsx` | Receipt orchestrator — chart, list, bills, reps | `taxEstimate, representatives, votes, onBack` |
| `src/components/SpendingChart.tsx` | Interactive donut chart (Recharts) | `spending, onCategoryClick, activeCategoryId` |
| `src/components/ReceiptLine.tsx` | Expandable spending line item with subcategories | `item, isExpanded, onToggle, isActive` |
| `src/components/BillsPanel.tsx` | Prominent bills panel with engagement counters | `activeCategoryId, activeCategoryName, totalFederalTax, representatives` |
| `src/components/RepresentativeCard.tsx` | Rep display with votes and re-election info | `rep, votes, compact?` |
| `src/components/RepresentativesModal.tsx` | Modal overlay for viewing all reps | `isOpen, onClose, representatives, votes` |

### Component Hierarchy

```
page.tsx
├── TaxForm (input state)
└── TaxReceipt (receipt state)
    ├── SpendingChart (donut)
    ├── ReceiptLine × N (expandable list)
    │   └── subcategory breakdown + legislation
    ├── BillsPanel (below chart+receipt)
    │   └── engagement counters, contact flow
    └── RepresentativesModal (triggered by CTA button)
        └── RepresentativeCard × N
```

## Data Layer

| File | Purpose |
|---|---|
| `src/data/budget.ts` | FY2024 & FY2025 spending categories (14 categories, subcategories, agencies, legislation). `getBudgetData(year)`, `TOTAL_FEDERAL_SPENDING[year]` |
| `src/data/pending-bills.ts` | 8 curated active bills with CBO cost estimates, champions, passage likelihood |
| `src/data/representatives.ts` | `Representative` and `VoteRecord` type definitions, `generateContactScript()` helper |
| `src/data/tracked-votes.ts` | 8 tracked bills with House/Senate roll call numbers, category mappings, and vote effect descriptions |

## Libraries

| File | Purpose |
|---|---|
| `src/lib/tax.ts` | Federal tax estimation (2024 & 2025 brackets, standard deduction, FICA). Exports `estimateFederalTax(income, status, year?)`, `formatCurrency()`, `formatPercent()` |
| `src/lib/spending.ts` | Maps total tax to spending categories proportionally. Exports `calculatePersonalSpending(tax, year?)`, `calculateSubcategorySpending()` |
| `src/lib/redis.ts` | Upstash Redis client with in-memory Map fallback. Exports `incrementCounter()`, `getCounter()`, `getCounters()` |
| `src/lib/useEngagement.ts` | Client hook for bill engagement counters. Fetches from and posts to `/api/engagement` |

## API Routes

| File | Method | Purpose |
|---|---|---|
| `src/app/api/representatives/route.ts` | GET | ZIP → Geocodio API → senators + house rep(s) with bioguide + LIS IDs. Cached 24h. Falls back to sample data. |
| `src/app/api/votes/route.ts` | GET | Fetches House/Senate roll call XML for tracked bills, returns vote records for requested legislators. Cached 24h. |
| `src/app/api/engagement/route.ts` | GET | Returns support/oppose/contacted counts for specified bill IDs |
| `src/app/api/engagement/route.ts` | POST | Increments a counter (support, oppose, or contacted) for a bill |

## Config

| File | Purpose |
|---|---|
| `.env.example` | Template for env vars (Upstash, Geocodio, Congress.gov) |
| `next.config.ts` | Next.js config (minimal) |
| `tsconfig.json` | TypeScript config with `@/` path alias |
| `postcss.config.mjs` | PostCSS for Tailwind |
| `eslint.config.mjs` | ESLint config |
