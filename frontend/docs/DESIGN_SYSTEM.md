# Recall Design System: Forensic Terminal Aesthetic

## Overview

Recall's visual identity is built around the concept of **AI Coding Agent Forensics** — treating AI coding sessions as evidence to be analyzed, replayed, and understood. This document captures the design decisions behind our forensic terminal aesthetic.

## The Problem

The original Recall interface used a generic light theme that didn't communicate the unique value proposition of the product. Sessions were displayed as simple cards, frames as plain text blocks. There was no visual language that connected the experience to the core metaphor: **forensic analysis of AI behavior**.

We needed a design system that:

1. Immediately communicated the "forensics" concept
2. Made users feel like investigators analyzing evidence
3. Differentiated Recall from generic developer tools
4. Created visual hierarchy for complex session data

## Design Principles

### 1. Terminal as Truth

The terminal is where AI agents do their work. By adopting terminal aesthetics (monospace fonts, command prompts, dark backgrounds), we honor the source material and create visual continuity between the sessions being analyzed and the tool doing the analysis.

### 2. Evidence, Not Content

Every piece of data is framed as evidence to be examined. Session cards become terminal windows. Frames become evidence items. Statistics become case file data. This metaphor shift changes how users perceive and interact with the information.

### 3. Precision Over Polish

Sharp corners. Uppercase labels. Exact timestamps. The aesthetic emphasizes precision and attention to detail — qualities essential to forensic analysis. We deliberately avoid soft, friendly UI patterns in favor of utilitarian clarity.

### 4. Color as Signal

Colors are used sparingly and meaningfully:

- **Green** signals primary actions, success, and current position
- **Amber** indicates warnings, highlights, and secondary information
- **Red** marks errors and critical issues
- **Cyan** represents user input and links
- **Purple** denotes AI thinking and Codex agent

## Color Palette

```css
/* Backgrounds - Near-black with subtle layering */
--forensic-bg-primary: #0a0a0a; /* Main background */
--forensic-bg-secondary: #111111; /* Cards, panels */
--forensic-bg-tertiary: #1a1a1a; /* Elevated surfaces, headers */

/* Borders - Subtle definition */
--forensic-border: #262626;

/* Text - High contrast hierarchy */
--forensic-text-primary: #e5e5e5; /* Main text */
--forensic-text-secondary: #737373; /* Supporting text */
--forensic-text-muted: #525252; /* Tertiary, disabled */

/* Accent Colors - Purposeful signals */
--accent-green: #22c55e; /* Primary accent, success, current */
--accent-amber: #f59e0b; /* Warnings, highlights, tool executions */
--accent-red: #ef4444; /* Errors, critical */
--accent-cyan: #06b6d4; /* User input, links, info */
--accent-purple: #a855f7; /* Thinking, Codex agent */
--accent-orange: #f97316; /* Claude agent */

/* Agent-Specific Colors */
--agent-claude: #f97316; /* Orange - Claude Code */
--agent-gemini: #22c55e; /* Green - Gemini CLI */
--agent-codex: #a855f7; /* Purple - Codex CLI */
```

## Typography

### Font Stack

- **Headings & Labels**: JetBrains Mono — A monospace font designed for developers, conveying technical precision
- **Body Text**: Inter — Clean, readable, professional
- **Code & Data**: JetBrains Mono — Consistency with terminal output

### Text Treatments

- **Section Headers**: Uppercase, letter-spacing: 0.05em, font-weight: 600
- **Labels**: Uppercase, smaller size, muted color
- **Data Values**: Monospace, accent colors for emphasis
- **Comments**: Prefixed with `//` in code-comment style

```tsx
// Example: Section header
<h3 className="font-mono text-sm uppercase tracking-wide text-accent-green">
  // Session Statistics
</h3>

// Example: Data label
<span className="font-mono text-xs text-forensic-text-muted uppercase tracking-wide">
  Frame Count
</span>
```

## Visual Components

### Terminal Window Cards

Session cards and modal panels use a terminal window metaphor with the classic three-dot header:

```tsx
<div className="bg-forensic-bg-secondary border border-forensic-border">
  {/* Terminal Header */}
  <div className="flex items-center gap-2 px-4 py-3 bg-forensic-bg-tertiary border-b border-forensic-border">
    <div className="w-3 h-3 rounded-full bg-accent-red" />
    <div className="w-3 h-3 rounded-full bg-accent-amber" />
    <div className="w-3 h-3 rounded-full bg-accent-green" />
  </div>

  {/* Content */}
  <div className="p-4">{/* ... */}</div>
</div>
```

### Evidence Cards

Data displays use the evidence card pattern — bordered containers with clear labeling:

