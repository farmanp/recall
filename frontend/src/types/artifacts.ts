/**
 * TypeScript interfaces for File Artifacts tracking
 * Used by the ArtifactsPanel to show files created/modified/read during a session
 */

/**
 * Individual operation on a file (read, write, edit)
 */
export interface ArtifactOperation {
  type: 'read' | 'write' | 'edit';
  frameIndex: number;
  timestamp: number;
  tool: string; // The tool that performed the operation (Read, Write, Edit, Bash, etc.)
  isError: boolean;
  // For edits/writes, track the diff info if available
  diff?: {
    additions: number;
    deletions: number;
    oldContent?: string;
    newContent?: string;
  };
  // Error message if operation failed
  errorMessage?: string;
}

/**
 * File status based on operations performed
 */
export type ArtifactStatus = 'created' | 'modified' | 'read_only';

/**
 * Aggregated file artifact with all operations
 */
export interface ArtifactFile {
  path: string;
  filename: string;
  directory: string;
  language: string;
  status: ArtifactStatus;
  reads: number;
  writes: number;
  edits: number;
  operations: ArtifactOperation[];
  firstFrameIndex: number;
  lastFrameIndex: number;
  firstTimestamp: number;
  lastTimestamp: number;
  // Total changes across all operations
  totalAdditions: number;
  totalDeletions: number;
  // Whether any operation had an error
  hasErrors: boolean;
}

/**
 * Summary statistics for the artifacts panel
 */
export interface ArtifactsSummary {
  totalFiles: number;
  createdCount: number;
  modifiedCount: number;
  readOnlyCount: number;
  totalReads: number;
  totalWrites: number;
  totalEdits: number;
  errorCount: number;
}

/**
 * Sort options for the artifacts list
 */
export type ArtifactSortOption = 'activity' | 'name' | 'recent' | 'type';

/**
 * Filter options for artifact status
 */
export interface ArtifactFilters {
  showCreated: boolean;
  showModified: boolean;
  showReadOnly: boolean;
}

/**
 * Export format options
 */
export type ExportFormat = 'json' | 'markdown' | 'csv';
