# Observability Plan

## Overview

Infrastructure and performance observability for Common Cents, focused on API health, client performance, and external dependency reliability. Complements the behavioral metrics plan (PostHog) with system-level visibility.

---

## Core Metrics

### 1. API Route Health

Monitor all routes under `src/app/api/` — representatives, votes, engagement, campaign-finance, bills.

| Metric | What to Watch | Why |
|--------|---------------|-----|
| Request latency (p50, p95, p99) | Slow responses degrade receipt experience | Geocodio/House Clerk/Senate XML add variable latency |
| Error rate (4xx / 5xx) | Spike = broken integration or bad client input | 400s from bad params vs 500s from upstream failures |
| Rate limit hits (429s) | How often users hit `checkRateLimit()` | May need to tune limits or add caching |
| Fallback activation rate | Routes returning `{ fallback: true }` | Measures external API unreliability |

### 2. External API Dependencies

These are the biggest risk to reliability since they're outside our control.

| Dependency | Failure Mode | Metric |
|------------|-------------|--------|
| **Geocodio** | ZIP → rep lookup fails | Error rate, latency, timeout rate |
| **House Clerk XML** | Roll call vote fetch fails | Error rate, latency, staleness (last successful fetch) |
| **Senate XML** | Roll call vote fetch fails | Error rate, latency, staleness |
| **Upstash Redis** | Engagement counters unavailable | Error rate, latency, fallback-to-in-memory-Map rate |

### 3. Client Performance (Web Vitals)

| Metric | Target | Why |
|--------|--------|-----|
| **LCP** (Largest Contentful Paint) | < 2.5s | Receipt render is the core value moment |
| **INP** (Interaction to Next Paint) | < 200ms | Category expand/collapse, tab switches use Framer Motion |
| **CLS** (Cumulative Layout Shift) | < 0.1 | Charts and async data loading can cause shifts |
| **TTFB** (Time to First Byte) | < 800ms | Static page with client-side compute should be fast |

### 4. Client Fetch Reliability

Track `fetchWithTimeout()` behavior in `src/app/page.tsx`.

| Metric | What to Watch |
|--------|---------------|
| Timeout rate | How often the 8s timeout fires |
| Null-return rate | Fetches that fail silently (by design) |
| Secondary data load time | Finance + votes fetch after primary receipt renders |

---

## Vercel Setup

### Step 1: Web Vitals — `@vercel/analytics`

Automatic Core Web Vitals collection with zero config.

```bash
npm i @vercel/analytics
```

Add to root layout:

```tsx
// src/app/layout.tsx
import { Analytics } from "@vercel/analytics/react";

// Inside the <body> tag:
<Analytics />
```

Dashboard: Vercel project → **Analytics** tab.

### Step 2: Speed Insights — `@vercel/speed-insights`

Real-user performance monitoring with per-route breakdowns.

```bash
npm i @vercel/speed-insights
```

Add to root layout:

```tsx
// src/app/layout.tsx
import { SpeedInsights } from "@vercel/speed-insights/next";

// Inside the <body> tag:
<SpeedInsights />
```

Dashboard: Vercel project → **Speed Insights** tab.

### Step 3: Structured Logging in API Routes

Vercel captures `console.log` output from serverless functions. Use structured JSON for queryability.

```ts
// Example: log in any API route
console.log(JSON.stringify({
  route: "/api/representatives",
  event: "external_api_call",
  dependency: "geocodio",
  latency_ms: elapsed,
  success: true,
}));

// On failure / fallback
console.log(JSON.stringify({
  route: "/api/votes",
  event: "fallback_activated",
  dependency: "house_clerk",
  error: error.message,
}));
```

Dashboard: Vercel project → **Logs** tab. Filter by JSON fields.

### Step 4: OpenTelemetry (Deferred — Requires Pro Plan)

Next.js has experimental OTEL support for automatic tracing of API routes and fetches. Requires either Vercel Pro (for built-in tracing or the Axiom integration) or a manually configured external provider (Grafana Cloud, Honeycomb). Revisit when upgrading to Pro.

---

## Alerting

Requires Vercel **Pro plan** (not available on Hobby):

| Alert | Condition | Channel |
|-------|-----------|---------|
| Error spike | 5xx rate > 5% over 5 min | Email / Slack |
| Latency degradation | p95 > 3s over 10 min | Email / Slack |
| Deployment failure | Build or function crash | Email / Slack |

Configure in Vercel project → **Settings** → **Notifications**.

---

## Implementation Priority

| Priority | Item | Effort |
|----------|------|--------|
| 1 | `@vercel/analytics` (Web Vitals) | 5 min — npm install + one line in layout |
| 2 | `@vercel/speed-insights` | 5 min — same as above |
| 3 | Structured logging in API routes | 1-2 hrs — add JSON logging to each route |
| 4 | Vercel alerting (requires Pro plan) | 10 min — dashboard config |
| 5 | OpenTelemetry instrumentation | 30 min — deferred, requires Pro plan |

---

## What This Does NOT Cover

- **Behavioral/product analytics** — see `behavioral-metrics-plan.md` (PostHog)
- **Uptime monitoring** — consider a simple external ping (e.g., Better Uptime, Checkly) for the public URL
- **Cost monitoring** — track Vercel function invocations and Upstash Redis usage in their respective dashboards
