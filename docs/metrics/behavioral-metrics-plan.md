# Behavioral Metrics Plan

## Overview

Add behavioral metrics tracking to Common Cents to understand how users interact with the app, which civic actions they take, and whether they return. The approach is **anonymous, session-based, and frictionless** — no consent banner needed since no PII is collected.

## Tooling

| Tool | Role | Cost |
|------|------|------|
| **PostHog** (cloud) | Event analytics, funnels, retention, session replay | Free tier: 1M events/month |
| **Existing Redis counters** | Civic action aggregates (bill support/oppose/contacted) | Already in place |

PostHog is installed as an npm package and initialized client-side. No server-side tracking needed for our use cases. Anonymous session IDs are stored in `localStorage` — no cookies, no PII.

### PostHog Configuration

- `persistence: "localStorage"` — no cookies, no consent banner
- `autocapture: false` — we define explicit events, not automatic click tracking
- `capture_pageview: false` — we handle pageviews manually for SPA routing
- `disable_session_recording: true` initially — enable later if needed

---

## Metrics by Category

### 1. Conversion / Activation

Track whether visitors convert from landing → generating a receipt.

| Event | Trigger | Properties |
|-------|---------|------------|
| `receipt_generated` | User submits income/filing/ZIP form | `filing_status`, `has_zip` (boolean) |
| `receipt_shared` | User copies or uses share URL | `method` ("copy_url", "native_share") |

**Key questions answered:**
- What % of visitors generate a receipt?
- What % of receipt generators share their result?

**Funnel:** `page_view` → `receipt_generated` → (any civic action)

### 2. User Engagement

Track how users explore their receipt.

| Event | Trigger | Properties |
|-------|---------|------------|
| `page_view` | App loads or navigates | `path`, `has_params` (boolean — returning via shared link?) |
| `category_expanded` | User expands a spending category | `category` |
| `category_collapsed` | User collapses a spending category | `category` |
| `tab_switched` | User switches panel tab | `from_tab`, `to_tab` |
| `international_compared` | User selects a country comparison | `country` |
| `chart_interacted` | User hovers/clicks chart elements | `chart_type`, `element` |

**Key questions answered:**
- Which spending categories get the most attention?
- Do users explore beyond the receipt (bills, reps, international)?
- How deep into the app do users go?

### 3. Civic Action

Track meaningful civic engagement. These are the highest-signal events.

| Event | Trigger | Properties |
|-------|---------|------------|
| `bill_viewed` | User expands a bill card | `bill_id` |
| `bill_voted` | User votes support/oppose | `bill_id`, `action` ("support" \| "oppose") |
| `rep_contact_clicked` | User clicks call/email link | `bill_id`, `contact_method` ("call" \| "email"), `rep_level` ("house" \| "senate") |
| `rep_looked_up` | ZIP code triggers rep lookup | `state` (2-letter, derived server-side) |
| `vote_record_viewed` | User views a rep's vote record | `rep_id`, `vote_type` |

**Key questions answered:**
- What % of users take a civic action after seeing their receipt?
- Which bills drive the most engagement?
- Do users contact reps after voting on bills?

**Funnel:** `receipt_generated` → `bill_viewed` → `bill_voted` → `rep_contact_clicked`

### 4. Retention / Return Visits

Tracked automatically by PostHog via anonymous session IDs in localStorage.

**Key questions answered:**
- What % of users return within 7 / 30 days?
- Do users who take civic actions return more often?
- Do shared-link visitors convert differently than organic visitors?

**Cohort definitions:**
- `new_user` — first session
- `returning_user` — has prior session
- `shared_link_visitor` — arrived with `?income=` params already set
- `civic_actor` — has at least one `bill_voted` or `rep_contact_clicked` event

---

## Implementation Plan

### Files to Change

| File | Change |
|------|--------|
| `package.json` | Add `posthog-js` dependency |
| `src/lib/analytics.ts` | **New** — PostHog init + typed event helpers |
| `src/app/layout.tsx` | Add PostHog provider |
| `src/app/page.tsx` | Track `page_view`, `receipt_generated`, rep lookup |
| `src/components/BillsPanel.tsx` | Track `bill_viewed`, `bill_voted`, `rep_contact_clicked` |
| `src/components/SpendingBreakdown.tsx` | Track `category_expanded` / `category_collapsed` |
| `src/components/InternationalComparison.tsx` | Track `international_compared` |

### Files to Create

| File | Purpose |
|------|---------|
| `src/lib/analytics.ts` | Typed wrapper around PostHog with event helpers |

### Implementation Details

#### `src/lib/analytics.ts`

Thin wrapper that:
- Initializes PostHog with privacy-safe defaults
- Exports typed helper functions per event (e.g., `trackReceiptGenerated()`)
- No-ops gracefully if PostHog key is missing (dev/test environments)
- Keeps all event names and properties in one place for maintainability

```ts
// Example shape
export function trackReceiptGenerated(filingStatus: string, hasZip: boolean) {
  capture("receipt_generated", { filing_status: filingStatus, has_zip: hasZip });
}
```

#### Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_POSTHOG_KEY` | No | PostHog project API key (tracking disabled without it) |
| `NEXT_PUBLIC_POSTHOG_HOST` | No | PostHog ingest URL (defaults to `https://us.i.posthog.com`) |

App works without these — analytics simply don't fire.

---

## Privacy Principles

1. **No PII collected** — no names, emails, or IP addresses stored
2. **No cookies** — session ID in localStorage only
3. **Anonymous by default** — PostHog `person_processing: false` considered
4. **Graceful degradation** — app works identically without PostHog configured
5. **Explicit events only** — no autocapture, no session recording initially
6. **Income is never tracked** — only `filing_status` and `has_zip` on receipt generation

The "No data stored — Calculated in your browser" promise remains true for tax data. Analytics track *actions*, not *financial information*.

---

## Success Criteria

After 30 days of data:

- [ ] Know the visitor → receipt conversion rate
- [ ] Know which spending categories users explore most
- [ ] Know what % of users take at least one civic action
- [ ] Know the receipt → civic action funnel drop-off points
- [ ] Have baseline retention numbers (7-day, 30-day)
- [ ] Identify whether shared-link visitors behave differently

---

## Future Considerations (Not in Scope)

- **Session replay** — enable PostHog recordings for UX research
- **Feature flags** — A/B test UI variants via PostHog
- **Alerts** — notify on engagement spikes (viral sharing, bill controversies)
- **Export** — pipe events to a data warehouse if volume warrants it
