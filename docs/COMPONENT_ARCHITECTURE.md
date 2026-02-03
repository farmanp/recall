# Frontend Component Architecture

**Project:** Recall
**Phase:** Phase 1 - Frontend Architecture
**Date:** 2026-02-02

---

## Table of Contents

1. [Overview](#overview)
2. [Component Tree Structure](#component-tree-structure)
3. [Component Specifications](#component-specifications)
4. [State Management Strategy](#state-management-strategy)
5. [Data Flow Patterns](#data-flow-patterns)
6. [Virtualization Strategy](#virtualization-strategy)
7. [Responsive Design Approach](#responsive-design-approach)
8. [Styling System](#styling-system)
9. [Phase 2 Features Design](#phase-2-features-design)
10. [File Organization](#file-organization)

---

## Overview

### Architecture Principles

1. **Component Composition**: Small, focused components with clear responsibilities
2. **Type Safety**: Full TypeScript coverage with strict mode
3. **Performance First**: Virtualization for all large lists (127+ sessions, 900+ events)
4. **Local-First**: All state derived from API, no external services
5. **Progressive Enhancement**: Phase 1 foundation, Phase 2 playback, Phase 3 search

### Technology Stack

- **React 18**: Functional components with hooks
- **TypeScript**: Strict mode, full type coverage
- **Vite**: Fast dev server and bundling
- **Tailwind CSS**: Utility-first styling
- **@tanstack/react-virtual**: List virtualization
- **Zustand**: Lightweight state management
- **React Router**: Client-side routing with deep links

---

## Component Tree Structure

```
App
├── Router
│   ├── SessionListPage
│   │   ├── SessionListHeader
│   │   │   ├── SearchBar (Phase 3)
│   │   │   └── FilterControls (Phase 3)
│   │   └── SessionList (virtualized)
│   │       └── SessionCard (repeated)
│   │           ├── SessionHeader
│   │           ├── SessionMetadata
│   │           └── SessionStats
│   │
│   └── SessionPlayerPage
│       ├── SessionPlayerHeader
│       │   ├── BackButton
│       │   └── SessionTitle
│       ├── SessionPlayer
│       │   ├── PlaybackControls (Phase 2)
│       │   │   ├── PlayButton
│       │   │   ├── SpeedSelector
│       │   │   └── NavigationButtons
│       │   ├── Timeline (Phase 2)
│       │   │   ├── TimelineScrubber
│       │   │   ├── ChapterMarkers
│       │   │   └── ProgressIndicator
│       │   ├── EventTimeline (virtualized)
│       │   │   └── EventDisplay (repeated)
│       │   │       ├── PromptCard
│       │   │       ├── ObservationCard
│       │   │       └── GapIndicator (Phase 2)
│       │   └── FilePanel (Phase 2)
│       │       ├── FilePanelHeader
│       │       ├── FilesTouchedList (virtualized)
│       │       └── FileStats
│       └── SessionPlayerFooter
│           └── KeyboardShortcuts (Phase 2)
```

---

## Component Specifications

### Core Layout Components

#### `App.tsx`

**Purpose:** Application root with routing setup

**Props:** None

**State:**
- None (routing handled by React Router)

**Responsibilities:**
- Initialize React Router
- Provide global error boundary
- Setup Zustand store provider (if needed)

```typescript
interface AppProps {}
```

---

### Page Components

#### `SessionListPage.tsx`

**Purpose:** Main landing page showing all sessions

**Props:** None (uses URL query params)

**State:**
- Session list data (from API)
- Loading state
- Error state
- Pagination state

**Data Flow:**
- Fetches from `GET /api/sessions?offset=N&limit=20`
- Passes session data to SessionList

**Responsibilities:**
- Fetch session list on mount
- Handle pagination
- Show loading/error states
- Filter by project/date (Phase 3)

```typescript
interface SessionListPageProps {}

interface SessionListPageState {
  sessions: Session[];
  total: number;
  offset: number;
  limit: number;
  loading: boolean;
  error: Error | null;
}
```

---

#### `SessionPlayerPage.tsx`

**Purpose:** Session detail view with timeline player

**Props:** None (uses URL params for session ID)

**State:**
- Session metadata
- Event timeline data
- Current playback state (Phase 2)
- Loading/error states

**Data Flow:**
- Fetches from `GET /api/sessions/:id`
- Fetches from `GET /api/sessions/:id/events?offset=N&limit=100`
- Manages playback state (Phase 2)

**Responsibilities:**
- Load session and events
- Handle deep links (e.g., `?t=timestamp` or `?e=eventIndex`)
- Coordinate playback controls (Phase 2)
- Show loading/error states

```typescript
interface SessionPlayerPageProps {}

interface SessionPlayerPageState {
  session: Session | null;
  events: SessionEvent[];
  totalEvents: number;
  currentEventIndex: number;
  loading: boolean;
  error: Error | null;
}
```

---

### Session List Components

#### `SessionList.tsx`

**Purpose:** Virtualized list of sessions

**Props:**
```typescript
interface SessionListProps {
  sessions: Session[];
  total: number;
  onLoadMore: () => void;
  loading?: boolean;
}
```

**State:**
- Virtualization state (managed by @tanstack/react-virtual)

**Virtualization:**
- Use `useVirtualizer` hook
- Estimated row height: 120px
- Overscan: 5 rows
- Total count from API

**Responsibilities:**
- Render virtualized session cards
- Handle scroll-based pagination
- Show loading indicator at bottom

---

#### `SessionCard.tsx`

**Purpose:** Individual session card in list

**Props:**
```typescript
interface SessionCardProps {
  session: Session;
  onClick?: (sessionId: string) => void;
}
```

**State:**
- Expanded/collapsed (for details - Phase 1 always collapsed)

**Responsibilities:**
- Display session metadata (project, date, prompt count)
- Navigate to player on click
- Show session status (active/completed)
- Display first user prompt preview

**Styling:**
- Hover effect
- Click animation
- Status indicator (green/gray dot)

---

### Session Player Components

#### `SessionPlayer.tsx`

**Purpose:** Main player container orchestrating all playback

**Props:**
```typescript
interface SessionPlayerProps {
  session: Session;
  events: SessionEvent[];
  totalEvents: number;
  onLoadMoreEvents: () => void;
}
```

**State:**
- Current event index (Phase 2)
- Playback state (playing/paused - Phase 2)
- Speed multiplier (Phase 2)

**Responsibilities:**
- Manage playback state (Phase 2)
- Coordinate controls, timeline, and event display
- Handle keyboard shortcuts (Phase 2)
- Auto-scroll to current event

**Layout:**
```
┌────────────────────────────────────────┐
│ PlaybackControls (Phase 2)             │ (sticky top)
├────────────────────────────────────────┤
│ Timeline (Phase 2)                     │ (sticky below controls)
├──────────────────────┬─────────────────┤
│ EventTimeline        │ FilePanel (P2)  │ (main scrollable area)
│ (virtualized)        │                 │
│                      │                 │
│                      │                 │
└──────────────────────┴─────────────────┘
```

---

#### `EventTimeline.tsx`

**Purpose:** Virtualized list of session events

**Props:**
```typescript
interface EventTimelineProps {
  events: SessionEvent[];
  totalEvents: number;
  currentEventIndex?: number; // Phase 2
  onLoadMore: () => void;
  onEventClick?: (eventIndex: number) => void; // Phase 2
}
```

**State:**
- Virtualization state

**Virtualization:**
- Use `useVirtualizer` hook
- Dynamic row heights (collapsed vs expanded)
- Estimated collapsed height: 80px
- Estimated expanded height: 400px
- Overscan: 10 rows

**Responsibilities:**
- Render virtualized event cards
- Highlight current event (Phase 2)
- Handle scroll-based pagination
- Auto-scroll to current event (Phase 2)

---

#### `EventDisplay.tsx`

**Purpose:** Router component for event type rendering

**Props:**
```typescript
interface EventDisplayProps {
  event: SessionEvent;
  index: number;
  isActive?: boolean; // Phase 2
  isCurrent?: boolean; // Phase 2
  onExpand?: () => void;
}
```

**Responsibilities:**
- Route to PromptCard or ObservationCard based on event_type
- Pass through props to child components
- Detect gaps between events (Phase 2)

---

#### `PromptCard.tsx`

**Purpose:** Display user prompt event

**Props:**
```typescript
interface PromptCardProps {
  event: SessionEvent;
  index: number;
  isActive?: boolean; // Phase 2
  isCurrent?: boolean; // Phase 2
  expanded?: boolean;
  onToggleExpand?: () => void;
}
```

**State:**
- Expanded/collapsed (Phase 1)

**Layout:**
```
┌─────────────────────────────────────────┐
│ 🟢 User Prompt #5        10:23:45 AM   │
├─────────────────────────────────────────┤
│ Can you add dark mode to the settings? │ (collapsed: first 100 chars)
│                                         │
│ [Full prompt text...]                   │ (expanded: full text)
└─────────────────────────────────────────┘
```

**Styling:**
- Green accent (user prompt)
- Rounded border
- Collapsible with chevron icon
- Highlight when current (Phase 2)

---

#### `ObservationCard.tsx`

**Purpose:** Display Claude's observation event

**Props:**
```typescript
interface ObservationCardProps {
  event: SessionEvent;
  index: number;
  isActive?: boolean; // Phase 2
  isCurrent?: boolean; // Phase 2
  expanded?: boolean;
  onToggleExpand?: () => void;
}
```

**State:**
- Expanded/collapsed (Phase 1)

**Layout:**
```
┌─────────────────────────────────────────┐
│ 🔵 Feature          pn:5   10:24:12 AM  │
├─────────────────────────────────────────┤
│ Settings Dark Mode Implementation       │ (title - always visible)
│ Added theme toggle with local storage   │ (subtitle - always visible)
│                                          │
│ Narrative: [Full narrative text...]     │ (expanded only)
│ Files Modified:                          │ (expanded only)
│ - settings.tsx                           │
│ - theme.ts                               │
│ Concepts: [theme, settings, UI]         │ (expanded only)
└─────────────────────────────────────────┘
```

**Type Colors:**
- Feature: Purple
- Bugfix: Red
- Decision: Yellow
- Discovery: Blue
- Refactor: Gray
- Change: Green

**Narrative Priority:**
1. `title` (always shown)
2. `subtitle` (always shown)
3. `narrative` (expanded)
4. `facts` parsed as bullet list (expanded)
5. "No narrative recorded" (fallback)

---

### Phase 2 Components (Designed but not implemented in Phase 1)

#### `PlaybackControls.tsx`

**Purpose:** Video-style playback controls

**Props:**
```typescript
interface PlaybackControlsProps {
  isPlaying: boolean;
  speed: number; // 0.5, 1, 2, 5
  currentEventIndex: number;
  totalEvents: number;
  onPlayPause: () => void;
  onSpeedChange: (speed: number) => void;
  onPrevious: () => void;
  onNext: () => void;
  onJumpToStart: () => void;
}
```

**Layout:**
```
┌──────────────────────────────────────────────────┐
│ ⏮ ⏸ ⏭   [====●======]   15/150   1x ⚙️ ⌨️      │
│           timeline scrub  progress speed keyboard│
└──────────────────────────────────────────────────┘
```

**Keyboard Shortcuts:**
- Space: Play/pause
- Left/Right: Previous/next
- J/L: Jump ±10 events
- 0: Jump to start
- Shift+Left/Right: Decrease/increase speed

---

#### `Timeline.tsx`

**Purpose:** Visual timeline scrubber with event markers

**Props:**
```typescript
interface TimelineProps {
  events: SessionEvent[];
  currentEventIndex: number;
  onSeek: (eventIndex: number) => void;
}
```

**Features:**
- Chapter markers (feature, decision, bugfix)
- Hover preview
- Click to jump
- Current position indicator
- Gap compression indicators (dead air)

---

#### `FilePanel.tsx`

**Purpose:** Show files touched during session

**Props:**
```typescript
interface FilePanelProps {
  events: SessionEvent[];
  currentEventIndex?: number; // Filter files up to this point
}
```

**Layout:**
```
┌─────────────────────────┐
│ Files Touched (23)      │
├─────────────────────────┤
│ settings.tsx        5x  │ (read + modified count)
│ theme.ts            3x  │
│ App.tsx             2x  │
│ ...                     │
└─────────────────────────┘
```

**Features:**
- Virtualized file list
- Show read vs modified counts
- Click to filter timeline (Phase 3)
- Update as playback progresses

---

## State Management Strategy

### State Organization

**Local Component State (useState):**
- UI state (expanded/collapsed, hover, focus)
- Form inputs
- Temporary animations

**Shared State (Zustand):**
- Playback state (Phase 2)
  - Current event index
  - Playing/paused
  - Speed multiplier
- Filter state (Phase 3)
  - Observation type filters
  - Search query
  - Date range

**Server State (React Query - optional, or raw fetch):**
- Session list
- Session details
- Event timeline
- Pagination

### Zustand Store Structure (Phase 2)

```typescript
interface PlaybackStore {
  // State
  sessionId: string | null;
  currentEventIndex: number;
  isPlaying: boolean;
  speed: number;

  // Actions
  setSession: (sessionId: string) => void;
  setCurrentEventIndex: (index: number) => void;
  play: () => void;
  pause: () => void;
  togglePlayPause: () => void;
  setSpeed: (speed: number) => void;
  nextEvent: () => void;
  previousEvent: () => void;
  jumpToStart: () => void;
  jumpToEvent: (index: number) => void;
}
```

### State Location Decision Tree

```
Is it UI state only?
├─ YES → Local useState
│
└─ NO → Is it shared across routes?
    ├─ YES → Zustand store
    │
    └─ NO → Is it server data?
        ├─ YES → Fetch in page component, pass down
        │
        └─ NO → URL query params (filters, search)
```

---

## Data Flow Patterns

### Session List Flow

```
SessionListPage
  ↓ fetch /api/sessions
  ↓ (sessions data)
SessionList
  ↓ (session props)
SessionCard
  ↓ onClick(sessionId)
  ↓ navigate to /session/:id
SessionPlayerPage
```

### Session Player Flow

```
SessionPlayerPage
  ↓ fetch /api/sessions/:id
  ↓ fetch /api/sessions/:id/events
  ↓ (session + events data)
SessionPlayer
  ├─ events → EventTimeline → EventDisplay → PromptCard/ObservationCard
  ├─ session → SessionPlayerHeader
  └─ (Phase 2)
      ├─ playback state → PlaybackControls
      ├─ events + currentIndex → Timeline
      └─ events + currentIndex → FilePanel
```

### Deep Link Flow (Phase 2)

```
URL: /session/:id?t=1738507438000
  ↓ SessionPlayerPage reads query params
  ↓ Find event index matching timestamp
  ↓ Set currentEventIndex in Zustand
  ↓ EventTimeline auto-scrolls to index
  ↓ Event highlighted
```

---

## Virtualization Strategy

### Why Virtualization is Critical

- 127 sessions in list (can grow to 1000+)
- 900+ events in largest session
- DOM nodes = performance bottleneck
- Must handle large datasets smoothly

### Implementation: @tanstack/react-virtual

**Session List Virtualization:**

```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

const SessionList: React.FC<SessionListProps> = ({ sessions, total }) => {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: total,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120, // Estimated row height
    overscan: 5, // Render 5 extra rows
  });

  return (
    <div ref={parentRef} className="h-screen overflow-auto">
      <div style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const session = sessions[virtualRow.index];
          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <SessionCard session={session} />
            </div>
          );
        })}
      </div>
    </div>
  );
};
```

**Event Timeline Virtualization:**

```typescript
const EventTimeline: React.FC<EventTimelineProps> = ({ events, total }) => {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: total,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      // Dynamic sizing based on event type and expansion state
      const event = events[index];
      return event?.expanded ? 400 : 80;
    },
    overscan: 10, // More overscan for smoother scrolling
  });

  // Similar structure to SessionList
  // ...
};
```

**Performance Considerations:**

- Use `virtualizer.measureElement` for accurate dynamic heights
- Implement `estimateSize` based on event type (prompts shorter than observations)
- Increase `overscan` for smoother scrolling (trade memory for UX)
- Use `React.memo` on SessionCard and EventDisplay to prevent re-renders

---

## Responsive Design Approach

### Breakpoints (Tailwind)

- `sm`: 640px (mobile landscape)
- `md`: 768px (tablet)
- `lg`: 1024px (desktop)
- `xl`: 1280px (wide desktop)

### Layout Strategies

#### Mobile (< 768px)

**Session List:**
- Full-width cards
- Stacked metadata
- Hide less important info

**Session Player:**
- Full-width layout
- Hide FilePanel (Phase 2)
- Sticky PlaybackControls at bottom
- Timeline below controls
- EventTimeline fills remaining height

```
┌──────────────────┐
│ Header           │
├──────────────────┤
│ PlaybackControls │ (sticky bottom)
├──────────────────┤
│ Timeline         │ (sticky below controls)
├──────────────────┤
│ EventTimeline    │ (scrollable)
│                  │
│                  │
└──────────────────┘
```

#### Tablet (768px - 1024px)

**Session Player:**
- Two-column layout
- EventTimeline: 70%
- FilePanel: 30% (Phase 2)
- Controls at top (sticky)

#### Desktop (> 1024px)

**Session Player:**
- Three-section layout
- EventTimeline: 60%
- FilePanel: 25% (Phase 2)
- Metadata sidebar: 15% (optional - Phase 3)
- Controls at top (sticky)

### Responsive Component Patterns

```typescript
// Hide on mobile
<div className="hidden md:block">
  <FilePanel />
</div>

// Full width on mobile, 2-col on tablet
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <SessionCard />
</div>

// Sticky positioning
<div className="sticky top-0 z-10 bg-white">
  <PlaybackControls />
</div>
```

---

## Styling System

### Tailwind CSS Configuration

**Custom Theme Extensions:**

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        // Observation type colors
        'obs-feature': '#8B5CF6', // Purple
        'obs-bugfix': '#EF4444',  // Red
        'obs-decision': '#F59E0B', // Yellow
        'obs-discovery': '#3B82F6', // Blue
        'obs-refactor': '#6B7280', // Gray
        'obs-change': '#10B981',   // Green

        // UI colors
        'prompt': '#22C55E',      // Green
        'bg-card': '#F9FAFB',     // Light gray
        'border-card': '#E5E7EB', // Border gray
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-in': 'slideIn 0.2s ease-out',
      },
      keyframes: {
        slideIn: {
          '0%': { transform: 'translateY(-10px)', opacity: 0 },
          '100%': { transform: 'translateY(0)', opacity: 1 },
        },
      },
    },
  },
};
```

### Component Styling Patterns

**Card Pattern:**
```typescript
className="bg-bg-card border border-border-card rounded-lg p-4 hover:shadow-md transition-shadow"
```

**Event Type Badge:**
```typescript
const typeColors = {
  feature: 'bg-obs-feature',
  bugfix: 'bg-obs-bugfix',
  decision: 'bg-obs-decision',
  discovery: 'bg-obs-discovery',
  refactor: 'bg-obs-refactor',
  change: 'bg-obs-change',
};

<span className={`${typeColors[type]} text-white px-2 py-1 rounded text-xs`}>
  {type}
</span>
```

**Loading Skeleton:**
```typescript
<div className="animate-pulse">
  <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
  <div className="h-4 bg-gray-300 rounded w-1/2"></div>
</div>
```

### Typography Scale

- Headings: `text-2xl font-bold` (session titles)
- Subheadings: `text-lg font-semibold` (event titles)
- Body: `text-base` (narratives, prompts)
- Metadata: `text-sm text-gray-600` (timestamps, counts)
- Code: `font-mono text-sm` (file names)

---

## Phase 2 Features Design

### Playback State Machine

```
IDLE ──[load session]──> LOADED
                           │
                           ├─[play]──> PLAYING ──[pause]──> PAUSED
                           │              │
                           │              └─[speed change]─┘
                           │
                           └─[next/prev]─> LOADED (new index)
```

### Auto-Advance Logic

```typescript
useEffect(() => {
  if (!isPlaying) return;

  const delay = calculateDelay(currentEvent, speed);
  const timer = setTimeout(() => {
    if (currentEventIndex < totalEvents - 1) {
      setCurrentEventIndex(currentEventIndex + 1);
    } else {
      pause(); // Auto-stop at end
    }
  }, delay);

  return () => clearTimeout(timer);
}, [isPlaying, currentEventIndex, speed]);

function calculateDelay(event: SessionEvent, speed: number): number {
  const baseDelay = event.event_type === 'prompt' ? 3000 : 1500;
  return baseDelay / speed;
}
```

### Gap Detection and Compression

```typescript
function detectGap(event: SessionEvent, nextEvent: SessionEvent): Gap | null {
  const timeDiff = nextEvent.ts - event.ts;
  const FIVE_MINUTES = 5 * 60 * 1000;

  if (timeDiff > FIVE_MINUTES) {
    return {
      duration: timeDiff,
      displayText: formatGapDuration(timeDiff), // "32 min later"
      summary: summarizeGap(event, nextEvent), // Files/concepts changed
    };
  }

  return null;
}
```

### Chapter Markers

```typescript
function getChapterMarkers(events: SessionEvent[]): ChapterMarker[] {
  const chapterTypes: ObservationType[] = ['feature', 'decision', 'bugfix'];

  return events
    .map((event, index) => ({
      index,
      event,
      isChapter: event.event_type === 'observation' &&
                 chapterTypes.includes(event.obs_type),
    }))
    .filter(marker => marker.isChapter);
}
```

### File Touch Aggregation

```typescript
function aggregateFilesTouched(
  events: SessionEvent[],
  upToIndex?: number
): FileTouchSummary[] {
  const eventSubset = upToIndex !== undefined
    ? events.slice(0, upToIndex + 1)
    : events;

  const fileMap = new Map<string, { reads: number; modifies: number }>();

  eventSubset.forEach(event => {
    if (event.event_type === 'observation') {
      event.files_read?.forEach(file => {
        const entry = fileMap.get(file) || { reads: 0, modifies: 0 };
        entry.reads++;
        fileMap.set(file, entry);
      });

      event.files_modified?.forEach(file => {
        const entry = fileMap.get(file) || { reads: 0, modifies: 0 };
        entry.modifies++;
        fileMap.set(file, entry);
      });
    }
  });

  return Array.from(fileMap.entries())
    .map(([path, counts]) => ({ path, ...counts, total: counts.reads + counts.modifies }))
    .sort((a, b) => b.total - a.total);
}
```

---

## File Organization

```
frontend/
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   └── ErrorBoundary.tsx
│   │   ├── session-list/
│   │   │   ├── SessionList.tsx
│   │   │   ├── SessionCard.tsx
│   │   │   ├── SessionListHeader.tsx
│   │   │   └── index.ts
│   │   ├── session-player/
│   │   │   ├── SessionPlayer.tsx
│   │   │   ├── SessionPlayerHeader.tsx
│   │   │   ├── EventTimeline.tsx
│   │   │   ├── EventDisplay.tsx
│   │   │   ├── PromptCard.tsx
│   │   │   ├── ObservationCard.tsx
│   │   │   ├── PlaybackControls.tsx (Phase 2)
│   │   │   ├── Timeline.tsx (Phase 2)
│   │   │   ├── FilePanel.tsx (Phase 2)
│   │   │   └── index.ts
│   │   ├── shared/
│   │   │   ├── LoadingSpinner.tsx
│   │   │   ├── ErrorMessage.tsx
│   │   │   ├── Badge.tsx
│   │   │   └── index.ts
│   │   └── index.ts
│   ├── pages/
│   │   ├── SessionListPage.tsx
│   │   ├── SessionPlayerPage.tsx
│   │   └── index.ts
│   ├── hooks/
│   │   ├── useSession.ts
│   │   ├── useSessionEvents.ts
│   │   ├── usePlayback.ts (Phase 2)
│   │   ├── useKeyboardShortcuts.ts (Phase 2)
│   │   └── index.ts
│   ├── stores/
│   │   ├── playbackStore.ts (Phase 2)
│   │   └── index.ts
│   ├── lib/
│   │   ├── api.ts (API client)
│   │   ├── formatters.ts (Date/time formatting)
│   │   ├── eventHelpers.ts (Gap detection, file aggregation)
│   │   └── index.ts
│   ├── types/
│   │   ├── api.ts (API types - shared with backend)
│   │   ├── components.ts (Component-specific types)
│   │   └── index.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── public/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

### Import Organization

```typescript
// External dependencies (React, libraries)
import React, { useState, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

// Internal types
import type { SessionEvent } from '@/types';

// Internal utilities
import { formatTimestamp, detectGap } from '@/lib/formatters';

// Internal components
import { PromptCard } from './PromptCard';
import { ObservationCard } from './ObservationCard';
```

---

## Success Criteria

### Phase 1 Complete When:

- [x] Component architecture documented
- [ ] All component stubs created with TypeScript interfaces
- [ ] SessionList renders with virtualization (handles 127+ sessions)
- [ ] EventTimeline renders with virtualization (handles 900+ events)
- [ ] Session navigation works (list → player → back)
- [ ] Events display with correct formatting (prompts green, observations colored by type)
- [ ] Expand/collapse works for event cards
- [ ] Mobile responsive (320px width)
- [ ] Desktop responsive (1920px width)
- [ ] Zero TypeScript errors (strict mode)

### Phase 2 Ready When:

- [ ] Playback controls interface designed
- [ ] Timeline scrubber interface designed
- [ ] Gap detection algorithm implemented
- [ ] File aggregation algorithm implemented
- [ ] Keyboard shortcuts spec defined

---

## Known Constraints and Trade-offs

### Constraints

1. **Backend data format**: Must match existing API responses
2. **Database read-only**: No writes, only reads from claude-mem.db
3. **Local-first**: No cloud services, no auth required
4. **Performance target**: Smooth scrolling with 900+ events

### Trade-offs

1. **Virtualization complexity** vs **Performance**
   - Decision: Accept complexity, performance is critical

2. **Zustand** vs **Context API**
   - Decision: Zustand (lighter, better dev tools, easier testing)

3. **React Query** vs **Raw fetch**
   - Decision: Start with raw fetch (simpler), add React Query if needed in Phase 3

4. **Component granularity** vs **File count**
   - Decision: Favor smaller components (better testing, reusability)

5. **Phase 1 feature scope** vs **Time to MVP**
   - Decision: Minimal Phase 1 (view-only), defer playback to Phase 2

---

## Next Steps

1. Initialize Vite + React + TypeScript project
2. Setup Tailwind CSS
3. Install dependencies (@tanstack/react-virtual, zustand, react-router)
4. Create component stubs with interfaces
5. Implement SessionListPage with API integration
6. Implement SessionPlayerPage with API integration
7. Test virtualization with real data (127 sessions, 900+ events)
8. Polish mobile responsiveness
9. Add loading/error states
10. Document component usage

---

**Status:** Architecture Complete - Ready for Implementation
**Next Phase:** Component Implementation (Phase 1)
**Estimated Effort:** 3-4 days for Phase 1 complete

