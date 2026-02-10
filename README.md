<div align="center">

# 🎬 Recall

**Replay your AI coding sessions like a video player**

[![npm version](https://img.shields.io/npm/v/recall-player.svg)](https://www.npmjs.com/package/recall-player)
[![npm downloads](https://img.shields.io/npm/dm/recall-player.svg)](https://www.npmjs.com/package/recall-player)
![Project Status: Beta](https://img.shields.io/badge/status-beta-yellow)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Watch how features were built · Review decisions made · Debug what went wrong**

A local-first web application that visualizes AI coding sessions from Claude Code, Codex CLI, and Gemini CLI. Navigate through your coding history frame-by-frame with video-player controls, search across sessions, and group related work into units.

[Quick Start](#quick-start) · [Features](#features) · [Screenshots](#screenshots) · [Documentation](#development)

</div>

---

## Why Recall?

Ever wondered **"How did the AI build this feature?"** or **"What changed between yesterday and today?"**

When working with AI coding assistants, it's easy to lose track of:

- 🤔 **What decisions were made** and why
- 🔧 **What approaches were tried** before settling on the final solution
- 🐛 **When bugs were introduced** during rapid iteration
- 📝 **How file changes evolved** across multiple sessions

**Recall solves this** by giving you a "DVR for your coding sessions" — replay any session frame-by-frame, search across all your work, and visualize the evolution of your codebase.

---

## Screenshots

### Session List

![Session List](docs/assets/session-list.png)
_Browse all your coding sessions across Claude, Codex, and Gemini with powerful filtering and search_

### Session Player

![Session Player](docs/assets/session-player.png)
_Replay sessions frame-by-frame with timeline scrubber, playback controls, and syntax-highlighted code diffs_

### Chat View

![Chat View](docs/assets/chat-view.png)
_Toggle between technical view and conversational chat view for easier reading_

---

## Supported Agents

<table>
<tr>
<td align="center">
<img src="https://img.shields.io/badge/Claude_Code-8B5CF6?style=for-the-badge" alt="Claude Code"/>
<br/>Anthropic's CLI coding assistant
</td>
<td align="center">
<img src="https://img.shields.io/badge/Codex_CLI-10B981?style=for-the-badge" alt="Codex CLI"/>
<br/>OpenAI's command-line tool
</td>
<td align="center">
<img src="https://img.shields.io/badge/Gemini_CLI-3B82F6?style=for-the-badge" alt="Gemini CLI"/>
<br/>Google's terminal assistant
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
npx recall-player
```

This will start Recall and automatically open your browser.

**Option 2: Global Install**

```bash
npm install -g recall-player
recall
```

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

## Features

### 🎥 Video Player Experience

- **Frame-by-frame playback** with play/pause and variable speed (0.5x to 10x)
- **Timeline scrubber** with visual event markers and chapter navigation
- **Keyboard shortcuts** for efficient navigation (Space, arrows, Home/End)
- **Search** within sessions to jump to specific content
- **Frame filtering** to show/hide message types (User, AI, Thinking, Tools)

### 🔍 Multi-Agent Session Browser

- **Unified view** of all sessions across Claude Code, Codex CLI, and Gemini CLI
- **Smart filtering** by agent type, project path, date range, and duration
- **Full-text search** across all session transcripts (powered by SQLite FTS5)
- **CWD filtering** - automatically shows only sessions from your current directory
- **Session metadata** - duration, frame count, AI model, first message preview

### 📦 Work Units (NEW!)

- **Auto-grouping** of related sessions into logical work units
- **Manual management** - add/remove sessions from work units
- **Multi-session playback** - replay entire features or bug fixes
- **Progress tracking** - see all work related to a specific task

### 🎨 Beautiful UI

- **Dark theme** optimized for long viewing sessions
- **Syntax highlighting** with Prism.js for 100+ languages
- **Inline diffs** with side-by-side and unified views
- **Framer Motion** animations for smooth transitions
- **Responsive design** for various screen sizes

### 🔒 Privacy & Security

- **100% local** - no cloud, no analytics, no external requests
- **Read-only** - session files are never modified
- **Offline-first** - works without internet connection
- **SQLite caching** - fast performance with local database

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
npx recall-player

# Disable filtering to see ALL sessions
RECALL_FILTER_CWD=false npx recall-player
```

#### `RECALL_EXCLUDE_PATTERNS`

Comma-separated glob patterns to exclude directories from session scanning.

```bash
# Exclude specific directories
RECALL_EXCLUDE_PATTERNS="archived,thedotmack" npx recall-player

# Exclude with glob patterns
RECALL_EXCLUDE_PATTERNS="**/test-data/**,**/plugins/**" npx recall-player
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
npx recall-player
```

Only sessions from `/Users/me/projects/myapp` will be shown. Disable with `RECALL_FILTER_CWD=false`.

### Does Recall modify my session files?

**No.** All session files are opened in **read-only mode**. Recall never writes to or modifies your original `.jsonl` or `.json` files.

### Is my data sent to the cloud?

**Absolutely not.** Recall is 100% local-first with:

- No analytics
- No external API calls
- No telemetry
- No cloud storage

All data stays on your machine.

---

## Troubleshooting

For detailed troubleshooting, see the [**Troubleshooting Guide**](docs/TROUBLESHOOTING.md).

### Quick Fixes

**Sessions not appearing?**

```bash
# Clear the database cache and restart
rm -f ~/.recall-player/transcripts.db*
npx recall-player
```

**SQLite corruption errors?**

```bash
# The transcript DB is just a cache - safe to delete
rm -f ~/.recall-player/transcripts.db*
npx recall-player
```

**Stale npx cache?**

```bash
npx clear-npx-cache && npx recall-player
```

See the [full troubleshooting guide](docs/TROUBLESHOOTING.md) for more solutions

---

## Security Notes

- **Local-only**: This app is designed for local use only
- **Read-only**: Session files are read but never modified
- **Sensitive data**: Session files may contain API keys, credentials, or sensitive code - do not expose this app to the internet

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
