# System Architecture

This document describes the technical architecture of the Recall application.

## Table of Contents

- [Overview](#overview)
- [System Architecture Diagram](#system-architecture-diagram)
- [Backend Architecture](#backend-architecture)
- [Frontend Architecture](#frontend-architecture)
- [Data Flow](#data-flow)
- [API Design Decisions](#api-design-decisions)
- [Timeline Ordering Algorithm](#timeline-ordering-algorithm)
- [Database Schema](#database-schema)
- [Security Considerations](#security-considerations)

---

## Overview

Recall is a **local-first web application** that replays AI coding sessions like a video player. It supports multiple AI coding agents by parsing session files directly from their respective directories.

### Supported Agents

| Agent       | Directory                       | Format |
| ----------- | ------------------------------- | ------ |
| Claude Code | `~/.claude/projects/{project}/` | JSONL  |
| Codex CLI   | `~/.codex/sessions/YYYY/MM/`    | JSONL  |
| Gemini CLI  | `~/.gemini/tmp/{hash}/chats/`   | JSON   |

### Key Design Principles

1. **File-Based Parsing:** Parse session files directly from agent directories (no external database)
2. **Read-Only Access:** Never modify session files
3. **Local-First:** No cloud dependencies, all data stays local
4. **Type Safety:** Strict TypeScript for reliability
5. **Time-First Ordering:** Chronological playback is the primary concern
6. **Performance:** Efficient pagination for large sessions (900+ events)

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Browser                            │
│                                                                 │
│  ┌───────────────────────────────────────────────────────┐    │
│  │              Frontend (React + Vite)                   │    │
│  │                                                         │    │
│  │  ├── SessionList Component                            │    │
│  │  ├── TimelineViewer Component                         │    │
│  │  ├── PlaybackControls Component                       │    │
│  │  └── API Client (fetch)                               │    │
│  └───────────────────────────────────────────────────────┘    │
│                          │                                      │
└──────────────────────────┼──────────────────────────────────────┘
                           │ HTTP/JSON
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                    Backend Server                               │
│                 (Node.js + Express + TypeScript)                │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                   Express Application                    │  │
│  │                                                           │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │           Route Handlers                          │  │  │
│  │  │  ├── GET /api/health                             │  │  │
│  │  │  ├── GET /api/agents                             │  │  │
│  │  │  ├── GET /api/sessions                           │  │  │
│  │  │  ├── GET /api/sessions/:id                       │  │  │
│  │  │  ├── GET /api/sessions/:id/frames                │  │  │
│  │  │  └── GET /api/work-units/*                       │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  │                     │                                    │  │
│  │  ┌──────────────────▼──────────────────────────────┐  │  │
│  │  │          Parser Layer                            │  │  │
│  │  │  ├── AgentDetector (detect agent from path)     │  │  │
│  │  │  ├── ParserFactory (select correct parser)      │  │  │
│  │  │  ├── ClaudeParser (Claude Code JSONL)           │  │  │
│  │  │  ├── CodexParser (Codex CLI JSONL)              │  │  │
│  │  │  ├── GeminiParser (Gemini CLI JSON)             │  │  │
│  │  │  └── SessionIndexer (scan all agent dirs)       │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  │                     │                                    │  │
│  │  ┌──────────────────▼──────────────────────────────┐  │  │
│  │  │        SQLite Cache (session metadata)           │  │  │
│  │  │  (better-sqlite3, local cache only)              │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────────┘  │
│                          │                                     │
└──────────────────────────┼─────────────────────────────────────┘
                           │ File System Access
                           │
┌──────────────────────────▼─────────────────────────────────────┐
│                   Local File System                            │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ ~/.claude/projects/{project}/*.jsonl   (Claude Code)     │ │
│  │ ~/.codex/sessions/YYYY/MM/*.jsonl      (Codex CLI)       │ │
│  │ ~/.gemini/tmp/{hash}/chats/session-*.json (Gemini CLI)   │ │
│  └──────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Backend Architecture

### Technology Stack

- **Runtime:** Node.js 18+
- **Framework:** Express 5.x
- **Language:** TypeScript (strict mode)
- **Database:** SQLite (via better-sqlite3)
- **Dependencies:**
  - `express`: Web framework
  - `cors`: CORS middleware
  - `dotenv`: Environment variables
  - `better-sqlite3`: SQLite driver

### Directory Structure

```
backend/
├── src/
│   ├── db/
│   │   ├── connection.ts      # SQLite cache connection
│   │   └── schema.ts          # TypeScript types
│   ├── parser/
│   │   ├── agent-detector.ts  # Detect agent type from file path
│   │   ├── base-parser.ts     # Abstract base parser class
│   │   ├── claude-parser.ts   # Claude Code JSONL parser
│   │   ├── codex-parser.ts    # Codex CLI JSONL parser
│   │   ├── gemini-parser.ts   # Gemini CLI JSON parser
│   │   ├── parser-factory.ts  # Parser selection factory
│   │   └── session-indexer.ts # Scan and index sessions
│   ├── routes/
│   │   ├── sessions.ts        # Session API routes
│   │   └── work-units.ts      # Work unit API routes
│   ├── services/
│   │   └── work-unit-service.ts # Work unit business logic
│   ├── server.ts              # Express app configuration
│   └── index.ts               # Server entry point
├── dist/                      # Compiled JavaScript
├── package.json
└── tsconfig.json
```

### Architectural Layers

#### 1. Server Layer (`index.ts`, `server.ts`)

**Responsibilities:**

- Start HTTP server
- Handle graceful shutdown (SIGTERM, SIGINT)
- Initialize database connection
- Configure middleware (CORS, JSON parsing, logging)

**Key Features:**

- Graceful shutdown closes database connections
- Request logging for debugging
- Error handling middleware
- Static file serving for frontend (production)

#### 2. Route Layer (`routes/sessions.ts`)

**Responsibilities:**

- Parse HTTP requests
- Validate query parameters
- Call database query functions
- Format JSON responses
- Handle errors with appropriate HTTP status codes

**Design Pattern:**

- Express Router for modular route handling
- Type-safe parameter extraction
- Consistent error response format

#### 3. Parser Layer (`parser/`)

**Responsibilities:**

- Detect agent type from file paths
- Select appropriate parser for each agent format
- Parse session files into unified PlaybackFrame format
- Scan agent directories to discover sessions

**Design Pattern:**

- Factory pattern for parser selection
- Strategy pattern for agent-specific parsing
- Abstract base class for shared parsing logic

**Key Components:**

- `AgentDetector`: Determines agent type (claude, codex, gemini) from file path
- `ParserFactory`: Creates correct parser instance based on agent type
- `BaseParser`: Abstract class with shared JSON/JSONL parsing utilities
- `ClaudeParser`: Parses Claude Code JSONL format
- `CodexParser`: Parses Codex CLI JSONL with nested date directories
- `GeminiParser`: Parses Gemini CLI JSON format
- `SessionIndexer`: Scans all agent directories and indexes sessions

#### 4. Cache Layer (`db/connection.ts`)

**Responsibilities:**

- Cache session metadata for fast listing
- Store session index for quick lookups
- Provide SQLite-based persistence

**Design Pattern:**

- Singleton pattern for connection
- Cache invalidation on session changes
- Local-only storage (no external dependencies)

#### 5. Type Layer (`db/schema.ts`)

**Responsibilities:**

- Define TypeScript interfaces for database rows
- Define API request/response types
- Ensure type safety across layers

---

## Frontend Architecture

### Technology Stack (Planned)

- **Build Tool:** Vite
- **Framework:** React 18+
- **Language:** TypeScript
- **State Management:** React Context + hooks
- **HTTP Client:** Fetch API
- **UI Components:** Custom components (no heavy frameworks)

### Directory Structure (Planned)

```
frontend/
├── src/
│   ├── api/
│   │   └── client.ts          # API client
│   ├── hooks/
│   │   ├── useSessions.ts     # Session list hook
│   │   ├── useSession.ts      # Single session hook
│   │   └── useTimeline.ts     # Timeline events hook
│   ├── components/
│   │   ├── SessionList/
│   │   ├── TimelineViewer/
│   │   ├── PlaybackControls/
│   │   └── EventCard/
│   ├── App.tsx
│   └── main.tsx
├── index.html
└── vite.config.ts
```

### Component Architecture

#### 1. SessionList Component

**Responsibilities:**

- Display paginated list of sessions
- Filter by project, date range
- Navigate to session detail view

**State:**

- `sessions: Session[]`
- `loading: boolean`
- `filters: { project?, dateStart?, dateEnd? }`

#### 2. TimelineViewer Component

**Responsibilities:**

- Display chronological timeline of events
- Virtualized scrolling for large sessions
- Event type filtering (prompts, observations)
- Jump to specific timestamps

**State:**

- `events: SessionEvent[]`
- `currentEventIndex: number`
- `filters: { types? }`

#### 3. PlaybackControls Component

**Responsibilities:**

- Play/pause/speed controls
- Seek to event
- Progress bar
- Dead air compression toggle

**State:**

- `isPlaying: boolean`
- `playbackSpeed: 1x | 2x | 4x`
- `currentTime: number`

---

## Data Flow

### 1. Session List Flow

```
User opens app
    │
    ▼
Frontend: Render SessionList component
    │
    ▼
Frontend: useSessions() hook calls API
    │
    ▼
API: GET /api/sessions?limit=20&offset=0
    │
    ▼
Backend: Route handler parses query params
    │
    ▼
Backend: getSessions({ limit: 20, offset: 0 })
    │
    ▼
Database: SELECT * FROM sdk_sessions ORDER BY started_at_epoch DESC LIMIT 20
    │
    ▼
Backend: Return { sessions: [...], total: 127, offset: 0, limit: 20 }
    │
    ▼
Frontend: Display session cards
    │
    ▼
User clicks session card → Navigate to timeline
```

### 2. Timeline Playback Flow

```
User clicks session
    │
    ▼
Frontend: Navigate to /session/:id
    │
    ▼
Frontend: useTimeline(sessionId) hook calls API
    │
    ▼
API: GET /api/sessions/:id/events?limit=100&offset=0
    │
    ▼
Backend: getSessionEvents(sessionId, { limit: 100, offset: 0 })
    │
    ▼
Database: Execute TIME-FIRST timeline query (UNION of prompts + observations)
    │
    ▼
Backend: Parse JSON fields (facts, concepts, files)
    │
    ▼
Backend: Return { events: [...], total: 150, offset: 0, limit: 100 }
    │
    ▼
Frontend: Render timeline with first 100 events
    │
    ▼
User scrolls near bottom → Load more events (offset: 100)
    │
    ▼
Frontend: Display all events in virtualized list
    │
    ▼
User clicks Play → Autoplay timeline with intervals
```

---

## API Design Decisions

### 1. Pagination Strategy

**Decision:** Use offset/limit pagination (not cursor-based)

**Rationale:**

- Simple to implement
- Works well with SQL OFFSET/LIMIT
- Sufficient for local-only app (no distributed systems concerns)
- Total count is cheap to compute for small dataset (127 sessions)

**Tradeoff:**

- Offset pagination can be slow for very large offsets
- Not suitable for real-time data (but our data is static)

### 2. JSON Field Parsing

**Decision:** Parse JSON fields in backend, not frontend

**Rationale:**

- Centralized error handling
- Type safety at API boundary
- Frontend gets clean, typed arrays

**Implementation:**

```typescript
// Backend parses:
facts: '["fact1", "fact2"]' → ["fact1", "fact2"]

// Frontend receives:
interface SessionEvent {
  facts?: string[]; // Already parsed
}
```

### 3. Session Identification

**Decision:** Use `claude_session_id` (UUID) as primary identifier, not row `id`

**Rationale:**

- Stable across database migrations
- Matches claude-mem's design
- Row IDs are internal to SQLite

**Validation:**

- Phase 0 verified `claude_session_id === sdk_session_id` for all 127 sessions

### 4. Error Handling

**Decision:** Return structured error responses with HTTP status codes

**Format:**

```json
{
  "error": "Human-readable error type",
  "message": "Detailed error message"
}
```

**Status Codes:**

- `200 OK`: Success
- `400 Bad Request`: Invalid parameters
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server/database errors

### 5. CORS Policy

**Decision:** Enable CORS for all origins (development-friendly)

**Rationale:**

- Frontend runs on different port during development (Vite: 5173, Backend: 3001)
- No security concern for local-only app

**Production Consideration:**

- Restrict CORS to specific origins if deploying

---

## Timeline Ordering Algorithm

### The Problem

Sessions contain two event types:

1. **User prompts** (questions/requests from user)
2. **Observations** (Claude's work: features, fixes, decisions)

**Requirements:**

1. Events must be chronologically ordered
2. Prompts must appear before their observations
3. Order must be stable and deterministic
4. Must handle edge cases (same timestamps, NULL prompt_numbers)

### The Solution: TIME-FIRST Ordering

**SQL Query:**

```sql
SELECT * FROM (
  -- Prompts
  SELECT
    'prompt' as event_type,
    p.id as row_id,
    p.prompt_number,
    p.created_at_epoch as ts,
    p.prompt_text as text,
    0 as kind_rank  -- Prompts have rank 0
  FROM user_prompts p
  WHERE p.claude_session_id = ?

  UNION ALL

  -- Observations
  SELECT
    'observation' as event_type,
    o.id as row_id,
    o.prompt_number,
    o.created_at_epoch as ts,
    COALESCE(o.title, o.narrative, o.text) as text,
    1 as kind_rank  -- Observations have rank 1
  FROM observations o
  WHERE o.sdk_session_id = ?
) combined

ORDER BY
  ts ASC,                              -- PRIMARY: Chronological time
  COALESCE(prompt_number, 999999) ASC, -- SECONDARY: Group by prompt
  kind_rank ASC,                       -- TERTIARY: Prompt before observation
  row_id ASC                           -- FINAL: Stable tiebreaker
```

### Ordering Logic Explanation

#### Level 1: Time First (`ts ASC`)

**Primary sort:** Chronological order by timestamp

```
Event A (ts: 1000) → Event B (ts: 1001) → Event C (ts: 1002)
```

**Why:** Sessions are meant to be watched chronologically

#### Level 2: Prompt Grouping (`COALESCE(prompt_number, 999999) ASC`)

**Secondary sort:** Group events by prompt number

```
ts: 1000
  ├── Prompt #1 (prompt_number: 1)
  └── Obs #1 (prompt_number: 1)

ts: 1001
  └── Obs #2 (prompt_number: NULL → 999999)  # Unattributed
```

**Why:**

- Events with same timestamp should be grouped by prompt
- NULL prompt_numbers sort last (999999)

#### Level 3: Kind Rank (`kind_rank ASC`)

**Tertiary sort:** Prompts before observations

```
ts: 1000, prompt_number: 1
  ├── Prompt (kind_rank: 0) ← Appears first
  └── Observation (kind_rank: 1)
```

**Why:**

- User must ask before Claude responds
- Maintains logical narrative flow

#### Level 4: Row ID (`row_id ASC`)

**Final tiebreaker:** Stable sort for deterministic results

**Why:**

- Ensures same query always returns events in same order
- Needed for pagination consistency

### Validation Results

**Phase 0 validation tested this algorithm on:**

- Small session: 11 events ✅
- Large session: 902 events (44 prompts, 858 observations) ✅

**All checks passed:**

1. ✅ Monotonic timestamps (no decreases)
2. ✅ Prompts before observations (for same timestamp)
3. ✅ No duplicate row IDs
4. ✅ Stable ordering across queries

---

## Session File Formats

The application parses session files directly from agent directories:

### Claude Code (JSONL)

**Location:** `~/.claude/projects/{project}/*.jsonl`

**Format:** One JSON event per line

```json
{"type": "user", "message": {"content": "Help me with..."}, "timestamp": "2026-02-04T10:00:00Z"}
{"type": "assistant", "message": {"content": "I'll help..."}, "timestamp": "2026-02-04T10:00:05Z"}
{"type": "tool_use", "tool": "Read", "input": {"file_path": "/path/to/file"}}
{"type": "tool_result", "content": "File contents..."}
```

### Codex CLI (JSONL)

**Location:** `~/.codex/sessions/YYYY/MM/*.jsonl`

**Format:** Wrapped events with `{type, payload}` structure

```json
{"type": "message", "payload": {"role": "user", "content": "..."}}
{"type": "message", "payload": {"role": "assistant", "content": "..."}}
{"type": "tool_call", "payload": {"name": "shell", "arguments": {...}}}
```

### Gemini CLI (JSON)

**Location:** `~/.gemini/tmp/{hash}/chats/session-*.json`

**Format:** Single JSON file with conversation array

```json
{
  "messages": [
    { "role": "user", "parts": [{ "text": "..." }] },
    { "role": "model", "parts": [{ "text": "..." }] }
  ]
}
```

### Unified PlaybackFrame Format

All parsers convert to a unified `PlaybackFrame` format:

```typescript
interface PlaybackFrame {
  index: number;
  timestamp: string;
  type: 'user_message' | 'assistant_message' | 'tool_use' | 'tool_result';
  content: {
    text?: string;
    tool?: string;
    input?: object;
    output?: string;
  };
}
```

---

## Security Considerations

### 1. Read-Only File Access

**Implementation:**

- Session files are opened in read-only mode
- The application never writes to agent directories
- Only the local SQLite cache is writable

**Rationale:**

- Prevents accidental data modification
- Protects original session files from corruption
- No risk of corrupting user's session history

### 2. Local-Only Architecture

**Constraints:**

- No cloud deployment
- No external API calls
- All data stays on local machine

**Rationale:**

- Session data may contain sensitive information:
  - API keys in prompts
  - Credentials in code
  - Private file paths
  - Business logic
- Local-first prevents data leaks

### 3. SQL Injection Prevention

**Implementation:**

```typescript
// Good: Parameterized query (for local cache)
db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);

// Bad: String concatenation (vulnerable)
db.prepare(`SELECT * FROM sessions WHERE id = ${sessionId}`).get();
```

**All cache queries use parameterized statements** via `?` placeholders.

### 4. JSON/JSONL Parsing Safety

**Implementation:**

```typescript
function tryParseJSON(jsonString: string): object | undefined {
  try {
    return JSON.parse(jsonString);
  } catch {
    return undefined; // Fail gracefully
  }
}

function parseJSONL(content: string): object[] {
  return content
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => tryParseJSON(line))
    .filter(Boolean);
}
```

**Rationale:**

- Malformed JSON in session files won't crash the app
- Type checking after parsing ensures safety
- Invalid lines are skipped gracefully

### 5. Error Exposure

**Decision:** Don't expose database paths or internal errors to client

**Implementation:**

```typescript
try {
  // ...
} catch (error) {
  console.error('Error:', error); // Server logs
  res.status(500).json({
    error: 'Internal server error',
    message: error instanceof Error ? error.message : 'Unknown error',
  });
}
```

**Rationale:**

- Prevents information disclosure
- Keeps error details server-side

---

## Performance Considerations

### 1. Database Connection Pooling

**Strategy:** Singleton connection (not connection pool)

**Rationale:**

- SQLite doesn't support concurrent writes
- Read-only mode is thread-safe
- Single connection is sufficient for local-only app

### 2. Pagination

**Strategy:** OFFSET/LIMIT pagination

**Performance:**

- Sessions: Fast (127 total)
- Events: Efficient for sessions with <1000 events
- Timeline query optimized with proper indexes

**Future Optimization:**

- Add indexes on `created_at_epoch` if query slows down
- Consider cursor-based pagination for very large sessions

### 3. JSON Field Parsing

**Strategy:** Parse on-demand (not upfront)

**Implementation:**

- Parse only when events are fetched
- Return `undefined` for malformed JSON (no retries)

---

## Future Architecture Considerations

### Phase 2: Playback Features

**New Components:**

- Playback engine with intervals
- Dead air compression algorithm
- Chapter marker extraction

**Backend Changes:**

- Add endpoint: `GET /api/sessions/:id/chapters`
- Calculate dead air gaps in timeline

### Phase 3: Search

**New Features:**

- Full-text search across observations
- Filter by file, concept, observation type

**Backend Changes:**

- Add SQLite FTS5 virtual table (or use LIKE queries)
- New endpoint: `GET /api/search?q=...`

### Phase 4: File Diffs

**New Features:**

- Show file changes when git history available

**Backend Changes:**

- Integrate with git (read-only)
- New endpoint: `GET /api/sessions/:id/diffs`

---

## Deployment Architecture (Local-Only)

### Development

```
Frontend (Vite):   http://localhost:5173
Backend (Express): http://localhost:3001
Session Files:     ~/.claude/, ~/.codex/, ~/.gemini/
```

### Production (Local)

```
Static Frontend:   Served by Express from /public
Backend (Express): http://localhost:3001
Session Files:     ~/.claude/, ~/.codex/, ~/.gemini/
```

**Build Process:**

1. Build frontend: `cd frontend && npm run build`
2. Copy build to `backend/public/`
3. Start backend: `cd backend && npm start`
4. Open browser: `http://localhost:3001`

---

## Technology Choices Rationale

### Why Express (not Fastify/Hono)?

- Mature ecosystem
- Excellent TypeScript support
- Simple for read-only API

### Why better-sqlite3 (not node-sqlite3)?

- Synchronous API (simpler code)
- Better performance
- TypeScript-friendly

### Why TypeScript strict mode?

- Catches errors at compile time
- Self-documenting code
- Better IDE support

### Why React (not Vue/Svelte)?

- Large ecosystem
- Excellent TypeScript support
- Familiar to most developers

### Why Vite (not Webpack)?

- Faster dev server
- Simpler configuration
- Native ES modules

---

**Last Updated:** 2026-02-02
**Version:** Phase 1 (Backend Complete)
