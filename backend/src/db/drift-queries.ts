/**
 * Database queries for drift analysis
 *
 * Provides CRUD operations for:
 * - repo_baselines: Computed baseline norms for repositories
 * - drift_analysis: Cached analysis results per session
 * - utility_index: Indexed utility functions for duplicate detection
 *
 * Uses the transcript database connection.
 *
 * @module drift-queries
 */

import { getTranscriptDbInstance } from './transcript-connection';
import type {
  DriftAnalysisResult,
  ImpactSummary,
  DriftFinding,
  DriftSeverity,
  RepoBaseline,
  RepoBaselineData,
  RepoBaselineRow,
  DriftAnalysisRow,
  UtilityFingerprint,
  UtilityIndexRow,
} from '../types/drift-analysis';

// ============================================================================
// Schema Initialization
// ============================================================================

/**
 * Initialize drift analysis schema
 *
 * Creates tables if they don't exist. Safe to call multiple times.
 */
export function initializeDriftSchema(): void {
  const db = getTranscriptDbInstance();

  db.exec(`
    -- Repo baselines (3D scoped: repo × language × topLevelDir)
    CREATE TABLE IF NOT EXISTS repo_baselines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      repo_path TEXT NOT NULL,
      language TEXT NOT NULL,
      top_level_dir TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '[]',
      computed_at TEXT NOT NULL,
      version TEXT NOT NULL,
      files_analyzed INTEGER NOT NULL,
      baseline_data TEXT NOT NULL,
      UNIQUE(repo_path, language, top_level_dir)
    );

    CREATE INDEX IF NOT EXISTS idx_baseline_repo
      ON repo_baselines(repo_path);

    CREATE INDEX IF NOT EXISTS idx_baseline_computed
      ON repo_baselines(computed_at DESC);

    -- Drift analysis results
    CREATE TABLE IF NOT EXISTS drift_analysis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL UNIQUE,
      analyzed_at TEXT NOT NULL,
      baseline_id INTEGER,
      impact_data TEXT NOT NULL,
      findings_data TEXT NOT NULL,
      findings_count INTEGER NOT NULL,
      findings_by_severity TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES session_metadata(session_id) ON DELETE CASCADE,
      FOREIGN KEY (baseline_id) REFERENCES repo_baselines(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_drift_session
      ON drift_analysis(session_id);

    CREATE INDEX IF NOT EXISTS idx_drift_findings_count
      ON drift_analysis(findings_count DESC);

    CREATE INDEX IF NOT EXISTS idx_drift_analyzed
      ON drift_analysis(analyzed_at DESC);

    -- Utility function index for duplicate detection
    CREATE TABLE IF NOT EXISTS utility_index (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      baseline_id INTEGER NOT NULL,
      function_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      fingerprint TEXT NOT NULL,
      token_count INTEGER NOT NULL,
      language TEXT NOT NULL,
      top_level_dir TEXT NOT NULL,
      FOREIGN KEY (baseline_id) REFERENCES repo_baselines(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_utility_name
      ON utility_index(function_name);

    CREATE INDEX IF NOT EXISTS idx_utility_fingerprint
      ON utility_index(fingerprint);

    CREATE INDEX IF NOT EXISTS idx_utility_baseline
      ON utility_index(baseline_id);

    CREATE INDEX IF NOT EXISTS idx_utility_baseline_name
      ON utility_index(baseline_id, function_name);
  `);
}

// ============================================================================
// Analysis Result Operations
// ============================================================================

/**
 * Get cached analysis result for a session
 *
 * @param sessionId - Session UUID
 * @returns DriftAnalysisResult or null if not cached
 */
export function getCachedAnalysis(sessionId: string): DriftAnalysisResult | null {
  const db = getTranscriptDbInstance();

  const row = db
    .prepare(
      `
      SELECT *
      FROM drift_analysis
      WHERE session_id = ?
    `
    )
    .get(sessionId) as DriftAnalysisRow | undefined;

  if (!row) {
    return null;
  }

  return rowToAnalysisResult(row);
}

