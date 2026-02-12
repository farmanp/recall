# Epic: Live Session Sharing

**Status:** Future (Post Indie-Ready)
**Priority:** P2
**Effort:** 1.5-2 sessions
**Security:** Requires careful implementation

---

## Why This Matters

> "The only tool that lets you watch AI coding sessions live and share with your team."

| Use Case          | Value                                    |
| ----------------- | ---------------------------------------- |
| Pair programming  | Watch teammate work with AI in real-time |
| Teaching/demos    | Stream to students or audience           |
| Team visibility   | See what's being built as it happens     |
| Stakeholder demos | Show AI-assisted development live        |
| Debugging         | Watch and help when something goes wrong |

---

## Security Requirements (Non-Negotiable)

Before ANY sharing feature ships:

- [ ] Viewer-only mode that disables all write operations
- [ ] Authentication for non-localhost access
- [ ] Secret detection and redaction
- [ ] Explicit user consent before exposing to network
- [ ] Audit logging for shared sessions
- [ ] Auto-expire for share links

---

## Dependency Graph

```
                    ┌─────────────────────────────────────┐
                    │      EPIC: LIVE SESSION SHARING     │
                    └─────────────────────────────────────┘
                                      │
        ┌─────────────────────────────┼─────────────────────────────┐
        │                             │                             │
        ▼                             ▼                             ▼
┌───────────────┐           ┌───────────────┐           ┌───────────────┐
│   PHASE 1     │           │   PHASE 2     │           │   PHASE 3     │
│   Security    │           │  Live Viewing │           │    Sharing    │
│  Foundation   │           │   (Local)     │           │   (Remote)    │
└───────┬───────┘           └───────┬───────┘           └───────┬───────┘
        │                           │                           │
        ▼                           │                           │
   ┌─────────┐                      │                           │
   │   S.1   │                      │                           │
   │ Viewer  │◄─────────────────────┤                           │
   │  Mode   │                      │                           │
   └────┬────┘                      │                           │
        │                           │                           │
        ▼                           ▼                           │
   ┌─────────┐                ┌─────────┐                       │
   │   S.2   │                │   L.1   │                       │
   │ Secret  │                │  Live   │                       │
   │Redaction│                │ Polling │                       │
   └────┬────┘                └────┬────┘                       │
        │                          │                            │
        ▼                          ▼                            │
   ┌─────────┐                ┌─────────┐                       │
   │   S.3   │                │   L.2   │                       │
   │  Auth   │◄───────────────│  Live   │                       │
   │ System  │                │   UI    │                       │
   └────┬────┘                └─────────┘                       │
        │                                                       │
        └───────────────────────────┬───────────────────────────┘
                                    │
                                    ▼
                              ┌─────────┐
                              │   R.1   │
                              │ Share   │
                              │  URL    │
                              └────┬────┘
                                   │
                              ┌────┴────┐
                              │         │
                              ▼         ▼
                         ┌─────────┐ ┌─────────┐
                         │   R.2   │ │   R.3   │
                         │ Tunnel  │ │ Share   │
                         │ Integr. │ │   UI    │
                         └─────────┘ └─────────┘
```

---

# Phase 1: Security Foundation

**Must complete before any sharing.** Effort: ~0.5 session

---

## Task S.1: Viewer-Only Mode

### User Story

As an admin, I want to enable a "viewer mode" that prevents any write operations, so I can safely let others watch sessions.

### Acceptance Criteria

- [ ] New middleware: `viewerModeMiddleware`
- [ ] When enabled, blocks all non-GET requests to sensitive endpoints:
  - `POST /api/sessions/:id/rewind/*`
  - `POST /api/import/*`
  - `PATCH /api/work-units/*`
  - `DELETE /*`
- [ ] Returns `403 Forbidden` with message: "Viewer mode enabled"
- [ ] Configurable via `RECALL_VIEWER_MODE=true` env var
- [ ] Also controllable via API for dynamic toggling

