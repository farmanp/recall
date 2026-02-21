# Getting Started with Recall

A step-by-step guide for first-time users of Recall.

## Prerequisites

Before you begin, ensure you have:

1. **Node.js 18 or higher** installed

   ```bash
   node --version  # Should show v18.0.0 or higher
   ```

2. **At least one AI coding agent** with session history:
   - **Claude Code**: Sessions in `~/.claude/projects/`
   - **Codex CLI**: Sessions in `~/.codex/sessions/`
   - **Gemini CLI**: Sessions in `~/.gemini/tmp/`

## Quick Start (npx - Recommended)

The fastest way to get started:

```bash
npx recall-player
```

Recall will:

1. Download and install automatically
2. Start the server on port 3001
3. Open your browser automatically

## First Session Replay

Once Recall opens in your browser:

### 1. Browse Your Sessions

You'll see a list of all your AI coding sessions. Each card shows:

- **Agent badge** (Claude, Codex, or Gemini)
- **Project path** where the session occurred
- **Duration** and **frame count**
- **First message** preview
- **Timestamp** of when the session started

### 2. Filter Sessions

Use the filter tabs at the top:

- **All** - Show sessions from all agents
- **Claude** - Only Claude Code sessions
- **Codex** - Only Codex CLI sessions
- **Gemini** - Only Gemini CLI sessions

### 3. Open a Session

Click on any session card. The **Session Player** will open with:

- **Timeline scrubber** at the top showing event markers
- **Main content area** displaying the current frame
- **Playback controls** at the bottom (play, pause, speed)
- **Frame counter** showing current position (e.g., "Frame 15 of 234")
- **Artifacts panel** on the right (if files were modified)

### 4. Navigate the Session

#### Using Playback Controls

- **Play/Pause**: Click the play button or press `Space`
- **Speed**: Click the speed selector to change playback speed (0.5x - 10x)
- **Timeline**: Click anywhere on the timeline to jump to that frame

#### Using Keyboard Shortcuts

| Key            | Action               |
| -------------- | -------------------- |
| `Space`        | Play/Pause           |
| `←` / `→`      | Previous/Next frame  |
| `Home` / `End` | First/Last frame     |
| `f`            | Open frame filters   |
| `Escape`       | Close filters/modals |

### 5. Understanding Frame Types

Frames are color-coded by type:

- **🟢 User Message** - Your prompts and questions
- **🟣 AI Response** - AI's text responses
- **🔵 Thinking** - AI's internal reasoning process
- **🟡 Tool Execution** - File edits, terminal commands, etc.

### 6. Filter Frame Types

Press `f` to open the frame filter dialog. Toggle frame types to show/hide:

- **User messages**
- **AI responses**
- **Thinking blocks**
- **Tool executions** (with sub-filters for specific tools)

### 7. View File Changes

If the session includes file modifications, the **Artifacts Panel** on the right shows:

- List of modified files
- Click any file to see:
  - **Diff view** (side-by-side or unified)
  - Syntax highlighting
  - Line numbers

### 8. Switch to Chat View

For a more conversational reading experience:

1. Click **"Chat"** toggle button (top right)
2. The view switches to a messaging-style interface
3. Click **"Technical"** to return to the detailed view

## Work Units

**Work Units** group related sessions together (e.g., all sessions for a feature or bug fix).

### Access Work Units

1. Click **"Work Units"** in the navigation
2. See all automatically-grouped work units
3. Click any work unit to replay all sessions in order

### Manual Work Unit Management

From a session player:

1. Click **"Add to Work Unit"**
2. Select existing work unit or create new one
3. Sessions are now grouped together

## Advanced Features

### CWD Filtering

By default, Recall only shows sessions from your **current working directory**:

```bash
cd /Users/me/projects/myapp
npx recall-player
# Shows only sessions from /Users/me/projects/myapp
```

To **disable** and see all sessions:

```bash
RECALL_FILTER_CWD=false npx recall-player
```

### Exclude Directories

Skip certain directories when scanning for sessions:

```bash
RECALL_EXCLUDE_PATTERNS="archived,plugins" npx recall-player
```

### Search Across Sessions

Use the search bar on the Session List page to:

- Search by project name
- Find sessions containing specific code
- Filter by AI model (e.g., "opus", "haiku")

## Tips & Best Practices

### 🎯 Efficient Navigation

- Use **keyboard shortcuts** for fast frame navigation
- Use **speed controls** (2x-5x) to quickly scan boring parts
- Use **filters** to hide thinking/tool frames when reviewing conversations

### 📊 Understanding Your Work

- Review **Work Units** to see multi-session efforts
- Check **session duration** to understand time investment
- Look at **tool execution frames** to see what actually changed

### 🔍 Debugging

- Use **timeline scrubber** to quickly jump to error messages
- **Filter to tool executions** to see only file changes
- **Compare artifacts** to identify when bugs were introduced

### 🚀 Performance

- Recall caches parsed sessions in `~/.recall-player/transcripts.db`
- First load may be slow; subsequent loads are instant
- Clear cache by deleting `~/.recall-player/` directory

## Troubleshooting

### No sessions showing up?

1. Verify session files exist in agent directories
2. Check browser console for errors
3. Test API: `curl http://localhost:3001/api/agents`

### Server won't start?

1. Check port 3001 is available: `lsof -i :3001`
2. Try a different port: `PORT=3002 npx recall-player`
3. Check Node.js version: `node --version`

### Sessions are slow to load?

1. Clear the cache: `rm -rf ~/.recall-player`
2. Reduce sessions shown with `RECALL_FILTER_CWD=true`
3. Exclude large directories with `RECALL_EXCLUDE_PATTERNS`

## Git Tracking (Optional)

Link your AI sessions to git commits for a commit-centric view of your work.

### Enable Tracking

```bash
cd /path/to/your/project
recall enable
```

### Check Status

```bash
recall status
# Shows: branch, tracking status, session/commit counts
```

### View Commits with Sessions

1. Start Recall: `recall`
2. Click "Relays" in the sidebar
3. Browse commits that have linked AI sessions
4. Click any commit to see contributing sessions and file diffs

For detailed documentation, see [GIT_TRACKING.md](GIT_TRACKING.md).

## Next Steps

- Read the full [README](../README.md) for all features
- Check [API documentation](API_EXAMPLES.md) for programmatic access
- Review [CONTRIBUTING](../CONTRIBUTING.md) to add new agent support
- Join discussions on [GitHub Issues](https://github.com/farmanp/recall/issues)

---

**Need help?** Open an issue on [GitHub](https://github.com/farmanp/recall/issues) or check the [FAQ](../README.md#faq).
