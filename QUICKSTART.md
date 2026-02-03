# Recall - Quick Start Guide

🎬 **Watch your Claude Code sessions like a video player!**

## Current Status: ✅ FULLY FUNCTIONAL

Both servers are running and ready:
- **Backend API:** http://localhost:3001
- **Frontend App:** http://localhost:5174

## What You've Built

A complete session replay application that lets you watch Claude Code sessions frame-by-frame, with playback controls, keyboard shortcuts, and timeline visualization.

### Features

✅ **6,404 sessions** indexed from `~/.claude/projects/`
✅ **462 frames** from current session ready to replay
✅ Video player-style interface with auto-advance
✅ Playback controls (play/pause, prev/next, speed control)
✅ Keyboard shortcuts (Space, arrows, Home, End)
✅ Timeline scrubber showing progress
✅ Color-coded frame types (user, thinking, response, tools)
✅ Toggle thinking blocks on/off

## How to Use

### 1. Open the Application

Visit: **http://localhost:5174**

### 2. Browse Sessions

- You'll see a list of all 6,404 available sessions
- Each card shows:
  - Session name/slug
  - Project path
  - Number of events
  - Start time and duration
  - First user message preview

### 3. Watch a Session

Click any session to start playback.

**Playback Controls:**
- **▶️ Play** - Auto-advance through frames
- **⏸ Pause** - Stop auto-advance
- **⏮ Prev** - Go to previous frame
- **⏭ Next** - Go to next frame
- **Speed** - Control playback speed (0.25x to 5x)
- **Show Thinking** - Toggle Claude's thinking blocks

**Keyboard Shortcuts:**
- `Space` - Play/Pause
- `→` - Next frame
- `←` - Previous frame
- `Home` - Jump to start
- `End` - Jump to end

### 4. Frame Types

Each frame is color-coded:
- 🔵 **Blue** - User messages
- 🟣 **Purple** - Claude thinking (internal reasoning)
- 🟢 **Green** - Claude responses
- 🟠 **Orange** - Tool executions (Bash, Read, Write, Edit)

## Technical Details

### Backend (backend/)

**Powered by:**
- Node.js + TypeScript + Express
- Reads `.jsonl` transcript files from `~/.claude/projects/`
- Parses entries into playback frames
- Calculates auto-advance timing
- Serves REST API on port 3001

**Key Files:**
- `src/parser/transcript-parser.ts` - Parses .jsonl files
- `src/parser/timeline-builder.ts` - Builds playback frames
- `src/parser/session-indexer.ts` - Indexes all sessions
- `src/routes/sessions.ts` - REST API endpoints

### Frontend (frontend/)

**Powered by:**
- React 18 + TypeScript + Vite
- TailwindCSS for styling
- React Query for data fetching
- React Router for navigation

**Key Files:**
- `src/pages/SessionListPage.tsx` - Session browser
- `src/pages/SessionPlayerPage.tsx` - Video player UI
- `src/api/transcriptClient.ts` - API client
- `src/hooks/useTranscriptApi.ts` - React Query hooks

## API Endpoints

```
GET  /api/sessions                    - List all sessions
GET  /api/sessions/:id                - Get session details
GET  /api/sessions/:id/frames         - Get playback frames
GET  /api/sessions/:id/frames/:frameId - Get single frame
POST /api/sessions/:id/refresh        - Refresh cached timeline
```

## Example Session Data

**Current session (4b198fdf-b80d-4bbc-806f-2900282cdc56):**
- Total frames: 462
- User messages: 27
- Claude thinking: 189
- Claude responses: 66
- Tool executions: 180

## Development

### Start Servers

Backend:
```bash
cd backend
npm run dev  # Runs on http://localhost:3001
```

Frontend:
```bash
cd frontend
npm run dev  # Runs on http://localhost:5174
```

### Build for Production

```bash
cd backend && npm run build
cd frontend && npm run build
```

## Future Enhancements

- 🎨 Syntax highlighting for code blocks
- 📊 File diff visualization (side-by-side)
- 💬 Commentary bubbles from claude-mem
- 🔍 Search and filter sessions
- 📹 Export to video
- ♾️ Virtualized rendering for very long sessions
- 🎯 Jump to specific tool or file
- 📈 Session analytics dashboard

## Troubleshooting

**Frontend not loading?**
- Check that both servers are running
- Verify ports 3001 and 5174 are available
- Check browser console for errors

**No sessions showing?**
- Verify `~/.claude/projects/` directory exists
- Check that .jsonl files are present
- Look at backend logs for indexing errors

**Frames not advancing?**
- Check playback speed setting
- Verify frame has duration value
- Check browser console for JavaScript errors

## Architecture Highlights

**Local-First Design:**
- Reads directly from `~/.claude/projects/`
- No external database needed
- Fast session discovery (6,404 sessions indexed)

**Performance:**
- Frames cached in memory
- Pagination for large session lists
- React Query for efficient data fetching

**Type Safety:**
- Full TypeScript coverage
- Shared types between frontend/backend
- Compile-time error detection

---

**Enjoy watching your Claude Code sessions! 🎬**

*Built with Claude Code*
