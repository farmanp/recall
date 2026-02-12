# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.4.0] - 2026-02-11

### Added

- **Git Branch Display** - Sessions now show the git branch they were recorded on directly in the header. Extracted from session files automatically - no database import required.
- **Security Foundation** - Added viewer-mode middleware, auth guard, and secret redactor services (preparation for future sharing features).
- **LLM Summary Generator** - Backend service for generating session summaries with cost tracking (requires API key configuration).
- **Git Context Capture** - Enhanced git state capture during database import including commits made during session.

### Changed

- **Export Improvements** - Streamlined export functionality with better formatting.

### Internal

- Added comprehensive test suites for new security middleware and services.
- Added documentation for competitive analysis and feature planning.

---

## [2.3.0] - 2026-02-11

### Added

- **Gemini Project Mapping** - Real-time capture of Gemini hash→project path mappings. Sessions now show project names instead of "Unknown Project" when started from a known directory.
- **Checkpoint Auto-Import** - Creating a checkpoint now automatically imports the session to the database if needed, removing the manual step.
- **Checkpoint Count Badge** - Visual indicator showing number of saved checkpoints on the toolbar button.

### Changed

- **Session Player Header** - Cleaner icon-only toolbar buttons with tooltips on hover. Reduces visual clutter while maintaining discoverability.
- **REPLAY Badge** - Better spacing and positioning relative to session title.

### Fixed

- **Checkpoint Creation** - Fixed silent failure when creating checkpoints on sessions not in database.
- **Git Activity Table** - Applied missing migration for git_activity table.

---

## [2.2.1] - 2026-02-11

### Changed

- **Directory Toggle** - "All Projects" button now toggles between "All Directories" / "Current Directory" for clarity
- **Session Count** - Simplified header to show just "X sessions" instead of confusing "X of Y // filtered"
- **npx Commands** - All documentation now uses `@latest` tag to avoid stale cache issues

### Fixed

- **Landing Page** - Fixed broken demo.gif path and updated version badge to 2.2.0

### Removed (temporarily)

- **Content Search** - Hidden until feature is fully implemented
- **Docs Button** - Hidden CLAUDE.md panel button until feature is ready
- **CLAUDE.md Filter** - Hidden filter button until feature is ready

---

## [2.2.0] - 2026-02-11

### Added

- **Git Commit Linking** - Sessions automatically capture git context (branch, commit, dirty state) on import. API endpoints for querying sessions by commit hash or branch.
- **Checkpoints** - Create named save points during sessions with file snapshots. Navigate to any checkpoint from the timeline.
- **Rewind** - Restore file state from any checkpoint with preview and undo capability. Automatic backup before rewind.
- **Session Summaries** - Storage and display of AI-generated session summaries via SummaryCard component.
- **Export Modal** - Unified export dialog with options for current frame or full session, in Markdown or HTML format.
- **New UI Components** - GitPanel, GitBadge, CheckpointPanel, CheckpointMarker, CreateCheckpointDialog, RewindPanel, RewindConfirmDialog, SummaryCard
- **Keyboard Shortcuts** - `g` (git), `k` (checkpoints), `w` (rewind), `y` (summary)
- **Comprehensive Tests** - 146 new tests across backend services, routes, and frontend components
- **Versioning Guide** - New `docs/VERSIONING.md` with semantic versioning guidelines

### Changed

- **SessionPlayerPage** - Integrated all new feature panels and keyboard shortcuts
- **Test Coverage** - Backend coverage improved to 57%, frontend to 36%

### Fixed

- **ESLint Warnings** - Resolved React hooks dependency warnings in TimelineScrubber, ArtifactsPanel, ArtifactsSidebar, ModelBadge
- **Prettier Formatting** - Added HTML files to lint-staged, fixed formatting in docs/index.html and frontend/index.html

---

## [2.1.1] - 2026-02-10

### Security

- **Fixed XSS vulnerability** - Search snippets now escape HTML entities before highlighting, and regex special characters in search queries are properly escaped

### Added

- **CODE_OF_CONDUCT.md** - Added Contributor Covenant 2.1

### Changed

- **Updated README and landing page** - Refreshed documentation and project homepage
- **Updated SECURITY.md** - Version support table now reflects 2.x release

### Fixed

- **Removed sensitive data from git** - `validation_report.json` (containing session UUIDs) removed from tracking and added to `.gitignore`

---

## [2.1.0] - 2026-02-10

### Added

- **Troubleshooting documentation** - New `docs/TROUBLESHOOTING.md` with database cleanup guidance and common issue resolution

### Changed

- **Claude-mem is now optional** - Recall starts and provides core session playback without claude-mem installed; claude-mem features (commentary, CLAUDE.md history) gracefully degrade to empty responses
- **Health endpoint** reports claude-mem availability separately (`claude_mem: "connected" | "unavailable"`)

### Fixed

- **Static asset 404s** - Missing static files (e.g., `/vite.svg`) now return proper 404 instead of index.html
- **Commentary endpoint** - Replaced broken `claude mcp call` shell-out with direct SQLite queries
- **Frontend tests** - Fixed 8 test assertions to match actual component output (text casing, element structure)

---

## [2.0.0] - 2026-02-09

### Added

#### Session Replay

- Video-like playback controls (play, pause, seek, variable speed 0.25x-5x)
- Timeline scrubber with frame preview and commentary markers
- Frame type filtering (user messages, AI responses, tool executions, thinking)
- Content search with next/previous match navigation
- Dead air compression to skip long pauses
- Chat view and timeline view modes

#### Multi-Agent Support

- **Claude Code** sessions from `~/.claude/projects/`
- **Codex CLI** sessions from `~/.codex/sessions/`
- **Gemini CLI** sessions from `~/.gemini/tmp/`
- Model badge display (Opus, Sonnet, Haiku, Gemini Flash, etc.)
- Agent-specific tool name normalization

#### File Artifacts

- Split-pane sidebar (press `a`) for side-by-side viewing during playback
- Full-page artifacts view at `/session/:id/artifacts`
- Cumulative and full session view modes
- Inline diff viewer and code content display
- Export to JSON, Markdown, or CSV
- Search, sort, and filter by file status

#### Work Units

- Group related sessions into atomic units of work
- Cross-session playback in work unit player
- Statistics dashboard with session counts

#### UI/UX

- Forensic terminal theme with dark aesthetic
- Keyboard shortcuts for all major actions
- CWD-based session filtering (shows sessions from current directory)
- CLAUDE.md panel for viewing project instructions
- Statistics panel with session metrics

#### Infrastructure

- Local-first architecture (no cloud dependencies)
- SQLite caching for fast queries
- LRU cache for timeline data (50 sessions, 30min TTL)
- Zod validation for all API routes
- E2E tests with Playwright

### Technical Details

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, React Query
- **Backend**: Express 5, TypeScript, better-sqlite3
- **Routing**: React Router v7
- **Testing**: Vitest (unit), Playwright (E2E)
