/**
 * Relays Queries
 *
 * Database queries for the Relays feature - a commit-centric view of sessions.
 * Aggregates session data around git commits to show which sessions contributed
 * to each commit.
 *
 * @module db/relays-queries
 */

import { getTranscriptDbInstance } from './transcript-connection';
import type { SessionMetadata } from '../types/transcript';

// ============================================================================
// Types
// ============================================================================

export interface RelaysStatus {
  available: boolean;
  totalCommits: number;
  uniqueBranches: number;
  message?: string;
}

export interface RelayCommit {
  hash: string;
  shortHash: string;
  message: string | null;
  authorName: string | null;
  authorEmail: string | null;
  committedAt: string;
  branch: string | null;
  sessionCount: number;
  sessionIds: string[];
}

export interface CommitFile {
  path: string;
  status: 'added' | 'modified' | 'deleted';
  additions?: number;
  deletions?: number;
}

export interface CommitDetail {
  commit: RelayCommit;
  sessions: SessionMetadata[];
  files: CommitFile[];
}

// ============================================================================
// Status & Availability
// ============================================================================

/**
 * Check if git integration has any data
 *
 * Returns true if there are any commits in the session_commits table,
 * indicating that git tracking is available and has captured data.
 */
export function hasGitIntegration(): boolean {
  const db = getTranscriptDbInstance();
  const result = db.prepare('SELECT COUNT(*) as count FROM session_commits').get() as {
    count: number;
  };
  return result.count > 0;
}

/**
 * Get relays status including availability and stats
 */
export function getRelaysStatus(): RelaysStatus {
  const db = getTranscriptDbInstance();

  // Check if we have any commits
  const commitCount = db
    .prepare('SELECT COUNT(DISTINCT commit_hash) as count FROM session_commits')
    .get() as { count: number };

  if (commitCount.count === 0) {
    return {
      available: false,
      totalCommits: 0,
      uniqueBranches: 0,
      message: 'No git data available. Sessions imported from git repositories will appear here.',
    };
  }

  // Count unique branches from git_activity
  const branchCount = db
    .prepare(
      'SELECT COUNT(DISTINCT branch_name) as count FROM git_activity WHERE branch_name IS NOT NULL'
    )
    .get() as { count: number };

  return {
    available: true,
    totalCommits: commitCount.count,
    uniqueBranches: branchCount.count,
  };
}

// ============================================================================
// Commit Queries
// ============================================================================

export interface GetCommitsOptions {
  limit?: number;
  offset?: number;
  branch?: string;
}

/**
 * Get commits with linked session counts
 *
 * Returns commits ordered by committed_at DESC, with session counts
 * and session IDs for each commit.
 */
export function getCommitsWithSessions(options: GetCommitsOptions = {}): {
  commits: RelayCommit[];
  total: number;
  hasMore: boolean;
} {
  const db = getTranscriptDbInstance();
  const { limit = 50, offset = 0, branch } = options;

  // Build base query for commits with aggregated session data
  // Join with git_activity to get branch info
  let whereClause = '';
  const params: (string | number)[] = [];

  if (branch) {
    whereClause = `
      WHERE sc.session_id IN (
        SELECT session_id FROM git_activity WHERE branch_name = ?
      )
    `;
    params.push(branch);
  }

  // Get total count
  const countQuery = `
    SELECT COUNT(DISTINCT sc.commit_hash) as count
    FROM session_commits sc
    ${whereClause}
  `;
  const totalResult = db.prepare(countQuery).get(...params) as { count: number };
  const total = totalResult.count;

  // Get commits with session info
  const query = `
    SELECT
      sc.commit_hash,
      sc.commit_message,
      sc.author_name,
      sc.author_email,
      MAX(sc.committed_at) as committed_at,
      COUNT(DISTINCT sc.session_id) as session_count,
      GROUP_CONCAT(DISTINCT sc.session_id) as session_ids,
      (
        SELECT ga.branch_name
        FROM git_activity ga
        WHERE ga.session_id IN (
          SELECT session_id FROM session_commits WHERE commit_hash = sc.commit_hash
        )
        LIMIT 1
      ) as branch
    FROM session_commits sc
    ${whereClause}
    GROUP BY sc.commit_hash
    ORDER BY MAX(sc.committed_at_epoch) DESC
    LIMIT ? OFFSET ?
  `;

  params.push(limit, offset);

  const rows = db.prepare(query).all(...params) as Array<{
    commit_hash: string;
    commit_message: string | null;
    author_name: string | null;
    author_email: string | null;
    committed_at: string;
    session_count: number;
    session_ids: string;
    branch: string | null;
  }>;

  const commits: RelayCommit[] = rows.map((row) => ({
    hash: row.commit_hash,
    shortHash: row.commit_hash.substring(0, 7),
    message: row.commit_message,
    authorName: row.author_name,
    authorEmail: row.author_email,
    committedAt: row.committed_at,
    branch: row.branch,
    sessionCount: row.session_count,
    sessionIds: row.session_ids ? row.session_ids.split(',') : [],
  }));

  return {
    commits,
    total,
    hasMore: offset + commits.length < total,
  };
}

