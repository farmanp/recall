import crypto from 'crypto';
import { getTranscriptDbInstance } from '../db/transcript-connection';
import { getTranscriptFrames, getTranscriptSessionById } from '../db/transcript-queries';
import { SecretRedactor } from './secret-redactor';
import { tokenManager } from './token-manager';
import { getSessionIndexer } from '../parser/session-indexer';
import { ParserFactory } from '../parser/parser-factory';
import { detectAgentFromPath } from '../parser/agent-detector';
import type { PlaybackFrame } from '../types/transcript';

export type ShareExpiry = '1h' | '24h' | '7d' | 'never';

export interface CreateShareOptions {
  enableRedaction: boolean;
  expiresIn: ShareExpiry;
}

export interface ShareRecord {
  shareId: string;
  sessionId: string;
  expiresAt: string | null;
  redactionEnabled: boolean;
  revokedAt: string | null;
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8');
}

let cachedSigningKey: string | null = null;
let warnedEphemeralKey = false;

function getSigningKey(): string {
  if (cachedSigningKey) {
    return cachedSigningKey;
  }

  const envKey = process.env.RECALL_SHARE_SIGNING_KEY;
  if (envKey) {
    cachedSigningKey = envKey;
    return cachedSigningKey;
  }

  const managerKey = tokenManager.getToken();
  if (managerKey) {
    cachedSigningKey = managerKey;
    return cachedSigningKey;
  }

  cachedSigningKey = crypto.randomBytes(32).toString('base64url');
  if (!warnedEphemeralKey) {
    console.warn(
      '[ShareLinks] Using ephemeral signing key because RECALL_SHARE_SIGNING_KEY is unset'
    );
    warnedEphemeralKey = true;
  }
  return cachedSigningKey;
}

function signPayload(payload: string): string {
  return crypto.createHmac('sha256', getSigningKey()).update(payload).digest('base64url');
}

function parseExpiry(expiresIn: ShareExpiry): number | null {
  const now = Date.now();
  if (expiresIn === '1h') return now + 60 * 60 * 1000;
  if (expiresIn === '24h') return now + 24 * 60 * 60 * 1000;
  if (expiresIn === '7d') return now + 7 * 24 * 60 * 60 * 1000;
  return null;
}

let schemaInitialized = false;

function ensureShareSchema(): void {
  if (schemaInitialized) return;

  const db = getTranscriptDbInstance();

  // Check if the old table with foreign key constraint exists
  const tableInfo = db
    .prepare(
      `
    SELECT sql FROM sqlite_master
    WHERE type='table' AND name='recall_shares'
  `
    )
    .get() as { sql: string } | undefined;

  // If table has FOREIGN KEY constraint, drop it and recreate without
  if (tableInfo?.sql?.includes('FOREIGN KEY')) {
    db.exec('DROP TABLE IF EXISTS recall_shares');
  }

  // Create table without foreign key - allows sharing filesystem-only sessions
  db.exec(`
    CREATE TABLE IF NOT EXISTS recall_shares (
      share_id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      redaction_enabled INTEGER NOT NULL DEFAULT 1,
      expires_at TEXT,
      expires_at_epoch INTEGER,
      revoked_at TEXT,
      created_at TEXT NOT NULL,
      created_at_epoch INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_recall_shares_session_id
      ON recall_shares(session_id);

    CREATE INDEX IF NOT EXISTS idx_recall_shares_expires
      ON recall_shares(expires_at_epoch);
  `);

  schemaInitialized = true;
}

function redactUnknown(value: unknown): unknown {
  if (typeof value === 'string') {
    return SecretRedactor.redact(value);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => redactUnknown(entry));
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    return Object.fromEntries(entries.map(([k, v]) => [k, redactUnknown(v)]));
  }
  return value;
}

export function createShareLink(
  sessionId: string,
  options: CreateShareOptions
): {
  shareId: string;
  token: string;
  expiresAt: string | null;
} {
  ensureShareSchema();
  const db = getTranscriptDbInstance();
  const shareId = crypto.randomBytes(12).toString('hex');
  const expiresAtEpoch = parseExpiry(options.expiresIn);
  const expiresAt = expiresAtEpoch ? new Date(expiresAtEpoch).toISOString() : null;
  const now = new Date().toISOString();

  db.prepare(
    `
    INSERT INTO recall_shares (
      share_id, session_id, redaction_enabled, expires_at, expires_at_epoch, revoked_at, created_at, created_at_epoch
    ) VALUES (?, ?, ?, ?, ?, NULL, ?, ?)
  `
  ).run(
    shareId,
    sessionId,
    options.enableRedaction ? 1 : 0,
    expiresAt,
    expiresAtEpoch,
    now,
    Date.now()
  );

  const payload = JSON.stringify({ sid: shareId, exp: expiresAtEpoch });
  const payloadEncoded = base64UrlEncode(payload);
  const signature = signPayload(payloadEncoded);

  return {
    shareId,
    token: `${payloadEncoded}.${signature}`,
    expiresAt,
  };
}

