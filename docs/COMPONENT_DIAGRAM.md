# Component Architecture Visual Diagrams

**Project:** Recall
**Date:** 2026-02-02

---

## Component Tree (Phase 1)

```
┌─────────────────────────────────────────────────────────────┐
│                         App.tsx                              │
│                    (React Router)                            │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┴────────────────────┐
        │                                        │
        ▼                                        ▼
┌────────────────────┐              ┌──────────────────────────┐
│ SessionListPage    │              │ SessionPlayerPage        │
│ Route: /           │              │ Route: /session/:id      │
└────────────────────┘              └──────────────────────────┘
        │                                        │
        │ ┌──────────────────┐                  │ ┌──────────────────┐
        └─┤ SessionList      │                  └─┤ SessionPlayer    │
          │ (virtualized)    │                    │                  │
          └──────────────────┘                    └──────────────────┘
                 │                                         │
                 │                                         │
          ┌──────┴────────┐                    ┌──────────┴─────────┐
          │               │                    │                    │
          ▼               ▼                    ▼                    ▼
   ┌─────────────┐  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
   │SessionCard  │  │SessionCard  │    │EventTimeline│    │[FilePanel]  │
   │             │  │             │    │(virtualized)│    │  (Phase 2)  │
   └─────────────┘  └─────────────┘    └─────────────┘    └─────────────┘
                                              │
                                    ┌─────────┴─────────┐
                                    │                   │
                                    ▼                   ▼
                            ┌──────────────┐    ┌──────────────┐
                            │EventDisplay  │    │EventDisplay  │
                            └──────────────┘    └──────────────┘
                                    │                   │
                        ┌───────────┴───┐   ┌───────────┴───┐
                        ▼               ▼   ▼               ▼
                  ┌──────────┐   ┌──────────┐   ┌──────────┐
                  │PromptCard│   │PromptCard│   │ObsCard   │
                  └──────────┘   └──────────┘   └──────────┘
```

---

## Data Flow (Session List)

```
┌───────────────────────────────────────────────────────────────┐
│                      SessionListPage                          │
│                                                               │
│  1. componentDidMount / useEffect                             │
│     └─> fetchSessions({ offset: 0, limit: 20 })             │
│                                                               │
│  2. State:                                                    │
│     - sessions: Session[]                                     │
│     - total: number                                           │
│     - offset: number                                          │
│     - loading: boolean                                        │
│     - error: Error | null                                     │
└───────────────────────────────────────────────────────────────┘
                            │
                            │ Pass props
                            ▼
┌───────────────────────────────────────────────────────────────┐
│                        SessionList                            │
│                                                               │
│  Props:                                                       │
│    - sessions: Session[]                                      │
│    - total: number                                            │
│    - onLoadMore: () => void                                   │
│    - loading: boolean                                         │
│                                                               │
│  Virtualization:                                              │
│    - useVirtualizer({ count: total })                         │
│    - Renders only visible sessions                            │
│    - Detects bottom scroll → onLoadMore()                     │
└───────────────────────────────────────────────────────────────┘
                            │
                            │ Map sessions
                            ▼
┌───────────────────────────────────────────────────────────────┐
│                      SessionCard (×N)                         │
│                                                               │
│  Props:                                                       │
│    - session: Session                                         │
│    - onClick: (sessionId) => navigate(`/session/${id}`)       │
│                                                               │
│  Displays:                                                    │
│    - Project name                                             │
│    - Started timestamp                                        │
│    - First prompt preview                                     │
│    - Prompt counter                                           │
│    - Session duration                                         │
│    - Status indicator (active/completed)                      │
└───────────────────────────────────────────────────────────────┘
```

---

## Data Flow (Session Player)

