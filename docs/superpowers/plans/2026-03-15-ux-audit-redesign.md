# UX Audit Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the app's visual identity to an "Elevated Civic + Editorial" hybrid while adding six interaction/feedback improvements.

**Architecture:** Component-by-component approach — set up shared foundations (typography, palette, utilities), then restyle each component top-to-bottom with both visual and interaction changes applied together. Each task produces a reviewable, self-contained result.

**Tech Stack:** Next.js 16 (App Router), Tailwind CSS v4 (`@theme inline` in globals.css), Framer Motion, Recharts v3, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-15-ux-audit-redesign.md`

---

## Chunk 1: Foundations & Layout

### Task 1: Create shared design constants

**Files:**
- Create: `src/lib/constants.ts`

- [ ] **Step 1: Create constants file with animation easing**

```ts
// src/lib/constants.ts

/** Shared cubic-bezier easing for all Framer Motion transitions */
export const EASE_OUT_CUBIC = [0.33, 1, 0.68, 1] as const;

/** Standard transition preset for component animations */
export const TRANSITION_DEFAULT = {
  duration: 0.3,
  ease: EASE_OUT_CUBIC,
} as const;

/** Stagger delay between list items */
export const STAGGER_DELAY = 0.05;
```

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noEmit src/lib/constants.ts`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/constants.ts
git commit -m "feat: add shared design constants (easing, transitions)"
```

---

### Task 2: Update typography and palette foundations in globals.css

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add serif font and `.font-amount` utility to globals.css**

In `src/app/globals.css`, update the `@theme inline` block and add the utility:

```css
@theme inline {
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
  --font-serif: Georgia, 'Times New Roman', serif;
}
```

Add after the `@theme inline` block:

```css
/* Monospace font for dollar amounts — receipt/ledger style */
.font-amount {
  font-family: 'Courier New', Courier, monospace;
}
```

- [ ] **Step 2: Update background color from gray-950 to slate-950**

Change line 9 from:
```css
background: #030712;
```
to:
```css
background: #020617;
```

- [ ] **Step 3: Update InfoTooltip tooltip background**

Change `bg-gray-900` to `bg-slate-900` in `src/components/InfoTooltip.tsx` line 33.

Also shift `text-gray-400` to `text-slate-400` and `text-gray-300` to `text-slate-300` on the icon (line 25) and tooltip body (line 33).

- [ ] **Step 4: Verify dev server starts without errors**

Run: `npm run dev` (check for build errors, then stop)
Expected: Compiles successfully

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css src/components/InfoTooltip.tsx
git commit -m "feat: add serif font, font-amount utility, shift to slate-950 base"
```

---

### Task 3: Global gray → slate palette shift

**Files:**
- Modify: All component files in `src/components/`, `src/app/page.tsx`

This is a bulk find-and-replace across all component files. The replacements are:

| Find | Replace |
|------|---------|
| `text-gray-300` | `text-slate-300` |
| `text-gray-400` | `text-slate-400` |
| `text-gray-500` | `text-slate-400` (bump up for contrast) |
| `bg-gray-950` | `bg-slate-950` |
| `bg-gray-900` | `bg-slate-900` |
| `border-white/5` | `border-white/8` |

**Exceptions — do NOT replace `text-gray-500`:**
- Footer source attributions — `src/app/page.tsx` lines 281-296 (keep as truly tertiary text)
- `InfoTooltip.tsx` tooltip body (already handled in Task 2)
- Submit button disabled state — `src/app/page.tsx` line 119 (`text-gray-500 cursor-not-allowed`) — keep for disabled affordance
- `src/components/TaxForm.tsx` line 119 (`text-gray-500 cursor-not-allowed`) — same

**Note:** `border-white/10` is used separately from `border-white/5` and is NOT part of this palette shift. Only `border-white/5` → `border-white/8`. Leave `border-white/10` as-is everywhere.

**Dependency note:** Tasks 4-16 assume this palette shift has already been applied. Run this task first.

- [ ] **Step 1: Run find-and-replace for `text-gray-300` → `text-slate-300`**

Apply across all `.tsx` files in `src/components/` and `src/app/page.tsx`.

- [ ] **Step 2: Run find-and-replace for `text-gray-400` → `text-slate-400`**

Apply across all `.tsx` files in `src/components/` and `src/app/page.tsx`.

- [ ] **Step 3: Run find-and-replace for `text-gray-500` → `text-slate-400`**

Apply across all `.tsx` files in `src/components/` and `src/app/page.tsx`. Then manually revert the footer source attribution lines in `page.tsx` (lines ~281-296) back to `text-gray-500`.