```tsx
<div className="bg-forensic-bg-tertiary border border-forensic-border p-4">
  <h4 className="font-mono text-xs text-forensic-text-muted uppercase tracking-wide mb-3">
    Evidence Type
  </h4>
  <div className="font-mono text-forensic-text-primary">{/* Data content */}</div>
</div>
```

### Frame Type Badges

Each frame type has a distinct color for instant recognition:

| Frame Type     | Color  | CSS Class                                 |
| -------------- | ------ | ----------------------------------------- |
| User Message   | Cyan   | `text-accent-cyan` / `bg-accent-cyan`     |
| AI Response    | Green  | `text-accent-green` / `bg-accent-green`   |
| AI Thinking    | Purple | `text-accent-purple` / `bg-accent-purple` |
| Tool Execution | Amber  | `text-accent-amber` / `bg-accent-amber`   |

### Agent Badges

Multi-agent support requires visual distinction:

| Agent  | Color  | Style                              |
| ------ | ------ | ---------------------------------- |
| Claude | Orange | `text-agent-claude`, border accent |
| Gemini | Green  | `text-agent-gemini`, border accent |
| Codex  | Purple | `text-agent-codex`, border accent  |

## Interaction Patterns

### Keyboard-First

The interface is designed for keyboard navigation, reflecting the terminal heritage:

- Single-key shortcuts (Space, 1-5, a, f, s, etc.)
- Keyboard hints shown in footers
- Focus states use green accent

### Hover States

- Borders transition to `accent-green/50` on hover
- Backgrounds lighten slightly (`hover:bg-forensic-border`)
- No dramatic color shifts — subtle, professional transitions

### Active/Selected States

- Current items use full `accent-green` highlighting
- Active filters show filled backgrounds
- Progress indicators glow with `shadow-[0_0_8px_rgba(34,197,94,0.5)]`

## Animation Philosophy

Animations are minimal and purposeful:

- **Transitions**: 150-200ms for color/opacity changes
- **No bouncy physics**: Professional, not playful
- **Loading states**: Simple pulse or blink, terminal-style cursor
- **Scanlines**: Optional overlay for full forensic immersion

```css
/* Terminal cursor blink */
@keyframes blink {
  0%,
  50% {
    opacity: 1;
  }
  51%,
  100% {
    opacity: 0;
  }
}

/* Subtle scanline effect */
.scanlines::before {
  background: repeating-linear-gradient(
    0deg,
    rgba(0, 0, 0, 0.15),
    rgba(0, 0, 0, 0.15) 1px,
    transparent 1px,
    transparent 2px
  );
}
```

## Implementation Notes

### Tailwind Configuration

All forensic colors are defined in `tailwind.config.js` under the `forensic` and `accent` namespaces, making them easy to use throughout the codebase:

```js
colors: {
  forensic: {
    'bg-primary': '#0a0a0a',
    'bg-secondary': '#111111',
    // ...
  },
  accent: {
    green: '#22c55e',
    amber: '#f59e0b',
    // ...
  },
  agent: {
    claude: '#f97316',
    gemini: '#22c55e',
    codex: '#a855f7',
  },
}
```

### CSS Utility Classes

Common patterns are extracted to `index.css` for reuse:

```css
.terminal {
  /* Terminal window container */
}
.terminal-header {
  /* Three-dot header */
}
.terminal-dot {
  /* Individual dot */
}
.evidence-card {
  /* Data display container */
}
.forensic-badge {
  /* Label badges */
}
```

### Sharp Corners

We deliberately removed `rounded-*` classes throughout the interface. Sharp corners reinforce the precision aesthetic and differentiate us from softer, consumer-oriented UIs.

## Decision Log

| Decision                | Rationale                                                            |
| ----------------------- | -------------------------------------------------------------------- |
| Dark theme only         | Matches terminal aesthetic; reduces eye strain for extended analysis |
| JetBrains Mono          | Purpose-built for code; excellent readability; developer credibility |
| Three-dot window chrome | Instantly recognizable terminal metaphor; adds visual interest       |
| Sharp corners           | Precision aesthetic; differentiation from generic UIs                |
| Uppercase labels        | Military/forensic documentation style; clear hierarchy               |
| Green as primary accent | Terminal heritage; positive/active connotation                       |
| Scanline overlay        | Optional immersion; nostalgic CRT reference                          |

## Future Considerations

1. **Theming**: The system is built to potentially support alternative themes (e.g., "amber terminal", "green phosphor") while maintaining the forensic metaphor
2. **Print styles**: Evidence export could use high-contrast print-friendly styling
3. **Accessibility**: Ensure color choices meet WCAG contrast requirements
4. **Motion preferences**: Respect `prefers-reduced-motion` for animations

---

_This design system was developed for Recall v1.5, February 2026._
