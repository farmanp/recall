<div align="center">

# 🎬 Recall

**See exactly what your AI built**

[![npm version](https://img.shields.io/npm/v/recall-player.svg?color=22c55e)](https://www.npmjs.com/package/recall-player)
[![GitHub stars](https://img.shields.io/github/stars/farmanp/recall.svg?style=flat&color=22c55e)](https://github.com/farmanp/recall)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Replay AI coding sessions like a video. Track every file change, understand every decision.**

Works with Claude Code, Codex CLI, and Gemini CLI. 100% local—your code never leaves your machine.

[Quick Start](#quick-start) · [Screenshots](#screenshots) · [Features](#features) · [Documentation](#development)

</div>

---

## How It Works

Recall creates a **read-only layer** over your AI coding logs:

1.  **Scan**: Automatically finds sessions in `~/.claude`, `~/.codex`, and `~/.gemini`
2.  **Index**: Builds a fast SQLite index for instant search across all sessions
3.  **Replay**: Serves a video-player-like interface to step through sessions frame-by-frame
4.  **Group**: Organizes related sessions into "Work Units" to track feature evolution

---

## The Problem

Ever asked **"How did the AI build this feature?"** or **"What did it change while I wasn't looking?"**

When working with AI coding assistants, you often lose context:

- **Invisible Decisions**: Why did it choose this library over that one?
- **Ghost Changes**: Small edits in distant files you might have missed
- **Knowledge Decay**: Forgetting how the AI reached a solution days later
- **Fragmented Work**: Related work spread across a dozen disconnected sessions

**Recall gives you visibility.** Step through every prompt, every response, and every file change—frame by frame.

---

## Screenshots

### Session List

![Session List](docs/assets/session-list.png)
_Browse all your AI sessions with search and agent filtering._

### Session Player

![Session Player](docs/demo.gif)
_Step through sessions frame-by-frame with timeline scrubbing._

### Chat View

![Chat View](docs/assets/chat-view.png)
_Toggle to a clean chat interface for easier reading._

### Work Units

![Work Units](docs/assets/work-units.png)
_Group related sessions to track complex features across time._

---

## Supported Agents

Recall works with three AI coding assistants:

<table>
<tr>
<td align="center">
<img src="https://img.shields.io/badge/Claude_Code-8B5CF6?style=for-the-badge" alt="Claude Code"/>
<br/><b>Anthropic</b>
<br/>Full support for <code>.jsonl</code> session logs.
</td>
<td align="center">
<img src="https://img.shields.io/badge/Codex_CLI-10B981?style=for-the-badge" alt="Codex CLI"/>
<br/><b>OpenAI</b>
<br/>Parses CLI execution history.
</td>
<td align="center">
<img src="https://img.shields.io/badge/Gemini_CLI-3B82F6?style=for-the-badge" alt="Gemini CLI"/>
<br/><b>Google</b>
<br/>Visualizes terminal assistant sessions.
</td>
</tr>
</table>

## Quick Start

### Prerequisites

- **Node.js 18+** (check with `node --version`)
- At least one AI coding agent with session history:
  - Claude Code sessions in `~/.claude/projects/`
  - Codex CLI sessions in `~/.codex/sessions/`
  - Gemini CLI sessions in `~/.gemini/tmp/`

### Installation

**Option 1: npx (Recommended)**

```bash
npx recall-player@latest
```

This will start Recall and automatically open your browser.

**Option 2: Global Install**

```bash
npm install -g recall-player
recall
```

**Enable Git Tracking** (optional but recommended)

```bash
cd /path/to/your/project
recall enable
```

This links your AI sessions to git commits. See the [Git Tracking Guide](docs/GIT_TRACKING.md) for details.

**Option 3: Development Setup**

```bash
# Clone the repository
git clone https://github.com/farmanp/recall.git
cd recall

# Install and build
npm install
npm run build

# Start the server
npm start
```

### Using Recall

1. Recall will automatically open your browser to http://localhost:3001
2. You'll see a list of all your AI coding sessions
3. Use the filter tabs (All, Claude, Codex, Gemini) to filter by agent
4. Click on any session to open the replay player
5. Use the playback controls to step through the session

---

---

## Features

### 📹 Playback

- **Frame-by-Frame**: Step through sessions at variable speeds (0.5x to 20x)
- **Timeline Scrubber**: Navigate with event density markers and chapter points
- **Dead Air Compression**: Skip long AI "thinking time" automatically
- **Keyboard Shortcuts**: Full navigation via hotkeys (Space, 1-5, Arrows, Home/End)

### 🔍 Search

- **Multi-Agent Support**: Native parsing for Claude Code, Codex, and Gemini
- **Full-Text Search**: Find anything across all sessions with SQLite FTS5
- **Project Filtering**: Auto-filter sessions based on your current directory
- **Smart Previews**: See model types, event counts, and first messages at a glance

### 📦 Work Units

- **Group Sessions**: Combine related sessions into a single "Work Unit"
- **Track Evolution**: Replay the entire history of a feature or bug fix

### 🔒 Private & Local

- **Zero Cloud**: 100% local—your code and sessions never leave your machine
- **Read-Only**: Recall never modifies your original session files
- **No Telemetry**: No analytics, no external API calls, no tracking

### 🔗 Git Tracking

- **Commit Linking**: See which sessions contributed to each git commit
- **Branch Filtering**: Browse sessions by git branch
- **File Diffs**: View code changes with side-by-side diff viewer
- **Relays Page**: Commit-centric view of your development work

---

## Use Cases

### 📚 Learning & Knowledge Sharing

**"Show the team how I implemented OAuth"**  
Record and replay your Claude Code session to demonstrate architectural decisions, debugging steps, and final implementation.

### 🐛 Debugging What Went Wrong

**"When did this bug get introduced?"**  
Scrub through timeline to find the exact moment a file change caused unexpected behavior.

### 📊 Session Analytics

**"How much time did I spend on this feature?"**  
Review session duration, frame counts, and tool executions to understand productivity patterns.

### 🔄 Resuming Interrupted Work

**"What was I working on yesterday?"**  
Quickly review your last session's work to pick up where you left off.

---

## Configuration

### Environment Variables

#### `RECALL_FILTER_CWD`

Controls automatic directory-based session filtering (default: `true`).

```bash
# Show only sessions from current directory (default)
cd /Users/me/projects/myapp
npx recall-player@latest

# Disable filtering to see ALL sessions
RECALL_FILTER_CWD=false npx recall-player@latest
```

#### `RECALL_EXCLUDE_PATTERNS`

Comma-separated glob patterns to exclude directories from session scanning.

```bash
# Exclude specific directories
RECALL_EXCLUDE_PATTERNS="archived,thedotmack" npx recall-player@latest

# Exclude with glob patterns
RECALL_EXCLUDE_PATTERNS="**/test-data/**,**/plugins/**" npx recall-player@latest
```

---

## Project Structure

```
recall/
├── backend/                 # Node.js + Express + TypeScript
│   ├── src/
│   │   ├── parser/          # Agent-specific parsers
│   │   │   ├── agent-detector.ts    # Detects agent from file path
│   │   │   ├── base-parser.ts       # Abstract parser base class
│   │   │   ├── claude-parser.ts     # Claude Code parser
│   │   │   ├── codex-parser.ts      # Codex CLI parser
│   │   │   ├── gemini-parser.ts     # Gemini CLI parser
│   │   │   └── parser-factory.ts    # Parser selection factory
│   │   ├── routes/          # API endpoints
│   │   ├── db/              # Database layer
│   │   └── types/           # TypeScript types
│   └── package.json
│
├── frontend/                # React + Vite + TypeScript
│   ├── src/
│   │   ├── pages/           # Main pages (SessionList, SessionPlayer)
│   │   ├── components/      # Reusable components
│   │   ├── api/             # API client
│   │   └── types/           # TypeScript types
│   └── package.json
│
└── README.md
```

---

## API Reference

### List Sessions

```bash
# Get all sessions
curl 'http://localhost:3001/api/sessions'

# Filter by agent
curl 'http://localhost:3001/api/sessions?agent=claude'
curl 'http://localhost:3001/api/sessions?agent=codex'
curl 'http://localhost:3001/api/sessions?agent=gemini'

# Pagination
curl 'http://localhost:3001/api/sessions?limit=10&offset=20'
```

### Get Available Agents

```bash
curl 'http://localhost:3001/api/agents'
# Returns: { "agents": ["claude", "codex", "gemini"], "counts": {...} }
```

### Get Session Details

```bash
curl 'http://localhost:3001/api/sessions/{sessionId}'
```

### Get Session Frames

```bash
curl 'http://localhost:3001/api/sessions/{sessionId}/frames'
```

---

## CLI Reference

Recall provides CLI commands for both starting the server and managing git tracking.

### Server Commands

```bash
recall              # Start the web server (default)
recall start        # Same as above
recall serve        # Same as above
```

### Git Tracking Commands

```bash
recall enable       # Enable git tracking for current repository
recall disable      # Disable git tracking for current repository
recall status       # Show tracking status for current repository
recall list         # List all enabled repositories
```

### Example: Enable Git Tracking

```bash
cd ~/projects/my-app
recall enable
# ✓ Git tracking enabled for my-app

recall status
# Shows: branch, tracking status, session/commit counts
```

For detailed git tracking documentation, see [docs/GIT_TRACKING.md](docs/GIT_TRACKING.md).

---

## Keyboard Shortcuts (Session Player)

| Key            | Action                     |
| -------------- | -------------------------- |
| `Space`        | Play/Pause                 |
| `←` / `→`      | Previous/Next frame        |
| `Home` / `End` | First/Last frame           |
| `n` / `p`      | Next/Previous search match |
| `?`            | Toggle help panel          |

---

## Development

### Quick Development Setup

```bash
git clone https://github.com/farmanp/recall.git
cd recall
npm run build    # Build everything
npm start        # Start the server
```

### Backend Development

```bash
cd backend
npm run dev      # Development with hot reload
npm run build    # Build for production
npm start        # Run production build
npm test         # Run tests
```

### Frontend Development

```bash
cd frontend
npm run dev      # Development with hot reload (with API proxy)
npm run build    # Build for production
npm run lint     # Run ESLint
npm run preview  # Preview production build
```

### Publishing

```bash
npm run build              # Build backend + frontend
npm publish --access public --otp=CODE  # Publish to npm
```

---

## Session File Locations

Recall automatically scans these directories for sessions:

| Agent       | Directory                       | File Format                   |
| ----------- | ------------------------------- | ----------------------------- |
| Claude Code | `~/.claude/projects/{project}/` | `*.jsonl`                     |
| Codex CLI   | `~/.codex/sessions/`            | `*.jsonl` (with date subdirs) |
| Gemini CLI  | `~/.gemini/tmp/{hash}/chats/`   | `session-*.json`              |

---

## FAQ

### How do I capture screenshots for GitHub/docs?

We provide an automated screenshot script:

```bash
# 1. Install Playwright (if needed)
npm install -D playwright

# 2. Start Recall
npm start

# 3. In another terminal, run the script
node scripts/capture-screenshots.js
```

Screenshots will be saved to `docs/assets/`.

### Can I export or share sessions?

Currently, Recall is **view-only** and designed for local use. Sessions contain potentially sensitive code and credentials, so we don't support exporting or cloud sync. You can:

- Take screenshots of specific frames
- Use screen recording software to capture playback
- Share the session `.jsonl` files manually (with caution)

### Why isn't my agent showing up?

Recall scans these directories automatically:

- Claude Code: `~/.claude/projects/`
- Codex CLI: `~/.codex/sessions/`
- Gemini CLI: `~/.gemini/tmp/`

If you don't see sessions:

1. Verify you have session files in one of these directories
2. Check the backend logs for parsing errors
3. Try: `curl http://localhost:3001/api/agents` to see detected agents

### Can I filter sessions by project?

Yes! Use the **CWD filter** feature:

```bash
# Run Recall from your project directory
cd /Users/me/projects/myapp
npx recall-player@latest
```

Only sessions from `/Users/me/projects/myapp` will be shown. Disable with `RECALL_FILTER_CWD=false`.

### Does Recall modify my session files?

**No.** All session files are opened in **read-only mode**. Recall never writes to or modifies your original `.jsonl` or `.json` files.

### Is my data sent to the cloud?

**Recall has no ability to send data anywhere.**

- No HTTP clients (except localhost server)
- No WebSockets to external services
- No telemetry or analytics
- No background sync

All data stays on your machine. You can verify this by running Recall with a firewall or network monitor.

---

## Troubleshooting

For detailed troubleshooting, see the [**Troubleshooting Guide**](docs/TROUBLESHOOTING.md).

### Quick Fixes

**Sessions not appearing?**

```bash
# Clear the database cache and restart
rm -f ~/.recall-player/transcripts.db*
npx recall-player@latest
```

**SQLite corruption errors?**

```bash
# The transcript DB is just a cache - safe to delete
rm -f ~/.recall-player/transcripts.db*
npx recall-player@latest
```

**Stale npx cache?**

```bash
npx clear-npx-cache && npx recall-player@latest
```

See the [full troubleshooting guide](docs/TROUBLESHOOTING.md) for more solutions

---

## Security

Recall is a **passive, read-only log indexer**. It has no ability to send data anywhere.

- **No network egress**: No HTTP clients, WebSockets, telemetry, or external API calls
- **No interception**: Does not proxy API calls, install certificates, or inspect traffic
- **Read-only**: Session files are never modified
- **Cache-only persistence**: SQLite database is a cache, safe to delete anytime
- **Localhost-only**: Server binds to localhost by default

Recall is in the same risk class as `ripgrep`, `less`, or `git log`.

For enterprise security reviews, see [SECURITY.md](SECURITY.md) with:

- Threat model
- Compliance FAQ (SOC 2, HIPAA, GDPR)
- Verification commands
- Data flow diagrams

---

## License

MIT

---

## Credits

Built with:

- [Node.js](https://nodejs.org/) + [Express](https://expressjs.com/)
- [React](https://react.dev/) + [Vite](https://vitejs.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/)

---

## Roadmap

- [x] **Git Tracking**: Link sessions to git commits with branch filtering
- [ ] **More Agents**: Support for GitHub Copilot CLI and Aider
- [ ] **Live Mode**: Watch sessions in real-time as the AI works
- [ ] **Annotations**: Add comments and notes to sessions
- [ ] **Team Sharing**: Export and share Work Units for code reviews

## Community & Support

- **Bugs & Features**: Open a [GitHub Issue](https://github.com/farmanp/recall/issues)
- **Discussions**: Join the conversation on [GitHub Discussions](https://github.com/farmanp/recall/discussions)
- **Code of Conduct**: Please follow our [Code of Conduct](CODE_OF_CONDUCT.md)

If you find Recall useful, please [star the repository](https://github.com/farmanp/recall)!

---

<div align="center">
Built for developers who work with AI coding assistants
</div>
