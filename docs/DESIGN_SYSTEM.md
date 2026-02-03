# Design System & Styling Guide

**Project:** Recall Frontend
**Version:** Phase 1
**Date:** 2026-02-02

---

## Table of Contents

1. [Color Palette](#color-palette)
2. [Typography](#typography)
3. [Spacing System](#spacing-system)
4. [Component Patterns](#component-patterns)
5. [Animation Guidelines](#animation-guidelines)
6. [Responsive Breakpoints](#responsive-breakpoints)
7. [Accessibility](#accessibility)

---

## Color Palette

### Observation Type Colors

Each observation type has a dedicated color for visual differentiation:

```css
--obs-feature: #8B5CF6;     /* Purple - New features */
--obs-bugfix: #EF4444;      /* Red - Bug fixes */
--obs-decision: #F59E0B;    /* Yellow - Important decisions */
--obs-discovery: #3B82F6;   /* Blue - Discoveries */
--obs-refactor: #6B7280;    /* Gray - Refactoring */
--obs-change: #10B981;      /* Green - General changes */
```

**Usage:**
- Card borders: `border-obs-feature`
- Background tints: `bg-purple-50` (feature), `bg-red-50` (bugfix), etc.
- Text colors: `text-purple-700` (feature), `text-red-700` (bugfix), etc.

### UI Colors

```css
--prompt: #22C55E;          /* Green - User prompts */
--bg-card: #F9FAFB;         /* Light gray - Card backgrounds */
--border-card: #E5E7EB;     /* Border gray - Card borders */
```

### Semantic Colors

- **Success:** `green-500` (#10B981)
- **Error:** `red-500` (#EF4444)
- **Warning:** `yellow-500` (#F59E0B)
- **Info:** `blue-500` (#3B82F6)

### Neutral Palette

- **Gray 50:** `#F9FAFB` - Backgrounds
- **Gray 100:** `#F3F4F6` - Subtle backgrounds
- **Gray 200:** `#E5E7EB` - Borders
- **Gray 300:** `#D1D5DB` - Disabled states
- **Gray 400:** `#9CA3AF` - Placeholder text
- **Gray 500:** `#6B7280` - Secondary text
- **Gray 600:** `#4B5563` - Primary text
- **Gray 700:** `#374151` - Headings
- **Gray 800:** `#1F2937` - Strong emphasis
- **Gray 900:** `#111827` - Maximum contrast

---

## Typography

### Font Stack

```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
```

### Type Scale

| Element | Class | Size | Weight | Line Height |
|---------|-------|------|--------|-------------|
| Page Title | `text-2xl font-bold` | 24px | 700 | 1.25 |
| Section Title | `text-xl font-bold` | 20px | 700 | 1.25 |
| Card Title | `text-lg font-semibold` | 18px | 600 | 1.5 |
| Subheading | `text-base font-semibold` | 16px | 600 | 1.5 |
| Body | `text-base` | 16px | 400 | 1.5 |
| Small | `text-sm` | 14px | 400 | 1.5 |
| Extra Small | `text-xs` | 12px | 400 | 1.5 |

### Code/Monospace

```css
font-family: ui-monospace, SFMono-Regular, "SF Mono", Monaco, "Cascadia Mono", "Segoe UI Mono", "Roboto Mono", Menlo, Consolas, "Liberation Mono", monospace;
```

**Usage:** File names, code snippets
**Class:** `font-mono text-sm`

---

## Spacing System

Tailwind's default spacing scale (0.25rem increments):

| Class | Size | Pixels |
|-------|------|--------|
| `p-1` | 0.25rem | 4px |
| `p-2` | 0.5rem | 8px |
| `p-3` | 0.75rem | 12px |
| `p-4` | 1rem | 16px |
| `p-6` | 1.5rem | 24px |
| `p-8` | 2rem | 32px |

### Component Spacing Standards

- **Card Padding:** `p-4` (16px)
- **Section Spacing:** `mb-6` (24px)
- **Element Spacing:** `gap-2` (8px) to `gap-4` (16px)
- **Page Margins:** `px-4` (16px mobile), `px-6` (24px desktop)

---

## Component Patterns

### Card Pattern

```tsx
<div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
  {/* Card content */}
</div>
```

**Variants:**
- **Clickable:** Add `cursor-pointer`
- **Active:** Add `ring-2 ring-blue-500 ring-offset-2`
- **Colored Border:** Replace `border-gray-200` with `border-l-4 border-obs-feature`

### Button Pattern

```tsx
{/* Primary */}
<button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
  Click Me
</button>

{/* Secondary */}
<button className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors">
  Cancel
</button>

{/* Icon Button */}
<button className="p-2 rounded hover:bg-gray-100 transition-colors">
  <svg className="w-5 h-5">...</svg>
</button>
```

### Badge Pattern

```tsx
<span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs font-semibold">
  Feature
</span>
```

**Type Colors:**
```tsx
const typeColors = {
  feature: 'bg-purple-100 text-purple-700',
  bugfix: 'bg-red-100 text-red-700',
  decision: 'bg-yellow-100 text-yellow-700',
  discovery: 'bg-blue-100 text-blue-700',
  refactor: 'bg-gray-100 text-gray-700',
  change: 'bg-green-100 text-green-700',
};
```

### Loading Skeleton

```tsx
<div className="animate-pulse">
  <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
  <div className="h-4 bg-gray-300 rounded w-1/2"></div>
</div>
```

### Input Pattern

```tsx
<input
  type="text"
  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
  placeholder="Search sessions..."
/>
```

---

## Animation Guidelines

### Transitions

Use Tailwind's `transition-*` utilities for smooth state changes:

```tsx
{/* Opacity */}
<div className="transition-opacity hover:opacity-80">

{/* Colors */}
<button className="transition-colors hover:bg-blue-700">

{/* Shadow */}
<div className="transition-shadow hover:shadow-lg">

{/* Transform */}
<div className="transition-transform hover:scale-105">

{/* All */}
<div className="transition-all duration-200">
```

### Custom Animations

Defined in `tailwind.config.js`:

```tsx
{/* Pulse (slow) */}
<div className="animate-pulse-slow">

{/* Slide in */}
<div className="animate-slide-in">

{/* Spin (loading) */}
<div className="animate-spin">
```

### Animation Durations

- **Fast:** `duration-150` (150ms) - Hover effects
- **Normal:** `duration-200` (200ms) - Default transitions
- **Slow:** `duration-300` (300ms) - Expand/collapse
- **Slower:** `duration-500` (500ms) - Page transitions

### Animation Best Practices

1. **Use sparingly:** Too many animations = distraction
2. **Prefer opacity/transform:** More performant than width/height
3. **Reduce motion:** Check `prefers-reduced-motion` media query (Phase 2)
4. **Loading states:** Always animate loading spinners

---

## Responsive Breakpoints

Tailwind breakpoints (mobile-first):

| Breakpoint | Min Width | Usage |
|------------|-----------|-------|
| `sm` | 640px | Mobile landscape |
| `md` | 768px | Tablet |
| `lg` | 1024px | Desktop |
| `xl` | 1280px | Wide desktop |
| `2xl` | 1536px | Ultra-wide |

### Responsive Patterns

```tsx
{/* Hide on mobile, show on desktop */}
<div className="hidden md:block">

{/* Stack on mobile, grid on desktop */}
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">

{/* Full width on mobile, constrained on desktop */}
<div className="w-full lg:w-1/2">

{/* Different padding on mobile vs desktop */}
<div className="px-4 md:px-6 lg:px-8">
```

### Component Responsive Behavior

**SessionCard:**
- Mobile: Full width, stacked metadata
- Desktop: Grid layout, side-by-side metadata

**SessionPlayer:**
- Mobile: Full-width timeline, hide FilePanel
- Tablet: 70/30 split (timeline/file panel)
- Desktop: 60/25/15 split (timeline/file panel/metadata)

**EventTimeline:**
- Mobile: Collapsed by default, expand on tap
- Desktop: Taller event cards, more content visible

---

## Accessibility

### Color Contrast

All text meets WCAG AA standards:
- **Body text (gray-700):** 4.5:1 contrast ratio
- **Headings (gray-900):** 7:1 contrast ratio
- **Disabled (gray-400):** 3:1 minimum (for large text)

### Focus States

All interactive elements have visible focus indicators:

```tsx
<button className="focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
```

### ARIA Labels

```tsx
{/* Buttons */}
<button aria-label="Close dialog">

{/* Regions */}
<div role="region" aria-label="Session timeline">

{/* Status */}
<div role="status" aria-live="polite">

{/* Hidden text for screen readers */}
<span className="sr-only">Loading...</span>
```

### Keyboard Navigation

- **Tab:** Navigate between interactive elements
- **Enter/Space:** Activate buttons
- **Escape:** Close modals/dialogs (Phase 2)
- **Arrow keys:** Navigate lists (Phase 2)

### Semantic HTML

- Use `<button>` for clickable actions
- Use `<a>` for navigation
- Use `<nav>` for navigation sections
- Use `<main>` for main content
- Use `<header>` for page headers

---

## Dark Mode (Phase 3+)

Future enhancement - not in Phase 1.

Planned approach:
- Use Tailwind's `dark:` variant
- Toggle via `<html class="dark">`
- Store preference in localStorage

Example:
```tsx
<div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
```

---

## Icon System

Currently using inline SVG icons from Heroicons.

### Icon Sizes

- **Small:** `w-4 h-4` (16px)
- **Medium:** `w-5 h-5` (20px)
- **Large:** `w-6 h-6` (24px)
- **Extra Large:** `w-8 h-8` (32px)

### Common Icons

**Navigation:**
- Back: `<path d="M15 19l-7-7 7-7"/>`
- Next: `<path d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"/>`

**Actions:**
- Play: Triangle pointing right
- Pause: Two vertical bars
- Expand: Chevron down

**Status:**
- Success: Checkmark circle
- Error: Exclamation circle
- Loading: Spinning circle

---

## Layout Patterns

### Full-Height Page

```tsx
<div className="h-screen bg-gray-50">
  <header className="bg-white border-b">...</header>
  <main className="flex-1 overflow-auto">...</main>
</div>
```

### Sticky Header

```tsx
<div className="sticky top-0 z-10 bg-white shadow-sm">
  {/* Header content */}
</div>
```

### Virtualized List Container

```tsx
<div
  ref={parentRef}
  className="h-screen overflow-auto bg-gray-50 p-4"
  aria-label="Session list"
>
  {/* Virtualized content */}
</div>
```

### Two-Column Layout

```tsx
<div className="flex h-screen">
  <div className="flex-1 overflow-auto">
    {/* Main content */}
  </div>
  <div className="w-80 border-l bg-white overflow-auto">
    {/* Sidebar */}
  </div>
</div>
```

---

## Design Tokens (CSS Variables - Future)

Phase 2+ may introduce CSS variables for dynamic theming:

```css
:root {
  --color-primary: #3B82F6;
  --color-success: #10B981;
  --color-error: #EF4444;
  --spacing-unit: 0.25rem;
  --border-radius: 0.5rem;
}
```

---

## Browser Support

**Target Browsers:**
- Chrome 90+ (Chromium)
- Firefox 88+
- Safari 14+
- Edge 90+

**Not Supporting:**
- IE 11 (deprecated)
- Safari < 14

**Graceful Degradation:**
- Animations: Fall back to instant transitions
- Grid: Fall back to flexbox
- CSS variables: Use Tailwind fallbacks

---

## Performance Considerations

### CSS Best Practices

1. **Use Tailwind's purge:** Remove unused classes (automatic in Vite)
2. **Minimize custom CSS:** Prefer Tailwind utilities
3. **Avoid inline styles:** Use classes for consistency
4. **Group common patterns:** Create reusable components

### Animation Performance

1. **Prefer transform/opacity:** GPU-accelerated
2. **Avoid animating width/height:** Causes reflows
3. **Use `will-change` sparingly:** Only when necessary
4. **Debounce scroll events:** Use virtualization instead

---

## Component Styling Checklist

When creating a new component:

- [ ] Responsive design (mobile, tablet, desktop)
- [ ] Focus states (keyboard navigation)
- [ ] Hover states (desktop)
- [ ] Loading states (skeletons)
- [ ] Error states (messages)
- [ ] Empty states (no data)
- [ ] ARIA labels (accessibility)
- [ ] Color contrast (WCAG AA)
- [ ] Semantic HTML (proper tags)
- [ ] Consistent spacing (Tailwind scale)

---

**Last Updated:** 2026-02-02
**Version:** Phase 1
**Status:** Complete