export function revokeShareLink(shareId: string): boolean {
  ensureShareSchema();
  const db = getTranscriptDbInstance();
  const result = db
    .prepare('UPDATE recall_shares SET revoked_at = ? WHERE share_id = ? AND revoked_at IS NULL')
    .run(new Date().toISOString(), shareId);
  return result.changes > 0;
}

function getShare(shareId: string): ShareRecord | null {
  ensureShareSchema();
  const db = getTranscriptDbInstance();
  const row = db
    .prepare(
      `
      SELECT share_id, session_id, expires_at, redaction_enabled, revoked_at
      FROM recall_shares
      WHERE share_id = ?
    `
    )
    .get(shareId) as
    | {
        share_id: string;
        session_id: string;
        expires_at: string | null;
        redaction_enabled: number;
        revoked_at: string | null;
      }
    | undefined;

  if (!row) return null;
  return {
    shareId: row.share_id,
    sessionId: row.session_id,
    expiresAt: row.expires_at,
    redactionEnabled: row.redaction_enabled === 1,
    revokedAt: row.revoked_at,
  };
}

export function validateShareToken(shareId: string, token: string): boolean {
  const [payloadEncoded, signature] = token.split('.');
  if (!payloadEncoded || !signature) {
    return false;
  }

  const expected = signPayload(payloadEncoded);
  const expectedBuffer = Buffer.from(expected, 'utf8');
  const signatureBuffer = Buffer.from(signature, 'utf8');
  if (expectedBuffer.length !== signatureBuffer.length) {
    return false;
  }
  if (!crypto.timingSafeEqual(expectedBuffer, signatureBuffer)) {
    return false;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(payloadEncoded)) as {
      sid?: string;
      exp?: number | null;
    };
    if (payload.sid !== shareId) {
      return false;
    }
    if (payload.exp && payload.exp < Date.now()) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function getSharedSessionData(
  shareId: string,
  token: string
): Promise<{
  session: { slug: string; project: string; startedAt: string };
  frames: Array<{ type: string; content: unknown }>;
  expiresAt: string | null;
  redactionEnabled: boolean;
} | null> {
  if (!validateShareToken(shareId, token)) {
    return null;
  }

  const share = getShare(shareId);
  if (!share || share.revokedAt) {
    return null;
  }

  if (share.expiresAt && new Date(share.expiresAt).getTime() < Date.now()) {
    return null;
  }

  // Try database first
  const dbSession = getTranscriptSessionById(share.sessionId);
  if (dbSession) {
    const frameResult = getTranscriptFrames(share.sessionId, { limit: 10000 });
    const frames = frameResult.frames.map((frame) => {
      if (frame.userMessage?.text) {
        const content = share.redactionEnabled
          ? SecretRedactor.redact(frame.userMessage.text)
          : frame.userMessage.text;
        return { type: 'user_message', content };
      }

      if (frame.claudeResponse?.text) {
        const content = share.redactionEnabled
          ? SecretRedactor.redact(frame.claudeResponse.text)
          : frame.claudeResponse.text;
        return { type: 'claude_response', content };
      }

      if (frame.toolExecution) {
        const content = share.redactionEnabled
          ? redactUnknown(frame.toolExecution)
          : frame.toolExecution;
        return { type: 'tool_execution', content };
      }

      return { type: frame.type, content: '' };
    });

    return {
      session: {
        slug: dbSession.slug,
        project: dbSession.project,
        startedAt: dbSession.startTime,
      },
      frames,
      expiresAt: share.expiresAt,
      redactionEnabled: share.redactionEnabled,
    };
  }

  // Fallback to filesystem
  const indexer = getSessionIndexer();
  const fsSession = await indexer.getSessionMetadata(share.sessionId);
  if (!fsSession) {
    return null;
  }

  // Find session file and build timeline
  const filePath = await indexer.findSessionFile(share.sessionId);
  if (!filePath) {
    return null;
  }

  const agentType = detectAgentFromPath(filePath);
  const transcript = await ParserFactory.parseFile(filePath);
  const timeline = await ParserFactory.buildTimeline(transcript, agentType);

  const frames = timeline.frames.map((frame: PlaybackFrame) => {
    if (frame.userMessage?.text) {
      const content = share.redactionEnabled
        ? SecretRedactor.redact(frame.userMessage.text)
        : frame.userMessage.text;
      return { type: 'user_message', content };
    }

    if (frame.claudeResponse?.text) {
      const content = share.redactionEnabled
        ? SecretRedactor.redact(frame.claudeResponse.text)
        : frame.claudeResponse.text;
      return { type: 'claude_response', content };
    }

    if (frame.toolExecution) {
      const content = share.redactionEnabled
        ? redactUnknown(frame.toolExecution)
        : frame.toolExecution;
      return { type: 'tool_execution', content };
    }

    return { type: frame.type, content: '' };
  });

  return {
    session: {
      slug: fsSession.slug,
      project: fsSession.project,
      startedAt: fsSession.startTime,
    },
    frames,
    expiresAt: share.expiresAt,
    redactionEnabled: share.redactionEnabled,
  };
}
