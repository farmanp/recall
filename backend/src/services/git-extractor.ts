/**
 * Git Extractor Service
 *
 * Extracts git context from a directory and stores it in the database.
 * Used during transcript import to link sessions to git history.
 *
 * @module git-extractor
 */

import { execSync } from 'child_process';
import { getTranscriptDbInstance } from '../db/transcript-connection';
import fs from 'fs';

/**
 * Git context extracted from a repository
 */
export interface GitContext {
  branch: string;
  headCommit: string | null;
  commitMessage: string | null;
  parentCommit: string | null;
  isDirty: boolean;
  stagedFiles: string[];
  modifiedFiles: string[];
  untrackedCount: number;
}

/**
 * Git commit information
 */
export interface GitCommit {
  hash: string;
  message: string;
  authorName: string;
  authorEmail: string;
  committedAt: string; // ISO timestamp
  committedAtEpoch: number;
}

/**
 * Git activity row from database
 */
export interface GitActivityRow {
  id: number;
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
  captured_at_epoch: number;
}

/**
 * Session commit row from database
 */
export interface SessionCommitRow {
  id: number;
  session_id: string;
  commit_hash: string;
  commit_message: string | null;
  author_name: string | null;
  author_email: string | null;
  committed_at: string;
  committed_at_epoch: number;
}

/**
 * Git Extractor Service
 *
 * Provides methods to extract git context from directories and store
 * it in the transcript database for session-git correlation.
 */
export class GitExtractor {
  /**
   * Execute a git command in a directory, suppressing stderr
   *
   * @param command - Git command to execute (without 'git' prefix)
   * @param cwd - Working directory
   * @returns Command output or null if command failed
   */
  private static execGit(command: string, cwd: string): string | null {
    try {
      const result = execSync(`git ${command}`, {
        cwd,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'], // Suppress stderr
        timeout: 5000, // 5 second timeout
      });
      return result.trim();
    } catch {
      return null;
    }
  }

  /**
   * Check if a directory is inside a git repository
   *
   * @param cwd - Directory path to check
   * @returns true if directory is in a git repo
   */
  static isGitRepo(cwd: string): boolean {
    if (!cwd || !fs.existsSync(cwd)) {
      return false;
    }
    const result = GitExtractor.execGit('rev-parse --git-dir', cwd);
    return result !== null;
  }

  /**
   * Extract git context from a directory
   *
   * Captures the current branch, HEAD commit, working directory state,
   * staged files, and modified files.
   *
   * @param cwd - Directory to extract git context from
   * @returns GitContext object or null if not a git repository
   *
   * @example
   * const context = GitExtractor.extractGitContext('/path/to/project');
   * if (context) {
   *   console.log(`Branch: ${context.branch}`);
   *   console.log(`Commit: ${context.headCommit}`);
   * }
   */
  static extractGitContext(cwd: string): GitContext | null {
    if (!GitExtractor.isGitRepo(cwd)) {
      return null;
    }

    try {
      // Get current branch name
      let branch = GitExtractor.execGit('branch --show-current', cwd);
      if (!branch) {
        // Detached HEAD state
        branch = 'HEAD detached';
      }

      // Get HEAD commit hash (short)
      const headCommit = GitExtractor.execGit('rev-parse --short HEAD', cwd);

      // Get commit message for HEAD
      let commitMessage: string | null = null;
      if (headCommit) {
        commitMessage = GitExtractor.execGit('log -1 --format=%s', cwd);
      }

      // Get parent commit
      let parentCommit: string | null = null;
      if (headCommit) {
        parentCommit = GitExtractor.execGit('rev-parse --short HEAD^', cwd);
      }

      // Check if working directory is dirty
      const statusOutput = GitExtractor.execGit('status --porcelain', cwd);
      const isDirty = statusOutput !== null && statusOutput.length > 0;

      // Get staged files
      const stagedOutput = GitExtractor.execGit('diff --cached --name-only', cwd);
      const stagedFiles = stagedOutput ? stagedOutput.split('\n').filter(Boolean) : [];

      // Get modified (unstaged) files
      const modifiedOutput = GitExtractor.execGit('diff --name-only', cwd);
      const modifiedFiles = modifiedOutput ? modifiedOutput.split('\n').filter(Boolean) : [];

      // Count untracked files
      const untrackedOutput = GitExtractor.execGit('ls-files --others --exclude-standard', cwd);
      const untrackedCount = untrackedOutput
        ? untrackedOutput.split('\n').filter(Boolean).length
        : 0;

      return {
        branch,
        headCommit,
        commitMessage,
        parentCommit,
        isDirty,
        stagedFiles,
        modifiedFiles,
        untrackedCount,
      };
    } catch (error) {
      console.warn('[GitExtractor] Failed to extract git context:', error);
      return null;
    }
  }

