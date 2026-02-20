/**
 * Relays Types
 *
 * TypeScript interfaces for the Relays feature - a commit-centric view of sessions.
 * These types mirror the backend response structures from /api/relays endpoints.
 */

import type { SessionMetadata } from './transcript';

/**
 * Status of git integration availability
 */
export interface RelaysStatus {
  available: boolean;
  totalCommits: number;
  uniqueBranches: number;
  message?: string;
}

/**
 * A git commit with linked session information
 */
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

/**
 * A file changed in a commit
 */
export interface CommitFile {
  path: string;
  status: 'added' | 'modified' | 'deleted';
  additions?: number;
  deletions?: number;
}

/**
 * Full detail for a single commit
 */
export interface CommitDetail {
  commit: RelayCommit;
  sessions: SessionMetadata[];
  files: CommitFile[];
}

/**
 * File diff content for a commit
 */
export interface CommitFileDiff {
  path: string;
  status: 'added' | 'modified' | 'deleted';
  oldContent?: string;
  newContent?: string;
  additions?: number;
  deletions?: number;
}

/**
 * Response from /api/relays/commits/:hash/diff
 */
export interface CommitDiffResponse {
  files: CommitFileDiff[];
  totalFiles: number;
  truncated: boolean;
}

/**
 * Branch with commit count
 */
export interface RelayBranch {
  branch: string;
  commitCount: number;
}

/**
 * Response from /api/relays/commits
 */
export interface CommitsResponse {
  commits: RelayCommit[];
  total: number;
  hasMore: boolean;
}

/**
 * Response from /api/relays/branches
 */
export interface BranchesResponse {
  branches: RelayBranch[];
  total: number;
}