- [ ] **Step 4: Run find-and-replace for `bg-gray-950` → `bg-slate-950`**

- [ ] **Step 5: Run find-and-replace for `bg-gray-900` → `bg-slate-900`**

- [ ] **Step 6: Run find-and-replace for `border-white/5` → `border-white/8`**

Apply carefully — this affects border visibility. Verify it doesn't over-thicken borders in cards.

- [ ] **Step 7: Verify build passes**

Run: `npx next build`
Expected: Build succeeds with no type errors

- [ ] **Step 8: Commit**

```bash
git add src/components/ src/app/page.tsx
git commit -m "feat: global palette shift from gray to slate for warmer contrast"
```

---

### Task 4: Header and footer editorial styling

**Files:**
- Modify: `src/app/page.tsx:193-209` (header), `src/app/page.tsx:274-320` (footer)

- [ ] **Step 1: Restyle the header**

In `src/app/page.tsx`, update the header section (~line 193-209):

Logo `<span>` (~line 200-202): add `font-serif` class and `tracking-tight`:
```tsx
<span className="text-2xl font-bold font-serif tracking-tight bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
```

FY label (`<span>` ~line 205-207): widen tracking:
```tsx
<span className="text-xs text-slate-500 uppercase tracking-[3px]">
```

Header border (~line 193): change to `border-white/8`:
```tsx
<header className="border-b border-white/8">
```

- [ ] **Step 2: Restyle the footer**

In `src/app/page.tsx`, update the footer section (~line 274-320):

Disclaimer text (~line 277-279): add `font-serif italic`:
```tsx
<p className="font-serif italic">
```

Non-affiliation note (~line 298-300): add `font-serif italic text-slate-500`:
```tsx
<p className="font-serif italic text-slate-500">
```

"Share feedback" button (~line 302-308): change `rounded-full` to `rounded-lg`.

"Buy me a coffee" button (~line 309-317): change `rounded-full` to `rounded-lg`.

- [ ] **Step 3: Update trust indicator separators**

In `src/app/page.tsx`, the trust indicators (~line 241-247): change `•` bullet to `·` middle dot:

```tsx
<span aria-hidden="true">·</span>
```

(Two instances — between "No data stored" and "Calculated in your browser", and between "Calculated in your browser" and "100% open source")

- [ ] **Step 4: Verify visually in dev server**

Run: `npm run dev`
Check: Header logo uses serif font, footer has italic serif disclaimers, buttons are rounded-lg not rounded-full.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: editorial styling for header (serif logo) and footer (italic disclaimers)"
```

---

## Chunk 2: Hero, Form, and Receipt

### Task 5: Hero section editorial treatment

**Files:**
- Modify: `src/app/page.tsx:222-248`

- [ ] **Step 1: Add serif font and gradient divider to hero**

In `src/app/page.tsx`, hero section (~line 224-237):

Update h1 (~line 225): add `font-serif`:
```tsx
<h1 className="text-4xl sm:text-5xl font-bold font-serif">
```

After the h1 closing tag and before the subtitle `<p>`, add gradient divider:
```tsx
<div className="w-10 h-0.5 bg-gradient-to-r from-indigo-400 to-purple-400 mx-auto" />
```

Update subtitle `<p>` (~line 232-235): add `font-serif italic`:
```tsx
<p className="text-slate-400 text-lg font-serif italic">
```

- [ ] **Step 2: Verify visually**

Run: `npm run dev`
Check: Hero headline is serif, thin gradient divider appears below headline, subtitle is italic serif.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: editorial hero — serif heading, gradient divider, italic subtitle"
```

---

### Task 6: TaxForm visual restyling

**Files:**
- Modify: `src/components/TaxForm.tsx`

- [ ] **Step 1: Update form labels to editorial style**

In `src/components/TaxForm.tsx`:

Income label (~line 45): change to uppercase tracking editorial style. Note: the spec says `text-[10px]` but per the `text-[10px]` triage rules, form labels should use `text-xs` with uppercase tracking to feel small without sacrificing readability:
```tsx
<label htmlFor="income" className="block text-xs font-medium text-slate-400 uppercase tracking-[1.5px]">
```

Filing status label (~line 66): same treatment:
```tsx
<label id="filing-status-label" className="block text-xs font-medium text-slate-400 uppercase tracking-[1.5px]">
```

ZIP label (~line 95): same treatment, keep the optional hint:
```tsx
<label htmlFor="zipCode" className="block text-xs font-medium text-slate-400 uppercase tracking-[1.5px]">
  ZIP Code <span className="text-slate-500 normal-case tracking-normal italic">(optional — for representative lookup)</span>
</label>
```