/**
 * Get unique branches that have commits
 */
export function getBranchesWithCommits(): Array<{ branch: string; commitCount: number }> {
  const db = getTranscriptDbInstance();

  const rows = db
    .prepare(
      `
      SELECT
        ga.branch_name as branch,
        COUNT(DISTINCT sc.commit_hash) as commit_count
      FROM git_activity ga
      INNER JOIN session_commits sc ON ga.session_id = sc.session_id
      WHERE ga.branch_name IS NOT NULL
      GROUP BY ga.branch_name
      ORDER BY commit_count DESC
    `
    )
    .all() as Array<{ branch: string; commit_count: number }>;

  return rows.map((row) => ({
    branch: row.branch,
    commitCount: row.commit_count,
  }));
}

/**
 * Get full commit detail including sessions and files
 */
export function getCommitDetail(hash: string): CommitDetail | null {
  const db = getTranscriptDbInstance();

  // Get commit info
  const commitRow = db
    .prepare(
      `
      SELECT
        sc.commit_hash,
        sc.commit_message,
        sc.author_name,
        sc.author_email,
        MAX(sc.committed_at) as committed_at,
        COUNT(DISTINCT sc.session_id) as session_count,
        GROUP_CONCAT(DISTINCT sc.session_id) as session_ids,
        (
          SELECT ga.branch_name
          FROM git_activity ga
          WHERE ga.session_id IN (
            SELECT session_id FROM session_commits WHERE commit_hash LIKE ? || '%'
          )
          LIMIT 1
        ) as branch
      FROM session_commits sc
      WHERE sc.commit_hash LIKE ? || '%'
      GROUP BY sc.commit_hash
    `
    )
    .get(hash, hash) as
    | {
        commit_hash: string;
        commit_message: string | null;
        author_name: string | null;
        author_email: string | null;
        committed_at: string;
        session_count: number;
        session_ids: string;
        branch: string | null;
      }
    | undefined;

  if (!commitRow) {
    return null;
  }

  const sessionIds = commitRow.session_ids ? commitRow.session_ids.split(',') : [];

  // Get session metadata for linked sessions
  const sessions: SessionMetadata[] = [];
  if (sessionIds.length > 0) {
    const placeholders = sessionIds.map(() => '?').join(',');
    const sessionRows = db
      .prepare(
        `
        SELECT
          session_id, slug, project, agent_type, start_time, end_time,
          duration_seconds, event_count, frame_count, cwd, first_user_message
        FROM session_metadata
        WHERE session_id IN (${placeholders})
        ORDER BY start_time DESC
      `
      )
      .all(...sessionIds) as Array<{
      session_id: string;
      slug: string;
      project: string;
      agent_type: string;
      start_time: string;
      end_time: string | null;
      duration_seconds: number | null;
      event_count: number;
      frame_count: number;
      cwd: string;
      first_user_message: string | null;
    }>;

    for (const row of sessionRows) {
      sessions.push({
        sessionId: row.session_id,
        slug: row.slug,
        project: row.project,
        agent: (row.agent_type || 'claude') as SessionMetadata['agent'],
        startTime: row.start_time,
        endTime: row.end_time || undefined,
        duration: row.duration_seconds || undefined,
        eventCount: row.event_count,
        cwd: row.cwd,
        firstUserMessage: row.first_user_message || undefined,
      });
    }
  }

  // Note: File diffs are not stored in our database per-commit.
  // We would need to run git commands to get actual file changes.
  // For now, return empty files array - the frontend can call the diff endpoint separately.
  const files: CommitFile[] = [];

  return {
    commit: {
      hash: commitRow.commit_hash,
      shortHash: commitRow.commit_hash.substring(0, 7),
      message: commitRow.commit_message,
      authorName: commitRow.author_name,
      authorEmail: commitRow.author_email,
      committedAt: commitRow.committed_at,
      branch: commitRow.branch,
      sessionCount: commitRow.session_count,
      sessionIds,
    },
    sessions,
    files,
  };
}
