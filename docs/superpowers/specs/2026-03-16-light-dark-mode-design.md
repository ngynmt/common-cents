# Light/Dark Mode — Design Spec

## Summary

Add light/dark theme support to Common Cents using `next-themes` for detection/persistence and Tailwind v4 CSS custom properties for color tokens. The app currently has a single dark theme with hardcoded color classes across all 17 components.

### Decisions

- **Theme control:** System preference + manual override (`next-themes` defaultTheme="system")
- **Light mode style:** "Cool Civic" — light blue tints (#f0f9ff base), sky borders (#bae6fd), deep blue text (#0c4a6e)
- **Toggle placement:** Floating sun/moon icon button, top-right area of the page
- **Category colors:** Light/dark hex variants for all 14 budget categories in `budget.ts`
- **Transition:** 200ms crossfade on background-color, color, border-color (respects prefers-reduced-motion)
- **Implementation approach:** Hybrid — `next-themes` for system detection + localStorage; CSS variables for color tokens

---

## 1. Theme Infrastructure

### next-themes Setup

- Install `next-themes`
- Add `<ThemeProvider>` in `layout.tsx`:
  - `attribute="data-theme"` — sets `data-theme` on `<html>`
  - `defaultTheme="system"` — respects OS preference
  - `enableSystem` — reacts to system preference changes
- Set `suppressHydrationWarning` on `<html>` to avoid server/client mismatch warnings

### CSS Variable Layer

Define CSS custom properties in `globals.css` using **standard CSS selectors** (not inside `@theme inline` — Tailwind v4's `@theme inline` does not support selector-based switching). Then wire them into Tailwind's theme system via `@theme inline` so that utility classes like `bg-surface`, `text-text-primary`, etc. are available:

```css
/* Standard CSS selectors for dark/light values */
[data-theme="dark"] {
  --surface: #020617;
  --surface-card: rgba(255,255,255,0.03);
  /* ... */
}
[data-theme="light"] {
  --surface: #f0f9ff;
  --surface-card: #ffffff;
  /* ... */
}

/* Wire into Tailwind so bg-surface, text-text-primary, etc. work */
@theme inline {
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

Token values:

| Token | Dark Value | Light Value |
|-------|-----------|-------------|
| `--surface` | `#020617` | `#f0f9ff` |
| `--surface-card` | `rgba(255,255,255,0.03)` | `#ffffff` |
| `--surface-elevated` | `rgba(255,255,255,0.05)` | `#f8fafc` |
| `--text-primary` | `#ededed` | `#0c4a6e` |
| `--text-secondary` | `#94a3b8` | `#0369a1` |
| `--text-muted` | `#64748b` | `#64748b` |
| `--border` | `rgba(255,255,255,0.1)` | `#bae6fd` |
| `--border-subtle` | `rgba(255,255,255,0.08)` | `#e0f2fe` |

Additional tokens may be added during implementation as edge cases surface (e.g., hover states, focus rings, specific component backgrounds).

### Crossfade Transition

Add a **new, separate** `@media (prefers-reduced-motion: no-preference)` rule (distinct from the existing `reduce` rule that disables animations):

```css
@media (prefers-reduced-motion: no-preference) {
  *, *::before, *::after {
    transition: background-color 200ms, color 200ms, border-color 200ms;
  }
}
```

Users who prefer reduced motion get instant theme switches.

---

## 2. Category Colors

### Data Model Change

In `budget.ts`, the `BudgetCategory.color` field changes from `string` to `{ dark: string; light: string }`:

- Dark variants = current hex values (no visual change to existing dark theme)
- Light variants = slightly deeper/more saturated versions of the same hue families, tuned for contrast on #f0f9ff

### Accessing Theme-Aware Colors

A utility function `resolveThemeColor(color: { dark: string; light: string }, theme: string): string`:

- Pure synchronous function (not a hook) — takes the color object and the current theme string, returns the correct hex
- Components call `useTheme()` from `next-themes` once at the top level to get the resolved theme, then pass it to `resolveThemeColor` wherever needed
- Used by Recharts chart fills and any inline `style` that needs category hex values (Recharts renders SVG with inline `fill` attributes, so CSS variables don't work here)
- Defaults to `"dark"` if theme is undefined (SSR fallback — matches current appearance, avoids hydration flash)

### Interface Change

```typescript
// Before
interface BudgetCategory {
  color: string;
  // ...
}

// After
interface BudgetCategory {
  color: { dark: string; light: string };
  // ...
}
```

All consumers of `category.color` must be updated to use `resolveThemeColor(category.color, theme)` where `theme` comes from `useTheme()` at the component's top level.

---

## 3. Toggle Component

### New Component: `ThemeToggle.tsx`

- Small icon button (w-8 h-8), rounded, ghost style
- Sun icon in dark mode, moon icon in light mode
- Inline SVG icons — no icon library dependency
- Uses `useTheme()` from `next-themes` to read and set theme
- Toggles between light and dark (two-state)
- Styled with semantic tokens: `--surface-elevated` background, `--border` border

### Placement

- Placed at the top of `page.tsx` (which is already `"use client"` and renders both form and receipt views), so the toggle appears consistently across both states without needing to modify the server-component `layout.tsx`
- Positioned top-right corner, consistent across landing page and receipt view

### Theme Behavior

- `defaultTheme="system"` — on first visit, the app detects the OS preference (e.g., Mac System Settings → Appearance)
- If the user manually toggles the theme, their choice is saved to localStorage and overrides the system preference on future visits
- If the user's OS preference changes while the app is open, the app updates in real time (unless the user has manually overridden)

---

## 4. Component Migration

### Class Replacement Map

| Current Class | Semantic Token Class |
|---|---|
| Body `background: #020617` | `bg-surface` |
| `bg-white/[0.03]` (card backgrounds) | `bg-surface-card` |
| `bg-white/5` (elevated surfaces) | `bg-surface-elevated` |
| `text-white` (primary text) | `text-text-primary` |
| `text-slate-400` (secondary text) | `text-text-secondary` |
| `text-slate-500` (muted text) | `text-text-muted` |
| `border-white/10` | `border-border` |
| `border-white/8` | `border-border-subtle` |

### What Stays the Same

- Semantic status colors (green for positive, red for negative) — functional in both themes
- Layout, spacing, typography, Framer Motion animations — untouched
- Component structure and props — unchanged (except `category.color` type)

### Migration Order

1. **`globals.css` + `layout.tsx`** — infrastructure, all components depend on this
2. **`ThemeToggle.tsx`** — new component, enables testing the toggle immediately
3. **`TaxForm.tsx`** — landing page, first thing users see
4. **`SpendingChart.tsx` + `ReceiptLine.tsx`** — core receipt, uses category colors
5. **`TaxReceipt.tsx` + `BillsPanel.tsx` + `SecondaryTabs.tsx`** — receipt wrapper and secondary content tabs
6. **`InternationalComparison.tsx` + `SpendingTrends.tsx`** — comparison views
7. **Remaining components** — `RepresentativeCard`, `RepresentativesModal`, `ShareSheet`, `InfoTooltip`, `InfluenceChain`, `BillInfluenceChain`, `FinanceCard`, `RecentExpenditures`, `StickyNav`

### Scrollbar Styles

The scrollbar styles in `globals.css` (`.overflow-y-auto::-webkit-scrollbar-thumb`) use hardcoded `rgba(255,255,255,...)` values. Replace with `var(--border)` / `var(--border-subtle)` so they update with theme. The existing selector scopes to `.overflow-y-auto` elements which covers all scrollable areas in the app.

---

## 5. Testing & Edge Cases

### Flash of Wrong Theme (FOUC)

`next-themes` injects a blocking `<script>` in `<head>` that sets `data-theme` synchronously before `<body>` children render. This means CSS-variable-based colors are correct from first paint. `suppressHydrationWarning` on `<html>` suppresses React warnings about the server/client attribute mismatch (server doesn't know the user's theme). Verify during testing that no color flash occurs on first load, including Recharts chart fills.

### Recharts Hydration

Charts are rendered in `"use client"` components, so `resolveThemeColor` resolves client-side. On SSR, it defaults to `"dark"` (matching current appearance), so the worst case is a brief moment of dark-theme chart colors before the client resolves the actual theme — acceptable and matches the existing behavior.

### Reduced Motion

Crossfade transition is in a separate `@media (prefers-reduced-motion: no-preference)` rule (not extending the existing `reduce` rule). Users who prefer reduced motion get instant theme switches.

### Verification Checklist

- Toggle works in both directions (light→dark, dark→light)
- System preference change (Mac Appearance switch) updates theme in real time
- Page refresh preserves user's theme choice (localStorage)
- All 14 category colors have sufficient contrast in both themes (WCAG AA)
- Charts, tooltips, modals render correctly in both themes
- Scrollbar styling updates with theme
- No FOUC on initial load

### Test Approach

No new automated test files — this is a visual/CSS change. Manual verification across all components in both themes is the primary approach.

---

## Files Changed

### New Files
- `src/components/ThemeToggle.tsx` — theme toggle icon button
- `src/lib/themeColor.ts` — `resolveThemeColor()` pure utility function

### Modified Files
- `package.json` — add `next-themes` dependency
- `src/app/globals.css` — CSS variable tokens, dark/light rulesets, crossfade transition, scrollbar variants
- `src/app/layout.tsx` — `<ThemeProvider>` wrapper, `suppressHydrationWarning`
- `src/data/budget.ts` — `color` field becomes `{ dark, light }` object
- `src/app/page.tsx` — add `ThemeToggle`, update hardcoded colors
- `src/components/TaxReceipt.tsx` — add `ThemeToggle`, update hardcoded colors
- `src/components/SpendingChart.tsx` — use `resolveThemeColor` for chart fills
- `src/components/ReceiptLine.tsx` — update color classes
- `src/components/BillsPanel.tsx` — update color classes
- `src/components/SecondaryTabs.tsx` — update color classes
- `src/components/InternationalComparison.tsx` — update color classes
- `src/components/SpendingTrends.tsx` — update color classes, chart fills
- `src/components/RepresentativeCard.tsx` — update color classes
- `src/components/RepresentativesModal.tsx` — update color classes
- `src/components/ShareSheet.tsx` — update color classes
- `src/components/InfoTooltip.tsx` — update color classes
- `src/components/InfluenceChain.tsx` — update color classes
- `src/components/BillInfluenceChain.tsx` — update color classes
- `src/components/FinanceCard.tsx` — update color classes
- `src/components/RecentExpenditures.tsx` — update color classes
- `src/components/StickyNav.tsx` — update color classes

### New Utility
- `resolveThemeColor` function in `src/lib/themeColor.ts` — pure function that takes `{ dark, light }` color object and theme string, returns hex value
