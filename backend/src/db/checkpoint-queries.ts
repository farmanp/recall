import { getTranscriptDbInstance } from './transcript-connection';
import type {
  Checkpoint,
  CheckpointFile,
  CheckpointWithFiles,
  CheckpointRow,
  CheckpointFileRow,
} from './checkpoint-schema';

/**
 * Initialize checkpoint schema
 * Creates tables and indexes if they don't exist
 * Safe to call multiple times - uses IF NOT EXISTS
 */
export function initializeCheckpointSchema(): void {
  const db = getTranscriptDbInstance();

  // Create checkpoints table
  db.exec(`
    CREATE TABLE IF NOT EXISTS checkpoints (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      name TEXT NOT NULL,
      frame_index INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      created_at_epoch INTEGER NOT NULL,
      git_commit TEXT,
      notes TEXT,
      FOREIGN KEY (session_id) REFERENCES session_metadata(session_id) ON DELETE CASCADE
    );
  `);

  // Create checkpoint_files table
  db.exec(`
    CREATE TABLE IF NOT EXISTS checkpoint_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      checkpoint_id TEXT NOT NULL,
      file_path TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT NOT NULL,
      FOREIGN KEY (checkpoint_id) REFERENCES checkpoints(id) ON DELETE CASCADE
    );
  `);

  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_checkpoints_session ON checkpoints(session_id);
    CREATE INDEX IF NOT EXISTS idx_checkpoints_frame ON checkpoints(session_id, frame_index);
    CREATE INDEX IF NOT EXISTS idx_checkpoints_created ON checkpoints(created_at_epoch DESC);
    CREATE INDEX IF NOT EXISTS idx_checkpoint_files_checkpoint ON checkpoint_files(checkpoint_id);
    CREATE INDEX IF NOT EXISTS idx_checkpoint_files_hash ON checkpoint_files(content_hash);
    CREATE INDEX IF NOT EXISTS idx_checkpoint_files_path ON checkpoint_files(file_path);
  `);
}

/**
 * Insert a new checkpoint into the database
 * @param checkpoint - Checkpoint data without files
 * @returns The inserted checkpoint
 */
export function insertCheckpoint(checkpoint: Omit<Checkpoint, 'fileCount'>): Checkpoint {
  const db = getTranscriptDbInstance();

  db.prepare(
    `
    INSERT INTO checkpoints (
      id, session_id, name, frame_index, created_at, created_at_epoch, git_commit, notes
    ) VALUES (
      @id, @sessionId, @name, @frameIndex, @createdAt, @createdAtEpoch, @gitCommit, @notes
    )
  `
  ).run({
    id: checkpoint.id,
    sessionId: checkpoint.sessionId,
    name: checkpoint.name,
    frameIndex: checkpoint.frameIndex,
    createdAt: checkpoint.createdAt,
    createdAtEpoch: new Date(checkpoint.createdAt).getTime(),
    gitCommit: checkpoint.gitCommit || null,
    notes: checkpoint.notes || null,
  });

  return {
    ...checkpoint,
    fileCount: 0,
  };
}

/**
 * Insert a file associated with a checkpoint
 * @param checkpointId - Checkpoint UUID
 * @param file - File data to insert
 * @returns The inserted file with its database ID
 */
export function insertCheckpointFile(
  checkpointId: string,
  file: Omit<CheckpointFile, 'id'>
): CheckpointFile {
  const db = getTranscriptDbInstance();

  const result = db
    .prepare(
      `
    INSERT INTO checkpoint_files (
      checkpoint_id, file_path, content_hash, content, status
    ) VALUES (
      @checkpointId, @filePath, @contentHash, @content, @status
    )
  `
    )
    .run({
      checkpointId,
      filePath: file.path,
      contentHash: file.contentHash,
      content: file.content,
      status: file.status,
    });

  return {
    id: result.lastInsertRowid as number,
    ...file,
  };
}

/**
 * Insert multiple files for a checkpoint in a transaction
 * @param checkpointId - Checkpoint UUID
 * @param files - Array of files to insert
 */
export function insertCheckpointFiles(
  checkpointId: string,
  files: Array<Omit<CheckpointFile, 'id'>>
): void {
  const db = getTranscriptDbInstance();

  const insertStmt = db.prepare(`
    INSERT INTO checkpoint_files (
      checkpoint_id, file_path, content_hash, content, status
    ) VALUES (
      @checkpointId, @filePath, @contentHash, @content, @status
    )
  `);

  const insertMany = db.transaction((filesToInsert: Array<Omit<CheckpointFile, 'id'>>) => {
    for (const file of filesToInsert) {
      insertStmt.run({
        checkpointId,
        filePath: file.path,
        contentHash: file.contentHash,
        content: file.content,
        status: file.status,
      });
    }
  });

  insertMany(files);
}

/**
 * Get a checkpoint by ID
 * @param id - Checkpoint UUID
 * @returns Checkpoint or null if not found
 */
export function getCheckpointById(id: string): Checkpoint | null {
  const db = getTranscriptDbInstance();

  const row = db
    .prepare(
      `
    SELECT
      c.*,
      (SELECT COUNT(*) FROM checkpoint_files WHERE checkpoint_id = c.id) as file_count
    FROM checkpoints c
    WHERE c.id = ?
  `
    )
    .get(id) as (CheckpointRow & { file_count: number }) | undefined;

  if (!row) {
    return null;
  }

  return rowToCheckpoint(row);
}

/**
 * Get a checkpoint with all its files
 * @param id - Checkpoint UUID
 * @returns CheckpointWithFiles or null if not found
 */
export function getCheckpointWithFiles(id: string): CheckpointWithFiles | null {
  const checkpoint = getCheckpointById(id);
  if (!checkpoint) {
    return null;
  }

  const files = getCheckpointFiles(id);

  return {
    ...checkpoint,
    files,
  };
}

/**
 * Get all checkpoints for a session
 * @param sessionId - Session UUID
 * @returns Array of checkpoints ordered by frame index
 */
export function getSessionCheckpoints(sessionId: string): Checkpoint[] {
  const db = getTranscriptDbInstance();

  const rows = db
    .prepare(
      `
    SELECT
      c.*,
      (SELECT COUNT(*) FROM checkpoint_files WHERE checkpoint_id = c.id) as file_count
    FROM checkpoints c
    WHERE c.session_id = ?
    ORDER BY c.frame_index ASC
  `
    )
    .all(sessionId) as Array<CheckpointRow & { file_count: number }>;

  return rows.map(rowToCheckpoint);
}

/**
 * Get files for a checkpoint
 * @param checkpointId - Checkpoint UUID
 * @returns Array of checkpoint files
 */
export function getCheckpointFiles(checkpointId: string): CheckpointFile[] {
  const db = getTranscriptDbInstance();

  const rows = db
    .prepare(
      `
    SELECT * FROM checkpoint_files
    WHERE checkpoint_id = ?
    ORDER BY file_path ASC
  `
    )
    .all(checkpointId) as CheckpointFileRow[];

  return rows.map(rowToCheckpointFile);
}

/**
 * Delete a checkpoint and all its files (cascades via foreign key)
 * @param id - Checkpoint UUID
 * @returns true if deleted, false if not found
 */
export function deleteCheckpoint(id: string): boolean {
  const db = getTranscriptDbInstance();

  // First delete files (in case foreign key cascade isn't enforced)
  db.prepare('DELETE FROM checkpoint_files WHERE checkpoint_id = ?').run(id);

  const result = db.prepare('DELETE FROM checkpoints WHERE id = ?').run(id);

  return result.changes > 0;
}

/**
 * Update a checkpoint's name or notes
 * @param id - Checkpoint UUID
 * @param updates - Fields to update
 * @returns Updated checkpoint or null if not found
 */
export function updateCheckpoint(
  id: string,
  updates: { name?: string; notes?: string }
): Checkpoint | null {
  const db = getTranscriptDbInstance();

  const updateClauses: string[] = [];
  const params: Record<string, unknown> = { id };

  if (updates.name !== undefined) {
    updateClauses.push('name = @name');
    params.name = updates.name;
  }

  if (updates.notes !== undefined) {
    updateClauses.push('notes = @notes');
    params.notes = updates.notes;
  }

  if (updateClauses.length === 0) {
    return getCheckpointById(id);
  }

  db.prepare(
    `
    UPDATE checkpoints
    SET ${updateClauses.join(', ')}
    WHERE id = @id
  `
  ).run(params);

  return getCheckpointById(id);
}

/**
 * Check if a checkpoint exists
 * @param id - Checkpoint UUID
 * @returns true if exists
 */
export function checkpointExists(id: string): boolean {
  const db = getTranscriptDbInstance();

  const result = db.prepare('SELECT 1 FROM checkpoints WHERE id = ?').get(id);

  return result !== undefined;
}

/**
 * Get checkpoint count for a session
 * @param sessionId - Session UUID
 * @returns Number of checkpoints
 */
export function getSessionCheckpointCount(sessionId: string): number {
  const db = getTranscriptDbInstance();

  const result = db
    .prepare(
      `
    SELECT COUNT(*) as count FROM checkpoints WHERE session_id = ?
  `
    )
    .get(sessionId) as { count: number };

  return result.count;
}

/**
 * Helper: Convert database row to Checkpoint object
 */
function rowToCheckpoint(row: CheckpointRow & { file_count?: number }): Checkpoint {
  return {
    id: row.id,
    sessionId: row.session_id,
    name: row.name,
    frameIndex: row.frame_index,
    createdAt: row.created_at,
    gitCommit: row.git_commit || undefined,
    notes: row.notes || undefined,
    fileCount: row.file_count ?? 0,
  };
}

/**
 * Helper: Convert database row to CheckpointFile object
 */
function rowToCheckpointFile(row: CheckpointFileRow): CheckpointFile {
  return {
    id: row.id,
    path: row.file_path,
    content: row.content,
    contentHash: row.content_hash,
    status: row.status as CheckpointFile['status'],
  };
}
