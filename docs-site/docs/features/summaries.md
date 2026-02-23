---
sidebar_position: 5
---

# Session Summaries

Automatically generate human-readable summaries of coding sessions.

## Summary Types

### Heuristic Summaries

Fast, rule-based summaries generated from session metadata. These are always available and don't require an API key.

Heuristic summaries include:

- Session duration and event count
- Files modified
- Key operations performed

### LLM Summaries

AI-powered summaries using Claude for deeper analysis. Requires an Anthropic API key.

```bash
RECALL_ANTHROPIC_API_KEY="sk-..." npx recall-player@latest
```

LLM summaries provide:

- Natural language description of what was accomplished
- Key decisions made during the session
- Potential issues or concerns identified

## Configuration

| Variable                   | Default          | Description                |
| -------------------------- | ---------------- | -------------------------- |
| `RECALL_ANTHROPIC_API_KEY` | —                | Required for LLM summaries |
| `RECALL_LLM_MODEL`         | `claude-3-haiku` | Model to use               |
| `RECALL_LLM_MAX_TOKENS`    | `1024`           | Max response tokens        |

## Batch Generation

Generate summaries for multiple sessions at once:

```bash
POST /api/summaries/generate-batch
Body: { sessionIds: string[] }
```

## Caching

Summaries are cached in the database for fast retrieval. To regenerate a summary:

```bash
POST /api/sessions/:id/summary/regenerate
```
