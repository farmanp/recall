# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
