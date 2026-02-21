-- Migration 031: Git-based checkpoint storage tracking
-- Adds columns to track git branch/commit references for checkpoints
--
-- Design notes:
-- - SQLite remains the authoritative source for checkpoint data
-- - Git branch storage is secondary/optional
-- - These columns track sync status and git references
-- - Supports both storage branch (all checkpoints) and export branches (individual)

-- Add columns to track git storage
-- git_storage_commit: SHA of the commit on recall/checkpoints/v1 branch
ALTER TABLE checkpoints ADD COLUMN git_storage_commit TEXT;

-- git_export_branch: Name of any export branch created from this checkpoint
ALTER TABLE checkpoints ADD COLUMN git_export_branch TEXT;

-- git_storage_synced: Boolean flag (0/1) indicating if synced to git
ALTER TABLE checkpoints ADD COLUMN git_storage_synced INTEGER DEFAULT 0;

-- Index for finding checkpoints by git commit
CREATE INDEX IF NOT EXISTS idx_checkpoints_git_commit ON checkpoints(git_storage_commit);

-- Index for finding unsynced checkpoints
CREATE INDEX IF NOT EXISTS idx_checkpoints_git_synced ON checkpoints(git_storage_synced);
