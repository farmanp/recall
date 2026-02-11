-- Migration 027: Rewind History - Track file restoration operations
-- Phase 3: Rewind feature for Recall session replay
--
-- The rewind feature allows users to restore file state from any frame or checkpoint
-- to disk. This table tracks all rewind operations for:
-- - Undo capability (restore from backups)
-- - Audit trail of file modifications
-- - Conflict detection for repeated rewinds
--
-- Design notes:
-- - Uses UUID for rewind IDs for frontend-friendliness
-- - Stores backup paths as JSON for easy undo operations
-- - can_undo flag indicates if backups are still available
-- - Foreign key to session_metadata ensures cleanup on session deletion

-- Table: rewind_history
-- Stores rewind operation metadata and backup information
CREATE TABLE IF NOT EXISTS rewind_history (
    id TEXT PRIMARY KEY,                    -- UUID
    session_id TEXT NOT NULL,               -- References session_metadata
    checkpoint_id TEXT,                     -- Optional: if rewind was from checkpoint
    frame_index INTEGER NOT NULL,           -- Frame index that was rewound to
    cwd TEXT NOT NULL,                      -- Working directory where files were restored
    executed_at TEXT NOT NULL,              -- ISO 8601 timestamp
    executed_at_epoch INTEGER NOT NULL,     -- Unix epoch milliseconds
    files_modified TEXT NOT NULL,           -- JSON array of paths that were modified
    backups_created TEXT,                   -- JSON map: { originalPath: backupPath }
    can_undo INTEGER DEFAULT 1,             -- Boolean: 1 if backups available for undo
    FOREIGN KEY (session_id) REFERENCES session_metadata(session_id) ON DELETE CASCADE
);

-- Indexes for rewind_history
CREATE INDEX IF NOT EXISTS idx_rewind_history_session ON rewind_history(session_id);
CREATE INDEX IF NOT EXISTS idx_rewind_history_executed ON rewind_history(executed_at_epoch DESC);
CREATE INDEX IF NOT EXISTS idx_rewind_history_can_undo ON rewind_history(session_id, can_undo);
