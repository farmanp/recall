/**
 * Database queries for enabled repository tracking.
 * Manages which git repositories have git tracking enabled for Recall.
 */

import { getTranscriptDbInstance } from './transcript-connection';
import fs from 'fs';
import path from 'path';

export interface EnabledRepo {
  id: number;
  repoPath: string;
  repoName: string | null;
  enabledAt: string;
  lastImportAt: string | null;
  sessionCount: number;
  commitCount: number;
}

interface EnabledRepoRow {
  id: number;
  repo_path: string;
  repo_name: string | null;
  enabled_at: string;
  last_import_at: string | null;
  session_count: number;
  commit_count: number;
}

// ============================================================================
// Schema Initialization
// ============================================================================

export function initializeEnabledReposSchema(): void {
  const db = getTranscriptDbInstance();
  const tableInfo = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='enabled_repos'")
    .get();
  if (tableInfo) return;

  const migrationPath = path.join(__dirname, 'migrations', '032_enabled_repos.sql');
  if (fs.existsSync(migrationPath)) {
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    db.exec(migrationSql);
    console.log('[EnabledRepos] Initialized enabled_repos schema');
  } else {
    db.exec(`
      CREATE TABLE IF NOT EXISTS enabled_repos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        repo_path TEXT NOT NULL UNIQUE,
        repo_name TEXT,
        enabled_at TEXT NOT NULL,
        enabled_at_epoch INTEGER NOT NULL,
        last_import_at TEXT,
        session_count INTEGER DEFAULT 0,
        commit_count INTEGER DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_enabled_repos_path ON enabled_repos(repo_path);
      CREATE INDEX IF NOT EXISTS idx_enabled_repos_enabled ON enabled_repos(enabled_at_epoch DESC);
    `);
    console.log('[EnabledRepos] Initialized enabled_repos schema (inline)');
  }
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Enable a repository for git tracking
 */
export function enableRepo(repoPath: string, repoName?: string): EnabledRepo {
  const db = getTranscriptDbInstance();
  const now = new Date();
  const name = repoName || path.basename(repoPath);

  // Check if already enabled
  const existing = db.prepare('SELECT * FROM enabled_repos WHERE repo_path = ?').get(repoPath) as
    | EnabledRepoRow
    | undefined;

  if (existing) {
    return rowToEnabledRepo(existing);
  }

  // Insert new entry
  db.prepare(
    `
    INSERT INTO enabled_repos (repo_path, repo_name, enabled_at, enabled_at_epoch)
    VALUES (?, ?, ?, ?)
  `
  ).run(repoPath, name, now.toISOString(), now.getTime());

  const inserted = db
    .prepare('SELECT * FROM enabled_repos WHERE repo_path = ?')
    .get(repoPath) as EnabledRepoRow;

  return rowToEnabledRepo(inserted);
}

/**
 * Disable git tracking for a repository
 */
export function disableRepo(repoPath: string): boolean {
  const db = getTranscriptDbInstance();
  const result = db.prepare('DELETE FROM enabled_repos WHERE repo_path = ?').run(repoPath);
  return result.changes > 0;
}

/**
 * Check if a repository is enabled
 */
export function isRepoEnabled(repoPath: string): boolean {
  const db = getTranscriptDbInstance();
  const row = db.prepare('SELECT id FROM enabled_repos WHERE repo_path = ?').get(repoPath);
  return !!row;
}

/**
 * Get all enabled repositories
 */
export function getEnabledRepos(): EnabledRepo[] {
  const db = getTranscriptDbInstance();
  const rows = db
    .prepare(
      `
    SELECT * FROM enabled_repos
    ORDER BY enabled_at_epoch DESC
  `
    )
    .all() as EnabledRepoRow[];

  return rows.map(rowToEnabledRepo);
}

/**
 * Get an enabled repository by path
 */
export function getEnabledRepo(repoPath: string): EnabledRepo | null {
  const db = getTranscriptDbInstance();
  const row = db.prepare('SELECT * FROM enabled_repos WHERE repo_path = ?').get(repoPath) as
    | EnabledRepoRow
    | undefined;

  return row ? rowToEnabledRepo(row) : null;
}

/**
 * Update repository stats (called after import)
 */
export function updateRepoStats(
  repoPath: string,
  stats: { sessionCount?: number; commitCount?: number }
): void {
  const db = getTranscriptDbInstance();
  const now = new Date();

  if (stats.sessionCount !== undefined) {
    db.prepare(
      `
      UPDATE enabled_repos
      SET session_count = ?, last_import_at = ?
      WHERE repo_path = ?
    `
    ).run(stats.sessionCount, now.toISOString(), repoPath);
  }

  if (stats.commitCount !== undefined) {
    db.prepare(
      `
      UPDATE enabled_repos
      SET commit_count = ?
      WHERE repo_path = ?
    `
    ).run(stats.commitCount, repoPath);
  }
}

/**
 * Get overall tracking statistics
 */
export function getTrackingStats(): {
  enabledRepos: number;
  totalSessions: number;
  totalCommits: number;
} {
  const db = getTranscriptDbInstance();

  const repoCount = (
    db.prepare('SELECT COUNT(*) as count FROM enabled_repos').get() as { count: number }
  ).count;

  const sessionCount =
    (
      db
        .prepare(
          `
    SELECT COUNT(DISTINCT ga.session_id) as count
    FROM git_activity ga
    JOIN enabled_repos er ON ga.session_id IN (
      SELECT session_id FROM session_metadata WHERE project = er.repo_path
    )
  `
        )
        .get() as { count: number } | undefined
    )?.count ?? 0;

  const commitCount =
    (
      db
        .prepare(
          `
    SELECT COUNT(*) as count FROM session_commits
  `
        )
        .get() as { count: number } | undefined
    )?.count ?? 0;

  return {
    enabledRepos: repoCount,
    totalSessions: sessionCount,
    totalCommits: commitCount,
  };
}

// ============================================================================
// Helpers
// ============================================================================

function rowToEnabledRepo(row: EnabledRepoRow): EnabledRepo {
  return {
    id: row.id,
    repoPath: row.repo_path,
    repoName: row.repo_name,
    enabledAt: row.enabled_at,
    lastImportAt: row.last_import_at,
    sessionCount: row.session_count,
    commitCount: row.commit_count,
  };
}
