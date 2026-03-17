# Light/Dark Mode Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add light/dark theme support with system preference detection, manual toggle, and smooth crossfade transitions.

**Architecture:** `next-themes` handles theme detection, localStorage persistence, and `data-theme` attribute management. CSS custom properties define semantic color tokens that swap values based on `data-theme`. Tailwind v4's `@theme inline` wires those variables into utility classes. Category chart colors use a `resolveThemeColor()` utility since Recharts needs inline hex values.

**Tech Stack:** next-themes, Tailwind CSS v4 `@theme inline`, CSS custom properties

**Spec:** `docs/superpowers/specs/2026-03-16-light-dark-mode-design.md`

---

## Chunk 1: Infrastructure + Toggle

### Task 1: Install next-themes and set up ThemeProvider

**Files:**
- Modify: `package.json`
- Modify: `src/app/layout.tsx`
- Create: `src/components/ThemeProvider.tsx`

- [ ] **Step 1: Install next-themes**

```bash
npm install next-themes
```

- [ ] **Step 2: Create ThemeProvider client wrapper**

`next-themes` requires a client component wrapper since `layout.tsx` is a server component. Create `src/components/ThemeProvider.tsx`:

```tsx
"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="data-theme" defaultTheme="system" enableSystem>
      {children}
    </NextThemesProvider>
  );
}
```

- [ ] **Step 3: Wrap layout with ThemeProvider**

Modify `src/app/layout.tsx`:
- Add `suppressHydrationWarning` to `<html>` (prevents React warnings about server/client data-theme mismatch)
- Import and wrap `{children}` with `<ThemeProvider>`

```tsx
import ThemeProvider from "@/components/ThemeProvider";

// ... existing code ...

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider>
          <PostHogInit />
          {children}
          <Analytics />
          <SpeedInsights />
        </ThemeProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Verify build passes**

```bash
npx next build
```

Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/app/layout.tsx src/components/ThemeProvider.tsx
git commit -m "feat: install next-themes and add ThemeProvider wrapper"
```

---

### Task 2: Define CSS variable tokens and Tailwind wiring

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add dark/light variable rulesets and Tailwind wiring**

Add the following to `src/app/globals.css`, after the `@import "tailwindcss";` line and before the existing `@theme inline` block. Then extend the existing `@theme inline` block with color mappings:

```css
/* ---- Theme color tokens ---- */
[data-theme="dark"] {
  --surface: #020617;
  --surface-card: rgba(255, 255, 255, 0.03);
  --surface-elevated: rgba(255, 255, 255, 0.05);
  --text-primary: #ededed;
  --text-secondary: #94a3b8;
  --text-muted: #64748b;
  --border: rgba(255, 255, 255, 0.1);
  --border-subtle: rgba(255, 255, 255, 0.08);
  --scrollbar-thumb: rgba(255, 255, 255, 0.1);
  --scrollbar-thumb-hover: rgba(255, 255, 255, 0.2);
}

[data-theme="light"] {
  --surface: #f0f9ff;
  --surface-card: #ffffff;
  --surface-elevated: #f8fafc;
  --text-primary: #0c4a6e;
  --text-secondary: #0369a1;
  --text-muted: #64748b;
  --border: #bae6fd;
  --border-subtle: #e0f2fe;
  --scrollbar-thumb: rgba(0, 0, 0, 0.15);
  --scrollbar-thumb-hover: rgba(0, 0, 0, 0.25);
}
```

Extend the existing `@theme inline` block to include color wiring:

```css
@theme inline {
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
  --font-serif: Georgia, 'Times New Roman', serif;
  --color-surface: var(--surface);
  --color-surface-card: var(--surface-card);
  --color-surface-elevated: var(--surface-elevated);
  --color-text-primary: var(--text-primary);
  --color-text-secondary: var(--text-secondary);
  --color-text-muted: var(--text-muted);
  --color-border: var(--border);
  --color-border-subtle: var(--border-subtle);
}
```

- [ ] **Step 2: Update body styles to use tokens**

Replace the hardcoded body styles:

