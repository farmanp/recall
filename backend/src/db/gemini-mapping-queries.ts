/**
 * Database queries for Gemini hash-to-project mappings
 *
 * Provides CRUD operations for the gemini_mappings table.
 * Uses the transcript database connection.
 *
 * Gemini CLI sessions are stored in ~/.gemini/tmp/{sha256-hash}/
 * where the hash doesn't reveal which project the session belongs to.
 * This module stores and retrieves the hash -> project associations.
 *
 * @module gemini-mapping-queries
 */

import { getTranscriptDbInstance } from './transcript-connection';

/**
 * Mapping source types
 * - 'realtime': Captured via file watcher when session is created
 * - 'manual': User-provided mapping
 * - 'inferred': Heuristically determined from session content
 */
export type GeminiMappingSource = 'realtime' | 'manual' | 'inferred';

/**
 * Gemini mapping record structure (camelCase for TypeScript)
 */
export interface GeminiMapping {
  hash: string;
  projectPath: string;
  capturedAt: string;
  source: GeminiMappingSource;
  confidence: number;
}

/**
 * Database row structure for gemini_mappings table (snake_case from SQLite)
 */
interface GeminiMappingRow {
  hash: string;
  project_path: string;
  captured_at: string;
  captured_at_epoch: number;
  source: string;
  confidence: number;
}

/**
 * Initialize the gemini_mappings table schema
 *
 * Creates the table and indexes if they don't exist. Safe to call multiple times.
 * Should be called during application startup.
 *
 * @example
 * initializeGeminiMappingSchema();
 * console.log('Gemini mappings schema initialized');
 */
export function initializeGeminiMappingSchema(): void {
  const db = getTranscriptDbInstance();

  db.exec(`
    -- Table: gemini_mappings
    -- Stores hash -> project path associations for Gemini sessions
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
  `);
}

/**
 * Save a Gemini hash to project path mapping
 *
 * Inserts or updates a mapping in the gemini_mappings table.
 * Uses INSERT OR REPLACE to handle both new and existing mappings.
 *
 * @param hash - SHA-256 hash of the project path (64 hex chars)
 * @param projectPath - Absolute path to the project directory
 * @param source - How the mapping was captured ('realtime', 'manual', 'inferred')
 * @param confidence - Confidence score from 0.0 to 1.0 (default 1.0)
 *
 * @example
 * saveGeminiMapping(
 *   'a1b2c3...', // 64 char hash
 *   '/Users/me/projects/myapp',
 *   'realtime',
 *   1.0
 * );
 */
export function saveGeminiMapping(
  hash: string,
  projectPath: string,
  source: 'realtime' | 'manual' | 'inferred' = 'realtime',
  confidence: number = 1.0
): void {
  const db = getTranscriptDbInstance();

  const now = new Date();
  const capturedAt = now.toISOString();
  const capturedAtEpoch = now.getTime();

  db.prepare(
    `
    INSERT OR REPLACE INTO gemini_mappings (
      hash,
      project_path,
      captured_at,
      captured_at_epoch,
      source,
      confidence
    ) VALUES (
      @hash,
      @projectPath,
      @capturedAt,
      @capturedAtEpoch,
      @source,
      @confidence
    )
  `
  ).run({
    hash,
    projectPath,
    capturedAt,
    capturedAtEpoch,
    source,
    confidence,
  });
}

/**
 * Get project path for a hash
 *
 * Looks up the project path and metadata for a given SHA-256 hash.
 * Returns null if no mapping exists.
 *
 * @param hash - SHA-256 hash to look up (64 hex chars)
 * @returns Mapping details or null if not found
 *
 * @example
 * const mapping = getGeminiMapping('a1b2c3...');
 * if (mapping) {
 *   console.log(`Hash maps to ${mapping.projectPath}`);
 *   console.log(`Confidence: ${mapping.confidence}`);
 * }
 */
export function getGeminiMapping(hash: string): {
  projectPath: string;
  confidence: number;
  source: string;
  capturedAt: string;
} | null {
  const db = getTranscriptDbInstance();

  const row = db
    .prepare(
      `
    SELECT project_path, confidence, source, captured_at
    FROM gemini_mappings
    WHERE hash = ?
  `
    )
    .get(hash) as
    | Pick<GeminiMappingRow, 'project_path' | 'confidence' | 'source' | 'captured_at'>
    | undefined;

  if (!row) {
    return null;
  }

  return {
    projectPath: row.project_path,
    confidence: row.confidence,
    source: row.source,
    capturedAt: row.captured_at,
  };
}

/**
 * Get all stored mappings
 *
 * Returns all hash -> project mappings, ordered by capture time (most recent first).
 *
 * @returns Array of all mappings with camelCase property names
 *
 * @example
 * const mappings = getAllGeminiMappings();
 * console.log(`Total mappings: ${mappings.length}`);
 * for (const m of mappings) {
 *   console.log(`${m.hash.slice(0, 8)}... -> ${m.projectPath}`);
 * }
 */
export function getAllGeminiMappings(): Array<{
  hash: string;
  projectPath: string;
  confidence: number;
  source: string;
  capturedAt: string;
}> {
  const db = getTranscriptDbInstance();

  const rows = db
    .prepare(
      `
    SELECT hash, project_path, confidence, source, captured_at
    FROM gemini_mappings
    ORDER BY captured_at_epoch DESC
  `
    )
    .all() as GeminiMappingRow[];

  return rows.map((row) => ({
    hash: row.hash,
    projectPath: row.project_path,
    confidence: row.confidence,
    source: row.source,
    capturedAt: row.captured_at,
  }));
}

