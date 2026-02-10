# GEMINI.md

This file provides context and guidance for Gemini agents working on the Recall project.

## Project: Recall

Recall is a local-first web application that visualizes coding sessions from various AI agents (Claude Code, Codex, Gemini) like a video player. It enables developers to visualize how features were built, decisions made, and problems solved by replaying the session event-by-event.

## 🎯 Current Status (Phase 4+ in Progress)

- **Multi-Agent Support**: ✅ Complete. Supports Claude Code, Codex CLI, and Gemini CLI session formats with tool name normalization.
- **Work Units**: ✅ Complete. Automatic and manual grouping of related sessions into logical work units.
- **CLAUDE.md History**: ✅ Complete. Tracking and diffing the evolution of `CLAUDE.md` across sessions.
- **Search**: ✅ Complete. FTS5 content-based search across all session transcripts.
- **CWD Filter**: ✅ Complete. Intelligent session filtering based on the directory where the player was started.
- **Backend**: ✅ Production-ready Express + TypeScript + SQLite architecture with dual-database system.
- **Frontend**: ✅ Rich React + Vite UI with Video Player, Chat View, Work Unit dashboard, and Diff views.

## 🏗️ Architecture

### Tech Stack

- **Backend**: Node.js, Express, TypeScript, `better-sqlite3`, `lru-cache`, `vitest` (Testing), `chokidar` (File Watching)
- **Frontend**: React, Vite, TypeScript, Tailwind CSS v3
  - **State**: `zustand` (Global State), `TanStack Query` (Server State)
  - **Routing**: `react-router-dom` v7
  - **UI**: `TanStack Virtual`, `PrismJS`, `react-diff-view`, `framer-motion`, `lucide-react`, `react-markdown`
- **Database**:
  - `claude-mem.db`: Read-only access to Claude-mem observations.
  - `transcripts.db`: Read-write database for parsed frames and indexing. (Located in `~/.recall-player/`)

### Key Layers & Components

- **Parser Layer**:
  - `AgentDetector`: Identifies agent type (Claude, Codex, Gemini) from file structure.
  - `ParserFactory`: Dispatches to specific `AgentParser` implementations (Claude, Codex, Gemini).
  - `BaseParser`: Shared logic for timeline building and frame normalization.
  - `TranscriptParser`: Handles the import into the optimized SQLite schema.
- **Services Layer**:
  - `WorkUnitCorrelator`: Automatically groups sessions by time, project, and context.
  - `FileWatcher`: Monitors agent log directories for real-time indexing.
  - `TranscriptImporter`: Robust bulk and single-file import logic with SQLite corruption recovery.
- **Frontend Pages**:
  - `SessionListPage`: Filterable list of all sessions with infinite scroll and CWD filter banner.
  - `SessionPlayerPage`: The "Video Player" experience with timeline scrubber, artifacts panel, and chat/technical toggle.
  - `WorkUnitListPage`: Dashboard for managing grouped coding tasks.
  - `WorkUnitPlayerPage`: Multi-session playback experience.

## 🛠️ Commands

### Root

```bash
npm install          # Install all dependencies (hoisted to root)
npm run build        # Full build (Backend + Frontend)
npm start            # Start production server
npm publish          # Full release workflow
```

### Backend

```bash
cd backend
npm run dev          # Start dev server with hot reload (port 3001)
npm run build        # Compile TypeScript to dist/
npm test             # Run Vitest suite
npm run import       # CLI for manual transcript import
```

### Frontend

```bash
cd frontend
npm run dev          # Start Vite dev server (port 5173)
npm run build        # Build React app
npm run lint         # Run ESLint & Type check
```

## ⚙️ Configuration

### Environment Variables

- `RECALL_FILTER_CWD`: Set to `false` to disable automatic directory filtering (default: `true`).
- `RECALL_EXCLUDE_PATTERNS`: Comma-separated list of glob patterns to exclude from session scanning (e.g., `thedotmack,**/test-data/**`).

## 📜 Development Rules

1.  **Read-Only Sources**: NEVER modify `~/.claude-mem/` or original agent `.jsonl` files.
2.  **Local-Only**: Keep the app strictly local. Do not add cloud or analytics dependencies.
3.  **Strict Typing**: Every new component or service must be fully typed. Avoid `any`.
4.  **UI Aesthetics**: Maintain the "Cinematic Technical" aesthetic—vibrant colors for event types, smooth Framer Motion transitions, and dark-mode optimization.
5.  **Pattern Persistence**: Follow the existing TIME-FIRST algorithm for event sorting: `ts ASC -> prompt_number ASC -> kind_rank ASC -> row_id ASC`.

## 📂 Directory Structure

- `backend/src/`
  - `db/`: Database schemas and migrations.
  - `parser/`: Multi-agent parsing logic (`claude`, `codex`, `gemini`).
  - `routes/`: API endpoints (`sessions`, `work-units`, `commentary`, `import`).
  - `services/`: Core logic for watchers, importers, and correlation.
- `frontend/src/`
  - `api/`: Type-safe API clients using TanStack Query.
  - `components/`: UI components (Player, Timeline, Diff, Search).
  - `pages/`: Main application views.
  - `stores/`: Zustand state for player and UI preferences.
- `shared/`: Shared types and constants between Frontend and Backend.

## 🚀 Roadmap

1.  **Phase 0-2**: Core Playback & Controls ✅
2.  **Phase 3**: Search, Filters & Agent Support ✅
3.  **Phase 4**: Work Units & CLAUDE.md History ✅
4.  **Phase 5**: Advanced Diffs & Export 🔄 (In Progress)
5.  **Phase 6**: User Annotations & Production Polish ⏳
