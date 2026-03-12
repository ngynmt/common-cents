# Common Cents

A web app that transforms your federal tax contribution into a personalized, interactive receipt — then connects that spending to political decisions and your elected representatives.

## Goal

Make government spending personal, understandable, and actionable. Encourage civic engagement by showing people exactly where their tax dollars go and who decided it.

## Design Philosophy

- **Personalization** — data reflects *your* taxes and *your* representatives
- **Clarity** — simplify complex government spending into clear categories and explanations
- **Emotional engagement** — meaningful comparisons, tradeoffs, local impacts, voting decisions
- **Actionability** — every insight leads to a potential action: learn more, explore deeper, contact representatives
- **Visual appeal** — colorful, animated, interactive. Civic tech doesn't have to be dull.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

See `.env.example` for optional environment variables (Upstash Redis, Geocodio, Congress.gov). The app works without any env vars — it falls back to in-memory counters and sample representative data.

## Data Sources

| Domain | Source | Status |
|---|---|---|
| Budget | OMB Historical Tables, USASpending.gov | Curated FY2024 data |
| Tax brackets | IRS Rev. Proc. 2023-34 (2024) | Implemented |
| Representatives | Geocodio API | Live — ZIP → exact legislators |
| Bills | Congress.gov API | Planned — currently manually curated |
| Votes | Congress.gov / ProPublica API | Planned — currently sample data |
| Cost estimates | CBO | Manual curation |

**Transparency note:** The app estimates how a user's taxes would be distributed based on overall federal spending proportions. It does not track exact individual tax dollars. This methodology is clearly explained to users.

## Core User Flow

1. **Input** — Income, filing status, ZIP code. No account required.
2. **Receipt** — Animated, interactive breakdown of where your tax dollars go across 14 budget categories.
3. **Drill-down** — Expand any category to see subcategories, agencies, and related legislation.
4. **Bills** — See active legislation that could change spending, with community engagement counters.
5. **Representatives** — View your senators and house rep, their contact info, and how they voted.
6. **Take action** — Call or email your rep with generated scripts tied to specific spending issues.

## MVP Scope

- [x] Tax estimation (income tax + FICA, standard deduction)
- [x] Interactive spending receipt with donut chart
- [x] Expandable line items with subcategory breakdowns
- [x] Bills panel with engagement counters (Upstash Redis)
- [x] Live representative lookup by ZIP (Geocodio)
- [x] Representative contact info and re-election tracking
- [x] URL persistence for shareable receipts
- [x] Contact scripts for calling/emailing reps
- [ ] Live bill tracking and vote records (Congress.gov API)
- [ ] Campaign finance data (OpenSecrets/FEC)

## Future Features

### API-Backed (automatable with live data)

| Feature | API | Notes |
|---|---|---|
| **Campaign finance** | [OpenSecrets](https://www.opensecrets.org/open-data/api), [FEC](https://api.open.fec.gov/) | "Your rep received $X from Y industry and voted YES on Z" |
| **Voter registration** | [Vote.org](https://www.vote.org/), [TurboVote](https://www.democracy.works/) | Registration check, absentee requests, polling places |
| **Election reminders** | [Google Civic Info](https://developers.google.com/civic-information), [BallotReady](https://www.ballotready.org/) | Upcoming elections, ballot measures |
| **Public comment periods** | [Regulations.gov](https://open.gsa.gov/api/regulationsgov/) | Open federal rulemaking — comments actually influence policy |
| **Town hall tracker** | [Town Hall Project](https://townhallproject.com/) | In-person and virtual events by district |

### Computed from Existing Data

| Feature | Description |
|---|---|
| **Voting alignment scorecard** | "Your rep voted with your priorities X% of the time" |
| **Year-over-year comparisons** | Spending trend visualization across fiscal years |
| **"What if?" budget sliders** | Reallocate your tax dollars and see tradeoffs |
| **Social sharing** | Share your receipt — "I paid $X toward defense, $Y toward education" |

### Requires Manual Curation

| Feature | Description |
|---|---|
| **State & local tracking** | No unified API — varies by state |
| **Contractor-level spending** | USASpending.gov has some data, needs curation |
| **State-level tax receipt** | Per-state budget data needed |

## Documentation

- **[ARCHITECTURE.md](ARCHITECTURE.md)** — System design, data flows, architectural constraints
- **[CODEBASE_MAP.md](CODEBASE_MAP.md)** — File-by-file navigation guide, component hierarchy
- **[CLAUDE.md](CLAUDE.md)** — Engineering protocol and project context

## Long-Term Vision

Build a public transparency tool that helps citizens understand where government money flows, how policy decisions shape those flows, and how they can influence those decisions through democratic participation.
