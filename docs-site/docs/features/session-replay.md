---
sidebar_position: 1
---

# Session Replay

Recall's core feature is replaying AI coding sessions like a video. The session player provides a transcript view of the entire conversation with expandable tool cards.

## Transcript View

The main view shows the session as a scrollable transcript with:

- **User Messages** - Your prompts and questions
- **AI Responses** - Claude/Gemini/Codex responses with markdown rendering
- **Tool Executions** - Expandable cards showing file operations, bash commands, etc.
- **Thinking Blocks** - Collapsible AI reasoning (for models that expose this)

### Auto-Collapse Heuristics

To keep the view manageable, Recall automatically collapses:

- Long user messages (> 800 characters)
- Thinking blocks
- Large read/grep outputs (> 10 lines)
- Bash commands with large output (> 15 lines)
- Long AI responses (> 500 characters)

You can expand any collapsed section by clicking on it.

## File Tracking

Every file operation is tracked and displayed with:

- **Read operations** - See exactly what files the AI read
- **Write operations** - Full file contents for new files
- **Edit operations** - Side-by-side diff view showing before/after
- **Bash commands** - Command and output captured

## View Modes

The session player offers multiple view modes:

| Mode           | Description                                                 |
| -------------- | ----------------------------------------------------------- |
| **Transcript** | Default. Scrollable conversation with expandable tool cards |
| **Tree**       | Subagent hierarchy view for complex multi-agent sessions    |

## Filtering

Use the filters panel to focus on specific content:

- **Frame Types** - Show/hide user messages, AI responses, tool executions, thinking
- **Tool Types** - Filter to specific tools (Read, Write, Edit, Bash, etc.)
- **Errors Only** - Show only tool executions that failed

## Search

Use `Cmd+K` or the search box to search across:

- Session metadata and summaries
- Full content search linking directly to specific frames