/**
 * Save analysis result to database
 *
 * Uses INSERT OR REPLACE for upsert behavior.
 *
 * @param result - Analysis result to save
 */
export function saveAnalysis(result: DriftAnalysisResult): void {
  const db = getTranscriptDbInstance();

  db.prepare(
    `
    INSERT OR REPLACE INTO drift_analysis (
      session_id,
      analyzed_at,
      baseline_id,
      impact_data,
      findings_data,
      findings_count,
      findings_by_severity
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `
  ).run(
    result.sessionId,
    result.analyzedAt,
    result.baselineId,
    JSON.stringify(result.impact),
    JSON.stringify(result.findings),
    result.findings.length,
    JSON.stringify(result.findingsBySeverity)
  );
}

/**
 * Delete analysis result for a session
 *
 * @param sessionId - Session UUID
 * @returns true if deleted, false if not found
 */
export function deleteAnalysis(sessionId: string): boolean {
  const db = getTranscriptDbInstance();
  const result = db.prepare('DELETE FROM drift_analysis WHERE session_id = ?').run(sessionId);
  return result.changes > 0;
}

/**
 * Convert database row to DriftAnalysisResult
 */
function rowToAnalysisResult(row: DriftAnalysisRow): DriftAnalysisResult {
  return {
    sessionId: row.session_id,
    analyzedAt: row.analyzed_at,
    baselineId: row.baseline_id,
    impact: JSON.parse(row.impact_data) as ImpactSummary,
    findings: JSON.parse(row.findings_data) as DriftFinding[],
    findingsBySeverity: JSON.parse(row.findings_by_severity) as Record<DriftSeverity, number>,
  };
}

// ============================================================================
// Baseline Operations
// ============================================================================

/**
 * Get baseline by key (repo_path × language × top_level_dir)
 *
 * @param repoPath - Repository root path
 * @param language - Programming language
 * @param topLevelDir - Top-level directory
 * @returns RepoBaseline or null if not found
 */
export function getBaselineByKey(
  repoPath: string,
  language: string,
  topLevelDir: string
): RepoBaseline | null {
  const db = getTranscriptDbInstance();

  const row = db
    .prepare(
      `
      SELECT *
      FROM repo_baselines
      WHERE repo_path = ? AND language = ? AND top_level_dir = ?
    `
    )
    .get(repoPath, language, topLevelDir) as RepoBaselineRow | undefined;

  if (!row) {
    return null;
  }

  return rowToBaseline(row);
}

/**
 * Get baseline by ID
 *
 * @param id - Baseline ID
 * @returns RepoBaseline or null if not found
 */
export function getBaselineById(id: number): RepoBaseline | null {
  const db = getTranscriptDbInstance();

  const row = db
    .prepare(
      `
      SELECT *
      FROM repo_baselines
      WHERE id = ?
    `
    )
    .get(id) as RepoBaselineRow | undefined;

  if (!row) {
    return null;
  }

  return rowToBaseline(row);
}

/**
 * Get or create baseline for a repo
 *
 * @param repoPath - Repository root path
 * @param language - Programming language
 * @param topLevelDir - Top-level directory
 * @param tags - Framework tags
 * @param baselineData - Baseline data to store
 * @param version - Analyzer version
 * @param filesAnalyzed - Number of files analyzed
 * @returns Baseline ID
 */
