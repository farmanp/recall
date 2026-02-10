# Troubleshooting

This guide helps you resolve common issues with recall-player.

## Understanding the Database Architecture

Recall uses **two databases** with different purposes:

| Database          | Location                          | Purpose                                        | Safe to Delete?                        |
| ----------------- | --------------------------------- | ---------------------------------------------- | -------------------------------------- |
| **Transcript DB** | `~/.recall-player/transcripts.db` | Cached metadata parsed from session files      | **Yes** - fully regenerated on restart |
| **Claude-mem DB** | `~/.claude-mem/claude-mem.db`     | Commentary/observations from claude-mem plugin | No - contains user annotations         |

### What the Transcript Database Contains

The transcript database stores **derived data only**:

- `session_metadata` — Session-level info (ID, project, CWD, timestamps) extracted from JSONL files
- `playback_frames` — Parsed conversation frames for the playback UI
- `parsing_status` — Import progress tracking
- `tool_executions` — Extracted tool call records

**None of this is primary data.** The source of truth is always the `.jsonl` files under:

- `~/.claude/projects/` (Claude Code sessions)
- `~/.codex/sessions/` (Codex CLI sessions)
- `~/.gemini/tmp/` (Gemini CLI sessions)

The transcript DB is a read-optimized cache that can be fully rebuilt at any time.

## Safe Cleanup Steps

When recall-player malfunctions, you can safely delete the transcript database:

```bash
# 1. Stop recall-player (Ctrl+C or kill the process)

# 2. Delete the transcript database (safe - it's just cached metadata)
rm -f ~/.recall-player/transcripts.db ~/.recall-player/transcripts.db-wal ~/.recall-player/transcripts.db-shm

# 3. Also clean up the legacy database location if it exists
rm -f ~/.claude/transcripts.db ~/.claude/transcripts.db-wal ~/.claude/transcripts.db-shm

# 4. Clear the npx cache to ensure fresh code (optional but recommended)
npx clear-npx-cache
# or manually: rm -rf ~/.npm/_npx/

# 5. Restart
npx recall-player
```

On restart, recall-player will:

1. Create a fresh transcript database
2. Start the file watcher to auto-import new sessions
3. Reimport sessions as you access them

## Common Issues

### "disk I/O error (10)" or SQLite Corruption

**Symptoms:**

- Server crashes on startup
- Error messages mentioning SQLite corruption
- `SQLITE_IOERR` errors

**Solution:** Delete the transcript database (see [Safe Cleanup Steps](#safe-cleanup-steps) above).

### Sessions Not Appearing

**Symptoms:**

- UI shows 0 sessions
- JSONL files exist in `~/.claude/projects/`
- Health check shows `transcripts: connected`

**Possible causes:**

1. **Stale npx cache** using old code with different DB path

   ```bash
   npx clear-npx-cache && npx recall-player
   ```

2. **CWD filter active** — By default, recall-player only shows sessions from the directory where it was started

   ```bash
   # Show all sessions regardless of directory
   RECALL_FILTER_CWD=false npx recall-player
   ```

3. **Database created but imports failed** — Wipe and reimport
   ```bash
   rm -f ~/.recall-player/transcripts.db*
   npx recall-player
   ```

### Wrong Sessions Showing / CWD Filter Issues

**Symptoms:**

- Sessions from wrong projects appearing
- Filter not matching expected directories

**Solution:** The session index may be stale. Clean restart:

```bash
rm -f ~/.recall-player/transcripts.db*
npx recall-player
```

### Claude-mem Features Not Working

**Symptoms:**

- Commentary panel is empty
- Health check shows `claude_mem: unavailable`

**Cause:** Claude-mem plugin is not installed or database doesn't exist.

**Solution:** This is expected if you haven't installed claude-mem. Core session playback works without it. To enable commentary features, install the [claude-mem plugin](https://github.com/anthropics/claude-mem).

### Port Already in Use

**Symptoms:**

- Error: `EADDRINUSE: address already in use :::3001`

**Solution:**

```bash
# Find and kill the process using port 3001
lsof -i :3001
kill <PID>

# Or use a different port
PORT=3002 npx recall-player
```

## Environment Variables

| Variable                    | Default     | Description                                  |
| --------------------------- | ----------- | -------------------------------------------- |
| `PORT`                      | `3001`      | Server port                                  |
| `HOST`                      | `127.0.0.1` | Server host                                  |
| `RECALL_FILTER_CWD`         | `true`      | Filter sessions to startup directory         |
| `RECALL_EXCLUDE_PATTERNS`   | (none)      | Comma-separated patterns to exclude          |
| `RECALL_DISABLE_CLAUDE_MEM` | `false`     | Disable claude-mem integration (for testing) |

## Getting Help

If you're still experiencing issues:

1. Check the [GitHub Issues](https://github.com/farmanp/recall/issues) for similar problems
2. Open a new issue with:
   - Your OS and Node.js version
   - The error message or unexpected behavior
   - Steps to reproduce
   - Output of `npx recall-player` startup logs

## Future: User Annotations

Currently, the transcript database contains only derived/cached data and is safe to delete.

If/when recall-player supports user annotations (comments, tags, bookmarks on sessions), those **would** be primary data stored in the transcript DB. At that point, the "safe to delete" guidance would include a caveat about backing up annotations first.
