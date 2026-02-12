-- Migration 029: Gemini Hash-to-Project Mappings
-- Stores mappings between Gemini session hashes and their project directories
--
-- Gemini CLI sessions are stored in ~/.gemini/tmp/{sha256-hash}/
-- where the hash doesn't reveal which project the session belongs to.
-- This table captures the association when sessions are created in realtime.
--
-- Mapping sources:
--   - 'realtime': Captured via file watcher when session is created
--   - 'manual': User-provided mapping
--   - 'inferred': Heuristically determined from session content

-- Table: gemini_mappings
-- Stores hash → project path associations for Gemini sessions
CREATE TABLE IF NOT EXISTS gemini_mappings (
    hash TEXT PRIMARY KEY,                      -- SHA-256 hash (64 chars)
    project_path TEXT NOT NULL,                 -- Resolved absolute project path
    captured_at TEXT NOT NULL,                  -- ISO 8601 timestamp
    captured_at_epoch INTEGER NOT NULL,         -- Unix epoch milliseconds
    source TEXT NOT NULL DEFAULT 'realtime',    -- 'realtime', 'manual', 'inferred'
    confidence REAL NOT NULL DEFAULT 1.0        -- Confidence score 0.0-1.0
);

-- Index for reverse lookups (find sessions by project)
CREATE INDEX IF NOT EXISTS idx_gemini_mappings_project
    ON gemini_mappings(project_path);

-- Index for ordering by capture time (most recent first)
CREATE INDEX IF NOT EXISTS idx_gemini_mappings_captured
    ON gemini_mappings(captured_at_epoch DESC);

-- Index for filtering by source type
CREATE INDEX IF NOT EXISTS idx_gemini_mappings_source
    ON gemini_mappings(source);
