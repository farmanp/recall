# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.8.0] - 2026-02-09

### Added

- **Artifacts Split-Pane Sidebar**: Press `a` to open artifacts as a side-by-side panel while watching playback (replaces modal overlay)
- **Artifacts Full-Page View**: Click expand icon or navigate to `/session/:id/artifacts` for dedicated full-width artifact analysis workspace
- **Forensic Terminal Theme**: Complete UI redesign with dark terminal aesthetic, scan lines, and evidence-card styling
- **Progressive Disclosure UX**: Quick glance in sidebar → expand file rows → full-page analysis

### Changed

- **Layout Architecture**: Session player now uses horizontal split layout when artifacts sidebar is open
- **Main Content Adapts**: Content area smoothly resizes when sidebar opens/closes
- **Frame Navigation**: Clicking file operations in sidebar navigates to frame without closing sidebar
- **Route Structure**: Added `/session/:sessionId/artifacts` route for full-page artifacts view

## [1.7.0] - 2026-02-09

### Added

- **Multi-Agent Artifact Support**: Artifacts panel now detects and displays file operations from Gemini CLI and Codex CLI sessions, not just Claude Code
- **Tool Name Normalization**: Centralized utility maps agent-specific tool names (e.g., `read_file`, `replace`, `shell`) to canonical categories
- **E2E Tests for Session Player**: Added Playwright tests for artifacts panel functionality

### Changed

- **Backend Parser**: Updated `base-parser.ts` to extract file paths from multiple input formats across agents
- **useArtifacts Hook**: Refactored to use normalization utility instead of hardcoded Claude tool names

## [1.6.0] - 2026-02-09

### Added

- **CWD Filter Banner**: Shows an info banner when sessions are filtered by current directory, displaying the filtered path and "Showing X of Y sessions" count with a quick "Show all sessions" action
- **E2E Test Suite**: Added Playwright tests for session list page to catch UI regressions

### Fixed

- **Session List Empty**: Fixed bug where session list showed "0 sessions" because API defaulted to empty database instead of filesystem source
- **API Default Source**: Changed default `source` parameter from `db` to `filesystem` in both backend schema and frontend client

## [1.5.1] - 2026-02-09

### Fixed

- **SQLite Corruption Recovery**: Server now auto-recovers from corrupted transcript database instead of crashing silently
- **Stable Database Location**: Moved transcript DB from `~/.claude/` to `~/.recall-player/` to avoid npx cache volatility
- **Lazy Schema Init**: Work-unit routes defer database initialization to first request, improving startup resilience

## [1.5.0] - 2026-02-09

### Added

- **Frame Filters Popup**: Press `f` to open filters in a modal dialog (frees up screen space)
- **Hierarchical Tool Filters**: Tool execution filters now show as a collapsible tree under the parent frame type
- **Filter Status Indicator**: Header button shows active filter count and highlights when filters are applied
- **Inline Artifact Viewing**: View file contents and diffs directly in the Artifacts panel

### Changed

- **Filter UX**: Moved frame type filters from inline sidebar to popup modal for cleaner layout
- **Session Player Controls**: Improved clarity and discoverability of playback controls

## [1.4.2] - 2026-02-04

### Fixed

- **npx CWD Detection**: Fixed CWD filter detecting npx cache directory instead of user's actual working directory when running via `npx recall-player`

## [1.4.1] - 2026-02-04

### Fixed

- **Model Extraction**: Increased chunk size from 2KB to 16KB to capture model info from assistant messages
- **CWD Filter Path**: Strip `/backend` subdirectory when detecting project root (fixes filter when running via npm scripts)
- **Empty Session Files**: Silently skip 0-byte abandoned session files instead of logging errors
- **Partial Line Parsing**: Discard incomplete JSON lines at chunk boundaries to prevent parse errors
- **CWD Extraction**: Search first 10 entries for CWD field (handles `file-history-snapshot` entries without CWD)

## [1.4.0] - 2026-02-04

### Added

- **CWD Session Filtering**: Automatically filter sessions to the directory where `recall-player` is started
- **`RECALL_FILTER_CWD` env var**: Set to `false` to disable automatic directory filtering
- **`?showAll=true` query param**: Override CWD filter for individual API requests
- **`/api/sessions/cwd-filter` endpoint**: Check current filter status
- **`RECALL_EXCLUDE_PATTERNS` env var**: Exclude directories from session scanning (comma-separated patterns)

### Fixed

- Scanner now skips corrupt/malformed session files instead of failing entirely
- Improved error handling in session indexer and transcript importer

## [1.3.2] - 2026-02-04

### Fixed

- Added missing `zod` dependency to root package.json for npx usage

## [1.3.1] - 2026-02-04

### Fixed

- Added missing `lru-cache` dependency to root package.json for npx usage

## [1.3.0] - 2026-02-04

### Added

- **Zod Validation**: Type-safe request validation middleware for all API routes
- **Path Security**: Directory whitelist and symlink detection for CLAUDE.md content endpoint
- **Parser Tests**: Comprehensive test suite with golden fixtures for Claude parser
- **npm Workspaces**: Monorepo configuration for better dependency management

### Changed

- **Performance**: Chunk-based metadata scanning reads only 4KB per file (was full file)
- **Performance**: LRU cache for timeline data caps memory at ~200MB (50 sessions, 30min TTL)
- **Performance**: FTS5 full-text search now working with correct table references

### Fixed

- **Duration Display**: Fixed negative durations caused by null timestamps in first log entry
- **Duration Formatting**: Session list now shows "50m 25s" instead of malformed numbers
- **TypeScript**: Removed unused imports and variables in sessions router

## [1.2.0] - 2026-02-04

### Added

- **Model Display**: Show AI model information (e.g., "Opus 4.5", "Haiku 4.5", "Gemini 2.0 Flash") in session list and player header
- New `ModelBadge` component with smart formatting for Claude, Codex, and Gemini model strings
- Model extraction from Claude logs (`message.model` field)
- Model extraction from Codex logs (`payload.model` field)
- Model extraction from Gemini logs (`messages[].model` field)

## [1.1.1] - 2026-02-04

### Fixed

- Fixed missing `uuid` dependency in root package.json for npx usage

## [1.1.0] - 2026-02-04

### Added

- Work Units feature for tracking atomic units of work across sessions
- Work Units list page with statistics dashboard
- Work Units player with cross-session playback
- Multi-agent support for Codex CLI and Gemini CLI sessions
- Session filtering by agent type
- Dark theme for improved visual experience

### Changed

- Enhanced session list page with comprehensive filtering
- Improved timeline scrubber with multi-session visualization

## [1.0.0] - 2025-12-01

### Added

- Initial release
- Session replay functionality for Claude Code sessions
- Video-like playback controls (play, pause, seek, speed)
- Timeline scrubber with frame preview
- Syntax highlighting for code blocks
- Diff viewer for file changes
- Session list with search and filtering
- Local-first architecture (no cloud dependencies)
- SQLite caching for improved performance
