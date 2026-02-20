/**
 * Relays Routes
 *
 * API endpoints for the Relays feature - a commit-centric view of sessions.
 * Shows which sessions contributed to each git commit.
 *
 * @module routes/relays
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validateQuery, validateParams } from '../middleware/validation';
import {
  getRelaysStatus,
  getCommitsWithSessions,
  getCommitDetail,
  getBranchesWithCommits,
} from '../db/relays-queries';
import { execSync } from 'child_process';

const router = Router();

// ============================================================================
// Validation Schemas
// ============================================================================

const commitsQuerySchema = z.object({
  branch: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

const commitHashSchema = z.object({
  hash: z.string().min(4).max(40),
});

// ============================================================================
// Helper: Execute git command safely
// ============================================================================

function execGitSafe(command: string, cwd: string, timeout = 10000): string | null {
  try {
    const result = execSync(`git ${command}`, {
      cwd,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout,
    });
    return result;
  } catch {
    return null;
  }
}

/**
 * Get files changed in a commit
 */
function getCommitFiles(
  cwd: string,
  hash: string
): Array<{
  path: string;
  status: 'added' | 'modified' | 'deleted';
  additions?: number;
  deletions?: number;
}> {
  const result = execGitSafe(`show --numstat --format="" ${hash}`, cwd);
  if (!result) return [];

  const files: Array<{
    path: string;
    status: 'added' | 'modified' | 'deleted';
    additions?: number;
    deletions?: number;
  }> = [];

  for (const line of result.trim().split('\n').filter(Boolean)) {
    const parts = line.split('\t');
    if (parts.length >= 3) {
      const additionsStr = parts[0] ?? '';
      const deletionsStr = parts[1] ?? '';
      const filePath = parts[2] ?? '';

      // Binary files show "-" for additions/deletions
      const additions = additionsStr === '-' ? undefined : parseInt(additionsStr, 10);
      const deletions = deletionsStr === '-' ? undefined : parseInt(deletionsStr, 10);

      // Determine status
      let status: 'added' | 'modified' | 'deleted' = 'modified';
      if (additions !== undefined && deletions === 0) {
        status = 'added';
      } else if (deletions !== undefined && additions === 0) {
        status = 'deleted';
      }

      if (filePath) {
        files.push({ path: filePath, status, additions, deletions });
      }
    }
  }

  return files;
}

/**
 * Get diff for a specific file in a commit
 */
function getFileDiff(
  cwd: string,
  hash: string,
  filePath: string
): { oldContent?: string; newContent?: string } | null {
  try {
    // Get the file content after the commit
    let newContent: string | undefined;
    try {
      const newResult = execGitSafe(`show ${hash}:${filePath}`, cwd);
      newContent = newResult || undefined;
    } catch {
      // File was deleted
    }

    // Get the file content before the commit (parent commit)
    let oldContent: string | undefined;
    try {
      const oldResult = execGitSafe(`show ${hash}^:${filePath}`, cwd);
      oldContent = oldResult || undefined;
    } catch {
      // File was added (no parent version)
    }

    return { oldContent, newContent };
  } catch {
    return null;
  }
}

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /api/relays/status
 * Check if git integration is available
 *
 * Response:
 * - available: boolean - true if git data exists
 * - totalCommits: number - total commits in database
 * - uniqueBranches: number - number of unique branches
 * - message?: string - message if unavailable
 */
