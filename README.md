# Common Cents

A web app that transforms your federal tax contribution into a personalized, interactive visual experience — then connects that spending to the political decisions and representatives responsible for it.

## Goal

Make government spending personal, understandable, and actionable. Encourage civic engagement by showing people exactly where their tax dollars go and who decided it.

## Design Philosophy

- **Personalization** — data reflects *your* taxes and *your* representatives
- **Clarity** — simplify complex government spending into clear categories and explanations
- **Emotional engagement** — meaningful comparisons, tradeoffs, local impacts, voting decisions
- **Actionability** — every insight leads to a potential action: learn more, explore deeper, contact representatives
- **Visual appeal** — colorful, animated, interactive. Civic tech doesn't have to be dull.

## Architecture

```
Browser (static)          Vercel (serverless)          Upstash Redis
┌──────────────┐          ┌──────────────────┐         ┌───────────┐
│ Next.js app  │  fetch   │ /api/engagement   │  REST   │ counters  │
│ tax calc     │ -------> │ hide keys, cache  │ ------> │ support/  │
│ budget JSON  │          │ aggregate APIs    │         │ oppose/   │
└──────────────┘          └──────────────────┘         │ contacted │
                                                       └───────────┘
```

- **Client-side:** Next.js static app. Tax calculation runs entirely in the browser. Budget data is bundled as JSON — no API call needed for the core receipt.
- **API layer:** Next.js API routes keep API keys server-side, aggregate upstream APIs, and handle caching.
- **Cache:** Upstash Redis stores engagement counters (support / oppose / contacted). An in-memory Map fallback is used in development when Redis is unavailable.
- **Data refresh:** Planned cron jobs for bill tracking and vote records (not yet implemented).
- **Hosting:** Vercel free tier.

## Project Structure

```
src/
├── app/
│   ├── api/engagement/route.ts  — engagement counter API
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                 — main page with URL persistence
├── components/
│   ├── TaxForm.tsx              — input form
│   ├── TaxReceipt.tsx           — receipt orchestrator
│   ├── SpendingChart.tsx        — interactive donut chart
│   ├── ReceiptLine.tsx          — expandable line items
│   ├── BillsPanel.tsx           — upcoming bills with engagement
│   ├── RepresentativeCard.tsx   — rep display card
│   └── RepresentativesModal.tsx — modal for viewing reps + votes
├── data/
│   ├── budget.ts                — FY2024 spending categories
│   ├── pending-bills.ts         — curated active bills with CBO data
│   └── representatives.ts      — sample rep data + vote records
└── lib/
    ├── tax.ts                   — federal tax estimation
    ├── spending.ts              — maps tax to spending proportions
    ├── redis.ts                 — Upstash Redis client + fallback
    └── useEngagement.ts         — client hook for counters
```

## Data Sources

| Domain | Source | Status |
|---|---|---|
| Budget | OMB Historical Tables, USASpending.gov API | Curated FY2024 data |
| Tax | IRS brackets (2024) | Implemented |
| Bills | Congress.gov API | Planned — currently manually curated |
| Representatives | Google Civic Information API | Planned — currently sample data |
| Votes | ProPublica Congress API | Planned — currently sample data |
| CBO | Cost estimates from cbo.gov | Manual curation |

**Important transparency note:** The app does not track exact individual tax dollars. It estimates how a user's taxes would be distributed based on overall federal spending proportions. This methodology is clearly explained to users.

## Core User Flow

### 1. Input (minimal friction)

A simple form collecting the least information needed for a good tax estimate:

- **Income** (annual gross income)
- **Filing status** (single / married filing jointly / head of household)
- **ZIP code** (for representative lookup)

No account required. Zero friction to value.

### 2. The Receipt (interactive visualization)

The heart of the app. A visually engaging, animated receipt showing where your tax dollars went.

**Main receipt component** with expandable spending categories:

| Category | Examples |
|---|---|
| Healthcare | Medicare, Medicaid, ACA subsidies |
| Social Programs | Social Security, SNAP, housing assistance |
| Defense | Military operations, procurement, R&D |
| Education | Federal student aid, K-12 grants |
| Infrastructure | Transportation, broadband, water systems |
| Interest on National Debt | Debt service payments |

Each category shows your personal dollar amount and percentage. Presented with:

- Animated receipt rendering
- Colorful pie/donut charts
- Interactive data visualizations
- Visual cues and transitions

### 3. Category Drill-Down (follow the money)

Clicking any spending category reveals:

