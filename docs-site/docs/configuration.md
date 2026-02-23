---
sidebar_position: 2
---

# Configuration

Recall can be configured using environment variables.

## Session Filtering

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

## Server Configuration

| Variable                    | Default   | Description                                      |
| --------------------------- | --------- | ------------------------------------------------ |
| `PORT`                      | `3001`    | Server port                                      |
| `HOST`                      | `0.0.0.0` | Server host binding                              |
| `NODE_ENV`                  | —         | Set to `production` for production mode          |
| `AUTO_WATCH`                | `true`    | Enable/disable file watcher on startup           |
| `RECALL_USER_CWD`           | —         | Override working directory for session filtering |
| `RECALL_CORS_ORIGINS`       | —         | Comma-separated list of allowed CORS origins     |
| `RECALL_DISABLE_CLAUDE_MEM` | `false`   | Disable claude-mem database integration          |

## Security & Authentication

| Variable                        | Default | Description                                     |
| ------------------------------- | ------- | ----------------------------------------------- |
| `RECALL_VIEWER_MODE`            | `false` | Start in read-only viewer mode                  |
| `RECALL_LOCALHOST_BYPASS`       | `true`  | Allow localhost requests without authentication |
| `RECALL_TRUST_LOCALHOST_BYPASS` | `true`  | Trust localhost origin for CORS                 |

## Sharing

| Variable                         | Default | Description                             |
| -------------------------------- | ------- | --------------------------------------- |
| `RECALL_SHARE_SIGNING_KEY`       | —       | Secret key for signing share links      |
| `RECALL_ALLOW_UNREDACTED_SHARES` | `false` | Allow sharing without content redaction |

## LLM Summaries

| Variable                   | Default          | Description                         |
| -------------------------- | ---------------- | ----------------------------------- |
| `RECALL_ANTHROPIC_API_KEY` | —                | Anthropic API key for LLM summaries |
| `RECALL_LLM_MODEL`         | `claude-3-haiku` | Model for summary generation        |
| `RECALL_LLM_MAX_TOKENS`    | `1024`           | Max tokens for summary response     |
