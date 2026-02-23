---
sidebar_position: 1
---

# Architecture

Recall is a monorepo with a Node.js backend and React frontend.

## Project Structure

```
recall/
├── backend/           # Express + TypeScript server
│   ├── src/
│   │   ├── index.ts   # Entry point
│   │   ├── server.ts  # Express app setup
│   │   ├── routes/    # API endpoints
│   │   ├── parser/    # Multi-agent session parsers
│   │   ├── db/        # SQLite database layer
│   │   ├── services/  # Business logic
│   │   └── middleware/# Auth, validation, etc.
│   └── public/        # Built frontend (served in production)
├── frontend/          # React + Vite + TypeScript
│   ├── src/
│   │   ├── pages/     # Route components
│   │   ├── components/# Reusable UI components
│   │   ├── hooks/     # Custom React hooks
│   │   └── utils/     # Utilities
│   └── e2e/           # Playwright tests
└── docs-site/         # Docusaurus documentation
```

## Dual Database System

Recall uses two SQLite databases:

### Claude-mem DB (`~/.claude-mem/claude-mem.db`)

- **Access:** Read-only
- **Content:** Observations from claude-mem plugin
- **Purpose:** Commentary and insights on sessions

### Transcript DB (`~/.claude/transcripts.db`)

- **Access:** Read-write
- **Content:** Parsed session frames for fast querying
- **Purpose:** Session playback and search

## Multi-Agent Parser System

The parser system uses a factory pattern:

```
File Path → AgentDetector → ParserFactory → AgentParser → PlaybackFrames
```

### Parser Files

| File                 | Purpose                               |
| -------------------- | ------------------------------------- |
| `agent-detector.ts`  | Detects agent type from file path     |
| `base-parser.ts`     | Abstract base class with shared logic |
| `claude-parser.ts`   | Claude Code JSONL format              |
| `codex-parser.ts`    | Codex CLI JSONL format                |
| `gemini-parser.ts`   | Gemini CLI JSON format                |
| `parser-factory.ts`  | Selects appropriate parser            |
| `session-indexer.ts` | Scans and indexes all sessions        |

## Development Servers

In development, two servers run simultaneously:

| Server   | Port | Purpose                         |
| -------- | ---- | ------------------------------- |
| Backend  | 3001 | Express API server              |
| Frontend | 5174 | Vite dev server with hot reload |

Vite automatically proxies `/api/*` requests to the backend.

## Production Build

In production, only the backend runs on port 3001, serving both:

- The API endpoints
- The pre-built frontend from `backend/public/`
