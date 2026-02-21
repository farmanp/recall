/**
 * Database queries for git checkpoint tracking
 *
 * These queries manage the git-related columns on the checkpoints table,
 * allowing us to track which checkpoints have been synced to git and
 * which branches they've been exported to.
 */

import { getTranscriptDatabase } from './transcript-connection';

/**
 * Update a checkpoint's git storage commit reference
 */
export function updateCheckpointGitStorage(
  checkpointId: string,
  gitStorageCommit: string
): boolean {
  const db = getTranscriptDatabase();
  if (!db) return false;

  try {
    const stmt = db.prepare(`
      UPDATE checkpoints
      SET git_storage_commit = ?, git_storage_synced = 1
      WHERE id = ?
    `);
    const result = stmt.run(gitStorageCommit, checkpointId);
    return result.changes > 0;
  } catch (error) {
    console.error('[git-checkpoint-queries] Failed to update git storage:', error);
    return false;
  }
}

/**
 * Update a checkpoint's export branch reference
 */
export function updateCheckpointExportBranch(checkpointId: string, exportBranch: string): boolean {
  const db = getTranscriptDatabase();
  if (!db) return false;

  try {
    const stmt = db.prepare(`
      UPDATE checkpoints
      SET git_export_branch = ?
      WHERE id = ?
    `);
    const result = stmt.run(exportBranch, checkpointId);
    return result.changes > 0;
  } catch (error) {
    console.error('[git-checkpoint-queries] Failed to update export branch:', error);
    return false;
  }
}

/**
 * Get all checkpoints that haven't been synced to git for a session
 */
export function getUnsyncedCheckpoints(sessionId: string): Array<{
  id: string;
  name: string;
  frameIndex: number;
  createdAt: string;
}> {
  const db = getTranscriptDatabase();
  if (!db) return [];

  try {
    const stmt = db.prepare(`
      SELECT id, name, frame_index as frameIndex, created_at as createdAt
      FROM checkpoints
      WHERE session_id = ? AND (git_storage_synced = 0 OR git_storage_synced IS NULL)
      ORDER BY frame_index ASC
    `);
    return stmt.all(sessionId) as Array<{
      id: string;
      name: string;
      frameIndex: number;
      createdAt: string;
    }>;
  } catch (error) {
    console.error('[git-checkpoint-queries] Failed to get unsynced checkpoints:', error);
    return [];
  }
}

/**
 * Get git sync status for a checkpoint
 */
export function getCheckpointGitStatus(checkpointId: string): {
  synced: boolean;
  storageCommit: string | null;
  exportBranch: string | null;
} | null {
  const db = getTranscriptDatabase();
  if (!db) return null;

  try {
    const stmt = db.prepare(`
      SELECT
        git_storage_synced as synced,
        git_storage_commit as storageCommit,
        git_export_branch as exportBranch
      FROM checkpoints
      WHERE id = ?
    `);
    const row = stmt.get(checkpointId) as
      | {
          synced: number | null;
          storageCommit: string | null;
          exportBranch: string | null;
        }
      | undefined;

    if (!row) return null;

    return {
      synced: row.synced === 1,
      storageCommit: row.storageCommit,
      exportBranch: row.exportBranch,
    };
  } catch (error) {
    console.error('[git-checkpoint-queries] Failed to get git status:', error);
    return null;
  }
}

/**
 * Mark a checkpoint as synced to git (without a commit reference)
 * Useful for tracking manual sync operations
 */
export function markCheckpointSynced(checkpointId: string): boolean {
  const db = getTranscriptDatabase();
  if (!db) return false;

  try {
    const stmt = db.prepare(`
      UPDATE checkpoints
      SET git_storage_synced = 1
      WHERE id = ?
    `);
    const result = stmt.run(checkpointId);
    return result.changes > 0;
  } catch (error) {
    console.error('[git-checkpoint-queries] Failed to mark synced:', error);
    return false;
  }
}

/**
 * Get all checkpoints with git storage info
 */
export function getAllCheckpointsWithGitInfo(): Array<{
  id: string;
  sessionId: string;
  name: string;
  frameIndex: number;
  createdAt: string;
  gitStorageCommit: string | null;
  gitExportBranch: string | null;
  gitStorageSynced: boolean;
}> {
  const db = getTranscriptDatabase();
  if (!db) return [];

  try {
    const stmt = db.prepare(`
      SELECT
        id,
        session_id as sessionId,
        name,
        frame_index as frameIndex,
        created_at as createdAt,
        git_storage_commit as gitStorageCommit,
        git_export_branch as gitExportBranch,
        git_storage_synced as gitStorageSynced
      FROM checkpoints
      ORDER BY created_at DESC
    `);
    const rows = stmt.all() as Array<{
      id: string;
      sessionId: string;
      name: string;
      frameIndex: number;
      createdAt: string;
      gitStorageCommit: string | null;
      gitExportBranch: string | null;
      gitStorageSynced: number | null;
    }>;

    return rows.map((row) => ({
      ...row,
      gitStorageSynced: row.gitStorageSynced === 1,
    }));
  } catch (error) {
    console.error('[git-checkpoint-queries] Failed to get checkpoints:', error);
    return [];
  }
}
