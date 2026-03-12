# Common Cents

A civic tech web app that transforms your federal tax contribution into a personalized, interactive receipt — then connects that spending to political decisions and your elected representatives.

## Tech Stack

- **Framework:** Next.js 16 (App Router) + TypeScript
- **Styling:** Tailwind CSS v4
- **Animations:** Framer Motion
- **Charts:** Recharts v3
- **State:** React hooks + URL search params (no external state library)
- **Engagement counters:** Upstash Redis (in-memory Map fallback for dev)
- **APIs:** Geocodio (ZIP → reps), Congress.gov (bills/votes — planned)
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

See `.env.example` for all keys. The app works without any env vars (falls back to in-memory counters and sample rep data).

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