# Claude Code Agent Spec: Live Sharing Security Foundation

**Agent:** Claude Code (Sonnet 4.5)
**Branch:** `feat/live-sharing-security`
**Directory:** `~/Documents/projects/recall/`
**Priority:** HIGH - Security-critical, blocks share UI work

---

## Mission

Implement the security foundation required before any session sharing features can be enabled. This is security-critical work that must be done carefully.

---

## Tasks

### Task S.1: Viewer-Only Mode Middleware

**File to Create:** `backend/src/middleware/viewer-mode.ts`

**Acceptance Criteria:**

- [ ] Middleware blocks all non-GET requests when enabled
- [ ] Specifically blocks:
  - `POST /api/sessions/:id/rewind/*`
  - `POST /api/import/*`
  - `PATCH /api/work-units/*`
  - `DELETE /*`
- [ ] Returns `403 Forbidden` with message: `"Viewer mode enabled - write operations disabled"`
- [ ] Configurable via `RECALL_VIEWER_MODE=true` env var
- [ ] Can be toggled via API: `POST /api/admin/viewer-mode`
- [ ] Default: OFF (full access for localhost)

**Implementation:**

```typescript
// backend/src/middleware/viewer-mode.ts
import { Request, Response, NextFunction } from 'express';

let viewerModeEnabled = process.env.RECALL_VIEWER_MODE === 'true';

const BLOCKED_PATTERNS = [
  { method: 'POST', pattern: /^\/api\/sessions\/.*\/rewind/ },
  { method: 'POST', pattern: /^\/api\/import/ },
  { method: 'PATCH', pattern: /^\/api\/work-units/ },
  { method: 'DELETE', pattern: /.*/ },
];

export function viewerModeMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!viewerModeEnabled) {
    return next();
  }

  const isBlocked = BLOCKED_PATTERNS.some(
    ({ method, pattern }) => req.method === method && pattern.test(req.path)
  );

  if (isBlocked) {
    return res.status(403).json({
      error: 'Viewer mode enabled',
      message: 'Write operations are disabled in viewer mode',
    });
  }

  next();
}

export function setViewerMode(enabled: boolean) {
  viewerModeEnabled = enabled;
}

export function isViewerModeEnabled() {
  return viewerModeEnabled;
}
```

**Files to Modify:**

- `backend/src/server.ts` - Apply middleware early in chain
- `backend/src/index.ts` - Log viewer mode status on startup

**Tests:** `backend/src/__tests__/middleware/viewer-mode.test.ts`

---

### Task S.2: Secret Detection & Redaction Service

**File to Create:** `backend/src/services/secret-redactor.ts`

**Acceptance Criteria:**

- [ ] Detects common secret patterns:
  - API keys: `sk-`, `api_key=`, `apiKey:`
  - AWS: `AKIA`, `aws_secret`
  - Passwords: `password=`, `passwd:`, `secret:`
  - Tokens: `token=`, `bearer `, `auth:`
  - Private keys: `-----BEGIN.*PRIVATE KEY-----`
  - Connection strings: `postgres://`, `mysql://`, `mongodb://`
- [ ] Replaces matches with `[REDACTED]`
- [ ] Configurable patterns via JSON config
- [ ] Option to disable for trusted viewers
- [ ] Logs redaction events (not values!)

**Implementation:**

```typescript
// backend/src/services/secret-redactor.ts
export interface RedactionResult {
  text: string;
  redactionCount: number;
  redactedPatterns: string[];
}

const DEFAULT_PATTERNS = [
  { name: 'api_key_sk', pattern: /sk-[a-zA-Z0-9]{20,}/g },
  { name: 'api_key_generic', pattern: /api[_-]?key[=:]\s*['"]?[a-zA-Z0-9_-]{16,}['"]?/gi },
  { name: 'aws_access_key', pattern: /AKIA[A-Z0-9]{16}/g },
  { name: 'aws_secret', pattern: /aws[_-]?secret[=:]\s*['"]?[a-zA-Z0-9/+=]{40}['"]?/gi },
  { name: 'password', pattern: /password[=:]\s*['"]?[^\s'"]{4,}['"]?/gi },
  { name: 'bearer_token', pattern: /bearer\s+[a-zA-Z0-9_-]{20,}/gi },
  { name: 'private_key', pattern: /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END/g },
  { name: 'connection_string', pattern: /(postgres|mysql|mongodb|redis):\/\/[^\s'"]+/gi },
  { name: 'jwt', pattern: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g },
];

export class SecretRedactor {
  private patterns = DEFAULT_PATTERNS;
  private enabled = true;

  redact(text: string): RedactionResult {
    if (!this.enabled) {
      return { text, redactionCount: 0, redactedPatterns: [] };
    }

    let result = text;
    let count = 0;
    const matched: string[] = [];

    for (const { name, pattern } of this.patterns) {
      const matches = result.match(pattern);
      if (matches) {
        count += matches.length;
        matched.push(name);
        result = result.replace(pattern, '[REDACTED]');
      }
    }

    if (count > 0) {
      console.log(`[SecretRedactor] Redacted ${count} secrets: ${matched.join(', ')}`);
    }

    return { text: result, redactionCount: count, redactedPatterns: matched };
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }
}

export const secretRedactor = new SecretRedactor();
```

