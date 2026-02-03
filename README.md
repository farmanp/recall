# Recall

A local-first web application that visualizes Claude Code sessions like a video player, enabling you to watch how features were built, decisions made, and problems solved.

---

## 🎯 Project Status

**Current Phase:** Phase 1 - Backend Complete ✅

**Completed:**
- ✅ Phase 0: Timeline Validation (ALL CHECKS PASSED)
- ✅ Phase 1: Backend API with validated timeline ordering
- ⏳ Phase 1: Frontend (Next step)

---

## 🏗️ Project Structure

```
recall/
├── backend/               # Node.js + Express + SQLite API
│   ├── src/
│   │   ├── db/
│   │   │   ├── connection.ts    # SQLite connection
│   │   │   ├── schema.ts        # TypeScript types
│   │   │   └── queries.ts       # Database queries (validated)
│   │   ├── routes/
│   │   │   └── sessions.ts      # API endpoints
│   │   ├── server.ts            # Express app
│   │   └── index.ts             # Entry point
│   ├── package.json
│   └── tsconfig.json
├── frontend/              # React + TypeScript (TODO)
├── shared/                # Shared types (TODO)
├── docs/                  # Documentation
│   └── PHASE_0_RESULTS.md  # Validation results
└── validate_timeline.js   # Phase 0 validation script

```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ (tested with v22.14.0)
- `claude-mem` installed with recorded sessions (`~/.claude-mem/claude-mem.db`)

### Run Backend Server

```bash
cd backend
npm install
npm run dev
```

Server will start on: `http://localhost:3001`

### Test API

```bash
# Health check
curl http://localhost:3001/api/health

# List sessions
curl 'http://localhost:3001/api/sessions?limit=5'

# Get session details
curl http://localhost:3001/api/sessions/<session_id>

# Get session timeline
curl 'http://localhost:3001/api/sessions/<session_id>/events?limit=100'
```

---

## 📡 API Endpoints

### `GET /api/health`
Health check endpoint

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-02-02T20:00:00.000Z",
  "database": "connected"
}
```

### `GET /api/sessions`
List all sessions with pagination

**Query Parameters:**
- `offset` (number): Skip N sessions (default: 0)
- `limit` (number): Return N sessions (default: 20)
- `project` (string): Filter by project name
- `dateStart` (string): Filter by start date (ISO format)
- `dateEnd` (string): Filter by end date (ISO format)

**Response:**
```json
{
  "sessions": [
    {
      "id": 123,
      "claude_session_id": "uuid",
      "sdk_session_id": "uuid",
      "project": "my-project",
      "user_prompt": "First prompt...",
      "started_at": "2026-02-02T10:00:00.000Z",
      "started_at_epoch": 1738508400000,
      "completed_at": "2026-02-02T11:00:00.000Z",
      "completed_at_epoch": 1738512000000,
      "status": "completed",
      "prompt_counter": 15
    }
  ],
  "total": 127,
  "offset": 0,
  "limit": 20
}
```

### `GET /api/sessions/:id`
Get session metadata and statistics

**Response:**
```json
{
  "session": { /* session object */ },
  "eventCount": 150,
  "promptCount": 15,
  "observationCount": 135
}
```

### `GET /api/sessions/:id/events`
Get session timeline with TIME-FIRST ordering

**Query Parameters:**
- `offset` (number): Skip N events (default: 0)
- `limit` (number): Return N events (default: 100)
- `types` (string): Filter by observation types (comma-separated: "feature,bugfix,decision")
- `afterTs` (number): Get events after timestamp (epoch ms)

**Response:**
```json
{
  "events": [
    {
      "event_type": "prompt",
      "row_id": 1,
      "prompt_number": 1,
      "ts": 1738508400000,
      "text": "User's prompt...",
      "kind_rank": 0
    },
    {
      "event_type": "observation",
      "row_id": 1,
      "prompt_number": 1,
      "ts": 1738508420000,
      "text": "Feature implementation completed",
      "kind_rank": 1,
      "obs_type": "feature",
      "title": "Feature Title",
      "subtitle": "Subtitle",
      "facts": ["fact 1", "fact 2"],
      "narrative": "Full narrative...",
      "concepts": ["concept1", "concept2"],
      "files_read": ["file1.ts", "file2.ts"],
      "files_modified": ["file1.ts"]
    }
  ],
  "total": 150,
  "offset": 0,
  "limit": 100,
  "sessionId": "uuid"
}
```

### `GET /api/sessions/:sessionId/events/:eventType/:eventId`
Get single event details

**Parameters:**
- `sessionId`: Session UUID
- `eventType`: "prompt" or "observation"
- `eventId`: Event row ID

**Response:**
```json
{
  "event_type": "observation",
  "row_id": 123,
  "prompt_number": 5,
  "ts": 1738508400000,
  "text": "Event text",
  "kind_rank": 1,
  "obs_type": "feature",
  "title": "Title",
  /* ... other fields ... */
}
```

---

## 🔬 Phase 0 Validation Results

**Status:** ✅ ALL CHECKS PASSED

**Database Statistics:**
- 127 sessions (88 multi-turn, 39 single-turn)
- 4,915 observations (0% NULL prompt_numbers)
- Perfect ID mapping (0 mismatches)

**Test Sessions:**
- Small session: 11 events ✅
- Large session: 902 events (44 prompts, 858 observations) ✅

**Timeline Ordering Algorithm:**
```sql
ORDER BY
  ts ASC,                                 -- PRIMARY: Chronological time
  COALESCE(prompt_number, 999999) ASC,   -- SECONDARY: Group by prompt
  kind_rank ASC,                          -- TERTIARY: Prompt before obs
  row_id ASC                              -- FINAL: Stable tiebreaker
