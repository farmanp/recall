/**
 * TypeScript types for CLAUDE.md content versioning and evolution tracking
 * Phase 2: CLAUDE.md Observability
 */

/**
 * CLAUDE.md content snapshot with deduplication via SHA-256 content hash
 * Stores unique versions of CLAUDE.md files across all sessions
 */
export interface ClaudeMdSnapshot {
  id: number;
  content_hash: string; // SHA-256 hash for deduplication
  file_path: string; // Absolute path (e.g., /Users/.../project/CLAUDE.md)
  content: string; // Full file content
  content_size: number; // Byte size for UI display
  first_seen_at: string; // ISO timestamp of first detection
  first_seen_at_epoch: number;
  created_at: string; // When this snapshot was inserted into DB
  created_at_epoch: number;
}

/**
 * Junction table linking sessions to CLAUDE.md snapshots
 * Multiple sessions can reference the same snapshot (via content_hash deduplication)
 * This enables tracking which version of CLAUDE.md was active during each session
 */
export interface SessionClaudeMd {
  id: number;
  session_id: string; // References sdk_sessions.content_session_id
  snapshot_id: number; // References claudemd_snapshots.id
  file_path: string; // Path at time of session (may differ from snapshot.file_path)
  loaded_at: string; // ISO timestamp from Phase 1 ClaudeMdInfo
  loaded_at_epoch: number;
}

/**
 * Full CLAUDE.md version info for timeline display
 * Combines snapshot data with usage statistics
 */
export interface ClaudeMdVersion {
  snapshotId: number;
  contentHash: string;
  filePath: string;
  content: string;
  contentSize: number;
  firstSeenAt: string;
  sessionCount: number; // How many sessions used this version
  dateRange: {
    from: string; // First session that used it
    to: string; // Last session that used it
  };
}

/**
 * API Response types
 */
export interface ClaudeMdHistoryResponse {
  project: string;
  versions: ClaudeMdVersion[];
}

export interface ClaudeMdCompareResponse {
  from: ClaudeMdSnapshot;
  to: ClaudeMdSnapshot;
}
