---
sidebar_position: 1
---

# Getting Started

Recall is a local-first web application that replays AI coding sessions like a video player. It supports multiple AI coding agents including Claude Code, Gemini CLI, and Codex CLI.

## Quick Start

The fastest way to get started is using npx:

```bash
npx recall-player@latest
```

This will:

1. Scan your home directory for AI coding sessions
2. Start a local web server on port 3001
3. Open the Recall UI in your browser

## Supported Agents

Recall automatically detects and parses sessions from:

| Agent           | Session Location      |
| --------------- | --------------------- |
| **Claude Code** | `~/.claude/projects/` |
| **Codex CLI**   | `~/.codex/sessions/`  |
| **Gemini CLI**  | `~/.gemini/tmp/`      |

## Global Installation

If you prefer, you can install Recall globally:

```bash
npm install -g recall-player
recall
```

## What You'll See

Once Recall starts, you'll see:

- **Session List** - All your AI coding sessions, filterable by agent, date, and project
- **Session Player** - Transcript view showing the conversation with expandable tool cards
- **File Tracking** - See every file read, write, and edit with full diffs

## Next Steps

- [Configuration](/docs/configuration) - Environment variables and customization
- [Session Replay](/docs/features/session-replay) - How to use the session player
- [Keyboard Shortcuts](/docs/keyboard-shortcuts) - Speed up your workflow