```
┌───────────────────────────────────────────────────────────────┐
│                    SessionPlayerPage                          │
│                                                               │
│  1. Get sessionId from URL params                             │
│  2. Parallel fetch:                                           │
│     ├─> fetchSessionDetails(sessionId)                        │
│     └─> fetchSessionEvents(sessionId, { offset: 0, limit: 100 })│
│                                                               │
│  3. State:                                                    │
│     - session: Session | null                                 │
│     - events: SessionEvent[]                                  │
│     - totalEvents: number                                     │
│     - offset: number                                          │
│     - loading: boolean                                        │
│     - error: Error | null                                     │
└───────────────────────────────────────────────────────────────┘
                            │
                            │ Pass props
                            ▼
┌───────────────────────────────────────────────────────────────┐
│                      SessionPlayer                            │
│                                                               │
│  Props:                                                       │
│    - session: Session                                         │
│    - events: SessionEvent[]                                   │
│    - totalEvents: number                                      │
│    - onLoadMoreEvents: () => void                             │
│                                                               │
│  Layout:                                                      │
│    ├─ [PlaybackControls] (Phase 2)                            │
│    ├─ [Timeline] (Phase 2)                                    │
│    ├─ EventTimeline (main)                                    │
│    └─ [FilePanel] (Phase 2)                                   │
└───────────────────────────────────────────────────────────────┘
                            │
                            │ Pass events
                            ▼
┌───────────────────────────────────────────────────────────────┐
│                      EventTimeline                            │
│                                                               │
│  Props:                                                       │
│    - events: SessionEvent[]                                   │
│    - totalEvents: number                                      │
│    - onLoadMore: () => void                                   │
│                                                               │
│  Virtualization:                                              │
│    - useVirtualizer({ count: totalEvents })                   │
│    - Dynamic heights (expanded vs collapsed)                  │
│    - Detects bottom scroll → onLoadMore()                     │
│                                                               │
│  State:                                                       │
│    - expandedEvents: Set<number>                              │
└───────────────────────────────────────────────────────────────┘
                            │
                            │ Map events
                            ▼
┌───────────────────────────────────────────────────────────────┐
│                     EventDisplay (×N)                         │
│                                                               │
│  Props:                                                       │
│    - event: SessionEvent                                      │
│    - index: number                                            │
│    - expanded: boolean                                        │
│    - onToggleExpand: () => void                               │
│                                                               │
│  Routing Logic:                                               │
│    if (event.event_type === 'prompt')                         │
│      → render <PromptCard />                                  │
│    else                                                       │
│      → render <ObservationCard />                             │
└───────────────────────────────────────────────────────────────┘
```

---

## Phase 2 Enhanced Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      SessionPlayer                           │
│                                                              │
│  Zustand Store:                                              │
│    - currentEventIndex: number                               │
│    - isPlaying: boolean                                      │
│    - speed: 0.5 | 1 | 2 | 5                                  │
│                                                              │
│  Auto-advance Logic:                                         │
│    useEffect(() => {                                         │
│      if (isPlaying) {                                        │
│        const delay = calculateDelay(event, speed);           │
│        setTimeout(() => nextEvent(), delay);                 │
│      }                                                        │
│    }, [isPlaying, currentEventIndex, speed]);               │
└─────────────────────────────────────────────────────────────┘
        │
        ├──────────────────────┬──────────────────┬──────────────┐
        │                      │                  │              │
        ▼                      ▼                  ▼              ▼
┌──────────────┐    ┌──────────────┐    ┌─────────────┐  ┌─────────────┐
│PlaybackCtrls │    │Timeline      │    │EventTimeline│  │FilePanel    │
│              │    │              │    │             │  │             │
│- Play/Pause  │    │- Scrubber    │    │- Highlights │  │- File list  │
│- Speed       │    │- Chapters    │    │  current    │  │- Read/Mod   │
│- Prev/Next   │    │- Click seek  │    │- Auto-scroll│  │  counts     │
│- Keyboard    │    │- Hover       │    │             │  │- Filtered   │
└──────────────┘    └──────────────┘    └─────────────┘  └─────────────┘
```

---

## State Management Layers

```
┌────────────────────────────────────────────────────────────────┐
│                     Component State (useState)                  │
│                                                                 │
│  Scope: Single component                                       │
│  Examples:                                                      │
│    - expanded/collapsed                                         │
│    - hover state                                                │
│    - form inputs                                                │
│    - loading skeleton                                           │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│                     Page State (useState)                       │
│                                                                 │
│  Scope: Page component + children                              │
│  Examples:                                                      │
│    - sessions: Session[]                                        │
│    - events: SessionEvent[]                                     │
│    - loading: boolean                                           │
│    - error: Error | null                                        │
│    - pagination: { offset, limit }                              │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│                  Shared State (Zustand) - Phase 2               │
│                                                                 │
│  Scope: Cross-component, cross-route                           │
│  Examples:                                                      │
│    - playbackStore:                                             │
│      - currentEventIndex: number                                │
│      - isPlaying: boolean                                       │
│      - speed: number                                            │
│    - filterStore (Phase 3):                                     │
│      - observationTypes: Set<ObservationType>                   │
│      - searchQuery: string                                      │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│                    URL State (query params)                     │
│                                                                 │
│  Scope: Shareable, bookmarkable                                │
│  Examples:                                                      │
│    - /session/:sessionId?t=1738507438000  (timestamp)           │
│    - /session/:sessionId?e=15             (event index)         │
│    - /?project=my-project                 (filter)              │
└────────────────────────────────────────────────────────────────┘
```

---

## Virtualization Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                   Viewport (visible area)                        │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ Overscan (5 rows above)                                 │    │
│  ├────────────────────────────────────────────────────────┤    │
│  │ Visible Row 1                                           │ ◄──┼─── Rendered
│  ├────────────────────────────────────────────────────────┤    │
│  │ Visible Row 2                                           │ ◄──┼─── Rendered
│  ├────────────────────────────────────────────────────────┤    │
│  │ Visible Row 3                                           │ ◄──┼─── Rendered
│  ├────────────────────────────────────────────────────────┤    │
│  │ Overscan (5 rows below)                                 │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Not Rendered:                                                  │
│  - Row 0 (above viewport)         ◄─── Virtual placeholder     │
│  - Rows 9+ (below viewport)       ◄─── Virtual placeholder     │
│                                                                  │
│  Total Rows: 127 sessions                                       │
│  Rendered: ~13 rows (visible + overscan)                        │
│  Performance: Constant O(1) regardless of total count           │
└─────────────────────────────────────────────────────────────────┘

Dynamic Row Heights (EventTimeline):

┌──────────────────────────────────────┐
│ Event 1 (collapsed)     80px    ●    │ ◄─── Collapsed
├──────────────────────────────────────┤
│ Event 2 (expanded)                   │
│                                      │
│  Title                               │
│  Subtitle                            │
│  Narrative...                        │ ◄─── Expanded (400px)
│  Files: [file1, file2]               │
│  Concepts: [...]                     │
│                           400px  ●   │
├──────────────────────────────────────┤
│ Event 3 (collapsed)     80px    ●    │ ◄─── Collapsed
└──────────────────────────────────────┘

Virtualizer dynamically adjusts scroll height based on expansion state.
```

