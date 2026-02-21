# Security

This document describes Recall's security model and is intended for security reviewers, compliance teams, and enterprise users evaluating the tool.

## Executive Summary

Recall is a **passive, read-only log indexer** for AI coding sessions. It has no ability to send data anywhere, does not intercept traffic, and does not modify source code or logs.

## Network Access

Recall has **no ability to send data anywhere**.

- No HTTP clients (except localhost server)
- No WebSockets to external services
- No telemetry
- No analytics
- No background sync
- No external API calls

All network traffic is limited to:

- `localhost` only (for the UI server on port 3001)

You can verify this by:

- Inspecting the source code (`backend/src/` and `frontend/src/`)
- Running Recall with a firewall or network monitor
- Searching the codebase: `grep -r "fetch\|axios\|http\|request" --include="*.ts"`

## No Interception

Recall does not:

- Intercept IDE traffic
- Proxy API calls
- Install certificates
- Inspect encrypted communications
- Hook into process memory
- Capture keystrokes
- Monitor clipboard

Recall only reads files that already exist on disk.

## Threat Model

Recall is designed to be safe in regulated environments.

### In Scope

- Parsing existing local AI session logs
- Indexing for search and playback
- Local-only visualization
- Read-only file access

### Out of Scope

- Intercepting network traffic
- Capturing keystrokes or memory
- Sending data to external services
- Modifying source code or logs
- Background execution or daemons
- System-wide hooks or drivers

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         YOUR MACHINE                             │
│                                                                   │
│   ~/.claude/projects/     ──┐                                    │
│   ~/.codex/sessions/      ──┼──▶  Recall  ──▶  localhost:3001   │
│   ~/.gemini/tmp/          ──┘      │                             │
│                                    ▼                             │
│                           ~/.claude/transcripts.db               │
│                           (local cache, safe to delete)          │
│                                                                   │
│   ❌ No outbound connections                                     │
│   ❌ No data leaves this machine                                 │
└─────────────────────────────────────────────────────────────────┘
```

## File Access

### Read-Only Guarantee

Recall opens all session files in **read-only mode**:

- Source session files (`.jsonl`, `.json`) are never modified
- Recall does not write to agent directories (`~/.claude/`, `~/.codex/`, `~/.gemini/`)
- Original logs remain the source of truth

### Cache Database

Recall maintains a SQLite cache at `~/.claude/transcripts.db`:

- This is a **cache**, not a canonical data store
- Safe to delete at any time (will be rebuilt on next run)
- Contains parsed session metadata for fast querying
- No long-term retention requirements

### Files Recall Creates

| Path                          | Purpose          | Deletable? |
| ----------------------------- | ---------------- | ---------- |
| `~/.claude/transcripts.db`    | Session cache    | Yes        |
| `~/.recall-player/auth-token` | Local auth token | Yes        |

## Authentication

When running on localhost (default), no authentication is required.

For non-localhost access (rare):

- Token-based authentication is required
- Tokens are stored locally in `~/.recall-player/auth-token`
- Tokens never leave the machine

## Viewer Mode

Recall supports a read-only "viewer mode" that blocks all write operations:

```bash
RECALL_VIEWER_MODE=true recall
```

In viewer mode:

- All POST/PATCH/DELETE requests are blocked
- Returns `403 Forbidden` for any mutation attempt
- Useful for shared or demo environments

## Secret Detection

When using sharing features, Recall includes automatic secret detection:

- API keys (`sk-*`, `AKIA*`)
- Passwords and tokens
- Connection strings
- Private keys
- JWTs and bearer tokens

Detected secrets are redacted before any sharing operation.

## Compliance Considerations

### SOC 2 / HIPAA / GDPR

Because Recall has no data egress path:

- No Data Processing Agreement (DPA) required
- No Business Associate Agreement (BAA) required
- No vendor risk review required
- No subprocessor discussion needed

Recall is in the same risk class as:

- `ripgrep`
- `less`
- `git log`
- `sqlitebrowser`

### Common Questions

**Q: Does this tool send code or prompts off-device?**

> No. Recall has no outbound network calls and no cloud services.

**Q: Can this tool intercept or observe traffic?**

> No. Recall does not inspect network traffic, TLS, or IPC. It only reads files already written to disk.

**Q: Can Recall modify source code or logs?**

> No. Recall opens session files in read-only mode and never modifies them.

**Q: Is Recall always running in the background?**

> No. Recall runs only when the user explicitly starts it.

**Q: Can Recall see data from other projects or users?**

> Only if those session files already exist on disk and the user chooses to scan them.

## Verification

To verify Recall's security properties:

### 1. Network Audit

```bash
# Monitor network connections while running Recall
lsof -i -P | grep recall

# Should only show localhost:3001
```

### 2. File Access Audit

```bash
# Monitor file access (macOS)
sudo fs_usage -w -f filesystem | grep recall

# Verify only reads to session directories
```

### 3. Source Code Review

All source code is available at: https://github.com/farmanp/recall

Key files to review:

- `backend/src/server.ts` - Express server setup
- `backend/src/parser/` - File parsing (read-only)
- `backend/src/db/` - SQLite cache operations

## Responsible Disclosure

If you discover a security vulnerability, please report it via:

- GitHub Issues: https://github.com/farmanp/recall/issues

We will respond within 48 hours and work with you to address the issue.

## Version

This security document applies to Recall v2.4.0 and later.

Last updated: February 2026