```css
/* Before */
body {
  background: #020617;
  color: #ededed;
  font-family: var(--font-sans), Arial, Helvetica, sans-serif;
}

/* After */
body {
  background: var(--surface);
  color: var(--text-primary);
  font-family: var(--font-sans), Arial, Helvetica, sans-serif;
}
```

- [ ] **Step 3: Update scrollbar styles to use tokens**

```css
/* Before */
.overflow-y-auto::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
}
.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}

/* After */
.overflow-y-auto::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
}
.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background: var(--scrollbar-thumb-hover);
}
```

- [ ] **Step 4: Add crossfade transition rule**

Add before the existing `@media (prefers-reduced-motion: reduce)` block:

```css
/* Smooth theme crossfade */
@media (prefers-reduced-motion: no-preference) {
  *,
  *::before,
  *::after {
    transition: background-color 200ms, color 200ms, border-color 200ms;
  }
}
```

- [ ] **Step 5: Verify build passes**

```bash
npx next build
```

Expected: Build succeeds. The app should still look identical in dark mode.

- [ ] **Step 6: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: add CSS theme tokens, Tailwind wiring, and crossfade transition"
```

---

### Task 3: Create resolveThemeColor utility

**Files:**
- Create: `src/lib/themeColor.ts`
- Create: `src/lib/themeColor.test.ts`

- [ ] **Step 1: Write the test**

Create `src/lib/themeColor.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { resolveThemeColor } from "./themeColor";

