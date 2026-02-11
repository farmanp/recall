/**
 * Git Routes
 *
 * API endpoints for git-related queries:
 * - Get git context for a session
 * - Search sessions by commit hash
 * - List branches with session counts
 *
 * @module routes/git
 */

import { Router, Request, Response } from 'express';
import { GitExtractor } from '../services/git-extractor';
import { getTranscriptSessionById } from '../db/transcript-queries';
import { z } from 'zod';
import { validateQuery, validateParams } from '../middleware/validation';

const router = Router();

/**
 * Session ID parameter schema
 */
const sessionIdSchema = z.object({
  id: z.string().min(1),
});

/**
 * Commit search query schema
 */
const commitSearchSchema = z.object({
  hash: z.string().min(4).max(40), // At least 4 chars for partial match
});

/**
 * GET /api/sessions/:id/git
 * Get git context for a session
 *
 * Returns the git context captured when the session was imported,
 * including branch name, commit hash, and working directory state.
 *
 * URL Parameters:
 * - id: Session UUID
 *
 * Response:
 * - session_id: Session UUID
 * - branch: Branch name at time of session
 * - commit_hash: HEAD commit hash (short)
 * - commit_message: Commit message for HEAD
 * - parent_commit: Parent commit hash
 * - is_dirty: Whether working directory had uncommitted changes
 * - staged_files: Array of staged file paths
 * - modified_files: Array of modified (unstaged) file paths
 * - untracked_count: Number of untracked files
 * - commits: Array of commits made during the session
 * - captured_at: When git context was captured
 *
 * Status Codes:
 * - 200: Success
 * - 404: Session not found or no git context available
 * - 500: Internal error
 *
 * @example
 * GET /api/sessions/4b198fdf-b80d-4bbc-806f-2900282cdc56/git
 * {
 *   "session_id": "4b198fdf-b80d-4bbc-806f-2900282cdc56",
 *   "branch": "main",
 *   "commit_hash": "a1b2c3d",
 *   "commit_message": "feat: add new feature",
 *   "is_dirty": true,
 *   "staged_files": ["src/index.ts"],
 *   "commits": []
 * }
 */
router.get(
  '/sessions/:id/git',
  validateParams(sessionIdSchema),
  async (_req: Request, res: Response) => {
    try {
      const { id: sessionId } = res.locals.validatedParams;

      // Check if session exists
      const session = getTranscriptSessionById(sessionId);
      if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      // Get git activity for session
      const gitActivity = GitExtractor.getGitActivity(sessionId);
      if (!gitActivity) {
        res.status(404).json({
          error: 'No git context available for this session',
          message:
            'Session was imported before git tracking was enabled, or project was not a git repository',
        });
        return;
      }

      // Get commits made during session
      const sessionCommits = GitExtractor.getSessionCommits(sessionId);

      res.json({
        session_id: gitActivity.session_id,
        branch: gitActivity.branch_name,
        commit_hash: gitActivity.commit_hash,
        commit_message: gitActivity.commit_message,
        parent_commit: gitActivity.parent_commit,
        is_dirty: gitActivity.is_dirty === 1,
        staged_files: gitActivity.files_staged ? JSON.parse(gitActivity.files_staged) : [],
        modified_files: gitActivity.files_modified ? JSON.parse(gitActivity.files_modified) : [],
        untracked_count: gitActivity.untracked_count,
        commits: sessionCommits.map((c) => ({
          hash: c.commit_hash,
          message: c.commit_message,
          author_name: c.author_name,
          author_email: c.author_email,
          committed_at: c.committed_at,
        })),
        captured_at: gitActivity.captured_at,
      });
    } catch (error) {
      console.error('Error fetching session git context:', error);
      res.status(500).json({
        error: 'Failed to fetch git context',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * GET /api/git/commits
 * Search for sessions that touched a specific commit
 *
 * Query Parameters:
 * - hash: Full or partial commit hash (minimum 4 characters)
 *
 * Response:
 * - hash: The searched commit hash
 * - sessions: Array of session IDs that touched this commit
 * - count: Number of matching sessions
 *
 * @example
 * GET /api/git/commits?hash=a1b2c3d
 * {
 *   "hash": "a1b2c3d",
 *   "sessions": ["session-1", "session-2"],
 *   "count": 2
 * }
 */
router.get('/commits', validateQuery(commitSearchSchema), async (_req: Request, res: Response) => {
  try {
    const { hash } = res.locals.validatedQuery as { hash: string };

    const sessionIds = GitExtractor.findSessionsByCommit(hash);

    res.json({
      hash,
      sessions: sessionIds,
      count: sessionIds.length,
    });
  } catch (error) {
    console.error('Error searching sessions by commit:', error);
    res.status(500).json({
      error: 'Failed to search sessions by commit',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/git/branches
 * List all branches with session counts
 *
 * Returns branches that have associated sessions, sorted by session count.
 *
 * Response:
 * - branches: Array of { branch, sessionCount }
 * - total: Total number of branches
 *
 * @example
 * GET /api/git/branches
 * {
 *   "branches": [
 *     { "branch": "main", "sessionCount": 45 },
 *     { "branch": "feature/new-feature", "sessionCount": 12 }
 *   ],
 *   "total": 2
 * }
 */
router.get('/branches', async (_req: Request, res: Response) => {
  try {
    const branches = GitExtractor.getBranchesWithCounts();

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
 * GET /api/git/branches/:name/sessions
 * Get sessions on a specific branch
 *
 * URL Parameters:
 * - name: Branch name (URL encoded)
 *
 * Query Parameters:
 * - limit: Maximum sessions to return (default: 100)
 *
 * Response:
 * - branch: Branch name
 * - sessions: Array of session IDs
 * - count: Number of sessions returned
 *
 * @example
 * GET /api/git/branches/main/sessions
 * {
 *   "branch": "main",
 *   "sessions": ["session-1", "session-2"],
 *   "count": 2
 * }
 */
router.get('/branches/:name/sessions', async (req: Request, res: Response) => {
  try {
    const nameParam = req.params.name;
    const branchName = decodeURIComponent(typeof nameParam === 'string' ? nameParam : '');
    const limitParam = req.query.limit;
    const limit = Math.min(
      parseInt(typeof limitParam === 'string' ? limitParam : '100') || 100,
      500
    );

    const sessionIds = GitExtractor.findSessionsByBranch(branchName, limit);

    res.json({
      branch: branchName,
      sessions: sessionIds,
      count: sessionIds.length,
    });
  } catch (error) {
    console.error('Error fetching sessions by branch:', error);
    res.status(500).json({
      error: 'Failed to fetch sessions by branch',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