  /**
   * Get commits made in a time range
   *
   * Useful for finding commits made during a session.
   *
   * @param cwd - Directory to search in
   * @param startTime - Start of time range (epoch ms)
   * @param endTime - End of time range (epoch ms)
   * @returns Array of commits in the time range
   *
   * @example
   * const commits = GitExtractor.getCommitsInTimeRange(
   *   '/path/to/project',
   *   Date.now() - 3600000, // 1 hour ago
   *   Date.now()
   * );
   */
  static getCommitsInTimeRange(cwd: string, startTime: number, endTime: number): GitCommit[] {
    if (!GitExtractor.isGitRepo(cwd)) {
      return [];
    }

    try {
      // Convert epoch ms to ISO format for git --after/--before
      const startDate = new Date(startTime).toISOString();
      const endDate = new Date(endTime).toISOString();

      // Get commits with custom format
      // Format: hash|message|author name|author email|timestamp
      const logOutput = GitExtractor.execGit(
        `log --after="${startDate}" --before="${endDate}" --format="%H|%s|%an|%ae|%aI"`,
        cwd
      );

      if (!logOutput) {
        return [];
      }

      const commits: GitCommit[] = [];
      const lines = logOutput.split('\n').filter(Boolean);

      for (const line of lines) {
        const parts = line.split('|');
        if (parts.length >= 5) {
          const hash = parts[0] || '';
          const message = parts[1] || '';
          const authorName = parts[2] || '';
          const authorEmail = parts[3] || '';
          const timestamp = parts[4] || new Date().toISOString();
          commits.push({
            hash,
            message,
            authorName,
            authorEmail,
            committedAt: timestamp,
            committedAtEpoch: new Date(timestamp).getTime(),
          });
        }
      }

      return commits;
    } catch (error) {
      console.warn('[GitExtractor] Failed to get commits in time range:', error);
      return [];
    }
  }

  /**
   * Store git context for a session in the database
   *
   * @param sessionId - Session UUID
   * @param context - Git context to store
   *
   * @example
   * const context = GitExtractor.extractGitContext('/path/to/project');
   * if (context) {
   *   GitExtractor.storeGitContext('session-123', context);
   * }
   */
  static storeGitContext(sessionId: string, context: GitContext): void {
    const db = getTranscriptDbInstance();
    const now = new Date();

    db.prepare(
      `
      INSERT INTO git_activity (
        session_id,
        commit_hash,
        commit_message,
        branch_name,
        parent_commit,
        is_dirty,
        files_staged,
        files_modified,
        untracked_count,
        captured_at,
        captured_at_epoch
      ) VALUES (
        @sessionId,
        @commitHash,
        @commitMessage,
        @branchName,
        @parentCommit,
        @isDirty,
        @filesStaged,
        @filesModified,
        @untrackedCount,
        @capturedAt,
        @capturedAtEpoch
      )
    `
    ).run({
      sessionId,
      commitHash: context.headCommit,
      commitMessage: context.commitMessage,
      branchName: context.branch,
      parentCommit: context.parentCommit,
      isDirty: context.isDirty ? 1 : 0,
      filesStaged: context.stagedFiles.length > 0 ? JSON.stringify(context.stagedFiles) : null,
      filesModified:
        context.modifiedFiles.length > 0 ? JSON.stringify(context.modifiedFiles) : null,
      untrackedCount: context.untrackedCount,
      capturedAt: now.toISOString(),
      capturedAtEpoch: now.getTime(),
    });
  }

