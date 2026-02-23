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
npx recall-player@latest

# Or install globally
npm install -g recall-player
recall
```

## Environment Variables

### `RECALL_EXCLUDE_PATTERNS`

Comma-separated list of directory patterns to exclude from session scanning. Useful for skipping plugin directories, archived projects, or directories that cause scan failures.

```bash
# Exclude specific directories
RECALL_EXCLUDE_PATTERNS="thedotmack,archived" npx recall-player@latest

# Exclude with glob-style patterns
RECALL_EXCLUDE_PATTERNS="**/claude-mem/**,**/test-data/**" npx recall-player@latest
```

**Pattern matching:**

- Simple patterns (e.g., `thedotmack`) match any path containing that string
- Glob patterns with `**` (e.g., `**/plugin/**`) match directories at any depth

### `RECALL_FILTER_CWD`

Controls automatic filtering of sessions based on the startup directory. When enabled (default), only sessions from the directory where `recall-player` was started are shown.

```bash
# Default behavior: filter to current directory
cd /Users/me/projects/myapp
npx recall-player@latest
# Shows only sessions from /Users/me/projects/myapp

# Disable CWD filter to see all sessions
RECALL_FILTER_CWD=false npx recall-player@latest
# Shows all sessions from all directories
```

### Server Configuration

| Variable                    | Default   | Description                                      |
| --------------------------- | --------- | ------------------------------------------------ |
| `PORT`                      | `3001`    | Server port                                      |
| `HOST`                      | `0.0.0.0` | Server host binding                              |
| `NODE_ENV`                  | —         | Set to `production` for production mode          |
| `AUTO_WATCH`                | `true`    | Enable/disable file watcher on startup           |
| `RECALL_USER_CWD`           | —         | Override working directory for session filtering |
| `RECALL_CORS_ORIGINS`       | —         | Comma-separated list of allowed CORS origins     |
| `RECALL_DISABLE_CLAUDE_MEM` | `false`   | Disable claude-mem database integration          |

### Security & Authentication

| Variable                        | Default | Description                                     |
| ------------------------------- | ------- | ----------------------------------------------- |
| `RECALL_VIEWER_MODE`            | `false` | Start in read-only viewer mode                  |
| `RECALL_LOCALHOST_BYPASS`       | `true`  | Allow localhost requests without authentication |
| `RECALL_TRUST_LOCALHOST_BYPASS` | `true`  | Trust localhost origin for CORS                 |

### Sharing

| Variable                         | Default | Description                             |
| -------------------------------- | ------- | --------------------------------------- |
| `RECALL_SHARE_SIGNING_KEY`       | —       | Secret key for signing share links      |
| `RECALL_ALLOW_UNREDACTED_SHARES` | `false` | Allow sharing without content redaction |

### LLM Summaries

| Variable                   | Default          | Description                         |
| -------------------------- | ---------------- | ----------------------------------- |
| `RECALL_ANTHROPIC_API_KEY` | —                | Anthropic API key for LLM summaries |
| `RECALL_LLM_MODEL`         | `claude-3-haiku` | Model for summary generation        |
| `RECALL_LLM_MAX_TOKENS`    | `1024`           | Max tokens for summary response     |

### Display Options

| Variable                  | Default | Description                                        |
| ------------------------- | ------- | -------------------------------------------------- |
| `RECALL_HIDE_TOKEN_STATS` | `false` | Hide token usage statistics from the Overview page |

**Note on Vertex AI / Third-Party Integrations:**

When using Claude Code through Vertex AI or other third-party integrations (e.g., `CLAUDE_CODE_USE_VERTEX=1`), token usage data may not be available in session transcripts. In this case, set `RECALL_HIDE_TOKEN_STATS=true` to hide the token statistics card from the Overview page:

```bash
RECALL_HIDE_TOKEN_STATS=true npx recall-player@latest
```

## Features Requiring Database Import

Some features require sessions to be **imported** into the transcript database, not just scanned from the filesystem:

| Feature             | Requires Import | Notes                                 |
| ------------------- | --------------- | ------------------------------------- |
| Session list/player | No              | Works from filesystem scan            |
| Token statistics    | Yes             | Re-import to populate token metrics   |
| Session summaries   | Yes             | Needs frames in database for analysis |
| Impact Analysis     | Partial         | Falls back to filesystem, but slower  |
| Checkpoints         | Yes             | Auto-imports when creating checkpoint |
| Search (in content) | Yes             | Searches indexed frames only          |

### Auto-Import

Sessions are automatically imported via the file watcher when:

- A new session file is created in `~/.claude/projects/`
- Recall is running with `AUTO_WATCH=true` (default)

### Manual Import

If you see "Analysis failed" or empty token stats, run the import command:

```bash
# Import all sessions into database
npx recall-player import

# Check import statistics
npx recall-player import --stats

# Force re-import all sessions (updates token stats)
npx recall-player import --no-skip

# Show all import options
npx recall-player import --help
```

**Via API (alternative):**

```bash
curl -X POST http://localhost:3001/api/import/start
curl http://localhost:3001/api/import/status
```

### Troubleshooting

**"Analysis failed: Session not found"**

- The session may not be imported yet. Wait for auto-import or manually import.
- Check if the session file exists in `~/.claude/projects/`

**Token stats showing 0 or empty**

- Sessions need to be re-imported after upgrading to capture token metrics
- Run `npm run import` to re-import all sessions

**404 errors in console for /api/sessions/{id}/analysis**

- Normal for sessions not yet in database. They still display but analysis features won't work until imported.

## Development Commands

### Root (Monorepo)

```bash
npm install          # Install all dependencies
npm run dev          # Start both backend and frontend in parallel
npm run dev:backend  # Start backend only
npm run dev:frontend # Start frontend only
npm run build        # Build backend + frontend (cleans and copies)
npm start            # Start production server
npm test             # Run all tests
npm run lint         # Run all linters
npm run lint:backend # Backend-only linting
npm run lint:frontend # Frontend-only linting
npm run format       # Format code with Prettier
npm run format:check # Check formatting without changes
```

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
npm run import       # CLI: bulk import all transcripts
npm run import -- --single <file>  # Import single file
npm run import -- --stats          # Show import statistics
```

### Frontend (React + Vite + TypeScript)

```bash
cd frontend
npm install          # Install dependencies
npm run dev          # Development server (port 5174)
npm run build        # Build for production
npm run lint         # Run ESLint
npm run preview      # Preview production build
npm test             # Run Vitest tests
npm run test:e2e     # Run Playwright E2E tests
npm run format       # Format with Prettier
npm run format:check # Check formatting
```

### Development Architecture

In development, two servers run simultaneously:

| Server   | Port | Purpose                                 |
| -------- | ---- | --------------------------------------- |
| Backend  | 3001 | Express API server (`/api/*` endpoints) |
| Frontend | 5174 | Vite dev server (React with hot reload) |

**How it works:**

- Open `http://localhost:5174` in your browser (the frontend)
- Vite automatically proxies `/api/*` requests to the backend at port 3001
- Changes to React components hot-reload instantly (no refresh needed)
- Changes to backend `.ts` files auto-restart via `tsx watch`

**In production** (via `npm start` or `npx recall-player`):

- Only the backend runs on port 3001
- It serves both the API and the pre-built frontend from `backend/public/`
- No Vite, no hot reload - just the compiled static files

### Full Build & Publish

```bash
npm run build        # Build backend + frontend (cleans and copies)
npm start            # Start production server
npm publish          # Publish to npm
```

### Build Workflow Details

The frontend build is served by the backend from `backend/public/`. The build process:

1. `npm run build:backend` - Compiles backend TypeScript to `backend/dist/`
2. `npm run build:frontend` - Builds React app to `frontend/dist/` (Vite creates hashed filenames)
3. `npm run clean:frontend` - Removes `backend/public/` using `rimraf` (cross-platform)
4. `npm run copy:frontend` - Copies `frontend/dist/*` to `backend/public/`

**Important:** Always use `npm run build` from root (not just `cd frontend && npm run build`) to ensure:

- Old hashed files are cleaned (prevents stale JS/CSS accumulation)
- Files are copied to `backend/public/` where the server serves them

For development iteration without full rebuild:

```bash
# Quick frontend rebuild and copy
npm run build:frontend && npm run copy:frontend

# Then restart backend to serve new files
# Or use frontend dev server at :5174 for hot reload
```

## Publishing Process

**See [docs/VERSIONING.md](docs/VERSIONING.md) for detailed versioning guidelines.**

### Pre-Release Checklist

1. **Run tests** to ensure nothing is broken:

   ```bash
   cd backend && npm test
   cd frontend && npm test
   ```

2. **CRITICAL: Verify all backend dependencies are in root package.json**:

   For `npx recall-player` to work, ALL runtime dependencies used by backend must also be in the root `package.json`. This is because npx installs from root, not from backend/.

   ```bash
   # Check for any backend deps missing from root
   diff <(cat backend/package.json | jq -r '.dependencies | keys[]' | sort) \
        <(cat package.json | jq -r '.dependencies | keys[]' | sort)
   ```

   If any backend dependency is missing from root, add it:

   ```bash
   npm install <missing-package> --save
   ```

3. **Update version** using `npm version patch|minor|major` (see [VERSIONING.md](docs/VERSIONING.md) for guidelines on which to use)

4. **Update CHANGELOG.md** with the new version and changes

5. **Commit and push** the version bump and changelog:
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
npx recall-player@latest --version
```

## Architecture

### Dual Database System

The backend uses two SQLite databases:

1. **Claude-mem DB** (`~/.claude-mem/claude-mem.db`)
   - Read-only access
   - Stores observations from claude-mem plugin
   - Used for commentary/insights on sessions

2. **Transcript DB** (`~/.claude/transcripts.db`)
   - Read-write access
   - Stores parsed session frames for fast querying
   - Populated via file watcher or manual import

### File Watcher (Auto-Import)

On startup, the backend starts a file watcher on `~/.claude/projects/` that:

- Detects new `.jsonl` files
- Auto-imports them to the transcript database after a 2-second debounce
- Enables real-time session availability

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
- `transcript-parser.ts` - Parses transcripts for database import
- `timeline-builder.ts` - Builds playback timelines from parsed events

### Backend Layers

1. **Server Layer** (`src/index.ts`, `src/server.ts`): Express app, static file serving, graceful shutdown
2. **Route Layer** (`src/routes/`): API handlers
   - `sessions.ts` - Session listing, frames, search, CLAUDE.md history
   - `import.ts` - Bulk and single transcript import
   - `commentary.ts` - Claude-mem observations integration
   - `admin.ts` - Viewer mode toggle and status
   - `checkpoints.ts` - Checkpoint creation and management
   - `git.ts` - Git context tracking for sessions
   - `rewind.ts` - File state restoration
   - `shares.ts` - Session sharing with expiry
   - `stats.ts` - Overview and folder statistics
   - `summaries.ts` - Session summary generation
3. **Parser Layer** (`src/parser/`): Multi-agent session parsing
4. **Database Layer** (`src/db/`): SQLite with dual-database architecture
5. **Services Layer** (`src/services/`):
   - `file-watcher.ts` - Auto-import on file changes
   - `transcript-importer.ts` - Bulk/single import logic
   - `checkpoint-manager.ts` - Checkpoint creation and file capture
   - `rewind-engine.ts` - File state restoration from session history
   - `share-links.ts` - Shareable link generation with expiry
   - `summarizer.ts` - Heuristic-based session summaries
   - `llm-summary-generator.ts` - LLM-powered summary generation
   - `gemini-hash-mapper.ts` - Maps Gemini CLI session hashes
6. **Middleware Layer** (`src/middleware/`):
   - `auth.ts` - Authentication guard for protected routes
   - `viewer-mode.ts` - Read-only mode enforcement
   - `validation.ts` - Request validation helpers

### Frontend Structure

- **State**: Zustand for global state, React Query for server state
- **Routing**: React Router with:
  - `/` - Overview dashboard
  - `/sessions` - Session list
  - `/folders` - Folder navigation
  - `/session/:sessionId` - Session player
  - `/session/:sessionId/artifacts` - Artifacts full page view
  - `/shared/:shareId` - Shared session viewer
- **Components**: `src/components/` with specialized viewers (DiffViewer, SyntaxHighlighter, TimelineScrubber)
- **Pages**: OverviewPage, SessionListPage, SessionPlayerPage, FoldersPage, SharedSessionPage
- **Utilities**: `src/utils/` with shared helpers (tool-normalization)

### Tool Name Normalization

The `frontend/src/utils/tool-normalization.ts` utility maps agent-specific tool names to canonical categories, enabling consistent artifact detection across all agents:

| Category  | Claude Code                            | Gemini CLI                            | Codex CLI       |
| --------- | -------------------------------------- | ------------------------------------- | --------------- |
| **read**  | `Read`, `Glob`, `Grep`, `NotebookRead` | `read_file`, `glob`, `list_directory` | —               |
| **write** | `Write`, `NotebookEdit`                | `write_file`, `create_file`           | —               |
| **edit**  | `Edit`                                 | `replace`                             | —               |
| **shell** | `Bash`                                 | `shell`, `run_shell_command`          | `shell_command` |

Usage:

```typescript
import { isReadTool, isWriteTool, isEditTool } from '../utils/tool-normalization';

if (isReadTool(toolName)) {
  /* handle read */
}
```

The backend (`base-parser.ts`) has equivalent methods for server-side normalization.

### Session File Formats

| Agent  | Directory                       | Format | Notes                     |
| ------ | ------------------------------- | ------ | ------------------------- |
| Claude | `~/.claude/projects/{project}/` | JSONL  | One event per line        |
| Codex  | `~/.codex/sessions/YYYY/MM/`    | JSONL  | `{type, payload}` wrapper |
| Gemini | `~/.gemini/tmp/{hash}/chats/`   | JSON   | `session-*.json` files    |

### Coding Agent Support Matrix

Feature support varies by agent due to differences in session file formats and available metadata.

| Feature                    | Claude Code | Codex CLI | Gemini CLI | Notes                             |
| -------------------------- | :---------: | :-------: | :--------: | --------------------------------- |
| **Core Features**          |
| Session playback           |     ✅      |    ✅     |     ✅     | All agents supported              |
| Session list/filtering     |     ✅      |    ✅     |     ✅     |                                   |
| Timeline scrubber          |     ✅      |    ✅     |     ✅     |                                   |
| Frame navigation           |     ✅      |    ✅     |     ✅     |                                   |
| **Session State**          |
| Live session detection     |     ✅      |    ✅     |     ❌     | Content-based analysis            |
| Session duration           |     ✅      |    ✅     |     ✅     |                                   |
| Event count                |     ✅      |    ✅     |     ✅     |                                   |
| **Metadata**               |
| Project/folder name        |     ✅      |    ✅     |     ⚠️     | Gemini uses hash mapping          |
| Session slug               |     ✅      |    ⚠️     |     ❌     | Codex defaults to 'codex-session' |
| Model name                 |     ✅      |    ✅     |     ✅     |                                   |
| First user message         |     ✅      |    ✅     |     ✅     |                                   |
| Working directory (cwd)    |     ✅      |    ✅     |     ⚠️     | Gemini requires hash mapping      |
| **Token Usage**            |
| Input/output tokens        |     ✅      |    ✅     |     ❌     | Gemini format lacks token data    |
| Cache tokens               |     ✅      |    ❌     |     ❌     | Claude-specific feature           |
| Cost estimation            |     ✅      |    ✅     |     ❌     |                                   |
| **Content Analysis**       |
| Thinking blocks            |     ✅      |    ✅     |     ❌     |                                   |
| Tool execution             |     ✅      |    ✅     |     ✅     |                                   |
| File artifacts             |     ✅      |    ✅     |     ✅     | Via tool normalization            |
| CLAUDE.md detection        |     ✅      |    ❌     |     ❌     | Claude-specific                   |
| **Advanced Features**      |
| Checkpoints                |     ✅      |    ✅     |     ✅     |                                   |
| Rewind                     |     ✅      |    ✅     |     ✅     |                                   |
| Session sharing            |     ✅      |    ✅     |     ✅     |                                   |
| LLM summaries              |     ✅      |    ✅     |     ✅     |                                   |
| Git context                |     ✅      |    ✅     |     ⚠️     | Depends on cwd resolution         |
| Auto-import (file watcher) |     ✅      |    ❌     |     ✅     |                                   |

**Legend:**

- ✅ Full support
- ⚠️ Partial support (see notes)
- ❌ Not supported

**Notes on partial support:**

- **Gemini hash mapping**: Gemini CLI stores sessions in hash-based directories (`~/.gemini/tmp/{hash}/`). Recall maintains a mapping table to resolve these hashes to project paths, but this requires the session to be started while Recall is running.
- **Codex session slug**: Codex sessions don't include a human-readable slug in their format, so they default to 'codex-session'.
- **Live session detection**: Uses content-based analysis (tracking thinking/tool_use vs text_output events). Gemini's JSON format doesn't include the granular event types needed for this analysis.

## Features

### Checkpoints

Checkpoints capture the complete file state at any point in a session. Useful for comparing code states or restoring to a known-good state.

- **Create checkpoints** at any frame in the session timeline
- **Capture file contents** - stores all files touched in the session up to that point
- **Compare checkpoints** - diff two checkpoints to see what changed
- **Name and annotate** - add custom names and notes to checkpoints

### Session Sharing

Share sessions with others via expiring links. Useful for code reviews or debugging discussions.

- **Generate share links** with configurable expiry (1h, 24h, 7d, 30d)
- **Content redaction** - optionally redact sensitive content before sharing
- **Public access** - shared links don't require authentication
- **Revocable** - delete share links at any time

Requires `RECALL_SHARE_SIGNING_KEY` environment variable for secure link generation.

### Session Summaries

Automatically generate human-readable summaries of coding sessions.

- **Heuristic summaries** - fast, rule-based summaries from session metadata
- **LLM summaries** - AI-powered summaries using Claude (requires `RECALL_ANTHROPIC_API_KEY`)
- **Batch generation** - generate summaries for multiple sessions at once
- **Caching** - summaries are cached in the database for fast retrieval

### Git Context Tracking

Track git state (branch, commit, dirty files) for each session.

- **Branch tracking** - see which branch each session was on
- **Commit correlation** - link sessions to git commits
- **Branch filtering** - view all sessions for a specific branch
- **Dirty file detection** - know if uncommitted changes existed

### Rewind (File Restoration)

Restore files to their exact state at any point in a session.

- **Preview changes** - see what files would be modified before executing
- **Backup creation** - automatic backups before any file changes
- **Undo support** - revert the last rewind operation
- **Selective restoration** - choose which files to restore

### Viewer Mode

Read-only mode for safely browsing sessions without risk of modifications.

- **Toggle via admin API** - enable/disable at runtime
- **Environment variable** - start in viewer mode with `RECALL_VIEWER_MODE=true`
- **Blocks mutations** - prevents checkpoints, rewinds, and other write operations

## API Reference

### Health & Status

```bash
GET /api/health                      # Health check with DB status
GET /api/agents                      # List agents with session counts
GET /api/sessions/cwd-filter         # Get CWD filter status
```

### Sessions

```bash
# List sessions
GET /api/sessions                    # List sessions (respects CWD filter)
GET /api/sessions?showAll=true       # Bypass CWD filter
GET /api/sessions?source=db          # Use database instead of filesystem
GET /api/sessions?agent=claude       # Filter by agent type
GET /api/sessions?project=<path>     # Filter by project path
GET /api/sessions?hasClaudeMd=true   # Only sessions with CLAUDE.md

