# Frontend Setup Guide

**Project:** Recall Frontend
**Date:** 2026-02-02

---

## Prerequisites

- Node.js 18+ installed
- Backend server running on `http://localhost:3001`

---

## Installation

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Install Missing Dependency (React Router)

The component architecture requires `react-router-dom` which needs to be installed:

```bash
npm install react-router-dom
npm install --save-dev @types/node  # For path resolution in vite.config.ts
```

### 3. Environment Variables (Optional)

Create `.env` file in `frontend/` directory:

```env
VITE_API_BASE_URL=http://localhost:3001
```

**Note:** If not set, defaults to `http://localhost:3001`

---

## Development

### Start Dev Server

```bash
npm run dev
```

**URL:** `http://localhost:5173`

The dev server includes:
- Hot module replacement (HMR)
- TypeScript type checking
- API proxy to backend (`/api` → `http://localhost:3001`)

### Build for Production

```bash
npm run build
```

**Output:** `dist/` directory

### Preview Production Build

```bash
npm run preview
```

---

## Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── session-list/
│   │   │   ├── SessionList.tsx
│   │   │   ├── SessionCard.tsx
│   │   │   └── index.ts
│   │   ├── session-player/
│   │   │   ├── SessionPlayer.tsx
│   │   │   ├── EventTimeline.tsx
│   │   │   ├── EventDisplay.tsx
│   │   │   ├── PromptCard.tsx
│   │   │   ├── ObservationCard.tsx
│   │   │   ├── PlaybackControls.tsx (Phase 2)
│   │   │   ├── Timeline.tsx (Phase 2)
│   │   │   ├── FilePanel.tsx (Phase 2)
│   │   │   └── index.ts
│   │   └── shared/
│   │       ├── LoadingSpinner.tsx
│   │       ├── ErrorMessage.tsx
│   │       └── index.ts
│   ├── pages/
│   │   ├── SessionListPage.tsx
│   │   ├── SessionPlayerPage.tsx
│   │   └── index.ts
│   ├── lib/
│   │   ├── api.ts
│   │   ├── formatters.ts
│   │   ├── eventHelpers.ts
│   │   └── index.ts
│   ├── types/
│   │   ├── api.ts
│   │   ├── components.ts
│   │   └── index.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

---

## TypeScript Configuration

### Path Aliases

Configured in `tsconfig.json` and `vite.config.ts`:

```typescript
// Import using alias
import { SessionList } from '@/components/session-list';
import type { Session } from '@/types';
import { formatTimestamp } from '@/lib/formatters';
```

**Alias:** `@/` → `src/`

### Strict Mode

The project uses TypeScript strict mode:
- `strict: true`
- `noUnusedLocals: true`
- `noUnusedParameters: true`

---

## Component Usage

### SessionListPage

**Route:** `/`

**Features:**
- Fetches sessions from `/api/sessions`
- Virtualized list (handles 127+ sessions)
- Infinite scroll pagination
- Loading and error states

**Props:** None (uses API)

### SessionPlayerPage

**Route:** `/session/:sessionId`

**Features:**
- Fetches session details from `/api/sessions/:sessionId`
- Fetches events from `/api/sessions/:sessionId/events`
- Virtualized event timeline (handles 900+ events)
- Expand/collapse events
- Back navigation

**Deep Link Support (Phase 2):**
- `/session/:id?t=1738507438000` - Jump to timestamp
- `/session/:id?e=15` - Jump to event index

### Example Component Usage

```tsx
// SessionList with data
<SessionList
  sessions={sessions}
  total={total}
  onLoadMore={handleLoadMore}
  loading={loading}
/>

// SessionPlayer with data
<SessionPlayer
  session={session}
  events={events}
  totalEvents={totalEvents}
  onLoadMoreEvents={handleLoadMore}
/>

// Standalone components
<PromptCard
  event={promptEvent}
  index={0}
  expanded={false}
  onToggleExpand={() => setExpanded(!expanded)}
/>

<ObservationCard
  event={observationEvent}
  index={1}
  expanded={true}
  onToggleExpand={() => setExpanded(!expanded)}
/>
```

---

## Styling

### Tailwind CSS

Custom theme extensions in `tailwind.config.js`:

**Observation Colors:**
```tsx
className="text-obs-feature"  // Purple
className="bg-obs-bugfix"     // Red
className="border-obs-decision" // Yellow
```

**Animations:**
```tsx
className="animate-pulse-slow"  // Slow pulse
className="animate-slide-in"    // Slide in from top
className="animate-spin"        // Loading spinner
```

**Custom Colors:**
```tsx
className="bg-bg-card"       // Light gray card background
className="border-border-card" // Gray card border
className="text-prompt"       // Green for prompts
```

### Responsive Design

```tsx
{/* Mobile: hidden, Desktop: visible */}
<div className="hidden md:block">

{/* Mobile: 1 column, Tablet: 2 columns, Desktop: 3 columns */}
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">

{/* Different padding per breakpoint */}
<div className="px-4 md:px-6 lg:px-8">
```

---

## API Integration

### API Client (`lib/api.ts`)