describe("resolveThemeColor", () => {
  const color = { dark: "#6366f1", light: "#4f46e5" };

  it("returns dark value for dark theme", () => {
    expect(resolveThemeColor(color, "dark")).toBe("#6366f1");
  });

  it("returns light value for light theme", () => {
    expect(resolveThemeColor(color, "light")).toBe("#4f46e5");
  });

  it("defaults to dark for undefined theme", () => {
    expect(resolveThemeColor(color, undefined as unknown as string)).toBe("#6366f1");
  });

  it("defaults to dark for unknown theme string", () => {
    expect(resolveThemeColor(color, "system")).toBe("#6366f1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- src/lib/themeColor.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `src/lib/themeColor.ts`:

```typescript
export interface ThemeColor {
  dark: string;
  light: string;
}

export function resolveThemeColor(color: ThemeColor, theme: string): string {
  if (theme === "light") return color.light;
  return color.dark;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- src/lib/themeColor.test.ts
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/themeColor.ts src/lib/themeColor.test.ts
git commit -m "feat: add resolveThemeColor utility with tests"
```

---

### Task 4: Create ThemeToggle component

**Files:**
- Create: `src/components/ThemeToggle.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Create the ThemeToggle component**

Create `src/components/ThemeToggle.tsx`:

```tsx
"use client";

import { useTheme } from "next-themes";
import { useState, useEffect } from "react";

export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch — only render after mount
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    // Render invisible placeholder to avoid layout shift
    return <div className="w-8 h-8" />;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="w-8 h-8 rounded-lg bg-surface-elevated border border-border flex items-center justify-center hover:border-border transition-colors cursor-pointer"
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
    >
      {isDark ? (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-text-secondary">
          <path d="M10 2a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 2ZM10 15a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 15ZM10 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM15.657 5.404a.75.75 0 1 0-1.06-1.06l-1.061 1.06a.75.75 0 0 0 1.06 1.06l1.06-1.06ZM6.464 14.596a.75.75 0 1 0-1.06-1.06l-1.06 1.06a.75.75 0 0 0 1.06 1.06l1.06-1.06ZM18 10a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 18 10ZM5 10a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 5 10ZM14.596 15.657a.75.75 0 0 0 1.06-1.06l-1.06-1.061a.75.75 0 1 0-1.06 1.06l1.06 1.06ZM5.404 6.464a.75.75 0 0 0 1.06-1.06l-1.06-1.06a.75.75 0 1 0-1.06 1.06l1.06 1.06Z" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-text-secondary">
          <path fillRule="evenodd" d="M7.455 2.004a.75.75 0 0 1 .26.77 7 7 0 0 0 9.958 7.967.75.75 0 0 1 1.067.853A8.5 8.5 0 1 1 6.647 1.921a.75.75 0 0 1 .808.083Z" clipRule="evenodd" />
        </svg>
      )}
    </button>
  );
}
```

- [ ] **Step 2: Add ThemeToggle to page.tsx**

In `src/app/page.tsx`, import `ThemeToggle` and render it at the top of the page, before the main content. Find the outermost container `<div>` and add the toggle:

```tsx
import ThemeToggle from "@/components/ThemeToggle";

// Inside the component's return, add at the very top of the page content:
<div className="fixed top-4 right-4 z-50">
  <ThemeToggle />
</div>
```

- [ ] **Step 3: Verify in browser**

```bash
npm run dev
```

Open http://localhost:3000 — toggle should appear top-right. Clicking it should switch `data-theme` on `<html>` (inspect element to verify). Background color should change between `#020617` (dark) and `#f0f9ff` (light) thanks to the CSS variable on `body`.

- [ ] **Step 4: Commit**

```bash
git add src/components/ThemeToggle.tsx src/app/page.tsx
git commit -m "feat: add ThemeToggle component with sun/moon icons"
```

---

### Task 5: Update budget.ts category colors to light/dark variants

**Files:**
- Modify: `src/data/budget.ts`

- [ ] **Step 1: Update BudgetCategory interface**

In `src/data/budget.ts`, change the `color` field type:

```typescript
// Before
export interface BudgetCategory {
  // ...
  color: string;
  // ...
}

// After
export interface BudgetCategory {
  // ...
  color: { dark: string; light: string };
  // ...
}
```

- [ ] **Step 2: Update all 14 category color values**

Replace each `color: "#hex"` with `color: { dark: "#hex", light: "#adjusted_hex" }`. Dark values stay identical to current. Light values are deeper/more saturated for contrast on `#f0f9ff`:

| Category | Dark (current) | Light (new) |
|----------|---------------|-------------|
| social-security | `#6366f1` (indigo) | `#4f46e5` |
| healthcare | `#ec4899` (pink) | `#db2777` |
| defense | `#ef4444` (red) | `#dc2626` |
| interest | `#f59e0b` (amber) | `#d97706` |
| income-security | `#8b5cf6` (violet) | `#7c3aed` |
| veterans | `#14b8a6` (teal) | `#0d9488` |
| education | `#3b82f6` (blue) | `#2563eb` |
| infrastructure | `#f97316` (orange) | `#ea580c` |
| immigration | `#10b981` (emerald) | `#059669` |
| science | `#22c55e` (green) | `#16a34a` |
| international | `#a855f7` (purple) | `#9333ea` |
| justice | `#64748b` (slate) | `#475569` |
| agriculture | `#84cc16` (lime) | `#65a30d` |
| government | `#78716c` (stone) | `#57534e` |

Example transformation:

```typescript
// Before
color: "#6366f1", // indigo

// After
color: { dark: "#6366f1", light: "#4f46e5" }, // indigo
```

Apply this to all 14 categories in the budget data array.

- [ ] **Step 3: Verify build**

```bash
npx next build
```

Expected: Build FAILS — all consumers of `category.color` now expect a string but receive an object. This is expected and will be fixed in subsequent tasks.

- [ ] **Step 4: Commit (on its own branch or with a note)**

```bash
git add src/data/budget.ts
git commit -m "feat: add light/dark color variants to all 14 budget categories

BREAKING: category.color is now { dark, light } — consumers updated in next commits"
```

---

### Task 6: Fix category.color consumers — SpendingChart, ReceiptLine, international hook, share-card

**Files:**
- Modify: `src/components/SpendingChart.tsx`
- Modify: `src/components/ReceiptLine.tsx`
- Modify: `src/hooks/useInternationalComparison.ts`
- Modify: `src/components/InternationalComparison.tsx` (pass theme to hooks)
- Modify: `src/lib/share-card.ts`
- Modify: `src/lib/share-card.test.ts`

These files reference `category.color` as a string. After Task 5, `category.color` is `{ dark, light }` — every consumer must be updated.

- [ ] **Step 1: Update SpendingChart.tsx**

Add imports and resolve theme at the top of the component:

```tsx
import { useTheme } from "next-themes";
import { resolveThemeColor } from "@/lib/themeColor";
```

Inside `SpendingChart` component, add near the top (after existing hooks):

```tsx
const { resolvedTheme } = useTheme();
```

Update the `chartData` mapping (line 77):

```typescript
// Before
color: item.category.color,

// After
color: resolveThemeColor(item.category.color, resolvedTheme ?? "dark"),
```

- [ ] **Step 2: Update ReceiptLine.tsx**

Add imports:

```tsx
import { useTheme } from "next-themes";
import { resolveThemeColor } from "@/lib/themeColor";
```

Inside the component, add after existing state:

```tsx
const { resolvedTheme } = useTheme();
```

Update both inline style usages (lines 73 and 176):

```typescript
// Before (two places)
style={{ backgroundColor: item.category.color }}

// After (both places)
style={{ backgroundColor: resolveThemeColor(item.category.color, resolvedTheme ?? "dark") }}
```

- [ ] **Step 3: Update useInternationalComparison.ts — add theme parameter**

The `computeComparison` internal function and both exported hooks (`useInternationalComparison`, `useAllCountriesComparison`) map `s.category.color` into `ComparisonItem.color: string`. The cleanest fix: add a `theme` parameter so the hook resolves colors internally. The `ComparisonItem` interface keeps `color: string` (already resolved).

Add import at the top:

```typescript
import { resolveThemeColor } from "@/lib/themeColor";
```

Update `computeComparison` (around line 65) — add `theme: string` parameter:

```typescript
// Before
function computeComparison(
  usSpending: UsSpending,
  totalFederalTax: number,
  countryCode: string,
  mode: ComparisonMode,
  grossIncome: number,
  filingStatus: FilingStatus
): InternationalComparison | null {

// After
function computeComparison(
  usSpending: UsSpending,
  totalFederalTax: number,
  countryCode: string,
  mode: ComparisonMode,
  grossIncome: number,
  filingStatus: FilingStatus,
  theme: string
): InternationalComparison | null {
```

Update the color mapping inside `computeComparison` (line 106):

```typescript
// Before
color: s.category.color,

// After
color: resolveThemeColor(s.category.color, theme),
```

Update `useInternationalComparison` — add `theme` parameter and pass to `computeComparison`:

```typescript
// Before
export function useInternationalComparison(
  usSpending: UsSpending,
  totalFederalTax: number,
  countryCode: string | null,
  mode: ComparisonMode = "same-amount",
  grossIncome: number = 0,
  filingStatus: FilingStatus = "single"
): InternationalComparison | null {

// After
export function useInternationalComparison(
  usSpending: UsSpending,
  totalFederalTax: number,
  countryCode: string | null,
  mode: ComparisonMode = "same-amount",
  grossIncome: number = 0,
  filingStatus: FilingStatus = "single",
  theme: string = "dark"
): InternationalComparison | null {
```

And inside the `useMemo`, pass `theme` to `computeComparison` and add `theme` to the deps array.

Do the same for `useAllCountriesComparison` — add `theme: string = "dark"` parameter, pass to `computeComparison`, add to deps array.

- [ ] **Step 4: Update InternationalComparison.tsx — pass theme to hooks**

Add import:

```tsx
import { useTheme } from "next-themes";
```

Inside the component, add:

```tsx
const { resolvedTheme } = useTheme();
```

Pass `resolvedTheme ?? "dark"` as the last argument to both hook calls:

```tsx
// Before
const comparison = useInternationalComparison(
  spending, totalFederalTax, isAllMode ? null : selectedCountry, mode, grossIncome, filingStatus
);
const allComparisons = useAllCountriesComparison(
  spending, totalFederalTax, isAllMode, mode, grossIncome, filingStatus
);

// After
const comparison = useInternationalComparison(
  spending, totalFederalTax, isAllMode ? null : selectedCountry, mode, grossIncome, filingStatus, resolvedTheme ?? "dark"
);
const allComparisons = useAllCountriesComparison(
  spending, totalFederalTax, isAllMode, mode, grossIncome, filingStatus, resolvedTheme ?? "dark"
);
```

- [ ] **Step 5: Update share-card.ts**

The share card always renders on a dark canvas background (hardcoded `BG_TOP = "#0f172a"` / `BG_BOTTOM = "#020617"`). Always use the dark color variant.

Update `mapSpendingToCard` signature and body:

```typescript
// Before
export function mapSpendingToCard(
  spending: { category: { name: string; color: string }; percentage: number }[],
): ShareCardCategory[] {
  // ...
  color: s.category.color,

// After
export function mapSpendingToCard(
  spending: { category: { name: string; color: { dark: string; light: string } }; percentage: number }[],
): ShareCardCategory[] {
  // ...
  color: s.category.color.dark,
```

The `ShareCardCategory` interface and `renderShareCard` stay unchanged — they still use `color: string` (already resolved to dark).

- [ ] **Step 6: Update share-card.test.ts**

Update the `mapSpendingToCard` test fixture (line 154-157):

```typescript
// Before
const mockSpending = Array.from({ length: 9 }, (_, i) => ({
  category: { name: `Cat ${i + 1}`, color: `#${i}${i}${i}` },
  percentage: i === 0 ? 30 : 70 / 8,
}));