- [ ] **Step 2: Add monospace font to income input**

Income input (~line 52-60): add `font-amount` class. Note: keep `border-white/10` (not `/8`) — the palette shift only changes `/5` → `/8`:
```tsx
className="w-full pl-8 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-lg font-amount placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
```

Dollar sign prefix (~line 49): update color:
```tsx
<span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-lg">
```

- [ ] **Step 3: Update ZIP placeholder**

ZIP input (~line 98-107): update placeholder and add `font-amount`. Keep `border-white/10`:
```tsx
<input
  id="zipCode"
  type="text"
  inputMode="numeric"
  value={zipCode}
  onChange={(e) => setZipCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 5))}
  placeholder="5 digits"
  maxLength={5}
  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-lg font-amount placeholder:text-slate-600 placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
/>
```

- [ ] **Step 4: Verify visually**

Run: `npm run dev`
Check: Labels are uppercase with wider tracking, income input shows monospace numbers, ZIP has "5 digits" placeholder.

- [ ] **Step 5: Commit**

```bash
git add src/components/TaxForm.tsx
git commit -m "feat: editorial form labels, monospace income input, updated ZIP placeholder"
```

---

### Task 7: TaxForm inline validation

**Files:**
- Modify: `src/components/TaxForm.tsx`

- [ ] **Step 1: Add validation state and blur handlers**

In `src/components/TaxForm.tsx`, add validation state after the existing state declarations (~line 14):

```ts
const [incomeError, setIncomeError] = useState("");
const [zipError, setZipError] = useState("");
```

Update `handleIncomeChange` (~line 16-18) to clear error on typing:
```ts
const handleIncomeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const raw = e.target.value.replace(/[^0-9]/g, "");
  setIncome(raw);
  if (incomeError) setIncomeError("");
};
```

Update ZIP onChange (~line 103) to clear error on typing:
```tsx
onChange={(e) => {
  setZipCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 5));
  if (zipError) setZipError("");
}}
```

Add blur handlers:
```ts
const handleIncomeBlur = () => {
  if (!income || Number(income) <= 0) {
    setIncomeError("Enter your annual income");
  }
};

const handleZipBlur = () => {
  if (zipCode.length > 0 && zipCode.length < 5) {
    setZipError("Enter a valid 5-digit ZIP code");
  }
};
```

- [ ] **Step 2: Add error display and aria attributes to income field**

Update the income input (~line 52-60) to include `onBlur`, `aria-invalid`, and `aria-describedby`:
```tsx
<input
  id="income"
  type="text"
  inputMode="numeric"
  value={formattedIncome}
  onChange={handleIncomeChange}
  onBlur={handleIncomeBlur}
  placeholder="75,000"
  aria-invalid={!!incomeError}
  aria-describedby={incomeError ? "income-error" : undefined}
  className={`w-full pl-8 pr-4 py-3 bg-white/5 border rounded-xl text-white text-lg font-amount placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all ${
    incomeError ? "border-red-400/50" : "border-white/10"
  }`}
/>
```

After the input's closing `</div>` (the relative wrapper), add the error message:
```tsx
{incomeError && (
  <p id="income-error" className="text-xs text-red-400 mt-1">{incomeError}</p>
)}
```

- [ ] **Step 3: Add error display and aria attributes to ZIP field**

Update the ZIP input to include `onBlur`, `aria-invalid`, and `aria-describedby`:
```tsx
<input
  id="zipCode"
  type="text"
  inputMode="numeric"
  value={zipCode}
  onChange={(e) => {
    setZipCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 5));
    if (zipError) setZipError("");
  }}
  onBlur={handleZipBlur}
  placeholder="5 digits"
  maxLength={5}
  aria-invalid={!!zipError}
  aria-describedby={zipError ? "zip-error" : undefined}
  className={`w-full px-4 py-3 bg-white/5 border rounded-xl text-white text-lg font-amount placeholder:text-slate-600 placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all ${
    zipError ? "border-red-400/50" : "border-white/10"
  }`}
/>
{zipError && (
  <p id="zip-error" className="text-xs text-red-400 mt-1">{zipError}</p>
)}
```

- [ ] **Step 4: Verify validation behavior**

