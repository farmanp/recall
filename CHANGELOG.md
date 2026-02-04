# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
