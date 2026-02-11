/**
 * TypeScript interfaces for Recall competitive features
 * Phase 1: Git Commit Linking
 * Phase 2: Checkpoints
 * Phase 3: Rewind
 * Phase 4: Auto-Summarization
 */

// ============================================================================
// Phase 1: Git Context Types
// ============================================================================

/**
 * Git commit information
 */
export interface GitCommitInfo {
  hash: string;
  message: string;
  author: string;
  timestamp: string;
}

/**
 * Git context for a session
 */
export interface GitContext {
  branch: string;
  headCommit: string;
  commitMessage?: string;
  isDirty: boolean;
  stagedFiles: string[];
  remoteUrl?: string;
  commitsInSession?: GitCommitInfo[];
}

// ============================================================================
// Phase 2: Checkpoint Types
// ============================================================================

/**
 * A checkpoint represents a saved point in the session timeline
 */
export interface Checkpoint {
  id: string;
  sessionId: string;
  name: string;
  frameIndex: number;
  createdAt: string;
  gitCommit?: string;
  notes?: string;
  fileCount?: number;
}

/**
 * Request to create a new checkpoint
 */
export interface CreateCheckpointRequest {
  name: string;
  frameIndex: number;
  notes?: string;
}

/**
 * Response when comparing two checkpoints
 */
export interface CheckpointComparison {
  checkpoint1: Checkpoint;
  checkpoint2: Checkpoint;
  filesDiff: {
    added: string[];
    removed: string[];
    modified: string[];
  };
  frameRange: {
    start: number;
    end: number;
  };
}

// ============================================================================
// Phase 3: Rewind Types
// ============================================================================

/**
 * A plan for rewinding to a specific frame
 */
export interface RewindPlan {
  sessionId: string;
  frameIndex: number;
  files: RewindFileAction[];
  conflicts: RewindConflict[];
  warnings: string[];
}

/**
 * Action to be taken on a specific file during rewind
 */
export interface RewindFileAction {
  path: string;
  action: 'create' | 'modify' | 'delete' | 'skip';
  content?: string;
  currentHash?: string;
  targetHash?: string;
}

/**
 * A conflict detected during rewind planning
 */
export interface RewindConflict {
  path: string;
  reason: string;
  currentContent?: string;
  expectedContent?: string;
}

/**
 * Options for executing a rewind
 */
export interface RewindOptions {
  createBackups: boolean;
  skipConflicts: boolean;
}

/**
 * Result of executing a rewind
 */
export interface RewindResult {
  success: boolean;
  rewindId: string;
  filesRestored: number;
  backupsCreated: string[];
  errors: string[];
  canUndo: boolean;
}

/**
 * Request to undo a previous rewind
 */
export interface RewindUndoRequest {
  rewindId: string;
}

/**
 * Result of undoing a rewind
 */
export interface RewindUndoResult {
  success: boolean;
  filesRestored: number;
  errors: string[];
}

// ============================================================================
// Phase 4: Summary Types
// ============================================================================

/**
 * AI-generated session summary
 */
export interface SessionSummary {
  sessionId: string;
  summaryText: string;
  keyDecisions: string[];
  filesChanged: {
    created: string[];
    modified: string[];
    deleted: string[];
  };
  toolsUsed: Record<string, number>;
  errorCount: number;
  successIndicators: string[];
  generatedAt: string;
}

/**
 * Request to generate or regenerate a summary
 */
export interface GenerateSummaryRequest {
  sessionId: string;
  force?: boolean;
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Standard API error response
 */
export interface ApiError {
  error: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Git context API response
 */
export interface GitContextResponse {
  sessionId: string;
  git: GitContext | null;
  error?: string;
}

/**
 * Checkpoints list API response
 */
export interface CheckpointsListResponse {
  checkpoints: Checkpoint[];
  sessionId: string;
  total: number;
}

/**
 * Rewind preview API response
 */
export interface RewindPreviewResponse {
  plan: RewindPlan;
  estimatedTime?: number;
}

/**
 * Summary API response
 */
export interface SummaryResponse {
  summary: SessionSummary | null;
  cached: boolean;
  generatedAt?: string;
}