### Files to Create

- `backend/src/middleware/viewer-mode.ts`

### Files to Modify

- `backend/src/server.ts` (apply middleware)
- `backend/src/index.ts` (config)

### Security Notes

- Default: OFF (full access for localhost)
- Auto-enables when sharing is active

---

## Task S.2: Secret Detection & Redaction

### User Story

As a user sharing my session, I want sensitive data automatically redacted so I don't accidentally expose secrets.

### Acceptance Criteria

- [ ] New service: `SecretRedactor`
- [ ] Detects common patterns:
  - API keys: `sk-`, `api_key=`, `apiKey:`
  - AWS: `AKIA`, `aws_secret`
  - Passwords: `password=`, `passwd:`, `secret:`
  - Tokens: `token=`, `bearer `, `auth:`
  - Private keys: `-----BEGIN.*PRIVATE KEY-----`
  - Connection strings: `postgres://`, `mysql://`, `mongodb://`
- [ ] Replaces with `[REDACTED]` in frame content
- [ ] Configurable patterns via config file
- [ ] Option to disable (for trusted viewers)
- [ ] Logs what was redacted (not the values!)

### Files to Create

- `backend/src/services/secret-redactor.ts`
- `backend/src/config/redaction-patterns.json`

### Files to Modify

- `backend/src/routes/sessions.ts` (apply redaction to frame output)

### Testing

- Test with sample sessions containing fake secrets
- Verify patterns don't over-redact (false positives)

---

## Task S.3: Authentication System

### User Story

As an admin, I want to require authentication for non-localhost access so only authorized users can view sessions.

### Acceptance Criteria

- [ ] Simple token-based auth (no user accounts needed for MVP)
- [ ] Generate random access token on first run
- [ ] Store in `~/.recall-player/auth-token`
- [ ] Display token in server startup logs (once)
- [ ] Require `Authorization: Bearer <token>` header for non-localhost
- [ ] Localhost (`127.0.0.1`) always allowed without auth
- [ ] Invalid token returns `401 Unauthorized`

### Files to Create

- `backend/src/middleware/auth.ts`
- `backend/src/services/token-manager.ts`

### Files to Modify

- `backend/src/server.ts` (apply middleware)
- `backend/src/index.ts` (display token)

### Future Enhancements (not MVP)

- Multiple tokens with different permissions
- Token expiration
- Revocation

---

# Phase 2: Live Viewing (Local)

**Prerequisite:** Phase 1 complete. Effort: ~0.5 session

---

## Task L.1: Enable Live Polling in Player

### User Story

As a user, I want to watch a session update in real-time as new frames are added.

### Acceptance Criteria

- [ ] Replace `useSession` with `useLiveSession` in `SessionPlayerPage`
- [ ] Poll every 5 seconds when session is "active"
- [ ] Detect "active" status: session file modified in last 60 seconds
- [ ] Stop polling when session becomes inactive
- [ ] New frames appear automatically without refresh
- [ ] Option to auto-scroll to newest frame

### Files to Modify

- `frontend/src/pages/SessionPlayerPage.tsx`
- `backend/src/routes/sessions.ts` (add `status` field)

### Backend Changes

- Add `status: "active" | "completed"` to session response
- Active = file mtime within last 60 seconds

---

## Task L.2: Live Session UI Indicators

### User Story

As a user watching a live session, I want visual feedback that I'm seeing real-time updates.

### Acceptance Criteria

- [ ] "LIVE" badge (pulsing red dot) when session is active
- [ ] Frame counter showing "X frames (updating...)"
- [ ] Toast notification when new frames arrive
- [ ] "Jump to latest" button when scrolled away from end
- [ ] Auto-scroll toggle (on by default)
- [ ] "Session ended" notification when status changes to completed

### Files to Create

- `frontend/src/components/LiveBadge.tsx`
- `frontend/src/components/LiveBadge.css`

### Files to Modify

- `frontend/src/pages/SessionPlayerPage.tsx`

