# UX Audit Redesign: Elevated Civic + Editorial Hybrid

**Date:** 2026-03-15
**Status:** Draft
**Approach:** Component-by-component (Approach A) with incremental review

## Overview

Comprehensive UX pass combining a visual redesign ("Elevated Civic + Editorial" hybrid) with six interaction/feedback improvements and consistency polish. The app keeps its dark theme and indigo/purple accent but gains editorial personality through serif headings, monospace dollar amounts, receipt-inspired structural cues, and warmer slate tones.

## Design Direction

**Visual identity:** Dark elevated base (slate/navy) with editorial character borrowed from print receipts and newspaper design.

**Key signals:**
- Serif headings (Georgia) for warmth and authority
- Monospace numbers (Courier New / `font-mono`) for the receipt/ledger feel
- Dotted leaders between category names and amounts
- Double-line border above TOTAL rows
- Italic subtitles for editorial voice
- Gradient divider under hero headline
- Shift from neutral `gray-*` to warmer `slate-*` palette
- Higher contrast body text (`text-slate-300` instead of `text-gray-400`)

## Scope

### Visual Redesign (Priority C)
1. Typography system — serif headings, monospace amounts, italic subtitles
2. Palette shift — gray → slate, higher contrast for WCAG AA
3. Receipt structural cues — dotted leaders, double borders, monospace alignment
4. Editorial header/footer — serif logo, wider letter-spacing on labels
5. Consistent card styling — uniform border weights, spacing, and depth

### Interaction & Feedback (Priority B)
1. **Form validation** — Real-time inline errors for income and ZIP fields
2. **Chart keyboard navigation** — Arrow key navigation through donut segments, screen reader announcements
3. **Tooltip viewport awareness** — Smart repositioning when tooltip would clip off-screen
4. **Loading skeletons for charts** — Shimmer states for SpendingChart and FinanceCard bars
5. **Expandable descriptions** — "Read more" affordance replacing silent `line-clamp-2` truncation
6. **Scroll UX on mobile** — Remove nested 600px scroll container on small screens

### Polish & Consistency (Priority A)
- Unified animation easing constant
- Badge/status style consolidation
- Consistent skeleton loader patterns
- Font size floor (no `text-[10px]` except source attributions)

---

## Component-by-Component Spec

### Step 0: Foundations

**Files changed:** `src/app/layout.tsx`, `tailwind.config.ts` (or `@theme` block in CSS)

**Typography:**
- No new font downloads needed — Georgia and Courier New are system fonts
- Add `font-serif` class mapped to `Georgia, 'Times New Roman', serif` in Tailwind theme
- `font-mono` already maps to Geist Mono; keep for code, use `font-receipt` or direct `font-family: 'Courier New', Courier, monospace` for dollar amounts via a utility class
- Define a `.font-amount` utility for monospace dollar rendering

**Colors:**
- Global find-and-replace: `text-gray-300` → `text-slate-300`, `text-gray-400` → `text-slate-400`, `text-gray-500` → `text-slate-400` (bump up), `bg-gray-950` → `bg-slate-950`, `border-white/5` → `border-white/8`
- Exception: keep `text-gray-500` only for truly tertiary text (source attributions in footer)
- Verify WCAG AA (4.5:1 minimum) for all text-on-background combinations

**Shared utilities:**
- Animation easing: export `EASE_OUT_CUBIC = [0.33, 1, 0.68, 1]` from a constants file, use across all Framer Motion transitions
- Viewport-aware tooltip: new positioning logic in `InfoTooltip.tsx` using `getBoundingClientRect()` to flip above/below/left/right

**Files created:** None (utilities go in existing files)

---

### Step 1: Layout & Header

**Files changed:** `src/app/page.tsx` (header/footer sections), `src/app/layout.tsx`

**Header changes:**
- "Common Cents" logo: add `font-serif` (Georgia), keep gradient, add `letter-spacing: -0.5px` for editorial tightness
- "FY 2024 Estimates" label: `text-xs uppercase tracking-[3px] text-slate-500` (wider tracking, warmer gray)
- Border: `border-b border-white/8` (slightly more visible)

**Footer changes:**
- Data sources line: keep `text-[10px]` (this is the one exception)
- Attribution text: `font-serif italic` for the disclaimer
- Separator dots: use `·` (middle dot) instead of `•` (bullet) for editorial feel
- "Share feedback" and "Buy me a coffee" buttons: `rounded-lg` instead of `rounded-full` (less playful, more editorial)