router.get('/status', (_req: Request, res: Response) => {
  try {
    const status = getRelaysStatus();
    res.json(status);
  } catch (error) {
    console.error('Error checking relays status:', error);
    res.status(500).json({
      error: 'Failed to check relays status',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/relays/branches
 * Get branches with commit counts
 *
 * Response:
 * - branches: Array<{ branch, commitCount }>
 * - total: number
 */
router.get('/branches', (_req: Request, res: Response) => {
  try {
    const branches = getBranchesWithCommits();
    res.json({
      branches,
      total: branches.length,
    });
  } catch (error) {
    console.error('Error fetching branches:', error);
    res.status(500).json({
      error: 'Failed to fetch branches',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/relays/commits
 * Get commits with linked session counts
 *
 * Query Parameters:
 * - branch?: string - filter by branch name
 * - limit?: number - max results (default: 50, max: 100)
 * - offset?: number - pagination offset (default: 0)
 *
 * Response:
 * - commits: Array<RelayCommit>
 * - total: number
 * - hasMore: boolean
 */
router.get('/commits', validateQuery(commitsQuerySchema), (_req: Request, res: Response) => {
  try {
    const { branch, limit, offset } = res.locals.validatedQuery as {
      branch?: string;
      limit: number;
      offset: number;
    };

    const result = getCommitsWithSessions({ branch, limit, offset });
    res.json(result);
  } catch (error) {
    console.error('Error fetching commits:', error);
    res.status(500).json({
      error: 'Failed to fetch commits',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/relays/commits/:hash
 * Get full commit detail including sessions
 *
 * URL Parameters:
 * - hash: commit hash (partial or full)
 *
 * Response:
 * - commit: RelayCommit
 * - sessions: SessionMetadata[]
 * - files: CommitFile[]
 */
router.get('/commits/:hash', validateParams(commitHashSchema), (_req: Request, res: Response) => {
  try {
    const { hash } = res.locals.validatedParams as { hash: string };

    const detail = getCommitDetail(hash);
    if (!detail) {
      res.status(404).json({
        error: 'Commit not found',
        message: `No commit found with hash: ${hash}`,
      });
      return;
    }

    // Try to get file info from git if we have sessions with cwd info
    if (detail.sessions.length > 0 && detail.files.length === 0) {
      // Use the first session's cwd to run git commands
      const cwd = detail.sessions[0]?.cwd;
      if (cwd) {
        const files = getCommitFiles(cwd, detail.commit.hash);
        detail.files = files;
      }
    }

    res.json(detail);
  } catch (error) {
    console.error('Error fetching commit detail:', error);
    res.status(500).json({
      error: 'Failed to fetch commit detail',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/relays/commits/:hash/diff
 * Get file diffs for a commit
 *
 * URL Parameters:
 * - hash: commit hash
 *
 * Query Parameters:
 * - cwd: working directory for git commands (optional, uses first session's cwd if not provided)
 *
 * Response:
 * - files: Array<{ path, oldContent, newContent, status }>
 */
router.get(
  '/commits/:hash/diff',
  validateParams(commitHashSchema),
  (req: Request, res: Response) => {
    try {
      const { hash } = res.locals.validatedParams as { hash: string };
      const cwdParam = req.query.cwd;
      const cwdFromQuery = typeof cwdParam === 'string' ? cwdParam : undefined;

      // Get commit detail to find cwd
      const detail = getCommitDetail(hash);
      if (!detail) {
        res.status(404).json({
          error: 'Commit not found',
          message: `No commit found with hash: ${hash}`,
        });
        return;
      }

      const cwd = cwdFromQuery || detail.sessions[0]?.cwd;
      if (!cwd) {
        res.status(400).json({
          error: 'No working directory available',
          message: 'Cannot determine git working directory for this commit',
        });
        return;
      }

      // Get files changed in commit
      const filesChanged = getCommitFiles(cwd, detail.commit.hash);

      // Get diff for each file (limit to first 10 files to avoid large responses)
      const MAX_FILES = 10;
      const files = filesChanged.slice(0, MAX_FILES).map((file) => {
        const diff = getFileDiff(cwd, detail.commit.hash, file.path);
        return {
          path: file.path,
          status: file.status,
          oldContent: diff?.oldContent,
          newContent: diff?.newContent,
          additions: file.additions,
          deletions: file.deletions,
        };
      });

      res.json({
        files,
        totalFiles: filesChanged.length,
        truncated: filesChanged.length > MAX_FILES,
      });
    } catch (error) {
      console.error('Error fetching commit diff:', error);
      res.status(500).json({
        error: 'Failed to fetch commit diff',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

export default router;
