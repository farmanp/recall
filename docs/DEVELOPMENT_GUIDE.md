# Development Guide

A comprehensive guide for developers working on Recall.

## Table of Contents

- [Local Development Setup](#local-development-setup)
- [Running Tests](#running-tests)
- [Debugging Tips](#debugging-tips)
- [Common Issues and Solutions](#common-issues-and-solutions)
- [Development Workflows](#development-workflows)
- [Best Practices](#best-practices)
- [Troubleshooting Tools](#troubleshooting-tools)

---

## Local Development Setup

### Prerequisites

Ensure you have the following installed:

```bash
# Check Node.js version (18+ required)
node --version
# Expected: v18.x.x or higher (tested with v22.14.0)

# Check npm version
npm --version
# Expected: 9.x.x or higher

# Verify claude-mem database exists
ls ~/.claude-mem/claude-mem.db
# Expected: ~/.claude-mem/claude-mem.db
```

### Step-by-Step Setup

#### 1. Clone and Install Dependencies

```bash
# Clone the repository
git clone <repository-url>
cd recall

# Install root dependencies
npm install

# Install backend dependencies
cd backend
npm install
cd ..

# Install frontend dependencies (when available)
cd frontend
npm install
cd ..
```

#### 2. Configure Environment Variables

Create a `.env` file in the `backend/` directory:

```bash
cd backend
cat > .env << 'EOF'
# Server Configuration
PORT=3001
NODE_ENV=development

# Database Configuration (optional override)
# DB_PATH=/path/to/custom/claude-mem.db
EOF
```

#### 3. Verify Database Connection

Test that you can connect to the claude-mem database:

```bash
cd backend
npm run dev
```

**Expected output:**

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

#### 4. Test API Endpoints

In a new terminal:

```bash
# Health check
curl http://localhost:3001/api/health

# Expected: {"status":"ok","timestamp":"...","database":"connected"}

# List sessions
curl http://localhost:3001/api/sessions?limit=5

# Expected: {"sessions":[...],"total":127,"offset":0,"limit":5}
```

---

## Running Tests

### Backend Tests

The backend uses **Vitest** for testing (already configured).

#### Run All Tests

```bash
cd backend
npm test
```

#### Watch Mode (Re-run tests on file changes)

```bash
cd backend
npm run test:watch
```

#### Coverage Report

```bash
cd backend
npm run test:coverage
```

Coverage reports are generated in `backend/coverage/`.

#### Run Timeline Validation Script

The validation script tests the timeline ordering algorithm:

```bash
# From project root
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
✅ PASS: Prompts appear before observations (for same timestamp)
✅ PASS: No duplicate row IDs

🔍 Check 3: Analyzing NULL prompt_number distribution...
✅ INFO: 0 observations (0.00%) have NULL prompt_number

================================================================================
📋 VALIDATION SUMMARY
================================================================================
Session: <session_id>
Events: 158 (15 prompts, 143 observations)
Checks: 5 passed, 0 failed

📄 Report written to: ./validation_report.json

✅ All checks passed!
```

### Frontend Tests (Planned)

```bash
cd frontend
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:ui       # Vitest UI
```

---

## Debugging Tips

### Backend Debugging

#### 1. Enable Debug Logging

Add console.log statements to trace execution:

```typescript
// In backend/src/db/queries.ts
export function getSessions(query: SessionListQuery) {
  console.log('getSessions called with:', query);

  const db = getDbInstance();
  const sessions = db.prepare('...').all();

  console.log('Found sessions:', sessions.length);
  return { sessions, total: sessions.length };
}
```

#### 2. Use Node.js Debugger

Add `debugger` statements and run with inspector:

```bash
cd backend
node --inspect-brk -r ts-node/register src/index.ts
```

Then open Chrome and navigate to `chrome://inspect`.

#### 3. VS Code Debugging

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Backend",
      "runtimeArgs": ["-r", "ts-node/register"],
      "args": ["${workspaceFolder}/backend/src/index.ts"],
      "cwd": "${workspaceFolder}/backend",
      "env": {
        "NODE_ENV": "development"
      },
      "console": "integratedTerminal",
      "sourceMaps": true
    }
  ]
}
```

Set breakpoints in VS Code and press F5 to start debugging.

#### 4. Inspect Database Queries

Log SQL queries before execution:

```typescript
const query = `SELECT * FROM sessions WHERE id = ?`;
console.log('Executing query:', query, 'with params:', [sessionId]);
const result = db.prepare(query).get(sessionId);
```

#### 5. Use SQLite CLI

Manually inspect the database:

```bash
sqlite3 ~/.claude-mem/claude-mem.db

# List tables
.tables

# Describe table schema
.schema sdk_sessions

# Run queries
SELECT COUNT(*) FROM sdk_sessions;
SELECT * FROM sdk_sessions LIMIT 5;

# Exit
.quit
```

### Frontend Debugging

#### 1. React DevTools

Install React DevTools browser extension:

- [Chrome](https://chrome.google.com/webstore/detail/react-developer-tools/fmkadmapgofadopljbjfkapdkoienihi)
- [Firefox](https://addons.mozilla.org/en-US/firefox/addon/react-devtools/)

#### 2. Network Tab

Open browser DevTools (F12) → Network tab to inspect API calls:

- Check request/response payloads
- Verify status codes
- Inspect response times

#### 3. Console Logging

Add strategic console.log statements:

```typescript
useEffect(() => {
  console.log('Fetching sessions with filters:', filters);
  fetchSessions(filters).then((data) => {
    console.log('Received sessions:', data.sessions.length);
  });
}, [filters]);
```

---

## Common Issues and Solutions

### Issue 1: Database Not Found

**Error:**

```
Error: Database not found at ~/.claude-mem/claude-mem.db
```

**Solution:**

1. Verify claude-mem is installed:

   ```bash
   which claude-mem
   ```

2. Check if database file exists:

   ```bash
   ls -lh ~/.claude-mem/claude-mem.db
   ```

3. If missing, run Claude Code to create sessions:
   ```bash
   claude-code
   # Ask Claude Code to do something to create a session
   ```

---

### Issue 2: Port Already in Use

**Error:**

```
Error: listen EADDRINUSE: address already in use :::3001
```

**Solution:**

1. Find process using port 3001:

   ```bash
   lsof -i :3001
   ```

2. Kill the process:

   ```bash
   kill -9 <PID>
   ```

3. Or change the port in `.env`:
   ```bash
   echo "PORT=3002" > backend/.env
   ```

---

### Issue 3: TypeScript Compilation Errors

**Error:**

```
error TS2304: Cannot find name 'Request'
```

**Solution:**

1. Ensure all `@types/*` packages are installed:

   ```bash
   cd backend
   npm install --save-dev @types/express @types/node @types/better-sqlite3
   ```

2. Check `tsconfig.json` has correct settings:
   ```json
   {
     "compilerOptions": {
       "types": ["node"],
       "esModuleInterop": true
     }
   }
   ```

---

### Issue 4: CORS Errors in Browser

**Error:**

```
Access to fetch at 'http://localhost:3001/api/sessions' from origin 'http://localhost:5173' has been blocked by CORS policy
```

**Solution:**

CORS is already enabled in `server.ts`. If you still see errors:

1. Verify CORS middleware is configured:

   ```typescript
   // backend/src/server.ts
   import cors from 'cors';
   app.use(cors());
   ```

2. Restart the backend server:
   ```bash
   cd backend
   npm run dev
   ```

---

### Issue 5: JSON Parsing Errors

**Error:**

```
Unexpected token in JSON at position 0
```

**Solution:**

Check API response format:

```bash
# Use curl to see raw response
curl -v http://localhost:3001/api/sessions

# Check for HTML error pages (server crash)
# Should see: Content-Type: application/json
```

If you see HTML instead of JSON, check backend logs for errors.

---

### Issue 6: Timeline Events Out of Order

**Error:**
Timeline shows observations before their prompts.

**Solution:**

Run the validation script to verify ordering:

```bash
node validate_timeline.js <session_id>
```

If validation fails, check the `ORDER BY` clause in `backend/src/db/queries.ts`:

```sql
ORDER BY
  ts ASC,                              -- PRIMARY: Time
  COALESCE(prompt_number, 999999) ASC, -- SECONDARY: Prompt group
  kind_rank ASC,                       -- TERTIARY: Prompt before obs
  row_id ASC                           -- FINAL: Tiebreaker
```

---

### Issue 7: Hot Reload Not Working

**Error:**
Changes to TypeScript files don't trigger server restart.

**Solution:**

1. Verify `nodemon` is watching `.ts` files:

   ```json
   // backend/package.json
   {
     "scripts": {
       "dev": "nodemon --watch src --ext ts --exec ts-node src/index.ts"
     }
   }
   ```

2. Restart dev server:
   ```bash
   cd backend
   npm run dev
   ```

---

### Issue 8: Database Locked Error

**Error:**

```
Error: database is locked
```

**Solution:**

1. Ensure no other process is accessing the database:

   ```bash
   lsof ~/.claude-mem/claude-mem.db
   ```

2. Close any SQLite CLI sessions:

   ```bash
   # In sqlite3 CLI
   .quit
   ```

3. Backend uses read-only mode, so it shouldn't lock the database. Verify:
   ```typescript
   // backend/src/db/connection.ts
   const db = new Database(DB_PATH, {
     readonly: true, // ← Should be true
   });
   ```

---

## Development Workflows

### Workflow 1: Adding a New API Endpoint

1. **Define types** in `backend/src/db/schema.ts`:

   ```typescript
   export interface NewFeatureQuery {
     param1?: string;
   }
   ```

2. **Add query function** in `backend/src/db/queries.ts`:

   ```typescript
   export function getNewFeature(query: NewFeatureQuery): Result {
     const db = getDbInstance();
     return db.prepare('SELECT ...').all(query.param1);
   }
   ```

3. **Add route** in `backend/src/routes/sessions.ts`:

   ```typescript
   router.get('/new-feature', (req, res) => {
     const result = getNewFeature({ param1: req.query.param1 });
     res.json(result);
   });
   ```

4. **Test manually**:

   ```bash
   curl http://localhost:3001/api/sessions/new-feature?param1=value
   ```

5. **Write test** (optional):

   ```typescript
   // backend/src/__tests__/new-feature.test.ts
   import { test, expect } from 'vitest';
   import { getNewFeature } from '../db/queries';

   test('getNewFeature returns results', () => {
     const result = getNewFeature({ param1: 'test' });
     expect(result).toBeDefined();
   });
   ```

6. **Document in `docs/API_EXAMPLES.md`**

---

### Workflow 2: Debugging Timeline Ordering Issues

1. **Run validation script**:

   ```bash
   node validate_timeline.js <session_id>
   ```

2. **Check validation report**:

   ```bash
   cat validation_report.json
   ```

3. **Inspect database directly**:

   ```bash
   sqlite3 ~/.claude-mem/claude-mem.db
   SELECT * FROM user_prompts WHERE claude_session_id = '<session_id>';
   SELECT * FROM observations WHERE sdk_session_id = '<session_id>';
   .quit
   ```

4. **Test query manually**:

   ```sql
   SELECT
     'prompt' as event_type,
     p.id as row_id,
     p.prompt_number,
     p.created_at_epoch as ts
   FROM user_prompts p
   WHERE p.claude_session_id = '<session_id>'
   ORDER BY ts ASC, prompt_number ASC;
   ```

5. **Fix ordering logic** in `backend/src/db/queries.ts`

6. **Re-run validation**:
   ```bash
   node validate_timeline.js <session_id>
   ```

---

### Workflow 3: Investigating Performance Issues

1. **Measure API response time**:

   ```bash
   curl -w "@curl-format.txt" -o /dev/null -s http://localhost:3001/api/sessions
   ```

   **curl-format.txt:**

   ```
   time_total:  %{time_total}s\n
   ```

2. **Profile database queries**:

   ```typescript
   // Add timing to queries
   const start = Date.now();
   const result = db.prepare('...').all();
   const duration = Date.now() - start;
   console.log(`Query took ${duration}ms`);
   ```

3. **Use SQLite EXPLAIN QUERY PLAN**:

   ```bash
   sqlite3 ~/.claude-mem/claude-mem.db
   EXPLAIN QUERY PLAN SELECT * FROM sessions ORDER BY started_at_epoch DESC LIMIT 20;
   .quit
   ```

4. **Add indexes if needed** (read-only mode prevents this, but document recommendations):
   ```sql
   -- Recommendation for claude-mem
   CREATE INDEX idx_sessions_started_at ON sdk_sessions(started_at_epoch);
   ```

---

## Best Practices

### Code Quality

1. **Use TypeScript strict mode** (already configured)
2. **Always handle null/undefined**:

   ```typescript
   const session = getSessionById(id);
   if (!session) {
     return res.status(404).json({ error: 'Not found' });
   }
   ```

3. **Validate inputs**:

   ```typescript
   const limit = parseInt(req.query.limit as string, 10);
   if (isNaN(limit) || limit < 1 || limit > 1000) {
     return res.status(400).json({ error: 'Invalid limit' });
   }
   ```

4. **Use parameterized queries** (prevent SQL injection):

   ```typescript
   // Good
   db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);

   // Bad
   db.prepare(`SELECT * FROM sessions WHERE id = ${id}`).get();
   ```

### Performance

1. **Paginate large result sets**:
   - Sessions: default limit 20
   - Events: default limit 100

2. **Parse JSON only when needed**:
   - Don't parse JSON fields if not requested

3. **Use database indexes**:
   - Ensure `created_at_epoch` has an index

### Error Handling

1. **Always wrap database calls in try/catch**:

   ```typescript
   try {
     const result = db.prepare('...').get();
   } catch (error) {
     console.error('Database error:', error);
     res.status(500).json({ error: 'Internal error' });
   }
   ```

2. **Log errors server-side, hide details from client**:
   ```typescript
   console.error('Detailed error:', error.stack);
   res.status(500).json({ error: 'Internal error' }); // Generic message
   ```

### Testing

1. **Test edge cases**:
   - Empty results
   - Large sessions (900+ events)
   - NULL values

2. **Test pagination boundaries**:
   - offset=0, limit=0
   - offset > total
   - limit > total

---

## Troubleshooting Tools

### Database Tools

**SQLite CLI:**

```bash
sqlite3 ~/.claude-mem/claude-mem.db
```

**DB Browser for SQLite** (GUI):

- Download: https://sqlitebrowser.org/
- Open: `~/.claude-mem/claude-mem.db`

### HTTP Tools

**curl:**

```bash
curl -v http://localhost:3001/api/health
```

**HTTPie** (prettier than curl):

```bash
brew install httpie
http GET http://localhost:3001/api/sessions limit==5
```

**Postman/Insomnia** (GUI):

- Import API endpoints and test interactively

### JSON Tools

**jq** (JSON processor):

```bash
brew install jq
curl http://localhost:3001/api/sessions | jq '.sessions[0]'
```

**fx** (interactive JSON viewer):

```bash
npm install -g fx
curl http://localhost:3001/api/sessions | fx
```

### Process Management

**Find port usage:**

```bash
lsof -i :3001
```

**Kill process by port:**

```bash
lsof -ti :3001 | xargs kill -9
```

**Check backend is running:**

```bash
ps aux | grep node
```

---

## Useful Scripts

### Quick Test Script

Create `test-api.sh`:

```bash
#!/bin/bash
set -e

BASE_URL="http://localhost:3001"

echo "Testing API endpoints..."

echo "1. Health check"
curl -s "$BASE_URL/api/health" | jq '.'

echo "2. List sessions"
curl -s "$BASE_URL/api/sessions?limit=2" | jq '.sessions | length'

echo "3. Get session details"
SESSION_ID=$(curl -s "$BASE_URL/api/sessions?limit=1" | jq -r '.sessions[0].claude_session_id')
curl -s "$BASE_URL/api/sessions/$SESSION_ID" | jq '.eventCount'

echo "✅ All tests passed!"
```

Run with:

```bash
chmod +x test-api.sh
./test-api.sh
```

---

**Last Updated:** 2026-02-02
**Version:** Phase 1