// After
const mockSpending = Array.from({ length: 9 }, (_, i) => ({
  category: { name: `Cat ${i + 1}`, color: { dark: `#${i}${i}${i}`, light: `#${i}${i}${i}` } },
  percentage: i === 0 ? 30 : 70 / 8,
}));
```

The `SAMPLE_SPENDING` constant (line 39-46) used by `renderShareCard` tests does NOT need updating — it's already `ShareCardCategory[]` with `color: string` (post-mapping shape).

- [ ] **Step 7: Verify build passes**

```bash
npx next build
```

Expected: Build succeeds with no type errors.

- [ ] **Step 8: Run tests**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/components/SpendingChart.tsx src/components/ReceiptLine.tsx src/hooks/useInternationalComparison.ts src/components/InternationalComparison.tsx src/lib/share-card.ts src/lib/share-card.test.ts
git commit -m "fix: resolve theme-aware category colors in all consumers"
```

---

## Chunk 2: Component Migration

### Task 7: Migrate TaxForm.tsx

**Files:**
- Modify: `src/components/TaxForm.tsx`

- [ ] **Step 1: Replace hardcoded color classes**

Read `TaxForm.tsx` fully and apply these specific replacements:

**Labels** (lines 60, 89, 118) — `text-slate-400` → `text-text-secondary`:
```
className="block text-xs font-medium text-text-secondary uppercase tracking-[1.5px]"
```

