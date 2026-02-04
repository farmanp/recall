import { getDbInstance } from '../db/connection';
import type {
  ClaudeMdSnapshot,
  ClaudeMdVersion,
  ClaudeMdHistoryResponse,
  ClaudeMdCompareResponse,
} from '../db/claudemd-schema';

/**
 * Get CLAUDE.md snapshot by ID
 */
export function getClaudeMdSnapshot(snapshotId: number): ClaudeMdSnapshot | null {
  const db = getDbInstance();

  const snapshot = db.prepare('SELECT * FROM claudemd_snapshots WHERE id = ?').get(snapshotId) as
    | ClaudeMdSnapshot
    | undefined;

  return snapshot || null;
}

/**
 * Get CLAUDE.md snapshot by content hash
 */
export function getClaudeMdSnapshotByHash(contentHash: string): ClaudeMdSnapshot | null {
  const db = getDbInstance();

  const snapshot = db
    .prepare('SELECT * FROM claudemd_snapshots WHERE content_hash = ?')
    .get(contentHash) as ClaudeMdSnapshot | undefined;

  return snapshot || null;
}

/**
 * Create a new CLAUDE.md snapshot
 */
export function createClaudeMdSnapshot(
  contentHash: string,
  filePath: string,
  content: string,
  firstSeenAt: string
): ClaudeMdSnapshot {
  const db = getDbInstance();

  const now = new Date().toISOString();
  const nowEpoch = Date.now();
  const firstSeenEpoch = new Date(firstSeenAt).getTime();
  const contentSize = Buffer.byteLength(content, 'utf8');

  const result = db
    .prepare(
      `
    INSERT INTO claudemd_snapshots 
    (content_hash, file_path, content, content_size, first_seen_at, first_seen_at_epoch, created_at, created_at_epoch)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `
    )
    .run(contentHash, filePath, content, contentSize, firstSeenAt, firstSeenEpoch, now, nowEpoch);

  const snapshotId = result.lastInsertRowid as number;

  return {
    id: snapshotId,
    content_hash: contentHash,
    file_path: filePath,
    content,
    content_size: contentSize,
    first_seen_at: firstSeenAt,
    first_seen_at_epoch: firstSeenEpoch,
    created_at: now,
    created_at_epoch: nowEpoch,
  };
}

/**
 * Link a session to a CLAUDE.md snapshot
 */
export function linkSessionToClaudeMd(
  sessionId: string,
  snapshotId: number,
  filePath: string,
  loadedAt: string
): void {
  const db = getDbInstance();

  const loadedAtEpoch = new Date(loadedAt).getTime();

  // Check if link already exists
  const existing = db
    .prepare('SELECT id FROM session_claudemd WHERE session_id = ? AND snapshot_id = ?')
    .get(sessionId, snapshotId);

  if (existing) {
    // Already linked, skip
    return;
  }

  db.prepare(
    `
    INSERT INTO session_claudemd 
    (session_id, snapshot_id, file_path, loaded_at, loaded_at_epoch)
    VALUES (?, ?, ?, ?, ?)
  `
  ).run(sessionId, snapshotId, filePath, loadedAt, loadedAtEpoch);
}

/**
 * Get CLAUDE.md history for a project
 * Returns all versions used across sessions for the given project
 */
export function getClaudeMdHistory(project: string): ClaudeMdHistoryResponse {
  const db = getDbInstance();

  const versions = db
    .prepare(
      `
    SELECT 
      s.id as snapshotId,
      s.content_hash as contentHash,
      s.file_path as filePath,
      s.content,
      s.content_size as contentSize,
      s.first_seen_at as firstSeenAt,
      COUNT(DISTINCT scm.session_id) as sessionCount,
      MIN(sess.started_at) as dateFrom,
      MAX(sess.started_at) as dateTo
    FROM claudemd_snapshots s
    INNER JOIN session_claudemd scm ON s.id = scm.snapshot_id
    INNER JOIN sdk_sessions sess ON scm.session_id = sess.content_session_id
    WHERE sess.project = ?
    GROUP BY s.id
    ORDER BY s.first_seen_at_epoch ASC
  `
    )
    .all(project) as Array<{
    snapshotId: number;
    contentHash: string;
    filePath: string;
    content: string;
    contentSize: number;
    firstSeenAt: string;
    sessionCount: number;
    dateFrom: string;
    dateTo: string;
  }>;

  const formattedVersions: ClaudeMdVersion[] = versions.map((v) => ({
    snapshotId: v.snapshotId,
    contentHash: v.contentHash,
    filePath: v.filePath,
    content: v.content,
    contentSize: v.contentSize,
    firstSeenAt: v.firstSeenAt,
    sessionCount: v.sessionCount,
    dateRange: {
      from: v.dateFrom,
      to: v.dateTo,
    },
  }));

  return {
    project,
    versions: formattedVersions,
  };
}

/**
 * Compare two CLAUDE.md snapshots
 */
export function compareClaudeMdSnapshots(
  fromId: number,
  toId: number
): ClaudeMdCompareResponse | null {
  const fromSnapshot = getClaudeMdSnapshot(fromId);
  const toSnapshot = getClaudeMdSnapshot(toId);

  if (!fromSnapshot || !toSnapshot) {
    return null;
  }

  return {
    from: fromSnapshot,
    to: toSnapshot,
  };
}

/**
 * Get CLAUDE.md snapshots for a specific session
 */
export function getSessionClaudeMdSnapshots(sessionId: string): ClaudeMdSnapshot[] {
  const db = getDbInstance();

  const snapshots = db
    .prepare(
      `
    SELECT s.*
    FROM claudemd_snapshots s
    INNER JOIN session_claudemd scm ON s.id = scm.snapshot_id
    WHERE scm.session_id = ?
    ORDER BY scm.loaded_at_epoch ASC
  `
    )
    .all(sessionId) as ClaudeMdSnapshot[];

  return snapshots;
}