**Files to Modify:**

- `backend/src/routes/sessions.ts` - Apply redaction to frame content when sharing

**Tests:** `backend/src/__tests__/services/secret-redactor.test.ts`

---

### Task S.3: Authentication System

**Files to Create:**

- `backend/src/middleware/auth.ts`
- `backend/src/services/token-manager.ts`

**Acceptance Criteria:**

- [ ] Generate random 32-char access token on first run
- [ ] Store in `~/.recall-player/auth-token`
- [ ] Display token in server startup logs (once)
- [ ] Require `Authorization: Bearer <token>` for non-localhost
- [ ] Localhost (`127.0.0.1`, `::1`) always allowed without auth
- [ ] Invalid token returns `401 Unauthorized`
- [ ] Token can be regenerated via CLI flag

**Implementation:**

```typescript
// backend/src/services/token-manager.ts
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const TOKEN_FILE = path.join(process.env.HOME || '~', '.recall-player', 'auth-token');

export class TokenManager {
  private token: string | null = null;
  private displayed = false;

  initialize(): string {
    // Try to load existing token
    if (fs.existsSync(TOKEN_FILE)) {
      this.token = fs.readFileSync(TOKEN_FILE, 'utf-8').trim();
    } else {
      // Generate new token
      this.token = crypto.randomBytes(24).toString('base64url');
      fs.mkdirSync(path.dirname(TOKEN_FILE), { recursive: true });
      fs.writeFileSync(TOKEN_FILE, this.token, { mode: 0o600 });
    }
    return this.token;
  }

  displayOnce(): void {
    if (!this.displayed && this.token) {
      console.log(`\n🔐 Auth token: ${this.token}\n`);
      this.displayed = true;
    }
  }

  validate(token: string): boolean {
    return this.token !== null && token === this.token;
  }

  regenerate(): string {
    this.token = crypto.randomBytes(24).toString('base64url');
    fs.writeFileSync(TOKEN_FILE, this.token, { mode: 0o600 });
    this.displayed = false;
    return this.token;
  }
}

export const tokenManager = new TokenManager();
```

```typescript
// backend/src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import { tokenManager } from '../services/token-manager';

const LOCALHOST_IPS = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const clientIp = req.ip || req.socket.remoteAddress || '';

  // Allow localhost without auth
  if (LOCALHOST_IPS.some((ip) => clientIp.includes(ip))) {
    return next();
  }

  // Require auth for non-localhost
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required for non-localhost access',
    });
  }

  const token = authHeader.slice(7);
  if (!tokenManager.validate(token)) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid authentication token',
    });
  }

  next();
}
```

**Files to Modify:**

- `backend/src/server.ts` - Apply auth middleware
- `backend/src/index.ts` - Initialize token manager, display token

**Tests:** `backend/src/__tests__/middleware/auth.test.ts`

---

## Testing Strategy

**Unit Tests:**

```bash
cd backend && npm test -- --grep "viewer-mode|secret-redactor|auth"
```

**Manual Testing:**

```bash
# Test viewer mode
RECALL_VIEWER_MODE=true npm start
curl -X POST http://localhost:3001/api/import/start
# Should return 403

# Test auth
# Bind to 0.0.0.0 to test non-localhost
curl -H "Authorization: Bearer wrong-token" http://192.168.x.x:3001/api/health
# Should return 401
```

---

## Definition of Done

- [ ] All three security components implemented
- [ ] Unit tests for each component (>80% coverage)
- [ ] Manual testing completed
- [ ] No security vulnerabilities introduced
- [ ] Code reviewed for edge cases
- [ ] Documentation updated

---

## Commit Messages

```
feat(security): add viewer-mode middleware for read-only access
feat(security): add secret detection and redaction service
feat(security): add token-based authentication for non-localhost
```

---

## Notes for Agent

- **Be paranoid** - Security code needs extra scrutiny
- **Test edge cases** - Empty strings, malformed input, unicode
- **Log carefully** - Never log actual secrets, only counts/patterns
- **Fail closed** - When in doubt, deny access