export function getOrCreateBaseline(
  repoPath: string,
  language: string,
  topLevelDir: string,
  tags: string[],
  baselineData: RepoBaselineData,
  version: string,
  filesAnalyzed: number
): number {
  const db = getTranscriptDbInstance();

  // Try to insert, on conflict update
  const result = db
    .prepare(
      `
      INSERT INTO repo_baselines (
        repo_path,
        language,
        top_level_dir,
        tags,
        computed_at,
        version,
        files_analyzed,
        baseline_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(repo_path, language, top_level_dir)
      DO UPDATE SET
        tags = excluded.tags,
        computed_at = excluded.computed_at,
        version = excluded.version,
        files_analyzed = excluded.files_analyzed,
        baseline_data = excluded.baseline_data
      RETURNING id
    `
    )
    .get(
      repoPath,
      language,
      topLevelDir,
      JSON.stringify(tags),
      new Date().toISOString(),
      version,
      filesAnalyzed,
      JSON.stringify(baselineData)
    ) as { id: number };

  return result.id;
}

/**
 * List all baselines for a repo
 *
 * @param repoPath - Repository root path
 * @returns Array of baselines
 */
export function getBaselinesForRepo(repoPath: string): RepoBaseline[] {
  const db = getTranscriptDbInstance();

  const rows = db
    .prepare(
      `
      SELECT *
      FROM repo_baselines
      WHERE repo_path = ?
      ORDER BY language, top_level_dir
    `
    )
    .all(repoPath) as RepoBaselineRow[];

  return rows.map(rowToBaseline);
}

/**
 * List all baselines
 *
 * @returns Array of all baselines
 */
export function getAllBaselines(): RepoBaseline[] {
  const db = getTranscriptDbInstance();

  const rows = db
    .prepare(
      `
      SELECT *
      FROM repo_baselines
      ORDER BY computed_at DESC
    `
    )
    .all() as RepoBaselineRow[];

  return rows.map(rowToBaseline);
}

/**
 * Delete baseline by ID
 *
 * Also deletes associated utility_index rows via CASCADE.
 *
 * @param id - Baseline ID
 * @returns true if deleted, false if not found
 */
export function deleteBaseline(id: number): boolean {
  const db = getTranscriptDbInstance();
  const result = db.prepare('DELETE FROM repo_baselines WHERE id = ?').run(id);
  return result.changes > 0;
}

/**
 * Convert database row to RepoBaseline
 */
function rowToBaseline(row: RepoBaselineRow): RepoBaseline {
  const data = JSON.parse(row.baseline_data) as RepoBaselineData;

  return {
    id: row.id,
    repoPath: row.repo_path,
    language: row.language,
    topLevelDir: row.top_level_dir,
    tags: JSON.parse(row.tags) as string[],
    computedAt: row.computed_at,
    version: row.version,
    filesAnalyzed: row.files_analyzed,
    testCouplingStats: data.testCouplingStats,
    functionLengthDist: data.functionLengthDist,
    importEdgeFrequency: data.importEdgeFrequency,
    utilityFingerprints: [], // Loaded separately from utility_index
    dependencyCatalog: data.dependencyCatalog,
  };
}

// ============================================================================
// Utility Index Operations
// ============================================================================

/**
 * Insert utility fingerprints for a baseline
 *
 * @param baselineId - Baseline ID
 * @param fingerprints - Array of utility fingerprints
 */