- **Agencies involved** in that spending area
- **Programs funded** and their breakdowns
- **High-level spending breakdowns** (subcategories)
- **Related legislation** — appropriations bills, funding changes, policy proposals

Each bill displays:

- Title and summary
- Current status
- Sponsors
- Links to official sources (congress.gov, etc.)

### 4. Representative Accountability

Using the user's ZIP code, the app identifies and displays their:

- **House representative**
- **Two Senators**

For each representative:

- Name, party, photo
- Contact information (phone, office address)
- Official website / contact form
- Voting record on relevant legislation

### 5. Take Action (frictionless civic engagement)

- Direct links to official contact forms
- Phone numbers and office addresses
- **Suggested call/email scripts** related to specific spending issues
- Share your receipt or a specific finding on social media

## Tech Stack

- **Next.js** (App Router) + **TypeScript**
- **Tailwind CSS** for styling
- **Framer Motion** for animations
- **Recharts** for data visualizations
- **Upstash Redis** for engagement counters
- Static budget dataset (curated JSON) for MVP

## MVP Scope

- [x] User input form (income, filing status, ZIP code)
- [x] Estimated federal tax calculation
- [x] Visual animated tax receipt with category breakdown
- [x] Interactive donut chart and expandable line items
- [x] Upcoming bills panel with engagement counters
- [x] URL persistence for shareable receipts
- [ ] Category drill-down with subcategories and legislation
- [ ] Representative lookup by ZIP code (live API)
- [ ] Contact-your-representative feature with suggested scripts

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in `.env.local` for engagement counters; the app falls back to in-memory storage if these are not set.

## Future Features

### API-Backed (automatable with live data)

| Feature | Data Source | API | Notes |
|---|---|---|---|
| **Campaign finance transparency** | FEC filings, industry contributions per member | [OpenSecrets API](https://www.opensecrets.org/open-data/api) (free, key required), [FEC API](https://api.open.fec.gov/) (free, no key) | "Your rep received $X from Y industry and voted YES on Z" — closes the loop between spending and influence |
| **Voter registration & status** | Registration check, absentee requests, polling places | [Vote.org API](https://www.vote.org/), [TurboVote API](https://www.democracy.works/) (free for civic apps) | Natural CTA alongside re-election badges |
| **Election reminders & ballot info** | Upcoming elections, polling locations, ballot measures | [Google Civic Information API](https://developers.google.com/civic-information) (free), [BallotReady API](https://www.ballotready.org/) | Same API we'll use for rep lookup also provides election data |
| **Public comment periods** | Open federal rulemaking comment periods by agency/topic | [Regulations.gov API](https://open.gsa.gov/api/regulationsgov/) (free, key required) | Massively underutilized civic action — comments actually influence policy |
| **Live representative lookup** | Representatives by address/ZIP | [Google Civic Information API](https://developers.google.com/civic-information) (free) | Replace current sample data |
| **Bill tracking & votes** | Active legislation, vote records | [Congress.gov API](https://api.congress.gov/) (free), [ProPublica Congress API](https://projects.propublica.org/api-docs/congress-api/) (free) | Replace current curated bills and sample votes |
| **Town hall tracker** | In-person and virtual town halls by district | [Town Hall Project](https://townhallproject.com/) (free data feeds) | RSS/JSON feeds, no formal API |

### Computed from Existing/Planned Data

| Feature | Description |
|---|---|
| **Voting alignment scorecard** | "Your rep voted with your priorities X% of the time" — computed from Congress.gov vote data + user's explored spending categories |
| **Year-over-year comparisons** | Trend visualization of spending changes across fiscal years |
| **"What if?" budget sliders** | Let users reallocate their tax dollars and see tradeoffs |
| **Social sharing** | Share your receipt or a specific finding — "I paid $X toward defense, $Y toward education" |

### Requires Manual Curation

| Feature | Description |
|---|---|
| **State & local legislature tracking** | No unified API — varies wildly by state |
| **Contact script templates** | Authored content for specific policy positions |
| **Contractor-level spending detail** | USASpending.gov has some data, but requires significant curation |
| **Donor state vs. recipient state comparisons** | Aggregated from multiple federal data sources |
| **State-level tax receipt companion** | Would need per-state budget data |

## Long-Term Vision

Build a public transparency tool that helps citizens understand:

- Where government money flows
- How policy decisions shape those flows
- How they can influence those decisions through democratic participation

Make civic engagement more informed, accessible, and immediate.