---

## API Integration Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend                                 │
│                                                                  │
│  Component                    lib/api.ts                         │
│  ┌─────────┐                ┌──────────────┐                    │
│  │ Page    │  ─────────────►│ fetchSessions│                    │
│  └─────────┘                └──────────────┘                    │
│      │                              │                            │
│      │                              │ HTTP GET                   │
│      │                              ▼                            │
│      │                    ┌──────────────────────────────┐      │
│      │                    │ http://localhost:3001/api/   │      │
│      │                    │   - /sessions                 │      │
│      │                    │   - /sessions/:id             │      │
│      │                    │   - /sessions/:id/events      │      │
│      │                    └──────────────────────────────┘      │
│      │                              │                            │
│      │                              │ Response                   │
│      │                              ▼                            │
│      │                    ┌──────────────┐                       │
│      └────────────────────┤ Update State │                       │
│                           └──────────────┘                       │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    │ (via Vite proxy)
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                          Backend                                 │
│                                                                  │
│  Express Server (port 3001)                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Routes                                                     │  │
│  │  GET /api/sessions         → sessionList(query)           │  │
│  │  GET /api/sessions/:id     → sessionDetails(id)           │  │
│  │  GET /api/sessions/:id/events → sessionEvents(id, query)  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           │                                      │
│                           │ Query                                │
│                           ▼                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Database (better-sqlite3)                                 │  │
│  │  ~/.claude-mem/claude-mem.db                              │  │
│  │    - sdk_sessions                                         │  │
│  │    - user_prompts                                         │  │
│  │    - observations                                         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           │                                      │
│                           │ Results                              │
│                           ▼                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ JSON Response                                             │  │
│  │  { sessions: [...], total: 127, offset: 0, limit: 20 }   │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Responsive Layout

### Mobile (< 768px)

```
┌─────────────────┐
│    Header       │
├─────────────────┤
│  Session Card   │
│                 │
├─────────────────┤
│  Session Card   │
│                 │
├─────────────────┤
│  Session Card   │
│                 │
└─────────────────┘

┌─────────────────┐
│  Back | Title   │
├─────────────────┤
│  Event 1        │
│  (collapsed)    │
├─────────────────┤
│  Event 2        │
│  (expanded)     │
│  - Title        │
│  - Narrative    │
│  - Files        │
├─────────────────┤
│  Event 3        │
└─────────────────┘
```

### Desktop (> 1024px)

```
┌────────────────────────────────────────────────────────────┐
│                     Header                                  │
├────────────────────────────────────────────────────────────┤
│           │             │             │                     │
│  Session  │  Session    │  Session    │  Session            │
│  Card     │  Card       │  Card       │  Card               │
│           │             │             │                     │
├────────────────────────────────────────────────────────────┤
│           │             │             │                     │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│  Back | Title                                   │  Metadata │
├────────────────────────────────────────────────┼───────────┤
│                                                 │           │
│  Event Timeline                                 │  File     │
│  ┌─────────────────────────────────┐            │  Panel    │
│  │ Event 1 (collapsed)             │            │           │
│  ├─────────────────────────────────┤            │  - file1  │
│  │ Event 2 (expanded)              │            │  - file2  │
│  │ - Title                         │            │  - file3  │
│  │ - Narrative...                  │            │           │
│  │ - Files: [...]                  │            │  Stats:   │
│  │ - Concepts: [...]               │            │  R: 15    │
│  ├─────────────────────────────────┤            │  M: 8     │
│  │ Event 3 (collapsed)             │            │           │
│  └─────────────────────────────────┘            │           │
│                                                 │           │
└─────────────────────────────────────────────────┴───────────┘
```

---

**Legend:**
- `│` - Vertical divider
- `├─`, `└─` - Component boundary
- `●` - Expand/collapse indicator
- `◄───` - Annotation arrow
- `[...]` - Placeholder content

