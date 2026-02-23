# GEMINI.md

This file provides context and guidance for Gemini agents working on the Recall project.

## Project: Recall

Recall is a local-first web application that visualizes coding sessions from various AI agents (Claude Code, Codex, Gemini) like a video player. It enables developers to visualize how features were built, decisions made, and problems solved by replaying the session event-by-event.

## 🎯 Current Status

- **Multi-Agent Support**: ✅ Complete. Supports Claude Code, Codex CLI, and Gemini CLI.
- **Advanced Playback**: ✅ Complete. Video-player interface with timeline, artifacts, and diff views.
- **State Management**: ✅ Complete. Checkpoints, File Rewind, and State Restoration.
- **Collaboration**: ✅ Complete. Session sharing with expiring links and redaction.
- **Intelligence**: ✅ Complete. LLM-powered summaries (Claude 3 Haiku) and heuristic analysis.
- **Git Integration**: ✅ Complete. Context tracking, commit correlation, and drift analysis.
- **Search & Organization**: ✅ Complete. FTS5 search, Work Unit grouping, and CWD filtering.

## 🏗️ Architecture

### Tech Stack

- **Backend**: Node.js, Express, TypeScript, `better-sqlite3`, `lru-cache`, `zod`, `@anthropic-ai/sdk`, `chokidar`
- **Frontend**: React, Vite, TypeScript, Tailwind CSS v3
  - **State**: `zustand` (Global), `TanStack Query` (Server)
  - **Routing**: `react-router-dom` v7
  - **UI**: `TanStack Virtual`, `PrismJS`, `react-diff-view`, `framer-motion`, `lucide-react`
- **Database**:
  - `claude-mem.db`: Read-only access to Claude-mem observations.
  - `transcripts.db`: Read-write database for parsed frames, indexing, and checkpoints.

### Key Layers & Components

- **Parser Layer**:
  - `AgentDetector` & `ParserFactory`: Handles multi-agent format detection.
  - `SessionIndexer`: Scans and indexes sessions.
  - `TimelineBuilder`: Normalizes events into a linear timeline.
- **Services Layer**:
  - **State**: `CheckpointManager`, `RewindEngine` (File restoration).
  - **Analysis**: `DriftAnalyzer`, `GitExtractor`, `TokenAttribution`.
  - **Content**: `Summarizer`, `LlmSummaryGenerator`, `ShareLinks`.
  - **System**: `FileWatcher`, `TranscriptImporter`.
- **Frontend**:
  - **Pages**: `SessionPlayerPage` (Main player), `SessionListPage`, `WorkUnitListPage`.
  - **Components**: `TimelineScrubber`, `DiffViewer`, `ArtifactsPanel`.

## 🛠️ Commands

### Root

```bash
npm install          # Install all dependencies
npm run build        # Full build (Backend + Frontend)
npm start            # Start production server
npm test             # Run all tests
npm publish          # Full release workflow
```

### Backend

```bash
cd backend
npm run dev          # Start dev server (port 3001)
npm run build        # Compile TypeScript
npm test             # Run Vitest suite
npm run import       # CLI for transcript import
npm run recall       # CLI for recall-specific utilities
```

### Frontend

```bash
cd frontend
npm run dev          # Start Vite dev server (port 5174)
npm run build        # Build React app
npm run lint         # Run ESLint
npm run test:e2e     # Run Playwright E2E tests
```

## ⚙️ Configuration

### Environment Variables

- **Filtering**:
  - `RECALL_FILTER_CWD`: Filter sessions by startup directory (default: `true`).
  - `RECALL_EXCLUDE_PATTERNS`: Glob patterns to exclude (e.g., `**/test-data/**`).
- **Server**:
  - `PORT`: Server port (default: `3001`).
  - `RECALL_VIEWER_MODE`: Start in read-only mode (default: `false`).
- **AI & Sharing**:
  - `RECALL_ANTHROPIC_API_KEY`: API key for summaries.
  - `RECALL_SHARE_SIGNING_KEY`: Key for signing share links.

## 📜 Development Rules

1.  **Read-Only Sources**: NEVER modify `~/.claude-mem/` or original agent `.jsonl` files.
2.  **Local-First**: Keep the app strictly local. No external analytics.
3.  **Strict Typing**: Full TypeScript usage. No `any`. Zod for validation.
4.  **UI Aesthetics**: "Cinematic Technical" - dark mode, vibrant accents, smooth motion.
5.  **Testing**: Maintain high coverage with Vitest (Unit) and Playwright (E2E).

## 📂 Directory Structure

- `backend/src/`
  - `db/`: Schemas and migrations.
  - `parser/`: Agent-specific parsers (`claude`, `codex`, `gemini`).
  - `routes/`: API endpoints (`sessions`, `rewind`, `checkpoints`, `git`).
  - `services/`: Core logic (`checkpoint-manager`, `rewind-engine`, `drift-analyzer`).
- `frontend/src/`
  - `api/`: Type-safe Query hooks.
  - `components/`: UI library.
  - `e2e/`: Playwright tests.
  - `pages/`: Route views.
  - `stores/`: Zustand state.
- `shared/`: Shared types (Frontend <-> Backend contract).

## 🚀 Roadmap

1.  **Phase 1-4**: Core Playback, Search, Work Units ✅
2.  **Phase 5**: Advanced State (Checkpoints, Rewind, Git) ✅
3.  **Phase 6**: User Annotations, Polish, & Release 🔄 (Current Focus)