/**
 * Get all Gemini mappings for a project path
 *
 * Finds all hash mappings that point to a given project.
 * Useful for finding all sessions associated with a project.
 *
 * @param projectPath - Absolute path to look up
 * @returns Array of hashes and their capture times
 *
 * @example
 * const mappings = getMappingsForProject('/Users/me/projects/myapp');
 * console.log(`Found ${mappings.length} sessions for this project`);
 */
export function getMappingsForProject(projectPath: string): Array<{
  hash: string;
  capturedAt: string;
  source: string;
  confidence: number;
}> {
  const db = getTranscriptDbInstance();

  const rows = db
    .prepare(
      `
    SELECT hash, captured_at, source, confidence
    FROM gemini_mappings
    WHERE project_path = ?
    ORDER BY captured_at_epoch DESC
  `
    )
    .all(projectPath) as Pick<GeminiMappingRow, 'hash' | 'captured_at' | 'source' | 'confidence'>[];

  return rows.map((row) => ({
    hash: row.hash,
    capturedAt: row.captured_at,
    source: row.source,
    confidence: row.confidence,
  }));
}

/**
 * Delete a Gemini mapping by hash
 *
 * Removes a mapping from the database.
 *
 * @param hash - SHA-256 hash to delete
 * @returns true if a row was deleted, false otherwise
 *
 * @example
 * if (deleteGeminiMapping('a1b2c3...')) {
 *   console.log('Mapping deleted');
 * }
 */
export function deleteGeminiMapping(hash: string): boolean {
  const db = getTranscriptDbInstance();

  const result = db.prepare('DELETE FROM gemini_mappings WHERE hash = ?').run(hash);

  return result.changes > 0;
}

/**
 * Check if a mapping exists for a hash
 *
 * @param hash - SHA-256 hash to check
 * @returns true if mapping exists
 */
export function hasGeminiMapping(hash: string): boolean {
  const db = getTranscriptDbInstance();

  const result = db.prepare('SELECT 1 FROM gemini_mappings WHERE hash = ?').get(hash);

  return result !== undefined;
}

/**
 * Get mapping statistics
 *
 * Returns aggregate statistics about stored mappings.
 *
 * @returns Statistics object with counts by source
 *
 * @example
 * const stats = getGeminiMappingStats();
 * console.log(`Total: ${stats.total}, Realtime: ${stats.realtime}`);
 */
export function getGeminiMappingStats(): {
  total: number;
  realtime: number;
  manual: number;
  inferred: number;
  uniqueProjects: number;
} {
  const db = getTranscriptDbInstance();

  const stats = db
    .prepare(
      `
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN source = 'realtime' THEN 1 ELSE 0 END) as realtime,
      SUM(CASE WHEN source = 'manual' THEN 1 ELSE 0 END) as manual,
      SUM(CASE WHEN source = 'inferred' THEN 1 ELSE 0 END) as inferred,
      COUNT(DISTINCT project_path) as unique_projects
    FROM gemini_mappings
  `
    )
    .get() as {
    total: number;
    realtime: number;
    manual: number;
    inferred: number;
    unique_projects: number;
  };

  return {
    total: stats.total || 0,
    realtime: stats.realtime || 0,
    manual: stats.manual || 0,
    inferred: stats.inferred || 0,
    uniqueProjects: stats.unique_projects || 0,
  };
}

/**
 * Bulk save mappings in a transaction
 *
 * Efficiently stores multiple mappings in a single transaction.
 * Uses INSERT OR REPLACE for upsert behavior.
 *
 * @param mappings - Array of mappings to save
 * @returns Number of mappings saved
 *
 * @example
 * const mappings = [
 *   { hash: 'abc...', projectPath: '/project/a', source: 'inferred', confidence: 0.8 },
 *   { hash: 'def...', projectPath: '/project/b', source: 'inferred', confidence: 0.9 },
 * ];
 * const count = saveGeminiMappingsBatch(mappings);
 */
export function saveGeminiMappingsBatch(
  mappings: Array<{
    hash: string;
    projectPath: string;
    source?: GeminiMappingSource;
    confidence?: number;
  }>
): number {
  if (mappings.length === 0) {
    return 0;
  }

  const db = getTranscriptDbInstance();
  const now = new Date();
  const capturedAt = now.toISOString();
  const capturedAtEpoch = now.getTime();

  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO gemini_mappings (
      hash,
      project_path,
      captured_at,
      captured_at_epoch,
      source,
      confidence
    ) VALUES (
      @hash,
      @projectPath,
      @capturedAt,
      @capturedAtEpoch,
      @source,
      @confidence
    )
  `);

  const batchInsert = db.transaction(
    (
      items: Array<{
        hash: string;
        projectPath: string;
        source?: GeminiMappingSource;
        confidence?: number;
      }>
    ) => {
      for (const mapping of items) {
        insertStmt.run({
          hash: mapping.hash,
          projectPath: mapping.projectPath,
          capturedAt,
          capturedAtEpoch,
          source: mapping.source || 'realtime',
          confidence: mapping.confidence ?? 1.0,
        });
      }
      return items.length;
    }
  );

  return batchInsert(mappings);
}
