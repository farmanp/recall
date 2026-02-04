import { Router, Request, Response } from 'express';
import { bulkImportTranscripts, importTranscript } from '../services/transcript-importer';
import { getImportStats } from '../db/transcript-queries';
import { detectAgentFromPath } from '../parser/agent-detector';
import type { AgentType } from '../types/transcript';

const router = Router();

/**
 * Track current import job state
 */
let currentImportJob: {
  status: 'idle' | 'importing' | 'completed' | 'failed';
  totalSessions: number;
  completedSessions: number;
  failedSessions: number;
  currentSession?: string;
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
} = {
  status: 'idle',
  totalSessions: 0,
  completedSessions: 0,
  failedSessions: 0,
};

/**
 * POST /api/import/start
 * Start a bulk import of transcript files
 *
 * Request Body:
 * - sourcePath (string, optional): Path to scan for .jsonl files (default: ~/.claude/projects/)
 * - parallel (number, optional): Number of parallel workers (default: 10)
 * - skipExisting (boolean, optional): Skip already imported sessions (default: true)
 *
 * Response:
 * - success: boolean
 * - message: string
 * - jobId: string (for tracking)
 *
 * Status Codes:
 * - 202: Import job started
 * - 400: Invalid request
 * - 409: Import already in progress
 * - 500: Internal error
 *
 * @example
 * POST /api/import/start
 * {
 *   "parallel": 10,
 *   "skipExisting": true
 * }
 */
router.post('/start', async (req: Request, res: Response) => {
  try {
    // Check if import is already running
    if (currentImportJob.status === 'importing') {
      res.status(409).json({
        success: false,
        error: 'Import already in progress',
        currentJob: currentImportJob,
      });
      return;
    }

    // Get config from request body
    const { sourcePath, parallel = 10, skipExisting = true } = req.body || {};

    // Reset job state
    currentImportJob = {
      status: 'importing',
      totalSessions: 0,
      completedSessions: 0,
      failedSessions: 0,
      startedAt: new Date().toISOString(),
    };

    // Start import in background (don't await)
    bulkImportTranscripts({
      sourcePath,
      parallel,
      skipExisting,
      onProgress: (completed, total) => {
        currentImportJob.totalSessions = total;
        currentImportJob.completedSessions = completed;
      },
    })
      .then((summary) => {
        currentImportJob.status = 'completed';
        currentImportJob.completedAt = new Date().toISOString();
        currentImportJob.totalSessions = summary.totalFiles;
        currentImportJob.completedSessions = summary.successful;
        currentImportJob.failedSessions = summary.failed;
        console.log(`[Import] Completed: ${summary.successful}/${summary.totalFiles} sessions`);
      })
      .catch((error) => {
        currentImportJob.status = 'failed';
        currentImportJob.completedAt = new Date().toISOString();
        currentImportJob.errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[Import] Failed:', error);
      });

    // Return immediately
    res.status(202).json({
      success: true,
      message: 'Import job started',
      job: currentImportJob,
    });
  } catch (error) {
    console.error('Error starting import:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start import',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/import/status
 * Get current import job status
 *
 * Response:
 * - status: 'idle' | 'importing' | 'completed' | 'failed'
 * - totalSessions: number
 * - completedSessions: number
 * - failedSessions: number
 * - currentSession?: string
 * - startedAt?: string
 * - completedAt?: string
 * - errorMessage?: string
 *
 * Status Codes:
 * - 200: Success
 *
 * @example
 * GET /api/import/status
 */
router.get('/status', (_req: Request, res: Response) => {
  res.json(currentImportJob);
});

/**
 * GET /api/import/stats
 * Get database import statistics
 *
 * Response:
 * - total: Total sessions in parsing_status table
 * - pending: Number of pending imports
 * - completed: Number of completed imports
 * - failed: Number of failed imports
 *
 * Status Codes:
 * - 200: Success
 * - 500: Internal error
 *
 * @example
 * GET /api/import/stats
 */
router.get('/stats', (_req: Request, res: Response) => {
  try {
    const stats = getImportStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching import stats:', error);
    res.status(500).json({
      error: 'Failed to fetch import stats',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/import/single
 * Import a single transcript file
 *
 * Request Body:
 * - filePath (string, required): Path to .jsonl file
 * - agent (string, optional): Agent type ('claude', 'codex', 'gemini', 'unknown')
 *                            If not specified, auto-detected from file path
 *
 * Response:
 * - success: boolean
 * - message: string
 * - agent: string (detected or specified agent type)
 *
 * Status Codes:
 * - 200: Import successful
 * - 400: Invalid request
 * - 500: Import failed
 *
 * @example
 * POST /api/import/single
 * {
 *   "filePath": "/Users/fpirzada/.claude/projects/my-project/session.jsonl"
 * }
 *
 * @example
 * POST /api/import/single
 * {
 *   "filePath": "/custom/path/session.jsonl",
 *   "agent": "codex"
 * }
 */
router.post('/single', async (req: Request, res: Response) => {
  try {
    const { filePath, agent: specifiedAgent } = req.body || {};

    if (!filePath || typeof filePath !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Missing required field: filePath',
      });
      return;
    }

    // Determine agent type: use specified agent or auto-detect from path
    const agent: AgentType = specifiedAgent || detectAgentFromPath(filePath);

    // Import the file
    await importTranscript(filePath, agent);

    res.json({
      success: true,
      message: 'Transcript imported successfully',
      agent,
    });
  } catch (error) {
    console.error('Error importing transcript:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to import transcript',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
