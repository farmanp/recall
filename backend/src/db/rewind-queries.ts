import { getTranscriptDbInstance } from './transcript-connection';
import type { RewindHistory, RewindHistoryRow } from './rewind-schema';

/**
 * Initialize rewind history schema
 * Creates tables and indexes if they don't exist
 * Safe to call multiple times - uses IF NOT EXISTS
 */
export function initializeRewindSchema(): void {
  const db = getTranscriptDbInstance();

  // Create rewind_history table
  db.exec(`
    CREATE TABLE IF NOT EXISTS rewind_history (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      checkpoint_id TEXT,
      frame_index INTEGER NOT NULL,
      cwd TEXT NOT NULL,
      executed_at TEXT NOT NULL,
      executed_at_epoch INTEGER NOT NULL,
      files_modified TEXT NOT NULL,
      backups_created TEXT,
      can_undo INTEGER DEFAULT 1,
      FOREIGN KEY (session_id) REFERENCES session_metadata(session_id) ON DELETE CASCADE
    );
  `);

  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_rewind_history_session ON rewind_history(session_id);
    CREATE INDEX IF NOT EXISTS idx_rewind_history_executed ON rewind_history(executed_at_epoch DESC);
    CREATE INDEX IF NOT EXISTS idx_rewind_history_can_undo ON rewind_history(session_id, can_undo);
  `);
}

/**
 * Insert a new rewind history entry
 * @param rewind - Rewind history data
 * @returns The inserted rewind history entry
 */
export function insertRewindHistory(rewind: RewindHistory): RewindHistory {
  const db = getTranscriptDbInstance();

  db.prepare(
    `
    INSERT INTO rewind_history (
      id, session_id, checkpoint_id, frame_index, cwd,
      executed_at, executed_at_epoch, files_modified, backups_created, can_undo
    ) VALUES (
      @id, @sessionId, @checkpointId, @frameIndex, @cwd,
      @executedAt, @executedAtEpoch, @filesModified, @backupsCreated, @canUndo
    )
  `
  ).run({
    id: rewind.id,
    sessionId: rewind.sessionId,
    checkpointId: rewind.checkpointId || null,
    frameIndex: rewind.frameIndex,
    cwd: rewind.cwd,
    executedAt: rewind.executedAt,
    executedAtEpoch: new Date(rewind.executedAt).getTime(),
    filesModified: JSON.stringify(rewind.filesModified),
    backupsCreated: rewind.backupsCreated ? JSON.stringify(rewind.backupsCreated) : null,
    canUndo: rewind.canUndo ? 1 : 0,
  });

  return rewind;
}

/**
 * Get a rewind history entry by ID
 * @param id - Rewind UUID
 * @returns RewindHistory or null if not found
 */
export function getRewindHistoryById(id: string): RewindHistory | null {
  const db = getTranscriptDbInstance();

  const row = db
    .prepare(
      `
    SELECT * FROM rewind_history WHERE id = ?
  `
    )
    .get(id) as RewindHistoryRow | undefined;

  if (!row) {
    return null;
  }

  return rowToRewindHistory(row);
}

/**
 * Get all rewind history for a session
 * @param sessionId - Session UUID
 * @returns Array of rewind history entries ordered by execution time (newest first)
 */
export function getSessionRewindHistory(sessionId: string): RewindHistory[] {
  const db = getTranscriptDbInstance();

  const rows = db
    .prepare(
      `
    SELECT * FROM rewind_history
    WHERE session_id = ?
    ORDER BY executed_at_epoch DESC
  `
    )
    .all(sessionId) as RewindHistoryRow[];

  return rows.map(rowToRewindHistory);
}

/**
 * Get the most recent undoable rewind for a session
 * @param sessionId - Session UUID
 * @returns Most recent RewindHistory with can_undo=1, or null
 */
export function getLastUndoableRewind(sessionId: string): RewindHistory | null {
  const db = getTranscriptDbInstance();

  const row = db
    .prepare(
      `
    SELECT * FROM rewind_history
    WHERE session_id = ? AND can_undo = 1
    ORDER BY executed_at_epoch DESC
    LIMIT 1
  `
    )
    .get(sessionId) as RewindHistoryRow | undefined;

  if (!row) {
    return null;
  }

  return rowToRewindHistory(row);
}

/**
 * Mark a rewind as no longer undoable
 * Called after undo is performed or backups are cleaned up
 * @param id - Rewind UUID
 * @returns true if updated, false if not found
 */
export function markRewindAsUsed(id: string): boolean {
  const db = getTranscriptDbInstance();

  const result = db
    .prepare(
      `
    UPDATE rewind_history
    SET can_undo = 0
    WHERE id = ?
  `
    )
    .run(id);

  return result.changes > 0;
}

/**
 * Delete a rewind history entry
 * @param id - Rewind UUID
 * @returns true if deleted, false if not found
 */
export function deleteRewindHistory(id: string): boolean {
  const db = getTranscriptDbInstance();

  const result = db
    .prepare(
      `
    DELETE FROM rewind_history WHERE id = ?
  `
    )
    .run(id);

  return result.changes > 0;
}

/**
 * Get count of rewind operations for a session
 * @param sessionId - Session UUID
 * @returns Number of rewind operations
 */
export function getSessionRewindCount(sessionId: string): number {
  const db = getTranscriptDbInstance();

  const result = db
    .prepare(
      `
    SELECT COUNT(*) as count FROM rewind_history WHERE session_id = ?
  `
    )
    .get(sessionId) as { count: number };

  return result.count;
}

/**
 * Get count of undoable rewinds for a session
 * @param sessionId - Session UUID
 * @returns Number of undoable rewind operations
 */
export function getUndoableRewindCount(sessionId: string): number {
  const db = getTranscriptDbInstance();

  const result = db
    .prepare(
      `
    SELECT COUNT(*) as count FROM rewind_history
    WHERE session_id = ? AND can_undo = 1
  `
    )
    .get(sessionId) as { count: number };

  return result.count;
}

/**
 * Clean up old rewind history entries that are no longer undoable
 * Can be called periodically to keep the database clean
 * @param olderThanDays - Delete entries older than this many days
 * @returns Number of entries deleted
 */
export function cleanupOldRewindHistory(olderThanDays: number = 30): number {
  const db = getTranscriptDbInstance();

  const cutoffEpoch = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;

  const result = db
    .prepare(
      `
    DELETE FROM rewind_history
    WHERE can_undo = 0 AND executed_at_epoch < ?
  `
    )
    .run(cutoffEpoch);

  return result.changes;
}

/**
 * Get rewind history statistics for a session
 * @param sessionId - Session UUID
 * @returns Statistics about rewind operations
 */
export function getRewindStats(sessionId: string): {
  totalRewinds: number;
  undoableRewinds: number;
  totalFilesModified: number;
  lastRewindAt?: string;
} {
  const db = getTranscriptDbInstance();

  const stats = db
    .prepare(
      `
    SELECT
      COUNT(*) as total_rewinds,
      SUM(CASE WHEN can_undo = 1 THEN 1 ELSE 0 END) as undoable_rewinds,
      MAX(executed_at) as last_rewind_at
    FROM rewind_history
    WHERE session_id = ?
  `
    )
    .get(sessionId) as {
    total_rewinds: number;
    undoable_rewinds: number;
    last_rewind_at: string | null;
  };

  // Count total files modified across all rewinds
  const fileStats = db
    .prepare(
      `
    SELECT files_modified FROM rewind_history WHERE session_id = ?
  `
    )
    .all(sessionId) as Array<{ files_modified: string }>;

  let totalFilesModified = 0;
  for (const row of fileStats) {
    try {
      const files = JSON.parse(row.files_modified);
      totalFilesModified += Array.isArray(files) ? files.length : 0;
    } catch {
      // Ignore parse errors
    }
  }

  return {
    totalRewinds: stats.total_rewinds || 0,
    undoableRewinds: stats.undoable_rewinds || 0,
    totalFilesModified,
    lastRewindAt: stats.last_rewind_at || undefined,
  };
}

/**
 * Helper: Convert database row to RewindHistory object
 */
function rowToRewindHistory(row: RewindHistoryRow): RewindHistory {
  let filesModified: string[] = [];
  let backupsCreated: Record<string, string> | undefined;

  try {
    filesModified = JSON.parse(row.files_modified);
  } catch {
    filesModified = [];
  }

  if (row.backups_created) {
    try {
      backupsCreated = JSON.parse(row.backups_created);
    } catch {
      backupsCreated = undefined;
    }
  }

  return {
    id: row.id,
    sessionId: row.session_id,
    checkpointId: row.checkpoint_id || undefined,
    frameIndex: row.frame_index,
    cwd: row.cwd,
    executedAt: row.executed_at,
    filesModified,
    backupsCreated,
    canUndo: row.can_undo === 1,
  };
}
