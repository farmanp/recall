# API Examples

This document provides comprehensive examples for all API endpoints in the Recall backend.

## Table of Contents

- [Base URL](#base-url)
- [Health Check](#health-check)
- [Session Endpoints](#session-endpoints)
  - [List Sessions](#list-sessions)
  - [Get Session Details](#get-session-details)
  - [Get Session Timeline](#get-session-timeline)
  - [Get Single Event](#get-single-event)
  - [Get Projects](#get-projects)
- [Query Parameters](#query-parameters)
- [Error Responses](#error-responses)
- [Advanced Examples](#advanced-examples)

---

## Base URL

**Development:** `http://localhost:3001`

**Production:** `http://localhost:3001` (local-only)

---

## Health Check

### `GET /api/health`

Check if the server is running and database is connected.

#### Example Request

```bash
curl http://localhost:3001/api/health
```

#### Example Response

```json
{
  "status": "ok",
  "timestamp": "2026-02-02T20:15:30.123Z",
  "database": "connected"
}
```

#### Response Codes

- `200 OK`: Server is healthy
- `500 Internal Server Error`: Database connection failed

---

## Session Endpoints

### List Sessions

#### `GET /api/sessions`

Get a paginated list of all sessions.

#### Basic Example

```bash
# Get first 20 sessions (default)
curl http://localhost:3001/api/sessions
```

#### Example Response

```json
{
  "sessions": [
    {
      "id": 123,
      "claude_session_id": "550e8400-e29b-41d4-a716-446655440000",
      "sdk_session_id": "550e8400-e29b-41d4-a716-446655440000",
      "project": "my-awesome-project",
      "user_prompt": "Create a REST API for user management",
      "started_at": "2026-02-02T10:00:00.000Z",
      "started_at_epoch": 1738490400000,
      "completed_at": "2026-02-02T11:30:00.000Z",
      "completed_at_epoch": 1738495800000,
      "status": "completed",
      "prompt_counter": 15
    },
    {
      "id": 122,
      "claude_session_id": "660e8400-e29b-41d4-a716-446655440001",
      "sdk_session_id": "660e8400-e29b-41d4-a716-446655440001",
      "project": "frontend-redesign",
      "user_prompt": "Update the navigation component to use Tailwind",
      "started_at": "2026-02-01T14:20:00.000Z",
      "started_at_epoch": 1738420800000,
      "completed_at": "2026-02-01T14:45:00.000Z",
      "completed_at_epoch": 1738422300000,
      "status": "completed",
      "prompt_counter": 3
    }
  ],
  "total": 127,
  "offset": 0,
  "limit": 20
}
```

#### Pagination Examples

```bash
# Get first 5 sessions
curl 'http://localhost:3001/api/sessions?limit=5'

# Get next 5 sessions (skip first 5)
curl 'http://localhost:3001/api/sessions?limit=5&offset=5'

# Get 10 sessions starting from offset 20
curl 'http://localhost:3001/api/sessions?limit=10&offset=20'
```

#### Filter by Project

```bash
# Get sessions for a specific project
curl 'http://localhost:3001/api/sessions?project=my-awesome-project'

# Combine with pagination
curl 'http://localhost:3001/api/sessions?project=my-awesome-project&limit=10'
```

#### Filter by Date Range

```bash
# Get sessions started after a specific date
curl 'http://localhost:3001/api/sessions?dateStart=2026-02-01T00:00:00.000Z'

# Get sessions started before a specific date
curl 'http://localhost:3001/api/sessions?dateEnd=2026-02-02T23:59:59.999Z'

# Get sessions within a date range
curl 'http://localhost:3001/api/sessions?dateStart=2026-02-01T00:00:00.000Z&dateEnd=2026-02-02T23:59:59.999Z'
```

#### Combined Filters

```bash
# Filter by project and date range with pagination
curl 'http://localhost:3001/api/sessions?project=my-awesome-project&dateStart=2026-02-01T00:00:00.000Z&limit=10&offset=0'
```

---

### Get Session Details

#### `GET /api/sessions/:id`

Get metadata and statistics for a specific session.

#### Example Request

```bash
curl http://localhost:3001/api/sessions/550e8400-e29b-41d4-a716-446655440000
```

#### Example Response

```json
{
  "session": {
    "id": 123,
    "claude_session_id": "550e8400-e29b-41d4-a716-446655440000",
    "sdk_session_id": "550e8400-e29b-41d4-a716-446655440000",
    "project": "my-awesome-project",
    "user_prompt": "Create a REST API for user management",
    "started_at": "2026-02-02T10:00:00.000Z",
    "started_at_epoch": 1738490400000,
    "completed_at": "2026-02-02T11:30:00.000Z",
    "completed_at_epoch": 1738495800000,
    "status": "completed",
    "prompt_counter": 15
  },
  "eventCount": 158,
  "promptCount": 15,
  "observationCount": 143
}
```

#### Error Response (Session Not Found)

```bash
curl http://localhost:3001/api/sessions/invalid-uuid
```

```json
{
  "error": "Session not found"
}
```

**Status Code:** `404 Not Found`

---

### Get Session Timeline

#### `GET /api/sessions/:id/events`

Get the chronologically ordered timeline of events (prompts + observations) for a session.

#### Basic Example

```bash
# Get first 100 events (default)
curl http://localhost:3001/api/sessions/550e8400-e29b-41d4-a716-446655440000/events
```

#### Example Response

```json
{
  "events": [
    {
      "event_type": "prompt",
      "row_id": 1,
      "prompt_number": 1,
      "ts": 1738490400000,
      "text": "Create a REST API for user management",
      "kind_rank": 0
    },
    {
      "event_type": "observation",
      "row_id": 1,
      "prompt_number": 1,
      "ts": 1738490420000,
      "text": "Setting up Express server with TypeScript",
      "kind_rank": 1,
      "obs_type": "feature",
      "title": "Initial API Setup",
      "subtitle": "Express + TypeScript configuration",
      "facts": [
        "Created Express server with TypeScript",
        "Configured CORS and JSON middleware",
        "Set up basic error handling"
      ],
      "narrative": "I've set up a basic Express server with TypeScript. The server includes CORS support for cross-origin requests, JSON parsing middleware, and a centralized error handler. This foundation will allow us to add user management endpoints.",
      "concepts": ["express", "typescript", "rest-api", "middleware"],
      "files_read": ["package.json", "tsconfig.json"],
      "files_modified": ["src/server.ts", "src/index.ts"]
    },
    {
      "event_type": "observation",
      "row_id": 2,
      "prompt_number": 1,
      "ts": 1738490450000,
      "text": "Database schema created",
      "kind_rank": 1,
      "obs_type": "feature",
      "title": "User Database Schema",
      "subtitle": "PostgreSQL table for users",
      "facts": [
        "Created users table with id, email, name, password_hash",
        "Added indexes on email for fast lookups",
        "Configured UUID primary keys"
      ],
      "narrative": "I've created the database schema for user management. The users table includes essential fields (id, email, name, password_hash) with proper indexing for performance.",
      "concepts": ["database", "postgresql", "schema-design"],
      "files_read": [],
      "files_modified": ["migrations/001_create_users_table.sql"]
    }
  ],
  "total": 158,
  "offset": 0,
  "limit": 100,
  "sessionId": "550e8400-e29b-41d4-a716-446655440000"
}
```

#### Pagination Examples

```bash
# Get first 50 events
curl 'http://localhost:3001/api/sessions/550e8400-e29b-41d4-a716-446655440000/events?limit=50'

# Get next 50 events
curl 'http://localhost:3001/api/sessions/550e8400-e29b-41d4-a716-446655440000/events?limit=50&offset=50'

# Get all events (for small sessions)
curl 'http://localhost:3001/api/sessions/550e8400-e29b-41d4-a716-446655440000/events?limit=1000'
```

#### Filter by Observation Types

```bash
# Get only feature observations
curl 'http://localhost:3001/api/sessions/550e8400-e29b-41d4-a716-446655440000/events?types=feature'

# Get features and bugfixes
curl 'http://localhost:3001/api/sessions/550e8400-e29b-41d4-a716-446655440000/events?types=feature,bugfix'

# Get decisions and refactorings
curl 'http://localhost:3001/api/sessions/550e8400-e29b-41d4-a716-446655440000/events?types=decision,refactor'
```

**Available observation types:**

- `feature`: New feature implementations
- `bugfix`: Bug fixes
- `decision`: Architecture/design decisions
- `refactor`: Code refactoring
- `discovery`: Code exploration
- `change`: General changes

#### Filter by Timestamp

```bash
# Get events after a specific timestamp (epoch milliseconds)
curl 'http://localhost:3001/api/sessions/550e8400-e29b-41d4-a716-446655440000/events?afterTs=1738490500000'

# Combine with pagination
curl 'http://localhost:3001/api/sessions/550e8400-e29b-41d4-a716-446655440000/events?afterTs=1738490500000&limit=50'
```

#### Combined Filters

```bash
# Feature observations after timestamp with pagination
curl 'http://localhost:3001/api/sessions/550e8400-e29b-41d4-a716-446655440000/events?types=feature&afterTs=1738490500000&limit=50&offset=0'
```

---

### Get Single Event

#### `GET /api/sessions/:sessionId/events/:eventType/:eventId`

Get details for a single event (prompt or observation).

#### Get a Prompt

```bash
curl http://localhost:3001/api/sessions/550e8400-e29b-41d4-a716-446655440000/events/prompt/1
```

**Response:**

```json
{
  "event_type": "prompt",
  "row_id": 1,
  "prompt_number": 1,
  "ts": 1738490400000,
  "text": "Create a REST API for user management",
  "kind_rank": 0
}
```

#### Get an Observation

```bash
curl http://localhost:3001/api/sessions/550e8400-e29b-41d4-a716-446655440000/events/observation/1
```

**Response:**

```json
{
  "event_type": "observation",
  "row_id": 1,
  "prompt_number": 1,
  "ts": 1738490420000,
  "text": "Setting up Express server with TypeScript",
  "kind_rank": 1,
  "obs_type": "feature",
  "title": "Initial API Setup",
  "subtitle": "Express + TypeScript configuration",
  "facts": ["Created Express server with TypeScript", "Configured CORS and JSON middleware"],
  "narrative": "Full narrative text...",
  "concepts": ["express", "typescript"],
  "files_read": ["package.json"],
  "files_modified": ["src/server.ts"]
}
```

#### Error Response (Invalid Event Type)

```bash
curl http://localhost:3001/api/sessions/550e8400-e29b-41d4-a716-446655440000/events/invalid/1
```

```json
{
  "error": "Invalid event type. Must be \"prompt\" or \"observation\""
}
```

**Status Code:** `400 Bad Request`

#### Error Response (Event Not Found)

```bash
curl http://localhost:3001/api/sessions/550e8400-e29b-41d4-a716-446655440000/events/prompt/99999
```

```json
{
  "error": "Event not found"
}
```

**Status Code:** `404 Not Found`

---

### Get Projects

#### `GET /api/sessions/meta/projects`

Get a list of all unique project names.

#### Example Request

```bash
curl http://localhost:3001/api/sessions/meta/projects
```

#### Example Response

```json
{
  "projects": [
    "backend-api",
    "frontend-redesign",
    "mobile-app",
    "my-awesome-project",
    "performance-optimization"
  ]
}
```

---

## Query Parameters

### Pagination Parameters

| Parameter | Type   | Default  | Description               |
| --------- | ------ | -------- | ------------------------- |
| `offset`  | number | 0        | Number of items to skip   |
| `limit`   | number | 20/100\* | Number of items to return |

\*Default limit is 20 for sessions, 100 for events.

### Filter Parameters

| Endpoint          | Parameter   | Type   | Description                              |
| ----------------- | ----------- | ------ | ---------------------------------------- |
| `/api/sessions`   | `project`   | string | Filter by project name                   |
| `/api/sessions`   | `dateStart` | string | Filter by start date (ISO 8601)          |
| `/api/sessions`   | `dateEnd`   | string | Filter by end date (ISO 8601)            |
| `/api/.../events` | `types`     | string | Filter by observation types (comma-sep)  |
| `/api/.../events` | `afterTs`   | number | Filter events after timestamp (epoch ms) |

---

## Error Responses

### Common Error Format

All errors follow this structure:

```json
{
  "error": "Error type",
  "message": "Detailed error message"
}
```

### Error Status Codes

| Code | Meaning               | Example Scenario               |
| ---- | --------------------- | ------------------------------ |
| 400  | Bad Request           | Invalid event type             |
| 404  | Not Found             | Session or event doesn't exist |
| 500  | Internal Server Error | Database error                 |

### Example Error Responses

#### 400 Bad Request

```bash
curl 'http://localhost:3001/api/sessions/550e8400-e29b-41d4-a716-446655440000/events/invalid-type/1'
```

```json
{
  "error": "Invalid event type. Must be \"prompt\" or \"observation\""
}
```

#### 404 Not Found

```bash
curl http://localhost:3001/api/sessions/nonexistent-session-id
```

```json
{
  "error": "Session not found"
}
```

#### 500 Internal Server Error

```bash
# If database is disconnected
curl http://localhost:3001/api/sessions
```

```json
{
  "error": "Failed to fetch sessions",
  "message": "Database connection lost"
}
```

---

## Advanced Examples

### Building a Session Timeline Viewer

**Step 1:** Get session list

```bash
curl 'http://localhost:3001/api/sessions?limit=10'
```

**Step 2:** Get session details

```bash
SESSION_ID="550e8400-e29b-41d4-a716-446655440000"
curl "http://localhost:3001/api/sessions/$SESSION_ID"
```

**Step 3:** Get first page of timeline events

```bash
curl "http://localhost:3001/api/sessions/$SESSION_ID/events?limit=100&offset=0"
```

**Step 4:** Load more events as user scrolls

```bash
curl "http://localhost:3001/api/sessions/$SESSION_ID/events?limit=100&offset=100"
curl "http://localhost:3001/api/sessions/$SESSION_ID/events?limit=100&offset=200"
```

### Implementing Infinite Scroll

```bash
# JavaScript example using fetch
const loadEvents = async (sessionId, offset = 0, limit = 100) => {
  const response = await fetch(
    `http://localhost:3001/api/sessions/${sessionId}/events?offset=${offset}&limit=${limit}`
  );
  const data = await response.json();
  return data;
};

// Load first page
const page1 = await loadEvents(sessionId, 0, 100);

// Load next page when user scrolls
const page2 = await loadEvents(sessionId, 100, 100);
```

### Filtering Timeline by Event Type

```bash
# Show only architecture decisions
SESSION_ID="550e8400-e29b-41d4-a716-446655440000"
curl "http://localhost:3001/api/sessions/$SESSION_ID/events?types=decision"
```

### Implementing "Jump to Event" Feature

```bash
# User clicks event at index 45 in timeline
# Get event details
curl "http://localhost:3001/api/sessions/$SESSION_ID/events/observation/45"
```

### Searching Sessions by Project

```bash
# Get all sessions for a project
curl 'http://localhost:3001/api/sessions?project=backend-api&limit=100'
```

### Exporting Session Data

```bash
# Export session metadata
SESSION_ID="550e8400-e29b-41d4-a716-446655440000"
curl "http://localhost:3001/api/sessions/$SESSION_ID" > session_metadata.json

# Export full timeline
curl "http://localhost:3001/api/sessions/$SESSION_ID/events?limit=1000" > session_timeline.json
```

### Using jq for JSON Processing

```bash
# Get only session titles
curl 'http://localhost:3001/api/sessions?limit=10' | jq '.sessions[].user_prompt'

# Get event count for each session
curl 'http://localhost:3001/api/sessions?limit=10' | jq '.sessions[] | {project, prompt_counter}'

# Extract only feature observations
SESSION_ID="550e8400-e29b-41d4-a716-446655440000"
curl "http://localhost:3001/api/sessions/$SESSION_ID/events?types=feature" | \
  jq '.events[] | {title, subtitle, files_modified}'
```

### Pretty Printing JSON

```bash
# Add pretty-print flag to curl
curl -s http://localhost:3001/api/health | jq '.'

# Or use Python
curl -s http://localhost:3001/api/health | python -m json.tool
```

### Debugging with Verbose Output

```bash
# Show HTTP headers and response
curl -v http://localhost:3001/api/health

# Show only headers
curl -I http://localhost:3001/api/health

# Show timing information
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:3001/api/sessions
```

**curl-format.txt:**

```
time_namelookup:  %{time_namelookup}\n
time_connect:  %{time_connect}\n
time_appconnect:  %{time_appconnect}\n
time_pretransfer:  %{time_pretransfer}\n
time_redirect:  %{time_redirect}\n
time_starttransfer:  %{time_starttransfer}\n
----------\n
time_total:  %{time_total}\n
```

---

## Response Field Reference

### Session Object

| Field                | Type   | Description                              |
| -------------------- | ------ | ---------------------------------------- |
| `id`                 | number | SQLite row ID                            |
| `claude_session_id`  | string | Session UUID (use this for API calls)    |
| `sdk_session_id`     | string | Same as `claude_session_id`              |
| `project`            | string | Project name                             |
| `user_prompt`        | string | First user prompt in session             |
| `started_at`         | string | ISO 8601 timestamp                       |
| `started_at_epoch`   | number | Unix epoch milliseconds                  |
| `completed_at`       | string | ISO 8601 timestamp (null if active)      |
| `completed_at_epoch` | number | Unix epoch milliseconds (null if active) |
| `status`             | string | "active", "completed", or "failed"       |
| `prompt_counter`     | number | Total prompts in session                 |

### SessionEvent Object

| Field           | Type   | Description                                   |
| --------------- | ------ | --------------------------------------------- |
| `event_type`    | string | "prompt" or "observation"                     |
| `row_id`        | number | Database row ID                               |
| `prompt_number` | number | Prompt sequence number                        |
| `ts`            | number | Timestamp (epoch milliseconds)                |
| `text`          | string | Event text (prompt text or observation title) |
| `kind_rank`     | number | 0 for prompts, 1 for observations             |

**Additional fields for observations:**

| Field            | Type     | Description                              |
| ---------------- | -------- | ---------------------------------------- |
| `obs_type`       | string   | Observation type (feature, bugfix, etc.) |
| `title`          | string   | Observation title                        |
| `subtitle`       | string   | Observation subtitle                     |
| `facts`          | string[] | List of facts (parsed from JSON)         |
| `narrative`      | string   | Full narrative text                      |
| `concepts`       | string[] | Related concepts (parsed from JSON)      |
| `files_read`     | string[] | Files read (parsed from JSON)            |
| `files_modified` | string[] | Files modified (parsed from JSON)        |

---

**Last Updated:** 2026-02-02
**API Version:** 1.0 (Phase 1)