# Session details
GET /api/sessions/:id                # Get session metadata
GET /api/sessions/:id/frames         # Get playback frames (paginated)
GET /api/sessions/:id/frames?source=db  # Frames from database
POST /api/sessions/:id/refresh       # Refresh cached timeline

# Search
GET /api/sessions/search?q=<query>   # Global content search
```

### CLAUDE.md History

```bash
GET /api/sessions/:id/claudemd-history    # Version history for session's project
GET /api/sessions/:id/claudemd-snapshots  # Snapshots linked to session
GET /api/claudemd/compare?from=1&to=2     # Compare two snapshots
GET /api/claudemd/content?path=<path>     # Get CLAUDE.md file content
```

### Import

```bash
POST /api/import/start               # Start bulk import
GET /api/import/status               # Get import job status
GET /api/import/stats                # Get database import statistics
POST /api/import/single              # Import single transcript file
```

### Commentary

```bash
GET /api/sessions/:id/commentary     # Get claude-mem observations for session
```

### Rewind

```bash
# Preview and execute file state restoration
POST /api/sessions/:id/rewind/preview    # Preview what would change
POST /api/sessions/:id/rewind/execute    # Execute rewind to restore files
POST /api/sessions/:id/rewind/undo       # Undo the last rewind (restore from backup)

