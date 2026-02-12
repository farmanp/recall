-- Migration 030: LLM Summary Fields
-- Add cost tracking fields for LLM-generated summaries
--
-- This migration extends the recall_summaries table to track:
-- - Token usage from LLM API calls
-- - Estimated cost per summary
-- - Model used for generation
-- Add LLM-specific fields to recall_summaries
-- These are optional fields that will be NULL for heuristic summaries
ALTER TABLE recall_summaries
ADD COLUMN tokens_used INTEGER DEFAULT 0;
ALTER TABLE recall_summaries
ADD COLUMN estimated_cost REAL DEFAULT 0.0;
ALTER TABLE recall_summaries
ADD COLUMN llm_model TEXT DEFAULT NULL;