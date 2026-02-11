-- Migration 025: Git Activity Tracking
-- Phase 1: Git Commit Linking
--
-- This migration adds tables to track git context during sessions,
-- enabling linking of sessions to git commits and branches.

-- Table: git_activity
-- Stores git context snapshots captured during session imports
CREATE TABLE IF NOT EXISTS git_activity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    commit_hash TEXT,                    -- HEAD commit at time of capture (null if no commits)
    commit_message TEXT,                 -- Commit message for HEAD
    branch_name TEXT NOT NULL,           -- Current branch (or 'HEAD detached' if detached)
    parent_commit TEXT,                  -- Parent commit hash (for commit chain navigation)
    is_dirty INTEGER DEFAULT 0,          -- 1 if working directory has uncommitted changes
    files_staged TEXT,                   -- JSON array of staged file paths
    files_modified TEXT,                 -- JSON array of modified (unstaged) file paths
    untracked_count INTEGER DEFAULT 0,   -- Number of untracked files
    captured_at TEXT NOT NULL,           -- ISO timestamp when git context was captured
    captured_at_epoch INTEGER NOT NULL,  -- Unix epoch milliseconds
    FOREIGN KEY (session_id) REFERENCES session_metadata(session_id) ON DELETE CASCADE
);

-- Index: Fast lookup by session
CREATE INDEX IF NOT EXISTS idx_git_activity_session ON git_activity(session_id);

-- Index: Search by commit hash (for "find sessions that touched this commit")
CREATE INDEX IF NOT EXISTS idx_git_activity_commit ON git_activity(commit_hash);

-- Index: Search by branch name (for "find sessions on this branch")
CREATE INDEX IF NOT EXISTS idx_git_activity_branch ON git_activity(branch_name);

-- Index: Time-based queries
CREATE INDEX IF NOT EXISTS idx_git_activity_captured ON git_activity(captured_at_epoch DESC);

-- Table: session_commits
-- Junction table linking sessions to commits made during the session
-- (Future use: for detecting commits made between session start/end)
CREATE TABLE IF NOT EXISTS session_commits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    commit_hash TEXT NOT NULL,
    commit_message TEXT,
    author_name TEXT,
    author_email TEXT,
    committed_at TEXT NOT NULL,          -- ISO timestamp from git
    committed_at_epoch INTEGER NOT NULL, -- Unix epoch milliseconds
    FOREIGN KEY (session_id) REFERENCES session_metadata(session_id) ON DELETE CASCADE
);

-- Index: Session to commits lookup
CREATE INDEX IF NOT EXISTS idx_session_commits_session ON session_commits(session_id);

-- Index: Find sessions by commit
CREATE INDEX IF NOT EXISTS idx_session_commits_hash ON session_commits(commit_hash);

-- Unique constraint: prevent duplicate session-commit pairs
CREATE UNIQUE INDEX IF NOT EXISTS idx_session_commits_unique ON session_commits(session_id, commit_hash);