# Rewind history and status
GET /api/sessions/:id/rewind/history     # Get rewind history for session
GET /api/sessions/:id/rewind/undo-info   # Check if undo is available
GET /api/sessions/:id/rewind/stats       # Get rewind statistics
```

### Admin

```bash
GET /api/admin/viewer-mode               # Get viewer mode status
POST /api/admin/viewer-mode              # Toggle viewer mode (body: {enabled: boolean})
GET /api/admin/status                    # Get admin status info
```

### Checkpoints

```bash
POST /api/sessions/:id/checkpoints       # Create checkpoint at frame
GET /api/sessions/:id/checkpoints        # List checkpoints for session
GET /api/checkpoints/:id                 # Get checkpoint metadata
GET /api/checkpoints/:id/full            # Get checkpoint with all file contents
GET /api/checkpoints/:id/files/*         # Get specific file from checkpoint
PATCH /api/checkpoints/:id               # Update checkpoint (name, notes)
DELETE /api/checkpoints/:id              # Delete checkpoint
GET /api/checkpoints/:id/diff/:otherId   # Compare two checkpoints
GET /api/checkpoints                     # List all checkpoints
```

### Git

```bash
GET /api/sessions/:id/git                # Get git context for session
GET /api/git/commits                     # List commits with session activity
GET /api/git/branches                    # List branches with session counts
GET /api/git/branches/:name/sessions     # Get sessions for a branch
```

### Shares

```bash
POST /api/sessions/:id/share             # Create shareable link
GET /api/shared/:shareId                 # Get shared session (public)
DELETE /api/shared/:shareId              # Delete share link
```

### Stats

```bash
GET /api/stats/overview                  # Dashboard statistics
GET /api/stats/folders                   # Folder-level statistics
```

### Summaries

```bash
GET /api/sessions/:id/summary            # Get session summary
POST /api/sessions/:id/summary/regenerate # Regenerate summary
GET /api/summaries/stats                 # Summary generation statistics
POST /api/summaries/generate-batch       # Batch generate summaries
```

## Keyboard Shortcuts

### Session Player

| Key            | Action                 |
| -------------- | ---------------------- |
| `Space`        | Play/Pause             |
| `←` / `→`      | Previous/Next frame    |
| `Home` / `End` | First/Last frame       |
| `a`            | Toggle Artifacts panel |
| `f`            | Toggle Filters popup   |
| `Escape`       | Close panel/popup      |
| `1-9`          | Set playback speed     |

## Testing

### Unit Tests (Vitest)

```bash
# Backend
cd backend && npm test
cd backend && npm run test:coverage

# Frontend
cd frontend && npm test
cd frontend && npm run test:ui
```

### E2E Tests (Playwright)

```bash
cd frontend && npm run test:e2e        # Run all E2E tests
cd frontend && npm run test:e2e:ui     # Run with Playwright UI
```

E2E test files:

- `frontend/e2e/session-list.spec.ts` - Session list page tests
- `frontend/e2e/session-player.spec.ts` - Session player and artifacts panel tests

**Prerequisites for E2E tests:**

- Backend running on `localhost:3001`
- At least one session exists in `~/.claude/projects/`

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
6. Add tool names to `frontend/src/utils/tool-normalization.ts` for artifact detection
7. Add tool detection methods in `backend/src/parser/base-parser.ts`