Run: `npm run dev`
Test:
1. Click income field, leave empty, tab away → "Enter your annual income" error appears
2. Type a number → error clears
3. Enter 3 digits in ZIP, tab away → "Enter a valid 5-digit ZIP code" error appears
4. Empty ZIP → no error (it's optional)
5. Enter 5 digits → no error

- [ ] **Step 5: Commit**

```bash
git add src/components/TaxForm.tsx
git commit -m "feat: inline form validation for income and ZIP fields"
```

---

### Task 8: TaxReceipt editorial styling

**Files:**
- Modify: `src/components/TaxReceipt.tsx`

- [ ] **Step 1: Update receipt heading to serif with meta line**

In `src/components/TaxReceipt.tsx`:

Update h2 (~line 83): add `font-serif`:
```tsx
<h2 className="text-2xl font-bold text-white font-serif">Your Federal Tax Receipt</h2>
```

After the existing summary stats `<div>` and disclaimer `<p>` (~line 104), add a meta line:
```tsx
<p className="text-xs text-slate-500 uppercase tracking-[1.5px]">
  Fiscal Year {currentYear} · {taxEstimate.filingStatus === "single" ? "Single Filer" : taxEstimate.filingStatus === "married" ? "Married Filing Jointly" : "Head of Household"}
</p>
```

Update the disclaimer `<p>` (~line 101-104) to italic serif:
```tsx
<p className="text-xs text-slate-400 max-w-lg mx-auto font-serif italic">
```

- [ ] **Step 2: Add monospace font to all dollar amounts in receipt summary**

Dollar amounts in the summary (~line 86, 89, 170): add `font-amount` class to the `<span>` elements wrapping `formatCurrency()`:
```tsx
<span className="text-white font-medium font-amount">{formatCurrency(...)}</span>
```

Apply to: Income amount, Est. Federal Tax amount, and the 3-column grid values (~line 170).

- [ ] **Step 3: Update receipt card borders and total row**

Receipt header (~line 199): change border to heavier:
```tsx
<div className="px-4 py-3 border-b-2 border-white/8">
```

"Spending Breakdown" heading (~line 201): add `font-serif`:
```tsx
<h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider font-serif">
```

Receipt card header dollar amount (~line 204): add `font-amount`:
```tsx
<span className="text-sm font-bold text-white font-amount">
```

Total footer (~line 231): change to double border:
```tsx
<div className="px-4 py-3 border-t-[3px] border-double border-white/15 bg-white/5">
```

"TOTAL" label (~line 233): update styling:
```tsx
<span className="text-sm font-semibold text-slate-400 uppercase tracking-[1.5px]">TOTAL</span>
```

Total amount (~line 234): add `font-amount` and bump size:
```tsx
<span className="text-base font-bold text-white font-amount">
```

- [ ] **Step 4: Fix mobile scroll container**

Receipt list container (~line 211): make max-height responsive:
```tsx
<div className="lg:max-h-[600px] lg:overflow-y-auto">
```

- [ ] **Step 5: Verify visually**

Run: `npm run dev`
Check: Serif heading, monospace dollar amounts, heavier header border, double-line total footer, mobile shows all items without nested scroll.

- [ ] **Step 6: Commit**

```bash
git add src/components/TaxReceipt.tsx
git commit -m "feat: editorial receipt — serif heading, monospace amounts, double-line total, mobile scroll fix"
```

---

## Chunk 3: Chart and Receipt Line

### Task 9: SpendingChart keyboard navigation and loading skeleton

**Files:**
- Modify: `src/components/SpendingChart.tsx`

- [ ] **Step 1: Add keyboard navigation state and handler**

In `src/components/SpendingChart.tsx`, add `useCallback` to imports (~line 1-2):
```ts
import { useState, useCallback } from "react";
```

Add keyboard index state after existing state (~line 20):
```ts
const [keyboardIndex, setKeyboardIndex] = useState<number | null>(null);
```

Add keyboard handler:
```ts
const handleKeyDown = useCallback(
  (e: React.KeyboardEvent) => {
    if (!chartData.length) return;

    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown": {
        e.preventDefault();
        const next = keyboardIndex === null ? 0 : (keyboardIndex + 1) % chartData.length;
        setKeyboardIndex(next);
        setHoveredId(chartData[next].id);
        break;
      }
      case "ArrowLeft":
      case "ArrowUp": {
        e.preventDefault();
        const prev = keyboardIndex === null ? chartData.length - 1 : (keyboardIndex - 1 + chartData.length) % chartData.length;
        setKeyboardIndex(prev);
        setHoveredId(chartData[prev].id);
        break;
      }
      case "Enter":
      case " ": {
        e.preventDefault();
        if (keyboardIndex !== null) {
          onCategoryClick(chartData[keyboardIndex].id);
        }
        break;
      }
      case "Escape": {
        e.preventDefault();
        setKeyboardIndex(null);
        setHoveredId(null);
        break;
      }
    }
  },
  [chartData, keyboardIndex, onCategoryClick],
);
```

- [ ] **Step 2: Update the chart container with a11y attributes**

Replace the existing `<motion.div>` container (~line 33-41):
```tsx
<motion.div
  initial={{ opacity: 0, scale: 0.9 }}
  animate={{ opacity: 1, scale: 1 }}
  transition={{ duration: 0.6, delay: 0.2 }}
  className="w-full h-[400px] relative outline-none"
  role="application"
  aria-roledescription="interactive chart"
  aria-label={`Spending breakdown chart with ${chartData.length} categories. Use arrow keys to navigate segments, Enter to expand, Escape to deselect.`}
  tabIndex={0}
  onKeyDown={handleKeyDown}
  onBlur={() => setKeyboardIndex(null)}
>
```

- [ ] **Step 3: Add aria-live announcement region**

After the center label `<div>` (~line 55), add:
```tsx
{/* Screen reader announcement */}
<div className="sr-only" aria-live="polite" aria-atomic="true">
  {activeItem
    ? `${activeItem.name}: ${formatCurrency(activeItem.value)}, ${formatPercent(activeItem.percentage / 100)} of your taxes`
    : ""}
</div>
```

- [ ] **Step 4: Update center label default text**

Update the default center text (~line 52):
```tsx
<div className="text-xs text-slate-500">Hover, click, or<br />use arrow keys</div>
```

Add `font-amount` to the dollar amount in center label (~line 48):
```tsx
<div className="text-lg font-bold text-white font-amount">{formatCurrency(activeItem.value)}</div>
```

- [ ] **Step 5: Add loading skeleton**

At the top of the component return, before the `<motion.div>`, add:
```tsx
if (spending.length === 0) {
  return (
    <div className="w-full h-[400px] flex items-center justify-center">
      <div className="w-[280px] h-[280px] rounded-full border-[20px] border-white/5 animate-pulse flex items-center justify-center">
        <span className="text-sm text-slate-500">Loading...</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Verify keyboard navigation**

Run: `npm run dev`
Test:
1. Tab to chart → first segment highlights
2. Arrow Right → cycles to next segment, center label updates
3. Arrow Left → cycles backward
4. Enter → toggles category expansion (same as click)
5. Escape → deselects
6. VoiceOver/screen reader announces segment info

- [ ] **Step 7: Commit**

```bash
git add src/components/SpendingChart.tsx
git commit -m "feat: chart keyboard navigation, loading skeleton, and a11y announcements"
```

---

### Task 10: ReceiptLine dotted leaders and monospace amounts

**Files:**
- Modify: `src/components/ReceiptLine.tsx`

- [ ] **Step 1: Add dotted leader between category name and amount**

In `src/components/ReceiptLine.tsx`, in the main button content (~line 61-108), add a dotted leader spacer between the category name `<span>` and the amount `<div>`:

After the category name span (~line 79-81), add a dotted leader. Keep `flex-1` on the name span to ensure it gets minimum space for long names, and use `min-w-0` to allow truncation. The dotted leader uses `flex-shrink-0` with a minimum width:

```tsx
{/* Category name */}
<span className="text-sm font-medium text-white text-left flex-1 min-w-0 truncate">
  {item.category.name}
</span>

{/* Dotted leader */}
<span className="shrink-0 w-8 border-b border-dotted border-white/10 self-end mb-1" aria-hidden="true" />
```

The name keeps `flex-1` so it grows to fill available space and truncates if needed. The dotted leader has a fixed `w-8` so it always shows some dots without breaking the layout.

- [ ] **Step 2: Add monospace font to dollar amounts**

Main amount (~line 85-86): add `font-amount`:
```tsx
<div className="text-sm font-semibold text-white font-amount">
  {formatCurrency(item.amount)}
</div>
```

Delta amount (~line 89-91): add `font-amount`:
```tsx
<div className={`text-[10px] font-medium font-amount ${item.amount > previousAmount ? "text-red-400" : "text-green-400"}`}>
```

Percentage (~line 93-95): keep sans-serif, update color:
```tsx
<div className="text-xs text-slate-400">
```

Subcategory amounts (~line 149-155): add `font-amount` to the value span:
```tsx
<div className="text-sm text-white font-medium font-amount">
  {formatCurrency(sub.amount)}
</div>
```

- [ ] **Step 3: Verify visually**

Run: `npm run dev`
Check: Dotted leaders appear between category names and amounts. Dollar amounts are monospace. The receipt looks like a classic print receipt.

- [ ] **Step 4: Commit**

```bash
git add src/components/ReceiptLine.tsx
git commit -m "feat: dotted leaders and monospace amounts in receipt lines"
```

---

## Chunk 4: Secondary Panels

### Task 11: SecondaryTabs and BillsPanel editorial styling

**Files:**
- Modify: `src/components/SecondaryTabs.tsx`, `src/components/BillsPanel.tsx`

- [ ] **Step 1: Add serif to section headings in SecondaryTabs**

In `src/components/SecondaryTabs.tsx`, find any `<h3>` or section heading elements and add `font-serif` class. Tab labels remain sans-serif (they're UI controls).

- [ ] **Step 2: Update BillsPanel monospace amounts and serif headings**

In `src/components/BillsPanel.tsx`:
- All `formatCurrency()` output wrappers: add `font-amount` class
- Section headings (e.g., "Pending Legislation", "Landmark Bills"): add `font-serif`
- `text-[10px]` on labels/badges: bump to `text-xs` where they are metadata labels (not source attributions)

- [ ] **Step 3: Verify visually**

Run: `npm run dev`
Check: Bills panel has monospace dollar amounts, serif section headings.

- [ ] **Step 4: Commit**

```bash
git add src/components/SecondaryTabs.tsx src/components/BillsPanel.tsx
git commit -m "feat: editorial styling for tabs and bills panel"
```

---

### Task 12: Expandable descriptions in RecentExpenditures and BillInfluenceChain

**Files:**
- Modify: `src/components/RecentExpenditures.tsx`, `src/components/BillInfluenceChain.tsx`

- [ ] **Step 1: Add expandable truncation to RecentExpenditures**

In `src/components/RecentExpenditures.tsx`:

Add state for tracking expanded items at the component level. Use string keys (not numeric indices) to avoid collisions between the contracts and bills lists:
```ts
const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());
```

At line 59 and 125 (where `line-clamp-2` appears), replace with controlled truncation. Use a unique key per item (e.g., `contract-${item.id}` or `bill-${item.title}`):
```tsx
<p className={`text-xs text-slate-400 ${!expandedDescriptions.has(itemKey) ? "line-clamp-3" : ""}`}>
  {description}
