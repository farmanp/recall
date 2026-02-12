import { getTranscriptDbInstance } from './transcript-connection';
import fs from 'fs';
import path from 'path';

export interface GitActivityParams {
  sessionId: string;
  commitHash: string | null;
  commitMessage: string | null;
  branchName: string;
  parentCommit: string | null;
  isDirty: boolean;
  filesStaged: string | null;
  filesModified: string | null;
  untrackedCount: number;
}

export interface GitCommitParams {
  sessionId: string;
  commitHash: string;
  commitMessage: string | null;
  authorName: string | null;
  authorEmail: string | null;
  committedAt: string;
  committedAtEpoch: number;
}

export function saveGitActivity(params: GitActivityParams): void {
  const db = getTranscriptDbInstance();
  const now = new Date();
  db.prepare(
    `
    INSERT INTO git_activity (
      session_id, commit_hash, commit_message, branch_name,
      parent_commit, is_dirty, files_staged, files_modified,
      untracked_count, captured_at, captured_at_epoch
    ) VALUES (
      @sessionId, @commitHash, @commitMessage, @branchName,
      @parentCommit, @isDirty, @filesStaged, @filesModified,
      @untrackedCount, @capturedAt, @capturedAtEpoch
    )
  `
  ).run({
    sessionId: params.sessionId,
    commitHash: params.commitHash,
    commitMessage: params.commitMessage,
    branchName: params.branchName,
    parentCommit: params.parentCommit,
    isDirty: params.isDirty ? 1 : 0,
    filesStaged: params.filesStaged,
    filesModified: params.filesModified,
    untrackedCount: params.untrackedCount,
    capturedAt: now.toISOString(),
    capturedAtEpoch: now.getTime(),
  });
}

export function saveSessionCommits(commits: GitCommitParams[]): void {
  if (commits.length === 0) return;
  const db = getTranscriptDbInstance();
  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO session_commits (
      session_id, commit_hash, commit_message, author_name,
      author_email, committed_at, committed_at_epoch
    ) VALUES (
      @sessionId, @commitHash, @commitMessage, @authorName,
      @authorEmail, @committedAt, @committedAtEpoch
    )
  `);
  const insertMany = db.transaction((commitsToInsert: GitCommitParams[]) => {
    for (const commit of commitsToInsert) {
      insertStmt.run(commit);
    }
  });
  insertMany(commits);
}

// ============================================================================
// Query Functions (used by routes)
// ============================================================================

export interface GitActivityRow {
  session_id: string;
  commit_hash: string | null;
  commit_message: string | null;
  branch_name: string;
  parent_commit: string | null;
  is_dirty: number;
  files_staged: string | null;
  files_modified: string | null;
  untracked_count: number;
  captured_at: string;
}

export interface SessionCommitRow {
  commit_hash: string;
  commit_message: string | null;
  author_name: string | null;
  author_email: string | null;
  committed_at: string;
}

/**
 * Get git activity for a session
 */
export function getGitActivity(sessionId: string): GitActivityRow | null {
  const db = getTranscriptDbInstance();
  return db
    .prepare(
      `
    SELECT session_id, commit_hash, commit_message, branch_name,
           parent_commit, is_dirty, files_staged, files_modified,
           untracked_count, captured_at
    FROM git_activity
    WHERE session_id = ?
  `
    )
    .get(sessionId) as GitActivityRow | null;
}

/**
 * Get commits made during a session
 */
export function getSessionCommits(sessionId: string): SessionCommitRow[] {
  const db = getTranscriptDbInstance();
  return db
    .prepare(
      `
    SELECT commit_hash, commit_message, author_name, author_email, committed_at
    FROM session_commits
    WHERE session_id = ?
    ORDER BY committed_at_epoch ASC
  `
    )
    .all(sessionId) as SessionCommitRow[];
}

/**
 * Find sessions that touched a specific commit
 */
export function findSessionsByCommit(hash: string): string[] {
  const db = getTranscriptDbInstance();
  const rows = db
    .prepare(
      `
    SELECT DISTINCT session_id
    FROM (
      SELECT session_id FROM git_activity WHERE commit_hash LIKE ? || '%'
      UNION
      SELECT session_id FROM session_commits WHERE commit_hash LIKE ? || '%'
    )
  `
    )
    .all(hash, hash) as Array<{ session_id: string }>;
  return rows.map((r) => r.session_id);
}

/**
 * Get all branches with session counts
 */
export function getBranchesWithCounts(): Array<{ branch: string; sessionCount: number }> {
  const db = getTranscriptDbInstance();
  return db
    .prepare(
      `
    SELECT branch_name as branch, COUNT(DISTINCT session_id) as sessionCount
    FROM git_activity
    WHERE branch_name IS NOT NULL
    GROUP BY branch_name
    ORDER BY sessionCount DESC
  `
    )
    .all() as Array<{ branch: string; sessionCount: number }>;
}

/**
 * Find sessions on a specific branch
 */
export function findSessionsByBranch(branchName: string, limit: number = 100): string[] {
  const db = getTranscriptDbInstance();
  const rows = db
    .prepare(
      `
    SELECT DISTINCT session_id
    FROM git_activity
    WHERE branch_name = ?
    ORDER BY captured_at_epoch DESC
    LIMIT ?
  `
    )
    .all(branchName, limit) as Array<{ session_id: string }>;
  return rows.map((r) => r.session_id);
}

// ============================================================================
// Schema Initialization
// ============================================================================

export function initializeGitActivitySchema(): void {
  const db = getTranscriptDbInstance();
  const tableInfo = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='git_activity'")
    .get();
  if (tableInfo) return;
  const migrationPath = path.join(__dirname, 'migrations', '025_git_activity.sql');
  if (fs.existsSync(migrationPath)) {
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    db.exec(migrationSql);
    console.log('[GitQueries] Initialized git_activity schema');
  } else {
    db.exec(`
      CREATE TABLE IF NOT EXISTS git_activity (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        commit_hash TEXT, commit_message TEXT, branch_name TEXT NOT NULL,
        parent_commit TEXT, is_dirty INTEGER DEFAULT 0,
        files_staged TEXT, files_modified TEXT, untracked_count INTEGER DEFAULT 0,
        captured_at TEXT NOT NULL, captured_at_epoch INTEGER NOT NULL,
        FOREIGN KEY (session_id) REFERENCES session_metadata(session_id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_git_activity_session ON git_activity(session_id);
      CREATE INDEX IF NOT EXISTS idx_git_activity_commit ON git_activity(commit_hash);
      CREATE INDEX IF NOT EXISTS idx_git_activity_branch ON git_activity(branch_name);
      CREATE INDEX IF NOT EXISTS idx_git_activity_captured ON git_activity(captured_at_epoch DESC);
      CREATE TABLE IF NOT EXISTS session_commits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        commit_hash TEXT NOT NULL, commit_message TEXT, author_name TEXT,
        author_email TEXT, committed_at TEXT NOT NULL, committed_at_epoch INTEGER NOT NULL,
        FOREIGN KEY (session_id) REFERENCES session_metadata(session_id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_session_commits_session ON session_commits(session_id);
      CREATE INDEX IF NOT EXISTS idx_session_commits_hash ON session_commits(commit_hash);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_session_commits_unique ON session_commits(session_id, commit_hash);
    `);
    console.log('[GitQueries] Initialized git_activity schema (inline)');
  }
}