```typescript
import { fetchSessions, fetchSessionDetails, fetchSessionEvents } from '@/lib/api';

// List sessions
const response = await fetchSessions({
  offset: 0,
  limit: 20,
  project: 'my-project', // Optional filter
});

// Session details
const details = await fetchSessionDetails(sessionId);

// Session events
const events = await fetchSessionEvents(sessionId, {
  offset: 0,
  limit: 100,
  types: 'feature,decision', // Optional filter
});
```

### API Base URL

Set via environment variable:
```env
VITE_API_BASE_URL=http://localhost:3001
```

Or configure in `lib/api.ts`:
```typescript
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
```

---

## Utilities

### Formatters (`lib/formatters.ts`)

```typescript
import { formatTimestamp, formatDuration, formatRelativeTime } from '@/lib/formatters';

formatTimestamp(1738507438000);     // "Feb 2, 10:30 AM"
formatDuration(3600000);            // "1h 0m"
formatRelativeTime(Date.now() - 3600000); // "1 hour ago"
```

### Event Helpers (`lib/eventHelpers.ts`)

```typescript
import { aggregateFilesTouched, detectGap, getChapterMarkers } from '@/lib/eventHelpers';

// Get file touch summary
const files = aggregateFilesTouched(events, currentIndex);

// Detect gap between events
const gap = detectGap(prevEvent, currentEvent);

// Get chapter markers
const chapters = getChapterMarkers(events);
```

---

## Virtualization

The project uses `@tanstack/react-virtual` for efficient rendering of large lists.

### SessionList Virtualization

```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

const virtualizer = useVirtualizer({
  count: total,                        // Total item count
  getScrollElement: () => parentRef.current,
  estimateSize: () => 120,             // Estimated row height
  overscan: 5,                         // Render extra rows
});
```

**Performance:**
- Renders only visible items
- Handles 1000+ items smoothly
- Dynamic row heights supported

### EventTimeline Virtualization

```typescript
const virtualizer = useVirtualizer({
  count: totalEvents,
  getScrollElement: () => parentRef.current,
  estimateSize: (index) => {
    return expandedEvents.has(index) ? 400 : 80;  // Dynamic heights
  },
  overscan: 10,
});
```

---

## Type Safety

All components are fully typed with TypeScript.

### Common Types

```typescript
import type {
  Session,
  SessionEvent,
  ObservationType,
  SessionListResponse,
  SessionEventsResponse,
} from '@/types';
```

### Component Props

```typescript
interface SessionCardProps {
  session: Session;
  onClick?: (sessionId: string) => void;
}

interface EventDisplayProps {
  event: SessionEvent;
  index: number;
  expanded?: boolean;
  onToggleExpand?: () => void;
}
```

---

## Testing (Future)

Phase 1 focus is on architecture. Testing infrastructure to be added in Phase 2+.

**Planned:**
- Vitest for unit tests
- React Testing Library for component tests
- Playwright for E2E tests

---

## Performance Tips

### 1. Virtualization

Always use virtualized lists for large datasets:
- SessionList: 127+ sessions
- EventTimeline: 900+ events
- FilePanel: 100+ files (Phase 2)

### 2. React.memo

Memoize components that receive stable props:

```typescript
export const SessionCard = React.memo<SessionCardProps>(({ session }) => {
  // Component implementation
});
```

### 3. useCallback

Memoize callback functions:

```typescript
const handleLoadMore = useCallback(() => {
  if (!loading && sessions.length < total) {
    loadSessions(true);
  }
}, [loading, sessions.length, total]);
```

### 4. Lazy Loading

Defer loading heavy components (Phase 2):

```typescript
const FilePanel = lazy(() => import('./FilePanel'));
```

---

## Troubleshooting

### Issue: Module not found '@/...'

**Solution:** Ensure path alias is configured:
1. Check `tsconfig.json` has `"baseUrl": "."` and `"paths": { "@/*": ["src/*"] }`
2. Check `vite.config.ts` has alias resolver
3. Restart dev server

### Issue: API calls fail with CORS error

**Solution:** Backend must be running on `http://localhost:3001`
- Check backend is running: `curl http://localhost:3001/api/health`
- Vite proxy is configured in `vite.config.ts`

### Issue: Virtualized list not rendering

**Solution:** Ensure parent has fixed height:
```tsx
<div ref={parentRef} className="h-screen overflow-auto">
```

### Issue: TypeScript errors in strict mode

**Solution:** Fix type issues:
- Add explicit types to props
- Use `!` for non-null assertions (sparingly)
- Use optional chaining `?.` for nullable values

---

## Next Steps

After completing Phase 1 setup:

1. **Test components:**
   - Run dev server
   - Navigate to `http://localhost:5173`
   - Test session list loading
   - Test session player navigation

2. **Verify API integration:**
   - Check network tab (should see `/api/sessions` calls)
   - Verify data displays correctly
   - Test error states (stop backend server)

3. **Phase 2 preparation:**
   - Review playback controls design
   - Plan timeline scrubber implementation
   - Design keyboard shortcuts

---

## Resources

- **Tailwind CSS:** https://tailwindcss.com/docs
- **React Router:** https://reactrouter.com/
- **TanStack Virtual:** https://tanstack.com/virtual/latest
- **Vite:** https://vitejs.dev/guide/

---

**Status:** Ready for Development
**Last Updated:** 2026-02-02
**Version:** Phase 1 Setup Complete