---

### Step 2: Hero & TaxForm

**Files changed:** `src/app/page.tsx` (hero section), `src/components/TaxForm.tsx`

**Hero:**
- Headline: add `font-serif` to h1, keep gradient on "tax dollars"
- Add gradient divider: `<div className="w-10 h-0.5 bg-gradient-to-r from-indigo-400 to-purple-400 mx-auto" />` between headline and subtitle
- Subtitle: add `font-serif italic` styling, `text-slate-400`

**TaxForm — visual:**
- Input labels: `text-[10px] uppercase tracking-[1.5px] text-slate-500` (editorial label style)
- Income input value: add monospace font for the formatted number display
- Dollar sign prefix: `text-slate-500` (was `text-gray-400`)
- ZIP placeholder: show `"5 digits"` instead of empty, `font-mono text-slate-600`
- Filing status buttons: keep current pill style but use `slate` borders

**TaxForm — inline validation:**
- Income field: if user submits with empty/zero income, show inline error below input: `<p className="text-xs text-red-400 mt-1">Enter your annual income</p>` with `border-red-400/50` on the input
- ZIP field: validate on blur — if 1-4 chars, show `"Enter a valid 5-digit ZIP code"` in same error style. If 0 chars, no error (it's optional). If 5 chars, validate silently.
- Error state clears when user starts typing in the field
- Add `aria-invalid` and `aria-describedby` linking input to error message for screen readers

---

### Step 3: TaxReceipt

**Files changed:** `src/components/TaxReceipt.tsx`

**Receipt header (summary area):**
- "Your Federal Tax Receipt" → `font-serif` heading
- Add meta line below: `"Fiscal Year 2024 · Single Filer"` in `text-[10px] uppercase tracking-[1.5px] text-slate-500`
- Dollar amounts in summary: monospace font
- Estimate disclaimer: `font-serif italic text-slate-500`

**Year comparison toggle:**
- Keep current pill button style, no change needed

**Tax breakdown mini-summary (3-column grid):**
- Dollar values: monospace font
- Labels: keep sans-serif

**Receipt card (spending breakdown):**
- Header: `font-serif` for "Spending Breakdown", `border-b-2` (heavier) instead of `border-b`
- Dollar amount in header: monospace
- Total footer: `border-t-[3px] border-double border-white/15` (classic receipt double-line)
- "TOTAL" label: `uppercase tracking-[1.5px] text-slate-400`
- Total amount: monospace, slightly larger (`text-base font-bold`)

**"See How Your Reps Voted" button:**
- Keep current indigo style, no changes needed

---

### Step 4: SpendingChart

**Files changed:** `src/components/SpendingChart.tsx`

**Loading skeleton:**
- When `spending` array is empty or chart is first rendering, show a circular skeleton:
  - Outer ring: `w-[280px] h-[280px] rounded-full border-[20px] border-white/5 animate-pulse mx-auto`
  - Center text: "Loading..." in `text-slate-500`
- Transition from skeleton to chart with opacity fade

**Keyboard navigation:**
- Add `tabIndex={0}` to the chart container, `role="application"`, `aria-roledescription="interactive chart"`
- On focus, activate first segment; arrow keys (Left/Right) cycle through segments
- Active segment triggers same visual state as hover (highlight + center label update)
- Add `aria-live="polite"` region for announcing: `"Social Security: $2,432, 23.0% of your taxes"`
- Enter/Space key toggles expansion (same as click)
- Escape key deselects active segment

**Center label:**
- "Hover or click to explore" → also mention keyboard: "Hover, click, or use arrow keys"
- Dollar amount in center: monospace font

**Visual:**
- Chart stroke: keep transparent, no changes

---

### Step 5: ReceiptLine

**Files changed:** `src/components/ReceiptLine.tsx`

**Dotted leaders:**
- Between category name and amount, add a flex spacer with dotted bottom border:
  ```
  <span className="flex-1 border-b border-dotted border-white/10 mx-2 self-end mb-1" />
  ```
- This creates the classic receipt "Social Security .......... $2,432" pattern

**Monospace amounts:**
- All dollar values: add monospace font class
- Percentage values: keep sans-serif, `text-slate-400`

**Expandable descriptions (replacing silent truncation):**
- Subcategory descriptions and bill summaries: remove `line-clamp-2`
- Add controlled truncation with "Show more" / "Show less" toggle:
  - Default: `line-clamp-3` with a `<button className="text-xs text-indigo-400 hover:text-indigo-300 mt-1">Show more</button>`
  - Expanded: full text with `<button>Show less</button>`
  - Track expanded state per-item locally

**Scroll UX improvement:**
- In `TaxReceipt.tsx`: change `max-h-[600px] overflow-y-auto` to be responsive:
  - Desktop (lg+): keep `max-h-[600px] overflow-y-auto` with custom scrollbar
  - Mobile (<lg): remove max-height, show all items naturally in page flow
  - Implementation: `className="lg:max-h-[600px] lg:overflow-y-auto"`

---

### Step 6: SecondaryTabs & Panels

**Files changed:** `src/components/SecondaryTabs.tsx`, `src/components/BillsPanel.tsx`, `src/components/RecentExpenditures.tsx`, `src/components/FinanceCard.tsx`, `src/components/InternationalComparison.tsx`, `src/components/SpendingTrends.tsx`

**SecondaryTabs:**
- Tab labels: keep sans-serif (they're UI controls, not editorial content)
- Active tab indicator: keep current indigo highlight
- Section headings within tabs: `font-serif` where they appear as content titles

**BillsPanel:**
- Bill titles: keep sans-serif (they're proper nouns/bill names)
- Dollar impacts: monospace font
- Status badges: keep current color scheme (already well-differentiated)
- Bill descriptions: add "Show more" affordance (same pattern as ReceiptLine)

**RecentExpenditures:**
- Contract amounts: monospace font
- Loading skeletons: already has them, verify slate palette
- "Load More" button: style consistent with editorial tone

**FinanceCard:**
- Dollar amounts on bars: monospace font
- Loading skeleton: already has shimmer, verify slate palette
- Section headings: `font-serif` for "Outside Spending", "Top Donor Employers"

**InternationalComparison:**
- Country comparison amounts: monospace font
- Section headings: `font-serif`
- "No equivalent" placeholder: `font-serif italic text-slate-500`

**SpendingTrends:**
- Dollar amounts: monospace font
- Section headers ("Spending", "Revenue"): `font-serif uppercase tracking-wider`
- Percentage badges: keep current green/red scheme

---

### Step 7: RepresentativesModal

**Files changed:** `src/components/RepresentativesModal.tsx`, `src/components/RepresentativeCard.tsx`, `src/components/InfoTooltip.tsx`

**Modal:**
- Title: `font-serif` for "Your Representatives"
- Palette: shift all `gray-*` to `slate-*` within modal

**RepresentativeCard:**
- Rep names: `font-serif` (they're proper nouns, editorial treatment suits them)
- Dollar amounts (campaign finance): monospace font

**InfoTooltip — viewport awareness:**
- Replace fixed `absolute bottom-full` / `top-full` with dynamic positioning:
  1. On show (hover/focus), call `getBoundingClientRect()` on the trigger element
  2. Calculate if tooltip would overflow viewport in current direction
  3. Flip to opposite side if needed: above ↔ below
  4. Also check horizontal bounds: if tooltip extends past left/right edge, shift it
- Implementation approach: add a `useEffect` that runs on visibility change, calculates position, and sets `top`/`left`/`transform` via inline style
- Fallback: if JS hasn't run yet (SSR), default to `bottom-full` (current behavior)

---

### Step 8: Footer

**Files changed:** `src/app/page.tsx` (footer section)

- Disclaimer text: `font-serif italic` for the editorial voice
- Source links: keep `text-[10px]` (the one size exception), shift to `text-slate-500`
- Separators: `·` middle dot (already done)
- "Share feedback" / "Buy me a coffee": `rounded-lg` instead of `rounded-full`
- Non-affiliation note: `font-serif italic text-slate-500`

---

## Testing Considerations

- **Visual regression:** Screenshot comparisons before/after for hero, receipt, chart, modal
- **WCAG AA contrast:** Verify all `text-slate-*` on `bg-slate-950` meet 4.5:1 ratio
- **Keyboard navigation:** Tab through entire page flow including chart segments
- **Screen reader:** Test chart announcements with VoiceOver/NVDA
- **Mobile:** Test receipt scroll behavior on viewport < 640px
- **Form validation:** Test edge cases: empty submit, partial ZIP, paste with non-numeric chars
- **Tooltip positioning:** Test in viewport corners, on mobile, in modal context

## Out of Scope

- Light mode / theme toggle
- New components or pages
- Data model changes
- API changes
- New font downloads (using system fonts only)
