---
sidebar_position: 4
---

# Session Sharing

Share sessions with others via expiring links. Useful for code reviews or debugging discussions.

## Setup

Session sharing requires a signing key for secure link generation:

```bash
RECALL_SHARE_SIGNING_KEY="your-secret-key" npx recall-player@latest
```

## Creating Share Links

1. Open a session in the player
2. Click the share button
3. Select expiry duration (1h, 24h, 7d, 30d)
4. Copy the generated link

## Features

### Expiring Links

All share links have a configurable expiry time. Once expired, the link no longer works.

### Content Redaction

By default, sensitive content is redacted in shared sessions. To allow unredacted sharing:

```bash
RECALL_ALLOW_UNREDACTED_SHARES=true
```

### Public Access

Shared links don't require authentication - anyone with the link can view the session.

### Revocable

You can delete share links at any time from the session player.

## API

```bash
# Create share link
POST /api/sessions/:id/share
Body: { expiresIn: "1h" | "24h" | "7d" | "30d", redact?: boolean }

# Access shared session (public)
GET /api/shared/:shareId

# Delete share link
DELETE /api/shared/:shareId
```
