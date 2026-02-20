-- Migration 032: Enabled Repositories for Git Tracking
--
-- Stores which repository paths have git tracking enabled.
-- Used by the recall CLI to manage which repos are tracked.

CREATE TABLE IF NOT EXISTS enabled_repos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repo_path TEXT NOT NULL UNIQUE,           -- Absolute path to repository root
    repo_name TEXT,                           -- Human-readable name (defaults to directory name)
    enabled_at TEXT NOT NULL,                 -- ISO timestamp when enabled
    enabled_at_epoch INTEGER NOT NULL,        -- Unix epoch milliseconds
    last_import_at TEXT,                      -- Last time sessions were imported from this repo
    session_count INTEGER DEFAULT 0,          -- Number of sessions imported from this repo
    commit_count INTEGER DEFAULT 0            -- Number of commits linked to sessions
);

-- Index: Fast lookup by path
CREATE INDEX IF NOT EXISTS idx_enabled_repos_path ON enabled_repos(repo_path);

-- Index: Order by enabled time
CREATE INDEX IF NOT EXISTS idx_enabled_repos_enabled ON enabled_repos(enabled_at_epoch DESC);
