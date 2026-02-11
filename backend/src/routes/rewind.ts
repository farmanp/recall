import { Router, Request, Response } from 'express';
import { RewindEngine } from '../services/rewind-engine';
import { getSessionIndexer } from '../parser/session-indexer';
import { ParserFactory } from '../parser/parser-factory';
import { detectAgentFromPath } from '../parser/agent-detector';
import {
  getSessionRewindHistory,
  getRewindStats,
  initializeRewindSchema,
} from '../db/rewind-queries';
import type {
  RewindPreviewRequest,
  RewindExecuteRequest,
  RewindOptions,
} from '../db/rewind-schema';

const router = Router();

// Initialize rewind schema when routes are loaded
initializeRewindSchema();

/**
 * POST /api/sessions/:sessionId/rewind/preview
 * Preview what would change if rewinding to a specific frame
 *
 * Request body:
 * - frameIndex: number - Frame index to rewind to
 * - checkpointId: string (optional) - Checkpoint ID if rewinding from checkpoint
 *
 * Response:
 * - RewindPlan with files, conflicts, and warnings
 *
 * @example
 * POST /api/sessions/abc-123/rewind/preview
 * { "frameIndex": 42 }
 */
router.post('/:sessionId/rewind/preview', async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;
    const { frameIndex, checkpointId } = req.body as RewindPreviewRequest;

    // Validate sessionId
    if (!sessionId) {
      res.status(400).json({ error: 'Session ID is required' });
      return;
    }

    // Validate frameIndex
    if (typeof frameIndex !== 'number' || frameIndex < 0) {
      res.status(400).json({
        error: 'Invalid frameIndex',
        message: 'frameIndex must be a non-negative number',
      });
      return;
    }

    // Get session metadata and frames
    const indexer = getSessionIndexer();
    const metadata = await indexer.getSessionMetadata(sessionId);

    if (!metadata) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    // Find session file and parse it
    const filePath = await indexer.findSessionFile(sessionId);
    if (!filePath) {
      res.status(404).json({ error: 'Session file not found' });
      return;
    }

    const agentType = detectAgentFromPath(filePath);
    const transcript = await ParserFactory.parseFile(filePath);
    const timeline = await ParserFactory.buildTimeline(transcript, agentType);

    // Validate frameIndex is within bounds
    if (frameIndex >= timeline.frames.length) {
      res.status(400).json({
        error: 'Frame index out of bounds',
        message: `Frame index ${frameIndex} exceeds total frames (${timeline.frames.length})`,
      });
      return;
    }

    // Create rewind plan
    const plan = await RewindEngine.previewRewind(
      sessionId,
      frameIndex,
      timeline.frames,
      metadata.cwd,
      checkpointId
    );

    res.json(plan);
  } catch (error) {
    console.error('Error creating rewind preview:', error);
    res.status(500).json({
      error: 'Failed to create rewind preview',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/sessions/:sessionId/rewind/execute
 * Execute a rewind to restore files to disk
 *
 * Request body:
 * - frameIndex: number - Frame index to rewind to
 * - checkpointId: string (optional) - Checkpoint ID if rewinding from checkpoint
 * - createBackups: boolean (default: true) - Create backups before modifying
 * - skipConflicts: boolean (default: false) - Skip files with conflicts
 *
 * Response:
 * - RewindResult with details of what was done
 *
 * @example
 * POST /api/sessions/abc-123/rewind/execute
 * { "frameIndex": 42, "createBackups": true }
 */
router.post('/:sessionId/rewind/execute', async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;
    const {
      frameIndex,
      checkpointId,
      createBackups = true,
      skipConflicts = false,
    } = req.body as RewindExecuteRequest;

    // Validate sessionId
    if (!sessionId) {
      res.status(400).json({ error: 'Session ID is required' });
      return;
    }

    // Validate frameIndex
    if (typeof frameIndex !== 'number' || frameIndex < 0) {
      res.status(400).json({
        error: 'Invalid frameIndex',
        message: 'frameIndex must be a non-negative number',
      });
      return;
    }

    // Get session metadata and frames
    const indexer = getSessionIndexer();
    const metadata = await indexer.getSessionMetadata(sessionId);

    if (!metadata) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    // Find session file and parse it
    const filePath = await indexer.findSessionFile(sessionId);
    if (!filePath) {
      res.status(404).json({ error: 'Session file not found' });
      return;
    }

    const agentType = detectAgentFromPath(filePath);
    const transcript = await ParserFactory.parseFile(filePath);
    const timeline = await ParserFactory.buildTimeline(transcript, agentType);

    // Validate frameIndex is within bounds
    if (frameIndex >= timeline.frames.length) {
      res.status(400).json({
        error: 'Frame index out of bounds',
        message: `Frame index ${frameIndex} exceeds total frames (${timeline.frames.length})`,
      });
      return;
    }

    // Create rewind plan first
    const plan = await RewindEngine.previewRewind(
      sessionId,
      frameIndex,
      timeline.frames,
      metadata.cwd,
      checkpointId
    );

    // Execute the rewind
    const options: RewindOptions = {
      createBackups,
      skipConflicts,
      dryRun: false,
    };

    const result = await RewindEngine.executeRewind(plan, options);

    res.json(result);
  } catch (error) {
    console.error('Error executing rewind:', error);
    res.status(500).json({
      error: 'Failed to execute rewind',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/sessions/:sessionId/rewind/undo
 * Undo the most recent rewind for a session
 * Restores files from backups
 *
 * Response:
 * - RewindUndoResult with details of what was restored
 *
 * @example
 * POST /api/sessions/abc-123/rewind/undo
 */
router.post('/:sessionId/rewind/undo', async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;

    if (!sessionId) {
      res.status(400).json({ error: 'Session ID is required' });
      return;
    }

    const result = await RewindEngine.undoLastRewind(sessionId);

    if (!result.success && result.rewindId === '') {
      res.status(404).json({
        error: 'No undoable rewind',
        message: result.message,
      });
      return;
    }

    res.json(result);
  } catch (error) {
    console.error('Error undoing rewind:', error);
    res.status(500).json({
      error: 'Failed to undo rewind',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/sessions/:sessionId/rewind/history
 * Get rewind history for a session
 *
 * Response:
 * - Array of RewindHistory entries
 *
 * @example
 * GET /api/sessions/abc-123/rewind/history
 */
router.get('/:sessionId/rewind/history', async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;

    if (!sessionId) {
      res.status(400).json({ error: 'Session ID is required' });
      return;
    }

    const history = getSessionRewindHistory(sessionId);

    res.json({
      sessionId,
      history,
      count: history.length,
    });
  } catch (error) {
    console.error('Error fetching rewind history:', error);
    res.status(500).json({
      error: 'Failed to fetch rewind history',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/sessions/:sessionId/rewind/undo-info
 * Get information about undo availability for a session
 *
 * Response:
 * - canUndo: boolean
 * - lastRewindId: string (if available)
 * - lastRewindAt: string (if available)
 * - filesCount: number (if available)
 *
 * @example
 * GET /api/sessions/abc-123/rewind/undo-info
 */
router.get('/:sessionId/rewind/undo-info', async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;

    if (!sessionId) {
      res.status(400).json({ error: 'Session ID is required' });
      return;
    }

    const undoInfo = RewindEngine.getUndoInfo(sessionId);

    res.json({
      sessionId,
      ...undoInfo,
    });
  } catch (error) {
    console.error('Error fetching undo info:', error);
    res.status(500).json({
      error: 'Failed to fetch undo info',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/sessions/:sessionId/rewind/stats
 * Get rewind statistics for a session
 *
 * Response:
 * - totalRewinds: number
 * - undoableRewinds: number
 * - totalFilesModified: number
 * - lastRewindAt: string (if available)
 *
 * @example
 * GET /api/sessions/abc-123/rewind/stats
 */
router.get('/:sessionId/rewind/stats', async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;

    if (!sessionId) {
      res.status(400).json({ error: 'Session ID is required' });
      return;
    }

    const stats = getRewindStats(sessionId);

    res.json({
      sessionId,
      ...stats,
    });
  } catch (error) {
    console.error('Error fetching rewind stats:', error);
    res.status(500).json({
      error: 'Failed to fetch rewind stats',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
