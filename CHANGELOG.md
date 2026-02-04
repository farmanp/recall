# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
