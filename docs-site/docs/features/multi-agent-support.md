---
sidebar_position: 2
---

# Multi-Agent Support

Recall supports multiple AI coding agents out of the box. Each agent stores sessions in a different format and location, but Recall normalizes them into a consistent playback experience.

## Supported Agents

### Claude Code

Claude Code sessions are stored in `~/.claude/projects/` as JSONL files with one event per line.

**Detection:** Files matching `~/.claude/projects/*/*.jsonl`

### Codex CLI

Codex CLI sessions are stored in `~/.codex/sessions/` organized by date (YYYY/MM).

**Detection:** Files matching `~/.codex/sessions/YYYY/MM/*.jsonl`

**Format:** Each line is a `{type, payload}` wrapper object.

### Gemini CLI

Gemini CLI sessions are stored in `~/.gemini/tmp/` with hash-based directory names.

**Detection:** Files matching `~/.gemini/tmp/{hash}/chats/session-*.json`

**Format:** JSON files (not JSONL).

## Tool Name Normalization

Different agents use different names for similar operations. Recall normalizes these for consistent artifact detection:

| Category  | Claude Code                            | Gemini CLI                            | Codex CLI       |
| --------- | -------------------------------------- | ------------------------------------- | --------------- |
| **Read**  | `Read`, `Glob`, `Grep`, `NotebookRead` | `read_file`, `glob`, `list_directory` | —               |
| **Write** | `Write`, `NotebookEdit`                | `write_file`, `create_file`           | —               |
| **Edit**  | `Edit`                                 | `replace`                             | —               |
| **Shell** | `Bash`                                 | `shell`, `run_shell_command`          | `shell_command` |

## Filtering by Agent

In the session list, use the agent filter tabs to show only sessions from a specific agent:

- **All** - Show all sessions
- **Claude** - Show only Claude Code sessions
- **Codex** - Show only Codex CLI sessions
- **Gemini** - Show only Gemini CLI sessions
