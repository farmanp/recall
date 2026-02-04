# Recall

![Project Status: Beta](https://img.shields.io/badge/status-beta-yellow)
[![npm version](https://img.shields.io/npm/v/recall-player.svg)](https://www.npmjs.com/package/recall-player)
[![npm downloads](https://img.shields.io/npm/dm/recall-player.svg)](https://www.npmjs.com/package/recall-player)

A local-first web application that lets you **replay AI coding sessions** like a video player. Watch how features were built, decisions made, and problems solved across multiple AI coding agents.

**Supported Agents:**

- **Claude Code** - Anthropic's CLI coding assistant
- **Codex CLI** - OpenAI's command-line coding tool
- **Gemini CLI** - Google's terminal-based AI assistant

## Screenshots

<!-- TODO: Add screenshots -->

_Screenshots coming soon - showing session list, playback controls, and Work Units dashboard_

---

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

### Session Browser

- View all sessions across Claude, Codex, and Gemini
- Filter by agent type, date range, and duration
- Search sessions by project name or content
- See session metadata (duration, event count, first message)

### Session Player

- **Frame-by-frame playback** of coding sessions
- **Frame types:** User messages, AI responses, AI thinking, Tool executions
- **Filter controls** to show/hide specific frame types
- **Keyboard shortcuts** for navigation (arrow keys, space, etc.)
- **Search** within sessions to find specific content

### Multi-Agent Support

- Automatically detects and parses sessions from all supported agents
- Agent-specific badges and colors in the UI
- Normalized frame format for consistent playback experience

### Work Units

Work Units are atomic units of work that span across sessions. They help you:

- Track progress on specific tasks across multiple coding sessions
- Review all work related to a feature or bug fix in one place
- Navigate between related sessions easily

Access Work Units from the `/work-units` route in the web interface.

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

## Troubleshooting

### No sessions showing up?

1. Make sure you have session files in one of the supported directories
2. Check the backend console for any errors
3. Try the API directly: `curl http://localhost:3001/api/agents`

### Backend won't start?

1. Make sure you're in the `backend` directory
2. Run `npm install` to install dependencies
3. Check that port 3001 is available

### Frontend won't start?

1. Make sure you're in the `frontend` directory
2. Run `npm install` to install dependencies
3. The frontend will automatically find an available port if 5173 is taken

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