---

# Phase 3: Remote Sharing

**Prerequisite:** Phases 1 & 2 complete. Effort: ~0.5-1 session

---

## Task R.1: Shareable Session URLs

### User Story

As a user, I want to generate a shareable URL for a session that others can view.

### Acceptance Criteria

- [ ] `POST /api/sessions/:id/share` creates share link
- [ ] Returns: `{ shareId, url, expiresAt }`
- [ ] Share ID is random, unguessable (UUID v4)
- [ ] URL format: `/shared/:shareId`
- [ ] Shared view is always viewer-mode (no write operations)
- [ ] Shared view has redaction enabled by default
- [ ] Links expire after 24 hours (configurable)
- [ ] Can revoke share link: `DELETE /api/shares/:shareId`

### Files to Create

- `backend/src/routes/shares.ts`
- `backend/src/db/migrations/032_share_links.sql`

### Database Schema

```sql
CREATE TABLE share_links (
  share_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_by TEXT,  -- for audit
  revoked_at TEXT,
  FOREIGN KEY (session_id) REFERENCES session_metadata(session_id)
);
```

---

## Task R.2: Tunnel Integration (Optional)

### User Story

As a user, I want to make my session publicly accessible without manual network config.

### Acceptance Criteria

- [ ] "Make Public" button in share UI
- [ ] Integrates with one of:
  - cloudflared (Cloudflare Tunnel) - preferred, free
  - ngrok (if installed)
  - localtunnel (fallback)
- [ ] Auto-detects available tunnel CLI
- [ ] Displays public URL when tunnel established
- [ ] Tunnel auto-closes when share is revoked
- [ ] Warning: "This will expose your session to the internet"

### Files to Create

- `backend/src/services/tunnel-manager.ts`

### Notes

- This is optional - users can use their own tunneling
- Don't bundle tunnel binaries, just integrate if available

---

## Task R.3: Share UI in Frontend

### User Story

As a user, I want an easy way to share sessions from the UI.

### Acceptance Criteria

- [ ] "Share" button in session player header
- [ ] Share modal with options:
  - [ ] Enable redaction (default: on)
  - [ ] Expiration (1 hour, 24 hours, 7 days)
  - [ ] "Make Public" toggle (if tunnel available)
- [ ] Copy link button with success feedback
- [ ] Show active shares for session
- [ ] Revoke button for existing shares
- [ ] Warning about security implications

### Files to Create

- `frontend/src/components/ShareModal.tsx`

### Files to Modify

- `frontend/src/pages/SessionPlayerPage.tsx`

---

# Summary

| Phase             | Tasks         | Effort         | Prerequisite |
| ----------------- | ------------- | -------------- | ------------ |
| **1: Security**   | S.1, S.2, S.3 | 0.5 session    | None         |
| **2: Live Local** | L.1, L.2      | 0.5 session    | Phase 1      |
| **3: Remote**     | R.1, R.2, R.3 | 0.5-1 session  | Phases 1 & 2 |
| **Total**         | 8 tasks       | 1.5-2 sessions |              |

---

# Parallel Execution

```
Phase 1 (Must be sequential - security first):
  S.1 → S.2 → S.3

Phase 2 (After Phase 1):
  L.1 → L.2

Phase 3 (After Phase 2):
  R.1 → R.2 (parallel) → R.3
       → R.3 (can start after R.1)
```

---

# Definition of Done

- [ ] All security tasks complete and tested
- [ ] Viewer mode blocks all write operations
- [ ] Secrets redacted in shared views
- [ ] Auth required for non-localhost
- [ ] Live viewing works for active sessions
- [ ] Share links work with expiration
- [ ] Security review completed
- [ ] Documentation updated

---

# Not In Scope (Future)

- User accounts / multi-user auth
- Permissions (view vs edit)
- Real-time collaboration (multiple cursors)
- Comments on shared sessions
- Cloud-hosted relay service
- Mobile app viewing
