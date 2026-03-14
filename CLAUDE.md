# Common Cents

A civic tech web app that transforms your federal tax contribution into a personalized, interactive receipt — then connects that spending to political decisions and your elected representatives.

## Tech Stack

- **Framework:** Next.js 16 (App Router) + TypeScript
- **Styling:** Tailwind CSS v4
- **Animations:** Framer Motion
- **Charts:** Recharts v3
- **State:** React hooks + URL search params (no external state library)
- **Engagement counters:** Upstash Redis (in-memory Map fallback for dev)
- **APIs:** Geocodio (ZIP → reps), House Clerk + Senate XML (roll call votes)
- **Hosting:** Vercel

## Key Decisions

- Tax calculation runs **entirely client-side** — no server round-trip needed
- Budget data is **bundled as static JSON** from OMB/CBO sources
- Representative lookup is **server-side** (API route) to keep keys hidden
- URL params (`?income=X&filing=Y&zip=Z`) enable shareable/refreshable receipts
- No user accounts — zero friction to value

## Dev Commands

```bash
npm run dev        # Start dev server on localhost:3000
npx next build     # Production build + type check
npm test           # Run tests once
npm run test:watch # Run tests in watch mode
```

## Environment Variables

See `.env.example` for all keys. The app works without env vars (in-memory counters, no rep data shown). Set `GEOCODIO_API_KEY` for live representative lookup and vote records.

---

# Engineering Protocol

When implementing a feature, follow this process:

1. Understand the problem
- Ask clarifying questions if requirements are ambiguous.

2. Design before coding
- Propose a short plan.
- Describe data models, APIs, and file structure.

3. Implement
- Write production-ready code.
- Follow existing project patterns.
- Avoid unnecessary abstractions.

4. Verify
- Consider edge cases.
- Suggest tests where appropriate.

5. Never output placeholder code. Avoid:
- TODO comments
- unimplemented functions
- pseudo-code

All code must run.

6. Before writing code:
- Check if similar patterns already exist in the repo
- Reuse existing utilities and hooks when possible

7. When implementing features:

Always show:
- files that will change
- files that will be created

8. Prefer small, focused changes rather than large rewrites.

9. If requirements are unclear, ask questions before implementing.

---

# Codebase Patterns

## Project Structure

```
src/
├── app/
│   ├── api/           # API routes: representatives, votes, engagement, campaign-finance, bills
│   ├── layout.tsx     # Root layout
│   └── page.tsx       # Home page — main client component, orchestrates all data fetching
├── components/        # Client components (all "use client") with Framer Motion animations
├── data/              # Static data: budget.ts, pending-bills.ts, tracked-votes.ts, international.json
├── hooks/             # Custom hooks: useInternationalComparison
└── lib/               # Utilities: tax.ts, spending.ts, redis.ts, useEngagement.ts
```

## API Routes

All routes in `src/app/api/*/route.ts` follow the same shape:

- Import `NextRequest` / `NextResponse` from `"next/server"`
- Validate query params at the top, return 400 on invalid input
- External API failures return `{ fallback: true }` (graceful degradation)
- Rate limiting via `checkRateLimit(ip)` → 429 with `Retry-After` header
- Cache with `{ next: { revalidate: 86400 } }` (24h ISR) or in-memory Maps

## Data Fetching (Client)

All client fetching lives in `src/app/page.tsx`:

- `fetchWithTimeout(url, timeoutMs)` — wrapper with configurable timeout (default 8s)
- Returns `null` or `[]` on failure — never throws to the UI
- Log errors with bracket prefixes: `[votes]`, `[reps]`, `[finance]`
- Secondary data (finance, votes) fetches non-blocking after primary receipt renders

## Key Utilities

| Utility | Location | Purpose |
|---------|----------|---------|
| `estimateFederalTax()` | `lib/tax.ts` | Client-side tax calculation |
| `calculatePersonalSpending()` | `lib/spending.ts` | Distributes tax across budget categories |
| `formatCurrency()` / `formatPercent()` | `lib/tax.ts` | Intl.NumberFormat wrappers |
| `useEngagement()` | `lib/useEngagement.ts` | Fetch/record bill engagement with optimistic updates |
| `useInternationalComparison()` | `hooks/useInternationalComparison.ts` | Compare spending across countries |
| `incrementCounter()` / `getCounters()` | `lib/redis.ts` | Redis with in-memory Map fallback |

## Types & Naming

- Discriminated unions over enums: `FilingStatus = "single" | "married" | "head_of_household"`
- PascalCase components, camelCase functions, SCREAMING_SNAKE constants
- Props interfaces defined at top of component files
- Path alias: `@/*` → `./src/*`

## Testing

- **Unit tests:** co-located as `*.test.ts` (e.g., `lib/tax.test.ts`)
- **Integration tests:** `api/*/*.integration.test.ts` — mock `fetch` with `vi.stubGlobal()`, dynamic-import route after mocking
- **E2E tests:** `e2e/` directory with Playwright
- **Runner:** Vitest (node environment, not jsdom)