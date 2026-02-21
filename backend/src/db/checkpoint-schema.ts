/**
 * TypeScript interfaces for checkpoint database tables and API responses
 */

/**
 * Checkpoint metadata - a named save point at a specific frame
 */
export interface Checkpoint {
  id: string; // UUID
  sessionId: string; // References session_metadata
  name: string; // User-provided name
  frameIndex: number; // Frame index at checkpoint creation
  createdAt: string; // ISO 8601 timestamp
  gitCommit?: string; // Optional git commit SHA
  notes?: string; // Optional user notes
  fileCount?: number; // Number of files in checkpoint (computed)
}

/**
 * File content stored in a checkpoint
 */
export interface CheckpointFile {
  id?: number; // Auto-incremented database ID
  path: string; // Absolute file path
  content: string; // Full file content
  contentHash: string; // SHA-256 hash for deduplication
  status: 'created' | 'modified' | 'deleted'; // File status at checkpoint
}

/**
 * Checkpoint with all its files attached
 */
export interface CheckpointWithFiles extends Checkpoint {
  files: CheckpointFile[];
}

/**
 * Database row shape for checkpoints table
 */
export interface CheckpointRow {
  id: string;
  session_id: string;
  name: string;
  frame_index: number;
  created_at: string;
  created_at_epoch: number;
  git_commit: string | null;
  notes: string | null;
}

/**
 * Database row shape for checkpoint_files table
 */
export interface CheckpointFileRow {
  id: number;
  checkpoint_id: string;
  file_path: string;
  content_hash: string;
  content: string;
  status: string;
}

/**
 * Request body for creating a checkpoint
 */
export interface CreateCheckpointRequest {
  name: string;
  frameIndex: number;
  gitCommit?: string;
  notes?: string;
  syncToGit?: boolean;
}

/**
 * Request body for updating a checkpoint
 */
export interface UpdateCheckpointRequest {
  name?: string;
  notes?: string;
}

/**
 * Diff result between two checkpoints
 */
export interface CheckpointDiff {
  from: Checkpoint;
  to: Checkpoint;
  addedFiles: string[]; // Files in 'to' but not in 'from'
  removedFiles: string[]; // Files in 'from' but not in 'to'
  modifiedFiles: string[]; // Files that exist in both but have different content
  unchangedFiles: string[]; // Files with same content in both
}

/**
 * File diff detail between two checkpoints
 */
export interface CheckpointFileDiff {
  path: string;
  fromContent?: string; // Content in 'from' checkpoint (undefined if added)
  toContent?: string; // Content in 'to' checkpoint (undefined if removed)
  status: 'added' | 'removed' | 'modified' | 'unchanged';
}
