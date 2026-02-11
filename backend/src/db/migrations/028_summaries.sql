-- Migration 028: Session Summaries (Auto-Summarization)
-- Phase 4: Heuristic-based session summarization
--
-- This migration adds a table to store auto-generated session summaries.
-- Summaries are generated using heuristics (pattern matching, counts, etc.)
-- without requiring LLM calls, making them fast and lightweight.

-- Table: recall_summaries
-- Stores heuristic-based or LLM-generated session summaries
CREATE TABLE IF NOT EXISTS recall_summaries (
    session_id TEXT PRIMARY KEY,           -- Session UUID (references session_metadata)
    summary_text TEXT NOT NULL,            -- Human-readable summary paragraph
    key_decisions TEXT,                    -- JSON array of decision strings
    files_changed TEXT,                    -- JSON: { created: [], modified: [], deleted: [] }
    tools_used TEXT,                       -- JSON: { "Bash": 10, "Edit": 5, ... }
    error_count INTEGER NOT NULL DEFAULT 0,-- Count of errors in tool executions
    success_indicators TEXT,               -- JSON array of positive signals
    generated_at TEXT NOT NULL,            -- ISO 8601 timestamp
    generated_at_epoch INTEGER NOT NULL,   -- Unix epoch milliseconds
    generated_by TEXT NOT NULL DEFAULT 'heuristic', -- 'heuristic' or 'llm'
    FOREIGN KEY (session_id) REFERENCES session_metadata(session_id) ON DELETE CASCADE
);

-- Index for ordering summaries by generation time
CREATE INDEX IF NOT EXISTS idx_recall_summaries_generated
    ON recall_summaries(generated_at_epoch DESC);

-- Index for filtering by generation method
CREATE INDEX IF NOT EXISTS idx_recall_summaries_by
    ON recall_summaries(generated_by);
