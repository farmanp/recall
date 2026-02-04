# GEMINI.md

This file provides context and guidance for Gemini agents working on the Recall project.

## Project: Recall

Recall is a local-first web application that visualizes Claude Code sessions like a video player. It reads from the `claude-mem` SQLite database (`~/.claude-mem/claude-mem.db`) in read-only mode to visualize how features were built, decisions made, and problems solved.

## 🎯 Current Status (Phase 1)

- **Backend**: ✅ Complete. Express + TypeScript + SQLite API is functional. Includes transcript import services and file watching.
- **Frontend**: 🚧 In Progress. React + Vite project initialized with core dependencies (Zustand, TanStack Query, etc.).
- **Validation**: ✅ Phase 0 Timeline Validation passed all checks.

## 🏗️ Architecture

### Tech Stack
- **Backend**: Node.js, Express, TypeScript, better-sqlite3, Vitest (Testing), Chokidar (File Watching)
- **Frontend**: React, Vite, TypeScript, Tailwind CSS
  - **State**: Zustand (Global), TanStack Query (Server)
  - **Routing**: React Router
  - **UI**: TanStack Virtual (Performance), PrismJS (Syntax Highlighting), React Diff View
- **Database**:
  - `claude-mem.db`: Main session data (read-only)
  - `transcript-*.db`: Imported raw transcripts

### Key Components
- **Backend Services**:
  - `TranscriptImporter`: Handles parsing and importing of raw session transcripts.
  - `FileWatcher`: Monitors file changes during sessions.
- **Timeline Ordering**: Events are sorted using a specific TIME-FIRST algorithm: `ts ASC -> prompt_number ASC -> kind_rank ASC -> row_id ASC`.

## 🛠️ Commands

### Backend
```bash
cd backend
npm install          # Install dependencies
npm run dev          # Start dev server (port 3001)
npm run build        # Compile TypeScript
npm test             # Run Vitest tests
npm run import       # Import transcripts CLI (using ts-node)
```

### Frontend
```bash
cd frontend
npm install          # Install dependencies
npm run dev          # Start dev server (port 5174)
npm run build        # Build for production
npm run lint         # Run ESLint
```

### Testing
```bash
# Validate Timeline (Phase 0)
node validate_timeline.js

# Test API Health
curl http://localhost:3001/api/health
```

## 📜 Development Rules

1.  **Read-Only Database**: NEVER modify `~/.claude-mem/claude-mem.db`. Open it in read-only mode.
2.  **Local-Only**: This is a local tool. Do not add cloud deployment configurations.
3.  **Strict TypeScript**: Manifest strict type safety. No `any` unless absolutely necessary and documented.
4.  **Formatting**: Follow the existing code style.

## 📂 Directory Structure

- `backend/`
    - `src/db/`: Database connection and queries
    - `src/routes/`: API routes (`sessions.ts`, `commentary.ts`, `import.ts`)
    - `src/services/`: Core logic (`transcript-importer.ts`, `file-watcher.ts`)
    - `src/parser/`: Parsing logic for transcripts
- `frontend/`
    - `src/api/`: API clients
    - `src/components/`: Reusable UI components
    - `src/pages/`: Application pages / wrappers
    - `src/stores/`: State management (Zustand)
    - `src/hooks/`: Custom React hooks
- `docs/`: Project documentation and progress summaries
- `validate_timeline.js`: Validation script for session data

## 🚀 Roadmap

1.  **Phase 0**: Validation ✅
2.  **Phase 1**: Backend ✅ & Frontend (In Progress)
3.  **Phase 2**: Playback Controls (Play, pause, speed)
4.  **Phase 3**: Search & Deep Links
5.  **Phase 4**: File Diffs & Export
6.  **Phase 5**: Production Polish