</p>
{description.length > 120 && (
  <button
    onClick={() => setExpandedDescriptions((prev) => {
      const next = new Set(prev);
      if (next.has(itemKey)) next.delete(itemKey);
      else next.add(itemKey);
      return next;
    })}
    className="text-xs text-indigo-400 hover:text-indigo-300 mt-1 cursor-pointer"
  >
    {expandedDescriptions.has(itemKey) ? "Show less" : "Show more"}
  </button>
)}
```

Also add `font-amount` to dollar amounts in this component.

- [ ] **Step 2: Add expandable truncation to BillInfluenceChain**

In `src/components/BillInfluenceChain.tsx`:

Same pattern as above. At line 482 (where `line-clamp-1` appears), replace with controlled truncation using local state.

Also:
- Shift `gray-*` → `slate-*` throughout the component
- Add `font-amount` to dollar amounts
- Bump `text-[10px]` labels to `text-xs` where appropriate

- [ ] **Step 3: Verify visually**

Run: `npm run dev`
Check: Long descriptions show "Show more" button. Clicking toggles full text. Dollar amounts are monospace.

- [ ] **Step 4: Commit**

```bash
git add src/components/RecentExpenditures.tsx src/components/BillInfluenceChain.tsx
git commit -m "feat: expandable descriptions replacing silent truncation"
```

---

### Task 13: FinanceCard, InfluenceChain, InternationalComparison, SpendingTrends styling

**Files:**
- Modify: `src/components/FinanceCard.tsx`, `src/components/InfluenceChain.tsx`, `src/components/InternationalComparison.tsx`, `src/components/SpendingTrends.tsx`

- [ ] **Step 1: Update FinanceCard (exported as FinanceChart)**

In `src/components/FinanceCard.tsx`:
- Section headings ("Outside Spending", "Top Donor Employers"): add `font-serif`
- Dollar amounts on bars and labels: add `font-amount`
- `line-clamp-1` at line 356: add "Show more" affordance (same pattern as Task 12, using string key like `finance-${name}`)
- Verify existing loading skeleton uses `slate-*` palette (update if needed)

- [ ] **Step 2: Update InfluenceChain**

In `src/components/InfluenceChain.tsx`:
- Palette shift: remaining `gray-*` → `slate-*`
- Dollar amounts: add `font-amount`
- `text-[10px]` labels: bump to `text-xs` per triage rules

- [ ] **Step 3: Update InternationalComparison**

In `src/components/InternationalComparison.tsx`:
- Country comparison amounts: add `font-amount`
- Section headings: add `font-serif`
- "No equivalent" placeholder: add `font-serif italic text-slate-500`
- Scroll container (~line 261): change `max-h-[600px] overflow-y-auto` to `lg:max-h-[600px] lg:overflow-y-auto`

- [ ] **Step 4: Update SpendingTrends**

In `src/components/SpendingTrends.tsx`:
- Dollar amounts: add `font-amount`
- Section headers ("Spending", "Revenue"): add `font-serif uppercase tracking-wider`
- Keep current green/red percentage scheme

- [ ] **Step 5: Verify visually**

Run: `npm run dev`
Check: All secondary panels use monospace amounts, serif headings, slate palette.

- [ ] **Step 6: Commit**

```bash
git add src/components/FinanceCard.tsx src/components/InfluenceChain.tsx src/components/InternationalComparison.tsx src/components/SpendingTrends.tsx
git commit -m "feat: editorial styling for finance, influence, comparison, and trends panels"
```

---

## Chunk 5: Modal and Tooltip

### Task 14: RepresentativesModal and RepresentativeCard styling

**Files:**
- Modify: `src/components/RepresentativesModal.tsx`, `src/components/RepresentativeCard.tsx`

- [ ] **Step 1: Update RepresentativesModal**

In `src/components/RepresentativesModal.tsx`:
- Modal title: add `font-serif`
- Any remaining `gray-*` → `slate-*` (the global replace should have caught most)

- [ ] **Step 2: Update RepresentativeCard**

In `src/components/RepresentativeCard.tsx`:
- Rep names: add `font-serif`
- Dollar amounts (campaign finance): add `font-amount`
- Any remaining `gray-*` → `slate-*`

- [ ] **Step 3: Verify visually**

Run: `npm run dev`
Check: Modal title is serif, rep names are serif, finance amounts are monospace.

- [ ] **Step 4: Commit**

```bash
git add src/components/RepresentativesModal.tsx src/components/RepresentativeCard.tsx
git commit -m "feat: editorial styling for representatives modal and cards"
```

---

### Task 15: InfoTooltip viewport-aware positioning

**Files:**
- Modify: `src/components/InfoTooltip.tsx`

- [ ] **Step 1: Rewrite InfoTooltip with dynamic positioning**

Replace the entire `src/components/InfoTooltip.tsx` with viewport-aware logic:

```tsx
"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface InfoTooltipProps {
  children: React.ReactNode;
  width?: string;
  position?: "above" | "below" | "auto";
}

