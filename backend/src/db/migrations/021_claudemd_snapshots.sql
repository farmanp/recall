-- Migration 003: CLAUDE.md Content Snapshots and Versioning
-- Phase 2: CLAUDE.md Observability - Evolution Tracking
-- 
-- This migration adds tables to store CLAUDE.md file content and track
-- which versions were used during each session. Content is deduplicated
-- using SHA-256 hashing to minimize storage overhead.
-- Table: claudemd_snapshots
-- Stores unique CLAUDE.md content versions with deduplication
CREATE TABLE IF NOT EXISTS claudemd_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content_hash TEXT UNIQUE NOT NULL,
    -- SHA-256 hash for deduplication
    file_path TEXT NOT NULL,
    -- Absolute path to CLAUDE.md file
    content TEXT NOT NULL,
    -- Full file content
    content_size INTEGER NOT NULL,
    -- Byte size for UI display
    first_seen_at TEXT NOT NULL,
    -- ISO timestamp of first detection
    first_seen_at_epoch INTEGER NOT NULL,
    -- Unix epoch milliseconds
    created_at TEXT NOT NULL,
    -- When snapshot was inserted
    created_at_epoch INTEGER NOT NULL -- Unix epoch milliseconds
);
-- Indexes for claudemd_snapshots
CREATE INDEX IF NOT EXISTS idx_claudemd_snapshots_hash ON claudemd_snapshots(content_hash);
CREATE INDEX IF NOT EXISTS idx_claudemd_snapshots_path ON claudemd_snapshots(file_path);
CREATE INDEX IF NOT EXISTS idx_claudemd_snapshots_first_seen ON claudemd_snapshots(first_seen_at_epoch DESC);
-- Table: session_claudemd
-- Junction table linking sessions to CLAUDE.md snapshots
-- Enables many-to-many relationship: multiple sessions can use same snapshot
CREATE TABLE IF NOT EXISTS session_claudemd (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    -- References sdk_sessions.content_session_id
    snapshot_id INTEGER NOT NULL,
    -- References claudemd_snapshots.id
    file_path TEXT NOT NULL,
    -- Path at time of session
    loaded_at TEXT NOT NULL,
    -- ISO timestamp when file was loaded
    loaded_at_epoch INTEGER NOT NULL,
    -- Unix epoch milliseconds
    FOREIGN KEY(session_id) REFERENCES sdk_sessions(content_session_id) ON DELETE CASCADE,
    FOREIGN KEY(snapshot_id) REFERENCES claudemd_snapshots(id) ON DELETE CASCADE
);
-- Indexes for session_claudemd
CREATE INDEX IF NOT EXISTS idx_session_claudemd_session ON session_claudemd(session_id);
CREATE INDEX IF NOT EXISTS idx_session_claudemd_snapshot ON session_claudemd(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_session_claudemd_loaded ON session_claudemd(loaded_at_epoch DESC);
-- Unique constraint: prevent duplicate session-snapshot pairs
CREATE UNIQUE INDEX IF NOT EXISTS idx_session_claudemd_unique ON session_claudemd(session_id, snapshot_id);