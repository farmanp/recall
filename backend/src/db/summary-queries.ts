/**
 * Database queries for session summaries
 *
 * Provides CRUD operations for the recall_summaries table.
 * Uses the transcript database connection.
 *
 * @module summary-queries
 */

import { getTranscriptDbInstance } from './transcript-connection';
import { Summarizer, SessionSummary, SessionSummaryRow } from '../services/summarizer';

/**
 * Initialize summary schema
 *
 * Creates the recall_summaries table if it doesn't exist.
 * Safe to call multiple times - uses IF NOT EXISTS.
 */
export function initializeSummarySchema(): void {
  const db = getTranscriptDbInstance();

  db.exec(`
    CREATE TABLE IF NOT EXISTS recall_summaries (
      session_id TEXT PRIMARY KEY,
      summary_text TEXT NOT NULL,
      key_decisions TEXT,
      files_changed TEXT,
      tools_used TEXT,
      error_count INTEGER NOT NULL DEFAULT 0,
      success_indicators TEXT,
      generated_at TEXT NOT NULL,
      generated_at_epoch INTEGER NOT NULL,
      generated_by TEXT NOT NULL DEFAULT 'heuristic',
      FOREIGN KEY (session_id) REFERENCES session_metadata(session_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_recall_summaries_generated
      ON recall_summaries(generated_at_epoch DESC);

    CREATE INDEX IF NOT EXISTS idx_recall_summaries_by
      ON recall_summaries(generated_by);
  `);
}

/**
 * Get summary for a session
 *
 * @param sessionId - Session UUID
 * @returns SessionSummary or null if not found
 *
 * @example
 * const summary = getSummary('abc-123');
 * if (summary) {
 *   console.log(summary.summaryText);
 * }
 */
export function getSummary(sessionId: string): SessionSummary | null {
  const db = getTranscriptDbInstance();

  const row = db
    .prepare(
      `
    SELECT *
    FROM recall_summaries
    WHERE session_id = ?
  `
    )
    .get(sessionId) as SessionSummaryRow | undefined;

  if (!row) {
    return null;
  }

  return Summarizer.fromRow(row);
}

/**
 * Store or update a session summary
 *
 * Uses INSERT OR REPLACE for upsert behavior.
 *
 * @param summary - SessionSummary to store
 *
 * @example
 * const summary = Summarizer.generateSummary('abc-123', frames);
 * storeSummary(summary);
 */
export function storeSummary(summary: SessionSummary): void {
  const db = getTranscriptDbInstance();
  const row = Summarizer.toRow(summary);

  db.prepare(
    `
    INSERT OR REPLACE INTO recall_summaries (
      session_id,
      summary_text,
      key_decisions,
      files_changed,
      tools_used,
      error_count,
      success_indicators,
      generated_at,
      generated_at_epoch,
      generated_by
    ) VALUES (
      @session_id,
      @summary_text,
      @key_decisions,
      @files_changed,
      @tools_used,
      @error_count,
      @success_indicators,
      @generated_at,
      @generated_at_epoch,
      @generated_by
    )
  `
  ).run(row);
}

/**
 * Delete a session summary
 *
 * @param sessionId - Session UUID
 * @returns true if a row was deleted, false otherwise
 */
export function deleteSummary(sessionId: string): boolean {
  const db = getTranscriptDbInstance();

  const result = db.prepare('DELETE FROM recall_summaries WHERE session_id = ?').run(sessionId);

  return result.changes > 0;
}

/**
 * Check if a summary exists for a session
 *
 * @param sessionId - Session UUID
 * @returns true if summary exists
 */
export function hasSummary(sessionId: string): boolean {
  const db = getTranscriptDbInstance();

  const row = db
    .prepare(
      `
    SELECT 1
    FROM recall_summaries
    WHERE session_id = ?
  `
    )
    .get(sessionId);

  return !!row;
}

