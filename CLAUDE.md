# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Recall is a local-first web application that replays AI coding sessions like a video player. It supports multiple AI coding agents:

- **Claude Code** - Sessions from `~/.claude/projects/`
- **Codex CLI** - Sessions from `~/.codex/sessions/`
- **Gemini CLI** - Sessions from `~/.gemini/tmp/`

## Quick Start

```bash
# Run via npx (recommended)
npx recall-player

# Or install globally
npm install -g recall-player
recall
```

## Development Commands

### Backend (Express + TypeScript)

```bash
cd backend
npm install          # Install dependencies
npm run dev          # Development with hot reload (port 3001)
npm run build        # Compile TypeScript
npm start            # Production (from dist/)
npm test             # Run Vitest tests
npm run test:ui      # Tests with UI
npm run test:coverage # Tests with coverage report
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

### Full Build & Publish

```bash
npm run build        # Build backend + frontend
npm start            # Start production server
npm publish          # Publish to npm
```

## Publishing Process

### Pre-Release Checklist

1. **Run tests** to ensure nothing is broken:

   ```bash
   cd backend && npm test
   cd frontend && npm test
   ```

2. **Update version** in `package.json` following semver:
   - `patch` (1.0.x): Bug fixes
   - `minor` (1.x.0): New features (backward compatible)
   - `major` (x.0.0): Breaking changes

3. **Update CHANGELOG.md** with the new version and changes:

   ```markdown
   ## [x.y.z] - YYYY-MM-DD

   ### Added

   - New features

   ### Changed

   - Changes to existing features

   ### Fixed

   - Bug fixes
   ```

4. **Commit and push** the version bump and changelog:
   ```bash
   git add package.json CHANGELOG.md
   git commit -m "chore: bump version to x.y.z and update changelog"
   git push
   ```

### Publishing to npm

```bash
# Build everything (runs automatically via prepublishOnly)
npm run build

# Publish to npm registry
npm publish

# Verify the publish
npx recall-player --version
```

### Post-Publish

- Test installation: `npx recall-player`
- Create GitHub release (optional) with changelog notes

### Testing the API

```bash
curl http://localhost:3001/api/health
curl http://localhost:3001/api/agents                    # List agents with counts
curl 'http://localhost:3001/api/sessions?agent=claude'   # Filter by agent
curl 'http://localhost:3001/api/sessions/<id>/frames'    # Get session frames
```

## Architecture

### Multi-Agent Parser System

The parser system uses a factory pattern to handle different agent formats:

```
File Path → AgentDetector → ParserFactory → AgentParser → PlaybackFrames
```

**Parser files** (`backend/src/parser/`):

- `agent-detector.ts` - Detects agent type from file path
- `base-parser.ts` - Abstract base class with shared parsing logic
- `claude-parser.ts` - Claude Code JSONL format
- `codex-parser.ts` - Codex CLI JSONL format (with nested date directories)
- `gemini-parser.ts` - Gemini CLI JSON format
- `parser-factory.ts` - Selects appropriate parser based on agent type
- `session-indexer.ts` - Scans and indexes sessions from all agents

### Backend Layers

1. **Server Layer** (`src/index.ts`, `src/server.ts`): Express app, static file serving, graceful shutdown
2. **Route Layer** (`src/routes/sessions.ts`): API handlers with agent filtering
3. **Parser Layer** (`src/parser/`): Multi-agent session parsing
4. **Database Layer** (`src/db/`): SQLite with session caching

### Frontend Structure

- **State**: Zustand for global state, React Query for server state
- **Routing**: React Router with `/` (session list) and `/session/:sessionId` (player)
- **Components**: `src/components/` with specialized viewers (DiffViewer, SyntaxHighlighter)
- **Pages**: `SessionListPage` with agent filter tabs, `SessionPlayerPage` with playback controls

### Session File Formats

| Agent  | Directory                       | Format | Notes                     |
| ------ | ------------------------------- | ------ | ------------------------- |
| Claude | `~/.claude/projects/{project}/` | JSONL  | One event per line        |
| Codex  | `~/.codex/sessions/YYYY/MM/`    | JSONL  | `{type, payload}` wrapper |
| Gemini | `~/.gemini/tmp/{hash}/chats/`   | JSON   | `session-*.json` files    |

## Key Constraints

- **Read-only file access**: Never modify session files
- **Local-only**: No cloud deployment (sessions may contain sensitive data)
- **TypeScript strict mode**: Both backend and frontend use strict compiler options
- **Parameterized queries**: All SQL uses `?` placeholders (no string concatenation)

## Adding a New Agent

1. Create `backend/src/parser/{agent}-parser.ts` extending `BaseParser`
2. Add agent type to `AgentDetector.detectAgent()`
3. Register parser in `ParserFactory`
4. Add directory scanning in `SessionIndexer`
5. Add filter tab in `frontend/src/pages/SessionListPage.tsx`