```

**All validation checks passed:**
1. ✅ Global ID Mapping (127/127 matches)
2. ✅ Monotonic Timestamps (0 violations)
3. ✅ Prompt-Before-Observation Order (0 violations)
4. ✅ No Duplicate Row IDs (0 duplicates)
5. ✅ NULL Prompt Number Analysis (0% NULL)

Full report: `docs/PHASE_0_RESULTS.md`

---

## 🛠️ Development

### Backend

```bash
cd backend

# Development (with hot reload)
npm run dev

# Build
npm run build

# Production
npm start
```

### Testing

```bash
# Run Phase 0 validation
node validate_timeline.js [session_id]

# Test API endpoints
curl http://localhost:3001/api/health
```

### TypeScript Configuration

The backend uses strict TypeScript settings:
- `strict: true`
- `noUnusedLocals: true`
- `noUnusedParameters: true`
- `noImplicitReturns: true`

---

## 📊 Database Schema

The application reads from `~/.claude-mem/claude-mem.db` (read-only mode for safety).

**Key Tables:**
- `sdk_sessions`: Session metadata
- `user_prompts`: User prompts with timestamps
- `observations`: Claude's work observations (feature, bugfix, decision, etc.)

**Data Integrity:**
- `claude_session_id === sdk_session_id` for all sessions
- All observations have valid `prompt_number` values
- Chronological ordering preserved via timestamps

---

## 🎬 Roadmap

### ✅ Phase 0: Timeline Validation (Complete)
- Validation script
- All checks passed
- Data quality verified

### ✅ Phase 1: Backend (Complete)
- Express + TypeScript + SQLite
- API endpoints with pagination
- Validated timeline queries
- JSON field parsing

### ⏳ Phase 1: Frontend (In Progress)
- Vite + React + TypeScript
- Virtualized session list
- Timeline viewer

### 📅 Phase 2: Playback (Planned)
- Video-style controls (play/pause/speed)
- Dead air compression
- Chapter markers
- File context panel

### 📅 Phase 3: Search + Deep Links (Planned)
- Full-text search
- Deep links to specific moments
- Annotations/bookmarks

### 📅 Phase 4: File Diffs + Export (Planned)
- File diffs (when git available)
- Export to Markdown/HTML/JSON

### 📅 Phase 5: Production Polish (Planned)
- Performance optimization
- Documentation
- Deployment options

---

## 🔒 Security

**Database Access:**
- Read-only mode (no writes)
- Local-only (no cloud deployment recommended)
- Database may contain sensitive data (tokens, credentials)

**Recommendations:**
- Keep local-first architecture
- Use deep links only within trusted team
- Do not expose to public internet

---

## 🤝 Contributing

This is a personal project implementing the plan from `~/.claude/plans/ticklish-wishing-moonbeam.md`.

---

## 📝 License

MIT (or your preferred license)

---

## 🙏 Credits

- Built with [Node.js](https://nodejs.org/)
- [Express](https://expressjs.com/) web framework
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) for SQLite
- [claude-mem](https://github.com/anthropics/claude-mem) for session storage

---

**Last Updated:** 2026-02-02
**Version:** Phase 1 (Backend Complete)
