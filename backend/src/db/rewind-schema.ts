/**
 * TypeScript interfaces for rewind database tables and API responses
 * Phase 3: Rewind feature for restoring file state from checkpoints/frames
 */

/**
 * Rewind history entry - tracks a single rewind operation
 */
export interface RewindHistory {
  id: string; // UUID
  sessionId: string; // References session_metadata
  checkpointId?: string; // Optional: if rewind was from a checkpoint
  frameIndex: number; // Frame index that was rewound to
  cwd: string; // Working directory where files were restored
  executedAt: string; // ISO 8601 timestamp
  filesModified: string[]; // Array of file paths that were modified
  backupsCreated?: Record<string, string>; // Map: originalPath -> backupPath
  canUndo: boolean; // Whether undo is available
}

/**
 * Database row shape for rewind_history table
 */
export interface RewindHistoryRow {
  id: string;
  session_id: string;
  checkpoint_id: string | null;
  frame_index: number;
  cwd: string;
  executed_at: string;
  executed_at_epoch: number;
  files_modified: string; // JSON string
  backups_created: string | null; // JSON string
  can_undo: number; // 0 or 1
}

/**
 * File action during rewind - what will happen to each file
 */
export interface RewindFileAction {
  path: string; // Relative path from cwd
  absolutePath: string; // Full absolute path
  action: 'create' | 'modify' | 'delete' | 'skip';
  content?: string; // New content to write (undefined for delete)
  currentContent?: string; // What's currently on disk (null if file doesn't exist)
  reason?: string; // Why skip/warning
}

/**
 * Conflict detected during rewind preview
 */
export interface RewindConflict {
  path: string;
  absolutePath: string;
  reason: 'modified_since_session' | 'missing_expected' | 'permission_denied' | 'outside_cwd';
  expectedContent?: string; // What we expected to find
  currentContent?: string; // What's actually on disk
  message: string; // Human-readable conflict description
}

/**
 * Rewind plan - preview of what would change
 * Returned by preview endpoint before execution
 */
export interface RewindPlan {
  sessionId: string;
  checkpointId?: string;
  frameIndex: number;
  cwd: string;
  files: RewindFileAction[];
  conflicts: RewindConflict[];
  warnings: string[];
  summary: {
    totalFiles: number;
    filesToCreate: number;
    filesToModify: number;
    filesToDelete: number;
    filesToSkip: number;
    conflictCount: number;
  };
}

/**
 * Result of executing a rewind
 */
export interface RewindResult {
  success: boolean;
  rewindId: string; // UUID of the rewind_history entry
  filesRestored: number;
  filesSkipped: number;
  backupsCreated: string[]; // List of backup file paths
  errors: string[]; // Errors encountered during execution
  canUndo: boolean; // Whether this rewind can be undone
  message: string; // Human-readable result summary
}

/**
 * Options for executing a rewind
 */
export interface RewindOptions {
  createBackups: boolean; // Default true - create backups before modifying
  skipConflicts: boolean; // Skip files with conflicts instead of failing
  dryRun: boolean; // Preview only, don't write files
  backupDir?: string; // Custom backup directory (default: .recall-backup)
}

/**
 * Request body for rewind preview endpoint
 */
export interface RewindPreviewRequest {
  frameIndex: number;
  checkpointId?: string;
}

/**
 * Request body for rewind execute endpoint
 */
export interface RewindExecuteRequest {
  frameIndex: number;
  checkpointId?: string;
  createBackups?: boolean; // Default true
  skipConflicts?: boolean; // Default false
}

/**
 * Result of undo operation
 */
export interface RewindUndoResult {
  success: boolean;
  rewindId: string; // ID of the rewind that was undone
  filesRestored: number; // Number of files restored from backup
  errors: string[]; // Errors encountered during undo
  message: string; // Human-readable result summary
}
