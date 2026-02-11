-- Migration 026: Checkpoints - Named save points for session file state
-- Phase 2: Checkpoints feature for Recall session replay
--
-- Checkpoints capture the cumulative file state at any frame during a session.
-- This enables users to save and restore file snapshots, compare states between
-- different points in a session, or export the codebase state at a specific moment.
--
-- Design notes:
-- - Uses UUID for checkpoint IDs for frontend-friendliness
-- - SHA-256 hashes on file content enable deduplication
-- - Stores file status (created/modified/deleted) for accurate state tracking
-- - Foreign key to session_metadata for referential integrity

-- Table: checkpoints
-- Stores checkpoint metadata (name, frame index, timestamps)
CREATE TABLE IF NOT EXISTS checkpoints (
    id TEXT PRIMARY KEY,                    -- UUID
    session_id TEXT NOT NULL,               -- References session_metadata
    name TEXT NOT NULL,                     -- User-provided name for the checkpoint
    frame_index INTEGER NOT NULL,           -- Frame index at which checkpoint was created
    created_at TEXT NOT NULL,               -- ISO 8601 timestamp
    created_at_epoch INTEGER NOT NULL,      -- Unix epoch milliseconds
    git_commit TEXT,                        -- Optional git commit SHA at checkpoint time
    notes TEXT,                             -- Optional user notes
    FOREIGN KEY (session_id) REFERENCES session_metadata(session_id) ON DELETE CASCADE
);

-- Table: checkpoint_files
-- Stores file content for each checkpoint with SHA-256 deduplication
CREATE TABLE IF NOT EXISTS checkpoint_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    checkpoint_id TEXT NOT NULL,            -- References checkpoints.id
    file_path TEXT NOT NULL,                -- Absolute file path
    content_hash TEXT NOT NULL,             -- SHA-256 hash of content for deduplication
    content TEXT NOT NULL,                  -- Full file content
    status TEXT NOT NULL,                   -- 'created', 'modified', 'deleted'
    FOREIGN KEY (checkpoint_id) REFERENCES checkpoints(id) ON DELETE CASCADE
);

-- Indexes for checkpoints
CREATE INDEX IF NOT EXISTS idx_checkpoints_session ON checkpoints(session_id);
CREATE INDEX IF NOT EXISTS idx_checkpoints_frame ON checkpoints(session_id, frame_index);
CREATE INDEX IF NOT EXISTS idx_checkpoints_created ON checkpoints(created_at_epoch DESC);

-- Indexes for checkpoint_files
CREATE INDEX IF NOT EXISTS idx_checkpoint_files_checkpoint ON checkpoint_files(checkpoint_id);
CREATE INDEX IF NOT EXISTS idx_checkpoint_files_hash ON checkpoint_files(content_hash);
CREATE INDEX IF NOT EXISTS idx_checkpoint_files_path ON checkpoint_files(file_path);