export function insertUtilityIndexRows(
  baselineId: number,
  fingerprints: UtilityFingerprint[]
): void {
  const db = getTranscriptDbInstance();

  // Delete existing rows for this baseline
  db.prepare('DELETE FROM utility_index WHERE baseline_id = ?').run(baselineId);

  // Insert new rows
  const insert = db.prepare(`
    INSERT INTO utility_index (
      baseline_id,
      function_name,
      file_path,
      fingerprint,
      token_count,
      language,
      top_level_dir
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((fps: UtilityFingerprint[]) => {
    for (const fp of fps) {
      insert.run(
        baselineId,
        fp.functionName,
        fp.filePath,
        fp.fingerprint,
        fp.tokenCount,
        fp.language,
        fp.topLevelDir
      );
    }
  });

  insertMany(fingerprints);
}

/**
 * Find utility candidates by name (stage 1 of duplicate detection)
 *
 * Returns utilities with exact or similar names.
 *
 * @param baselineId - Baseline ID
 * @param functionName - Function name to search for
 * @returns Array of matching fingerprints
 */
export function findUtilityCandidatesByName(
  baselineId: number,
  functionName: string
): UtilityFingerprint[] {
  const db = getTranscriptDbInstance();

  // Search for exact match or LIKE pattern
  const rows = db
    .prepare(
      `
      SELECT *
      FROM utility_index
      WHERE baseline_id = ?
        AND (
          LOWER(function_name) = LOWER(?)
          OR LOWER(function_name) LIKE LOWER(?)
        )
    `
    )
    .all(baselineId, functionName, `%${functionName}%`) as UtilityIndexRow[];

  return rows.map(rowToFingerprint);
}

/**
 * Find utility by fingerprint (stage 2 of duplicate detection)
 *
 * @param baselineId - Baseline ID
 * @param fingerprint - Normalized token hash
 * @returns Matching fingerprint or null
 */
export function findUtilityByFingerprint(
  baselineId: number,
  fingerprint: string
): UtilityFingerprint | null {
  const db = getTranscriptDbInstance();

  const row = db
    .prepare(
      `
      SELECT *
      FROM utility_index
      WHERE baseline_id = ? AND fingerprint = ?
      LIMIT 1
    `
    )
    .get(baselineId, fingerprint) as UtilityIndexRow | undefined;

  if (!row) {
    return null;
  }

  return rowToFingerprint(row);
}

/**
 * Get all utility fingerprints for a baseline
 *
 * @param baselineId - Baseline ID
 * @returns Array of all fingerprints
 */
export function getUtilityFingerprintsForBaseline(baselineId: number): UtilityFingerprint[] {
  const db = getTranscriptDbInstance();

  const rows = db
    .prepare(
      `
      SELECT *
      FROM utility_index
      WHERE baseline_id = ?
      ORDER BY function_name
    `
    )
    .all(baselineId) as UtilityIndexRow[];

  return rows.map(rowToFingerprint);
}

/**
 * Convert database row to UtilityFingerprint
 */
function rowToFingerprint(row: UtilityIndexRow): UtilityFingerprint {
  return {
    functionName: row.function_name,
    filePath: row.file_path,
    fingerprint: row.fingerprint,
    tokenCount: row.token_count,
    language: row.language,
    topLevelDir: row.top_level_dir,
  };
}

// ============================================================================
// Statistics
// ============================================================================

/**
 * Get drift analysis statistics
 *
 * @returns Object with counts and summaries
 */
export function getDriftStats(): {
  totalAnalyses: number;
  totalBaselines: number;
  totalFindings: number;
  findingsByCategory: Record<string, number>;
} {
  const db = getTranscriptDbInstance();

  const totalAnalyses =
    (db.prepare('SELECT COUNT(*) as count FROM drift_analysis').get() as { count: number })
      ?.count || 0;

  const totalBaselines =
    (db.prepare('SELECT COUNT(*) as count FROM repo_baselines').get() as { count: number })
      ?.count || 0;

  const totalFindings =
    (
      db.prepare('SELECT SUM(findings_count) as sum FROM drift_analysis').get() as {
        sum: number | null;
      }
    )?.sum || 0;

  // Count findings by category
  const analyses = db.prepare('SELECT findings_data FROM drift_analysis').all() as Array<{
    findings_data: string;
  }>;

  const findingsByCategory: Record<string, number> = {};

  for (const row of analyses) {
    const findings = JSON.parse(row.findings_data) as DriftFinding[];
    for (const finding of findings) {
      findingsByCategory[finding.category] = (findingsByCategory[finding.category] || 0) + 1;
    }
  }

  return {
    totalAnalyses,
    totalBaselines,
    totalFindings,
    findingsByCategory,
  };
}