/**
 * Get multiple summaries by session IDs
 *
 * Efficient batch retrieval for session list views.
 *
 * @param sessionIds - Array of session UUIDs
 * @returns Map of sessionId to SessionSummary
 *
 * @example
 * const summaries = getSummariesBatch(['abc-123', 'def-456']);
 * for (const [id, summary] of summaries) {
 *   console.log(`${id}: ${summary.summaryText}`);
 * }
 */
export function getSummariesBatch(sessionIds: string[]): Map<string, SessionSummary> {
  if (sessionIds.length === 0) {
    return new Map();
  }

  const db = getTranscriptDbInstance();
  const placeholders = sessionIds.map(() => '?').join(',');

  const rows = db
    .prepare(
      `
    SELECT *
    FROM recall_summaries
    WHERE session_id IN (${placeholders})
  `
    )
    .all(...sessionIds) as SessionSummaryRow[];

  const summaries = new Map<string, SessionSummary>();

  for (const row of rows) {
    summaries.set(row.session_id, Summarizer.fromRow(row));
  }

  return summaries;
}

/**
 * Get summary statistics
 *
 * Returns aggregate statistics about stored summaries.
 *
 * @returns Summary statistics object
 */
export function getSummaryStats(): {
  total: number;
  heuristic: number;
  llm: number;
  avgErrorCount: number;
  avgFilesChanged: number;
} {
  const db = getTranscriptDbInstance();

  const stats = db
    .prepare(
      `
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN generated_by = 'heuristic' THEN 1 ELSE 0 END) as heuristic,
      SUM(CASE WHEN generated_by = 'llm' THEN 1 ELSE 0 END) as llm,
      AVG(error_count) as avg_error_count,
      AVG(
        COALESCE(
          json_array_length(json_extract(files_changed, '$.created')) +
          json_array_length(json_extract(files_changed, '$.modified')),
          0
        )
      ) as avg_files_changed
    FROM recall_summaries
  `
    )
    .get() as {
    total: number;
    heuristic: number;
    llm: number;
    avg_error_count: number | null;
    avg_files_changed: number | null;
  };

  return {
    total: stats.total || 0,
    heuristic: stats.heuristic || 0,
    llm: stats.llm || 0,
    avgErrorCount: stats.avg_error_count || 0,
    avgFilesChanged: stats.avg_files_changed || 0,
  };
}

/**
 * Get sessions without summaries
 *
 * Returns session IDs that don't have summaries yet.
 * Useful for background summary generation.
 *
 * @param limit - Maximum number of session IDs to return
 * @returns Array of session IDs
 */
export function getSessionsWithoutSummaries(limit: number = 100): string[] {
  const db = getTranscriptDbInstance();

  const rows = db
    .prepare(
      `
    SELECT m.session_id
    FROM session_metadata m
    LEFT JOIN recall_summaries s ON m.session_id = s.session_id
    WHERE s.session_id IS NULL
    ORDER BY m.start_time DESC
    LIMIT ?
  `
    )
    .all(limit) as Array<{ session_id: string }>;

  return rows.map((r) => r.session_id);
}

/**
 * Bulk store summaries
 *
 * Efficiently stores multiple summaries in a single transaction.
 *
 * @param summaries - Array of SessionSummary objects
 * @returns Number of summaries stored
 */
export function storeSummariesBatch(summaries: SessionSummary[]): number {
  if (summaries.length === 0) {
    return 0;
  }

  const db = getTranscriptDbInstance();

  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO recall_summaries (
      session_id,
      summary_text,
      key_decisions,
      files_changed,
      tools_used,
      error_count,
      success_indicators,
      generated_at,
      generated_at_epoch,
      generated_by
    ) VALUES (
      @session_id,
      @summary_text,
      @key_decisions,
      @files_changed,
      @tools_used,
      @error_count,
      @success_indicators,
      @generated_at,
      @generated_at_epoch,
      @generated_by
    )
  `);

  const batchInsert = db.transaction((items: SessionSummary[]) => {
    for (const summary of items) {
      const row = Summarizer.toRow(summary);
      insertStmt.run(row);
    }
    return items.length;
  });

  return batchInsert(summaries);
}