**Dollar sign prefix** (line 64) — `text-slate-500` → `text-text-muted`

**Input fields** (lines 77, 135) — replace `bg-white/5` → `bg-surface-elevated`, `text-white` → `text-text-primary`, `border-white/10` → `border-border`, `placeholder:text-slate-500` / `placeholder:text-slate-600` → `placeholder:text-text-muted`

**Filing status buttons** (lines 106-107):
- Active state: `bg-indigo-500 text-white` → keep as-is (white on colored bg works in both themes)
- Inactive state: `bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10` → `bg-surface-elevated text-text-secondary border border-border hover:bg-surface-card`

**ZIP hint text** (line 119) — `text-slate-500` → `text-text-muted`

**Submit button** (lines 152-153):
- Enabled: `text-white` on gradient bg → keep as-is
- Disabled: `bg-white/5 text-gray-500` → `bg-surface-elevated text-text-muted`

**Leave unchanged:** `focus:ring-indigo-500`, `border-red-400/50` (error state), `shadow-indigo-500/*` (accent shadows)

- [ ] **Step 2: Verify in browser**

```bash
npm run dev
```

Toggle between light/dark on the form page. Verify:
- Input fields are readable in both themes
- Labels and placeholder text have adequate contrast
- Buttons are visible and styled appropriately
- Error states (red text) still work

- [ ] **Step 3: Commit**

```bash
git add src/components/TaxForm.tsx
git commit -m "feat: migrate TaxForm to theme-aware color tokens"
```

---