  /**
   * Store commits made during a session
   *
   * @param sessionId - Session UUID
   * @param commits - Array of commits to store
   */
  static storeSessionCommits(sessionId: string, commits: GitCommit[]): void {
    if (commits.length === 0) {
      return;
    }

    const db = getTranscriptDbInstance();

    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO session_commits (
        session_id,
        commit_hash,
        commit_message,
        author_name,
        author_email,
        committed_at,
        committed_at_epoch
      ) VALUES (
        @sessionId,
        @commitHash,
        @commitMessage,
        @authorName,
        @authorEmail,
        @committedAt,
        @committedAtEpoch
      )
    `);

    const insertMany = db.transaction((commitsToInsert: GitCommit[]) => {
      for (const commit of commitsToInsert) {
        insertStmt.run({
          sessionId,
          commitHash: commit.hash,
          commitMessage: commit.message,
          authorName: commit.authorName,
          authorEmail: commit.authorEmail,
          committedAt: commit.committedAt,
          committedAtEpoch: commit.committedAtEpoch,
        });
      }
    });

    insertMany(commits);
  }

  /**
   * Get git activity for a session
   *
   * @param sessionId - Session UUID
   * @returns Git activity row or null if not found
   */
  static getGitActivity(sessionId: string): GitActivityRow | null {
    const db = getTranscriptDbInstance();

    const row = db
      .prepare(
        `
      SELECT *
      FROM git_activity
      WHERE session_id = ?
      ORDER BY captured_at_epoch DESC
      LIMIT 1
    `
      )
      .get(sessionId) as GitActivityRow | undefined;

    return row || null;
  }

  /**
   * Get commits associated with a session
   *
   * @param sessionId - Session UUID
   * @returns Array of session commit rows
   */
  static getSessionCommits(sessionId: string): SessionCommitRow[] {
    const db = getTranscriptDbInstance();

    const rows = db
      .prepare(
        `
      SELECT *
      FROM session_commits
      WHERE session_id = ?
      ORDER BY committed_at_epoch ASC
    `
      )
      .all(sessionId) as SessionCommitRow[];

    return rows;
  }

  /**
   * Find sessions by commit hash
   *
   * @param commitHash - Full or partial commit hash
   * @returns Array of session IDs that touched this commit
   */
  static findSessionsByCommit(commitHash: string): string[] {
    const db = getTranscriptDbInstance();

    // Search both git_activity (current HEAD) and session_commits (commits during session)
    const activityRows = db
      .prepare(
        `
      SELECT DISTINCT session_id
      FROM git_activity
      WHERE commit_hash LIKE @hash || '%'
         OR parent_commit LIKE @hash || '%'
    `
      )
      .all({ hash: commitHash }) as { session_id: string }[];

    const commitRows = db
      .prepare(
        `
      SELECT DISTINCT session_id
      FROM session_commits
      WHERE commit_hash LIKE @hash || '%'
    `
      )
      .all({ hash: commitHash }) as { session_id: string }[];

    // Combine and deduplicate
    const sessionIds = new Set<string>();
    for (const row of [...activityRows, ...commitRows]) {
      sessionIds.add(row.session_id);
    }

    return Array.from(sessionIds);
  }

  /**
   * Get branches with session counts
   *
   * @returns Array of branches with their session counts
   */
  static getBranchesWithCounts(): { branch: string; sessionCount: number }[] {
    const db = getTranscriptDbInstance();

    const rows = db
      .prepare(
        `
      SELECT
        branch_name as branch,
        COUNT(DISTINCT session_id) as sessionCount
      FROM git_activity
      GROUP BY branch_name
      ORDER BY sessionCount DESC
    `
      )
      .all() as { branch: string; sessionCount: number }[];

    return rows;
  }

  /**
   * Find sessions on a specific branch
   *
   * @param branchName - Branch name to search for
   * @param limit - Maximum number of sessions to return
   * @returns Array of session IDs on this branch
   */
  static findSessionsByBranch(branchName: string, limit = 100): string[] {
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
      .all(branchName, limit) as { session_id: string }[];

    return rows.map((r) => r.session_id);
  }
}

/**
 * Initialize git activity schema
 *
 * Creates the git_activity and session_commits tables if they don't exist.
 * Called during database initialization.
 */
export function initializeGitActivitySchema(): void {
  const db = getTranscriptDbInstance();

  // Check if tables exist
  const tableInfo = db
    .prepare(
      `
    SELECT name FROM sqlite_master
    WHERE type='table' AND name='git_activity'
  `
    )
    .get();

  if (tableInfo) {
    // Tables already exist
    return;
  }

  // Read and execute migration SQL
  const fs = require('fs');
  const path = require('path');
  const migrationPath = path.join(__dirname, '..', 'db', 'migrations', '025_git_activity.sql');

  if (fs.existsSync(migrationPath)) {
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    db.exec(migrationSql);
    console.log('[GitExtractor] Initialized git_activity schema');
  } else {
    // Fallback: Create tables directly if migration file not found
    db.exec(`
      CREATE TABLE IF NOT EXISTS git_activity (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        commit_hash TEXT,
        commit_message TEXT,
        branch_name TEXT NOT NULL,
        parent_commit TEXT,
        is_dirty INTEGER DEFAULT 0,
        files_staged TEXT,
        files_modified TEXT,
        untracked_count INTEGER DEFAULT 0,
        captured_at TEXT NOT NULL,
        captured_at_epoch INTEGER NOT NULL,
        FOREIGN KEY (session_id) REFERENCES session_metadata(session_id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_git_activity_session ON git_activity(session_id);
      CREATE INDEX IF NOT EXISTS idx_git_activity_commit ON git_activity(commit_hash);
      CREATE INDEX IF NOT EXISTS idx_git_activity_branch ON git_activity(branch_name);
      CREATE INDEX IF NOT EXISTS idx_git_activity_captured ON git_activity(captured_at_epoch DESC);

      CREATE TABLE IF NOT EXISTS session_commits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        commit_hash TEXT NOT NULL,
        commit_message TEXT,
        author_name TEXT,
        author_email TEXT,
        committed_at TEXT NOT NULL,
        committed_at_epoch INTEGER NOT NULL,
        FOREIGN KEY (session_id) REFERENCES session_metadata(session_id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_session_commits_session ON session_commits(session_id);
      CREATE INDEX IF NOT EXISTS idx_session_commits_hash ON session_commits(commit_hash);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_session_commits_unique ON session_commits(session_id, commit_hash);
    `);
    console.log('[GitExtractor] Initialized git_activity schema (inline)');
  }
}
