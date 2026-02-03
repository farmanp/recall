# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Recall is a local-first web application that visualizes Claude Code sessions like a video player. It reads from the `claude-mem` SQLite database (`~/.claude-mem/claude-mem.db`) in read-only mode.

## Commands

### Backend (Express + TypeScript + SQLite)

```bash
cd backend
npm install          # Install dependencies
npm run dev          # Development with hot reload (port 3001)
npm run build        # Compile TypeScript
npm start            # Production (from dist/)
npm test             # Run Vitest tests
npm run test:ui      # Tests with UI
npm run test:coverage # Tests with coverage report
npm run import       # Import transcripts CLI
```

### Frontend (React + Vite + TypeScript)

```bash
cd frontend
npm install          # Install dependencies
npm run dev          # Development server (port 5173)
npm run build        # Build for production
npm run lint         # Run ESLint
npm run preview      # Preview production build
```

### Testing the API

```bash
curl http://localhost:3001/api/health
curl 'http://localhost:3001/api/sessions?limit=5'
curl http://localhost:3001/api/sessions/<session_id>
curl 'http://localhost:3001/api/sessions/<session_id>/events?limit=100'
```

## Architecture

### Dual Database System

- **claude-mem database** (`~/.claude-mem/claude-mem.db`): Main session data (sessions, prompts, observations)
- **Transcript database** (`backend/src/db/transcript-*`): Imported raw transcripts for detailed replay

### Backend Layers

1. **Server Layer** (`src/index.ts`, `src/server.ts`): Express app setup, middleware, graceful shutdown
2. **Route Layer** (`src/routes/`): HTTP handlers for sessions, commentary, import
3. **Query Layer** (`src/db/queries.ts`): SQL with TIME-FIRST ordering algorithm
4. **Connection Layer** (`src/db/connection.ts`): SQLite singleton (read-only mode)

### Frontend Structure

- **State**: Zustand for global state, React Query for server state
- **Routing**: React Router with `/` (session list) and `/session/:sessionId` (player)
- **Components**: `src/components/` with specialized viewers (DiffViewer, SyntaxHighlighter)
- **API Client**: `src/api/client.ts` and `src/api/transcriptClient.ts`

### Timeline Ordering Algorithm

Events are sorted using TIME-FIRST ordering:
```sql
ORDER BY
  ts ASC,                              -- PRIMARY: Chronological time
  COALESCE(prompt_number, 999999) ASC, -- SECONDARY: Group by prompt
  kind_rank ASC,                       -- TERTIARY: Prompt before observation
  row_id ASC                           -- FINAL: Stable tiebreaker
```

## Key Constraints

- **Read-only database access**: Never modify the claude-mem database
- **Local-only**: No cloud deployment (session data may contain sensitive info)
- **Parameterized queries**: All SQL uses `?` placeholders (no string concatenation)
- **TypeScript strict mode**: Backend uses strict compiler options