### Task 8: Migrate TaxReceipt.tsx, SpendingChart.tsx, ReceiptLine.tsx

**Files:**
- Modify: `src/components/TaxReceipt.tsx`
- Modify: `src/components/SpendingChart.tsx` (color classes only — category colors already resolved in Task 6)
- Modify: `src/components/ReceiptLine.tsx` (color classes only — category colors already resolved in Task 6)

- [ ] **Step 1: Migrate TaxReceipt.tsx**

Read the full file and replace hardcoded color classes with semantic tokens. This is the main receipt orchestrator — it has background colors, text colors, and borders throughout.

Key patterns to watch for:
- `bg-slate-900` or similar dark backgrounds → `bg-surface` or `bg-surface-card`
- Gradient text using `from-*`/`to-*` → may need `from-text-primary` or keep as accent colors
- `text-white` → `text-text-primary`
- `border-white/10` → `border-border`

- [ ] **Step 2: Migrate SpendingChart.tsx color classes**

Replace non-category color classes (text labels, backgrounds). The Recharts `fill` values were already handled in Task 6.

- [ ] **Step 3: Migrate ReceiptLine.tsx color classes**

Replace background, text, and border classes. The inline `style={{ backgroundColor }}` for category dots was already handled in Task 6.

- [ ] **Step 4: Verify in browser**

Toggle between themes. The donut chart, receipt list, and overall receipt layout should look correct in both.

- [ ] **Step 5: Commit**

```bash
git add src/components/TaxReceipt.tsx src/components/SpendingChart.tsx src/components/ReceiptLine.tsx
git commit -m "feat: migrate receipt components to theme-aware color tokens"
```

---

### Task 9: Migrate BillsPanel.tsx, SecondaryTabs.tsx

**Files:**
- Modify: `src/components/BillsPanel.tsx`
- Modify: `src/components/SecondaryTabs.tsx`

- [ ] **Step 1: Migrate BillsPanel.tsx**

Read the full file and replace hardcoded color classes. This component has:
- Card backgrounds (`bg-white/[0.03]`)
- Text colors for bill titles, descriptions, impact amounts
- Border colors
- Tab/sort button active states
- The "Reset filter" button added earlier

Keep status colors (green for decreases, red for increases) as-is — they work in both themes.

- [ ] **Step 2: Migrate SecondaryTabs.tsx**

Replace tab button active/inactive colors and container backgrounds.

- [ ] **Step 3: Verify in browser**

Toggle themes. Check:
- Bills panel readability
- Sort buttons and tab switching
- Impact amounts (green/red) visible in both themes
- Engagement vote buttons

- [ ] **Step 4: Commit**

```bash
git add src/components/BillsPanel.tsx src/components/SecondaryTabs.tsx
git commit -m "feat: migrate bills panel and secondary tabs to theme-aware tokens"
```

---

### Task 10: Migrate InternationalComparison.tsx, SpendingTrends.tsx

**Files:**
- Modify: `src/components/InternationalComparison.tsx`
- Modify: `src/components/SpendingTrends.tsx`

- [ ] **Step 1: Migrate InternationalComparison.tsx**

This component has:
- Country comparison bars (inline styles with category colors — already resolved via hook)
- Country selector dropdown styling
- Mode toggle buttons
- Card backgrounds, borders, text colors
- InfoTooltip content
- Footer attribution text

Replace all hardcoded Tailwind color classes with semantic tokens.

- [ ] **Step 2: Migrate SpendingTrends.tsx**

This component uses Recharts for trend charts but does NOT reference `category.color` — no `resolveThemeColor` needed here. Only replace hardcoded Tailwind color classes (backgrounds, text, borders).

- [ ] **Step 3: Verify in browser**

Toggle themes. Check:
- International comparison bars render correctly
- Country selector is readable
- Spending trends chart colors are correct
- All text has adequate contrast

- [ ] **Step 4: Commit**

```bash
git add src/components/InternationalComparison.tsx src/components/SpendingTrends.tsx
git commit -m "feat: migrate international comparison and spending trends to theme tokens"
```

---

### Task 11: Migrate remaining components

