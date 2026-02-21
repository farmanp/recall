# Git Tracking Guide

Recall can link your AI coding sessions to git commits, giving you a **commit-centric view** of your development work. See which sessions contributed to each commit, browse by branch, and view file diffs alongside session context.

## Quick Start

```bash
# 1. Navigate to your git repository
cd /path/to/your/project

# 2. Enable git tracking
recall enable

# 3. Work with AI coding assistants as usual
# Sessions will automatically capture git context

# 4. View sessions organized by commit
recall
# Navigate to the "Relays" page in the web UI
```

## CLI Commands

### `recall enable`

Enable git tracking for the current repository.

```bash
cd /path/to/your/project
recall enable
```

**What it does:**

- Registers the repository for git tracking
- Future sessions will capture git context (branch, commits)
- Commits made during sessions will be linked

**Output:**

```
✓ Git tracking enabled for my-project
  Path: /Users/you/projects/my-project

Next steps:
  1. Use Claude Code (or other AI agents) to work on this project
  2. Sessions will be imported with git context automatically
  3. View sessions by commit: http://localhost:3001/relays
```

### `recall status`

Show tracking status for the current directory.

```bash
recall status
```

**Output:**

```
Recall Status

Current Directory
  Path:       /Users/you/projects/my-project
  Git repo:   Yes
  Branch:     main
  Tracking:   Enabled (since 2/20/2026)
  Sessions:   15
  Commits:    42

Global Statistics
  Total commits:   127
  Total branches:  8
```

### `recall list`

List all repositories with git tracking enabled.

```bash
recall list
```

**Output:**

```
Enabled Repositories

● my-project
  /Users/you/projects/my-project
  Enabled: 2/20/2026 · Sessions: 15 · Commits: 42

● another-app
  /Users/you/projects/another-app
  Enabled: 2/15/2026 · Sessions: 8 · Commits: 23

Total: 2 repos · 65 commits tracked
```

### `recall disable`

Disable git tracking for the current repository.

```bash
cd /path/to/your/project
recall disable
```

**Note:** This only stops future tracking. Existing session data is preserved.

## The Relays Page

Once you have git tracking enabled, the **Relays** page in the web UI shows your sessions organized by commit.

### Accessing Relays

1. Start Recall: `recall` (or `npx recall-player@latest`)
2. Click "Relays" in the sidebar navigation
3. Browse commits with linked sessions

### Features

**Commit List View:**

- See all commits that have linked AI sessions
- Filter by branch using the dropdown
- View session count per commit
- Click to expand and see contributing sessions

**Commit Detail View:**

- Full commit metadata (hash, message, author, timestamp)
- List of sessions that contributed to this commit
- File changes with expandable diffs
- Side-by-side diff viewer for each file

### Example Workflow

1. You're working on a feature branch `feature/auth`
2. You use Claude Code to implement OAuth login
3. Multiple sessions contribute code over several days
4. Each session is linked to commits made during that session
5. On the Relays page, you can:
   - Filter to `feature/auth` branch
   - See all commits with AI contributions
   - Click any commit to see which sessions built it
   - Review the file diffs alongside session context

## How Git Tracking Works

### Session Import

When sessions are imported, Recall captures:

1. **Git State at Start**
   - Current branch name
   - HEAD commit hash
   - Dirty/clean working directory status
   - Staged and modified files

2. **Commits Made During Session**
   - All commits created while the session was active
   - Commit hash, message, author, timestamp
   - Links between session and commits

### Data Storage

Git tracking data is stored in the Recall SQLite database (`~/.claude/transcripts.db`):

- `git_activity` - Git state snapshots for each session
- `session_commits` - Links between sessions and commits
- `enabled_repos` - List of repositories with tracking enabled

### Git Context in Session Player

When viewing a session in the player, git context appears in:

- **Session header** - Shows branch name and commit count
- **Git panel** - Expandable panel with full git state
- **Commit badges** - Indicates commits made during session

## Troubleshooting

### "No Git Data Available" on Relays Page

This means no sessions have been imported with git context yet.

**To fix:**

1. Enable tracking: `recall enable`
2. Work on some sessions with Claude Code
3. Sessions will be imported automatically when you start Recall

### Sessions Not Showing Commits

Commits are only linked if they were made during the session timeframe.

**Check:**

- Was the session in a git repository?
- Were commits made while the session was active?
- Is the repository enabled? Run `recall status`

### Tracking Not Working After Enable

Make sure:

1. You're in a git repository (`git status` should work)
2. Sessions are being imported (check the Overview page)
3. The backend server is running with the git tables initialized

### Re-importing Sessions

If you enabled tracking after sessions already existed:

```bash
# Force re-import to capture git context
# (Sessions will be updated, not duplicated)
cd backend && npm run import
```

## Best Practices

### 1. Enable Early

Enable git tracking at the start of a project:

```bash
cd ~/projects/new-project
git init
recall enable
```

### 2. One Repo Per Project

Keep each project in its own git repository for clean session-to-commit mapping.

### 3. Commit Frequently

Smaller, more frequent commits create better session linkage than large monolithic commits.

### 4. Use Descriptive Commit Messages

Good commit messages help when browsing the Relays page:

```bash
# Good
git commit -m "feat: add OAuth login with Google provider"

# Less helpful
git commit -m "updates"
```

## Privacy & Security

- **Local only** - Git data never leaves your machine
- **Read-only access** - Recall reads git state but never modifies repositories
- **No credentials** - Git credentials and tokens are not captured
- **No remote access** - Recall doesn't interact with GitHub/GitLab/etc.
