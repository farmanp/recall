# Quick Start Guide

Get Recall up and running in 5 minutes.

## Prerequisites

Before you begin, ensure you have:

- **Node.js 18+** installed ([Download](https://nodejs.org/))
- **claude-mem** installed with recorded sessions
- **Terminal** access

## Verify Prerequisites

```bash
# Check Node.js version (should be 18+)
node --version

# Check if claude-mem database exists
ls ~/.claude-mem/claude-mem.db
```

If the database file exists, you're ready to go!

---

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd recall
```

### 2. Install Backend Dependencies

```bash
cd backend
npm install
```

This will install:

- Express (web framework)
- better-sqlite3 (database driver)
- TypeScript and type definitions

---

## Running the Backend

### Start the Development Server

```bash
cd backend
npm run dev
```

You should see:

```
Testing database connection...
✅ Database connected: 127 sessions found

🚀 Recall Server
📡 Server running on http://localhost:3001
💾 Database: ~/.claude-mem/claude-mem.db

API Endpoints:
  GET /api/health
  GET /api/sessions
  GET /api/sessions/:id
  GET /api/sessions/:id/events

Press Ctrl+C to stop
```

---

## Testing the API

Open a new terminal and try these commands:

### 1. Health Check

```bash
curl http://localhost:3001/api/health
```

**Expected output:**

```json
{
  "status": "ok",
  "timestamp": "2026-02-02T20:00:00.000Z",
  "database": "connected"
}
```

### 2. List Sessions

```bash
curl http://localhost:3001/api/sessions?limit=5
```

**Expected output:**

```json
{
  "sessions": [
    {
      "id": 123,
      "claude_session_id": "550e8400-e29b-41d4-a716-446655440000",
      "project": "my-project",
      "user_prompt": "Create a REST API...",
      "started_at": "2026-02-02T10:00:00.000Z",
      "prompt_counter": 15
    }
    // ... more sessions
  ],
  "total": 127,
  "offset": 0,
  "limit": 5
}
```

### 3. Get Session Details

```bash
# Replace <session_id> with a UUID from the previous response
SESSION_ID="<session_id>"
curl "http://localhost:3001/api/sessions/$SESSION_ID"
```

**Expected output:**

```json
{
  "session": {
    "id": 123,
    "claude_session_id": "550e8400-e29b-41d4-a716-446655440000",
    "project": "my-project",
    "user_prompt": "Create a REST API...",
    "prompt_counter": 15
  },
  "eventCount": 158,
  "promptCount": 15,
  "observationCount": 143
}
```

### 4. Get Session Timeline

```bash
curl "http://localhost:3001/api/sessions/$SESSION_ID/events?limit=10"
```

**Expected output:**

```json
{
  "events": [
    {
      "event_type": "prompt",
      "row_id": 1,
      "prompt_number": 1,
      "ts": 1738490400000,
      "text": "User's prompt text..."
    },
    {
      "event_type": "observation",
      "row_id": 1,
      "prompt_number": 1,
      "ts": 1738490420000,
      "text": "Feature implementation...",
      "obs_type": "feature",
      "title": "Feature Title",
      "facts": ["fact 1", "fact 2"],
      "files_modified": ["src/file.ts"]
    }
    // ... more events
  ],
  "total": 158,
  "offset": 0,
  "limit": 10
}
```

---

## Using a Pretty JSON Viewer

For easier reading, pipe curl output to `jq`:

```bash
# Install jq (macOS)
brew install jq

# View sessions with pretty formatting
curl http://localhost:3001/api/sessions?limit=5 | jq '.'

# Extract specific fields
curl http://localhost:3001/api/sessions?limit=5 | jq '.sessions[].project'
```

---

## Running Validation Tests

Test the timeline ordering algorithm:

```bash
# From project root
cd ..
node validate_timeline.js

# Or test a specific session
node validate_timeline.js <session_id>
```

**Expected output:**

```
📊 Validating Session: <session_id>

🔍 Check 1: Verifying session ID mapping...
✅ PASS: All 127 sessions have matching IDs

🔍 Check 2: Validating timeline ordering...
📝 Fetched 158 events (15 prompts, 143 observations)
✅ PASS: Timestamps are chronologically ordered
✅ PASS: Prompts appear before observations
✅ PASS: No duplicate row IDs

🔍 Check 3: Analyzing NULL prompt_number distribution...
✅ INFO: 0 observations (0.00%) have NULL prompt_number

================================================================================
📋 VALIDATION SUMMARY
================================================================================
Checks: 5 passed, 0 failed

✅ All checks passed!
```

---

## Building for Production

### 1. Compile TypeScript

```bash
cd backend
npm run build
```

This creates compiled JavaScript in `backend/dist/`.

### 2. Run Production Build

```bash
npm start
```

The server will run on port 3001 (or `PORT` from `.env`).

---

## Stopping the Server

Press `Ctrl+C` in the terminal where the server is running.

The server will gracefully shut down:

```
⏹️  SIGINT received, shutting down gracefully...
✅ HTTP server closed
✅ Database connection closed
```

---

## Next Steps

Now that you have the backend running, you can:

1. **Explore the API** using the examples in [API_EXAMPLES.md](API_EXAMPLES.md)
2. **Read the architecture** in [ARCHITECTURE.md](ARCHITECTURE.md)
3. **Set up the frontend** (when available)
4. **Contribute** by reading [CONTRIBUTING.md](../CONTRIBUTING.md)

---

## Common Issues

### Issue: Database Not Found

**Error:**

```
Error: Database not found at ~/.claude-mem/claude-mem.db
```

**Solution:**

1. Ensure claude-mem is installed:

   ```bash
   which claude-mem
   ```

2. Run Claude Code to create sessions:

   ```bash
   claude-code
   # Ask Claude Code to help with something
   ```

3. Verify database exists:
   ```bash
   ls -lh ~/.claude-mem/claude-mem.db
   ```

---

### Issue: Port Already in Use

**Error:**

```
Error: listen EADDRINUSE: address already in use :::3001
```

**Solution:**

**Option 1:** Kill the process using port 3001:

```bash
lsof -i :3001
kill -9 <PID>
```

**Option 2:** Use a different port:

```bash
# Create .env file in backend/
echo "PORT=3002" > .env
npm run dev
```

---

### Issue: CORS Errors (Frontend)

**Error (in browser console):**

```
Access to fetch blocked by CORS policy
```

**Solution:**

CORS is already enabled in the backend. If you still see errors:

1. Verify backend is running on port 3001
2. Check that frontend is using correct API URL
3. Restart backend server:
   ```bash
   cd backend
   npm run dev
   ```

---

## Useful Commands

### Development

```bash
# Start dev server (with hot reload)
cd backend && npm run dev

# Build TypeScript
cd backend && npm run build

# Run production build
cd backend && npm start

# Validate timeline
node validate_timeline.js
```

### Testing API

```bash
# Health check
curl http://localhost:3001/api/health

# List sessions (first 5)
curl 'http://localhost:3001/api/sessions?limit=5'

# Get session details
curl http://localhost:3001/api/sessions/<session_id>

# Get timeline events
curl 'http://localhost:3001/api/sessions/<session_id>/events?limit=10'

# Get projects list
curl http://localhost:3001/api/sessions/meta/projects
```

### JSON Processing

```bash
# Pretty print JSON
curl http://localhost:3001/api/health | jq '.'

# Extract specific field
curl http://localhost:3001/api/sessions | jq '.total'

# Get first session's project name
curl http://localhost:3001/api/sessions | jq '.sessions[0].project'
```

---

## Environment Variables

Create a `.env` file in `backend/` to customize settings:

```bash
# backend/.env
PORT=3001
NODE_ENV=development

# Optional: Override database path
# DB_PATH=/path/to/custom/claude-mem.db
```

---

## Quick Reference

### API Endpoints

| Endpoint                                 | Description           |
| ---------------------------------------- | --------------------- |
| `GET /api/health`                        | Health check          |
| `GET /api/sessions`                      | List all sessions     |
| `GET /api/sessions/:id`                  | Get session details   |
| `GET /api/sessions/:id/events`           | Get session timeline  |
| `GET /api/sessions/:id/events/:type/:id` | Get single event      |
| `GET /api/sessions/meta/projects`        | Get all project names |

### Default Ports

- **Backend:** `http://localhost:3001`
- **Frontend (planned):** `http://localhost:5173`

### File Locations

- **Database:** `~/.claude-mem/claude-mem.db`
- **Backend:** `./backend/`
- **Frontend:** `./frontend/`
- **Docs:** `./docs/`

---

## Getting Help

- **Documentation:** Check `docs/` folder
- **API Examples:** See [API_EXAMPLES.md](API_EXAMPLES.md)
- **Development Guide:** See [DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md)
- **Issues:** Check existing GitHub issues or create a new one

---

**You're all set!** The backend is running and ready to serve Claude Code session data.

Next: Read [API_EXAMPLES.md](API_EXAMPLES.md) for more advanced usage examples.