**Files:**
- Modify: `src/components/RepresentativeCard.tsx`
- Modify: `src/components/RepresentativesModal.tsx`
- Modify: `src/components/ShareSheet.tsx`
- Modify: `src/components/InfoTooltip.tsx`
- Modify: `src/components/InfluenceChain.tsx`
- Modify: `src/components/BillInfluenceChain.tsx`
- Modify: `src/components/FinanceCard.tsx`
- Modify: `src/components/RecentExpenditures.tsx`
- Modify: `src/components/StickyNav.tsx`

- [ ] **Step 1: Migrate each component**

Read each file and apply the same class replacement pattern. These are smaller components with fewer color references. Apply the standard mapping:

- `text-white` → `text-text-primary`
- `text-slate-400` → `text-text-secondary`
- `text-slate-500` → `text-text-muted`
- `bg-white/[0.03]` / `bg-white/5` → `bg-surface-card` / `bg-surface-elevated`
- `border-white/10` → `border-border`
- `border-white/8` → `border-border-subtle`

Special attention:
- **InfoTooltip.tsx** — tooltip popup background needs to be opaque and readable in both themes
- **ShareSheet.tsx** — modal overlay and backdrop colors
- **RepresentativesModal.tsx** — modal background
- **StickyNav.tsx** — sticky header background needs to be opaque (not transparent) in both themes

- [ ] **Step 2: Migrate page.tsx header/footer colors**

`src/app/page.tsx` has a header with gradient text and footer text. Update:
- Gradient text classes if they use hardcoded colors
- Footer `text-slate-500` → `text-text-muted`
- Any container background colors

- [ ] **Step 3: Full build verification**

```bash
npx next build
```

Expected: Build succeeds with no errors.

- [ ] **Step 4: Run all tests**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 5: Verify every component in browser**

Toggle between light/dark. Walk through the entire flow:
1. Landing page / form
2. Submit form → receipt view
3. Donut chart + receipt lines
4. Expand a receipt line (subcategories)
5. Bills panel (filter, sort, expand a bill)
6. International comparison (country selector, mode toggle)
7. Spending trends
8. Representative cards (if ZIP entered)
9. Share sheet / modal
10. Info tooltips

Check for:
- Text contrast (readable in both themes)
- Backgrounds (no leftover dark patches in light mode)
- Borders (visible but subtle)
- Chart colors (correct variants)
- Modals/overlays (opaque, readable)
- Scrollbar styling
- Crossfade animation on toggle

- [ ] **Step 6: Commit**

```bash
git add src/components/RepresentativeCard.tsx src/components/RepresentativesModal.tsx src/components/ShareSheet.tsx src/components/InfoTooltip.tsx src/components/InfluenceChain.tsx src/components/BillInfluenceChain.tsx src/components/FinanceCard.tsx src/components/RecentExpenditures.tsx src/components/StickyNav.tsx src/app/page.tsx
git commit -m "feat: migrate all remaining components to theme-aware color tokens"
```

---

## Chunk 3: Polish + Verification

### Task 12: Final verification and edge case fixes

**Files:**
- Possibly modify: any component where issues are found

- [ ] **Step 1: Test system preference detection**

1. Set Mac to dark mode → load app → should be dark
2. Set Mac to light mode → load app → should be light
3. Toggle manually to dark → refresh → should stay dark (localStorage)
4. Clear localStorage → refresh → should follow system again

- [ ] **Step 2: Test crossfade animation**

Click the toggle and verify smooth 200ms transition on backgrounds, text, and borders. No jarring flashes.

- [ ] **Step 3: Test reduced motion**

In Mac System Settings → Accessibility → Display → Reduce motion: ON. Toggle theme — should switch instantly, no animation.

- [ ] **Step 4: Fix any issues found**

If any component has contrast issues, leftover hardcoded colors, or broken styling, fix them now. Additional CSS tokens may be needed (e.g., `--surface-hover`, `--text-accent`).

- [ ] **Step 5: Final build + tests**

```bash
npx next build && npm test
```

Expected: All pass.

- [ ] **Step 6: Commit any fixes**

```bash
git add -A
git commit -m "fix: polish theme edge cases and contrast issues"
```