export default function InfoTooltip({ children, width = "w-56", position = "auto" }: InfoTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [resolvedPosition, setResolvedPosition] = useState<"above" | "below">(
    position === "auto" ? "above" : position,
  );
  const [horizontalShift, setHorizontalShift] = useState(0);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);

  const calculatePosition = useCallback(() => {
    if (!triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();

    // Vertical: decide above or below
    if (position === "auto" || position === "above") {
      const spaceAbove = triggerRect.top;
      const spaceBelow = window.innerHeight - triggerRect.bottom;

      if (position === "auto") {
        setResolvedPosition(spaceAbove >= tooltipRect.height + 8 ? "above" : "below");
      } else if (spaceAbove < tooltipRect.height + 8) {
        setResolvedPosition("below"); // flip if preferred direction clips
      }
    } else {
      const spaceBelow = window.innerHeight - triggerRect.bottom;
      if (spaceBelow < tooltipRect.height + 8) {
        setResolvedPosition("above");
      }
    }

    // Horizontal: shift if clipping edges
    const tooltipLeft = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
    const tooltipRight = tooltipLeft + tooltipRect.width;
    const padding = 8;

    if (tooltipLeft < padding) {
      setHorizontalShift(padding - tooltipLeft);
    } else if (tooltipRight > window.innerWidth - padding) {
      setHorizontalShift(window.innerWidth - padding - tooltipRight);
    } else {
      setHorizontalShift(0);
    }
  }, [position]);

  useEffect(() => {
    if (isVisible) {
      calculatePosition();
    }
  }, [isVisible, calculatePosition]);

  const positionClasses =
    resolvedPosition === "above"
      ? "bottom-full mb-1.5"
      : "top-full mt-1.5";

  return (
    <span
      className="relative group inline-flex"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      <span
        ref={triggerRef}
        className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-white/10 text-[9px] text-slate-400 cursor-help font-serif italic font-bold leading-none lowercase"
        tabIndex={0}
        role="note"
        aria-label="More info"
      >
        i
      </span>
      <span
        ref={tooltipRef}
        className={`absolute ${positionClasses} ${width} p-2.5 rounded-lg bg-slate-900 border border-white/10 shadow-xl text-[10px] text-slate-300 leading-relaxed text-left font-normal normal-case tracking-normal z-[100] transition-opacity duration-150 ${
          isVisible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        style={{
          left: "50%",
          transform: `translateX(calc(-50% + ${horizontalShift}px))`,
        }}
      >
        {children}
      </span>
    </span>
  );
}
```

- [ ] **Step 2: Verify tooltip positioning**

Run: `npm run dev`
Test:
1. Hover tooltip near top of page → should appear below
2. Hover tooltip in middle → should appear above
3. Hover tooltip near left edge → should shift right to stay in viewport
4. Hover tooltip near right edge → should shift left
5. Focus via Tab key → tooltip appears
6. Blur → tooltip disappears

- [ ] **Step 3: Verify existing `position="below"` call sites still work**

Check `ReceiptLine.tsx` line 130 which passes `position="below"` — tooltip should prefer below, but flip above if no room.

- [ ] **Step 4: Commit**

```bash
git add src/components/InfoTooltip.tsx
git commit -m "feat: viewport-aware tooltip positioning with auto-flip and edge detection"
```

---

## Chunk 6: Final Polish and Verification

### Task 16: DeltaBadge and text-[10px] triage

**Files:**
- Modify: `src/components/TaxReceipt.tsx` (DeltaBadge), various components

- [ ] **Step 1: Update DeltaBadge**

In `src/components/TaxReceipt.tsx`, the `DeltaBadge` component (~line 310-323):

Add `font-amount` to the amount span:
```tsx
<span
  className={`ml-1.5 text-[10px] font-medium font-amount ${
    isUp ? "text-red-400" : "text-green-400"
  }`}
>
```

Keep `text-[10px]` here — it's an inline delta badge, appropriately small.

- [ ] **Step 2: Triage remaining text-[10px] instances**

Scan all components and bump `text-[10px]` to `text-xs` where the text is a label or metadata (not a source attribution or tooltip):

Priority targets:
- `TaxReceipt.tsx`: comparison card labels (~line 139, 141, 149) — bump to `text-xs`
- `ReceiptLine.tsx`: metadata in expanded sections — keep where appropriate
- `BillsPanel.tsx`: badge text, metadata — bump labels to `text-xs`
- `SpendingTrends.tsx`: labels — review for mobile readability

Keep `text-[10px]` in:
- Footer source attributions
- Tooltip body text (InfoTooltip)
- Very small inline indicators (DeltaBadge)

- [ ] **Step 3: Verify no visual regressions**

Run: `npm run dev`
Check: All bumped text is still appropriately sized, no layout breaks.

- [ ] **Step 4: Commit**

```bash
git add src/components/ src/app/
git commit -m "feat: text size triage — bump metadata labels from 10px to 12px for readability"
```

---

### Task 17: Final build verification

**Files:** None (verification only)

- [ ] **Step 1: Run production build**

Run: `npx next build`
Expected: Build succeeds with no type errors or warnings

- [ ] **Step 2: Run existing tests**

Run: `npm test`
Expected: All existing tests pass (these are logic tests, not affected by styling changes)

- [ ] **Step 3: Manual smoke test checklist**

Run: `npm run dev`

WCAG AA contrast check:
- [ ] Verify `text-slate-300` (#cbd5e1) on `bg-slate-950` (#020617) meets 4.5:1 ratio (~11.5:1 — passes)
- [ ] Verify `text-slate-400` (#94a3b8) on `bg-slate-950` (#020617) meets 4.5:1 ratio (~7.0:1 — passes)
- [ ] Verify `text-slate-500` (#64748b) on `bg-slate-950` (#020617) meets 4.5:1 for large text (~4.3:1 — borderline, only used for tertiary/large text)

Visual checks:
- [ ] Hero: serif heading, gradient divider, italic subtitle
- [ ] Form: editorial labels, monospace input, inline validation on blur
- [ ] Receipt: serif heading, monospace amounts, dotted leaders, double-line total
- [ ] Chart: keyboard navigation works, loading skeleton shows briefly
- [ ] Bills panel: monospace amounts, "Show more" on long descriptions
- [ ] Modal: serif title, serif rep names, monospace finance amounts
- [ ] Tooltips: don't clip viewport edges
- [ ] Footer: italic serif disclaimer, rounded-lg buttons
- [ ] Mobile (narrow viewport): no nested scroll containers, text is readable
- [ ] Palette: slate tones throughout, no leftover gray-* outliers

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add src/components/ src/app/
git commit -m "fix: address visual smoke test findings"
```
