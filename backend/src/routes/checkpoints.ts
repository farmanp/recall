import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validateBody, validateParams, validateQuery } from '../middleware/validation';
import { CheckpointManager } from '../services/checkpoint-manager';
import { getSessionIndexer } from '../parser/session-indexer';
import { ParserFactory } from '../parser/parser-factory';
import { detectAgentFromPath } from '../parser/agent-detector';
import { getTranscriptSessionById } from '../db/transcript-queries';
import { importTranscript } from '../services/transcript-importer';
import type { CreateCheckpointRequest, UpdateCheckpointRequest } from '../db/checkpoint-schema';

const router = Router();

// ============================================================================
// Validation Schemas
// ============================================================================

const checkpointIdSchema = z.object({
  id: z.string().uuid(),
});

const sessionIdSchema = z.object({
  sessionId: z.string().min(1),
});

const createCheckpointSchema = z.object({
  name: z.string().min(1).max(255),
  frameIndex: z.number().int().min(0),
  gitCommit: z.string().optional(),
  notes: z.string().optional(),
});

const updateCheckpointSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  notes: z.string().optional(),
});

const filePathSchema = z.object({
  filePath: z.string().min(1),
});

// ============================================================================
// Session Checkpoint Routes (mounted at /api/sessions/:sessionId/checkpoints)
// ============================================================================

/**
 * POST /api/sessions/:sessionId/checkpoints
 * Create a new checkpoint for a session
 *
 * Request Body:
 * - name (string, required): Checkpoint name
 * - frameIndex (number, required): Frame index to checkpoint at
 * - gitCommit (string, optional): Git commit SHA
 * - notes (string, optional): User notes
 *
 * Response:
 * - Checkpoint object with files
 *
 * @example
 * POST /api/sessions/abc-123/checkpoints
 * { "name": "Before refactor", "frameIndex": 42 }
 */
router.post(
  '/sessions/:sessionId/checkpoints',
  validateParams(sessionIdSchema),
  validateBody(createCheckpointSchema),
  async (_req: Request, res: Response) => {
    try {
      const { sessionId } = res.locals.validatedParams;
      const body = _req.body as CreateCheckpointRequest;

      // Get session file path
      const indexer = getSessionIndexer();
      const filePath = await indexer.findSessionFile(sessionId);

      if (!filePath) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      // Parse transcript to get frames
      const agentType = detectAgentFromPath(filePath);
      const transcript = await ParserFactory.parseFile(filePath);
      const timeline = await ParserFactory.buildTimeline(transcript, agentType);

      // Validate frame index
      if (body.frameIndex >= timeline.frames.length) {
        res.status(400).json({
          error: 'Invalid frame index',
          message: `Frame index ${body.frameIndex} is out of range (0-${timeline.frames.length - 1})`,
        });
        return;
      }

      // Auto-import session to database if not already imported
      // Checkpoints require sessions to exist in the database (foreign key constraint)
      const existingSession = getTranscriptSessionById(sessionId);
      if (!existingSession) {
        console.log(`[Checkpoints] Session ${sessionId} not in database, auto-importing...`);
        try {
          await importTranscript(filePath, { agent: agentType });
          console.log(`[Checkpoints] Auto-imported session ${sessionId}`);
        } catch (importError) {
          console.error(`[Checkpoints] Failed to auto-import session:`, importError);
          res.status(500).json({
            error: 'Failed to import session',
            message: 'Session must be imported before creating checkpoints. Auto-import failed.',
          });
          return;
        }
      }

      // Create checkpoint
      const checkpoint = CheckpointManager.createCheckpoint(
        sessionId,
        body.frameIndex,
        body.name,
        timeline.frames,
        body.gitCommit,
        body.notes
      );

      res.status(201).json(checkpoint);
    } catch (error) {
      console.error('Error creating checkpoint:', error);
      res.status(500).json({
        error: 'Failed to create checkpoint',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * GET /api/sessions/:sessionId/checkpoints
 * List all checkpoints for a session
 *
 * Response:
 * - checkpoints: Array of Checkpoint objects
 * - total: Number of checkpoints
 *
 * @example
 * GET /api/sessions/abc-123/checkpoints
 */
router.get(
  '/sessions/:sessionId/checkpoints',
  validateParams(sessionIdSchema),
  async (_req: Request, res: Response) => {
    try {
      const { sessionId } = res.locals.validatedParams;

      const checkpoints = CheckpointManager.getSessionCheckpoints(sessionId);

      res.json({
        checkpoints,
        total: checkpoints.length,
      });
    } catch (error) {
      console.error('Error listing checkpoints:', error);
      res.status(500).json({
        error: 'Failed to list checkpoints',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// ============================================================================
// Checkpoint Routes (mounted at /api/checkpoints)
// ============================================================================

/**
 * GET /api/checkpoints/:id
 * Get checkpoint details (without files)
 *
 * Response:
 * - Checkpoint object
 *
 * @example
 * GET /api/checkpoints/550e8400-e29b-41d4-a716-446655440000
 */
router.get(
  '/checkpoints/:id',
  validateParams(checkpointIdSchema),
  async (_req: Request, res: Response) => {
    try {
      const { id } = res.locals.validatedParams;

      const checkpoint = CheckpointManager.getCheckpointById(id);

      if (!checkpoint) {
        res.status(404).json({ error: 'Checkpoint not found' });
        return;
      }

      res.json(checkpoint);
    } catch (error) {
      console.error('Error fetching checkpoint:', error);
      res.status(500).json({
        error: 'Failed to fetch checkpoint',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * GET /api/checkpoints/:id/full
 * Get checkpoint with all files
 *
 * Response:
 * - CheckpointWithFiles object
 *
 * @example
 * GET /api/checkpoints/550e8400-e29b-41d4-a716-446655440000/full
 */
router.get(
  '/checkpoints/:id/full',
  validateParams(checkpointIdSchema),
  async (_req: Request, res: Response) => {
    try {
      const { id } = res.locals.validatedParams;

      const checkpoint = CheckpointManager.getCheckpointWithFiles(id);

      if (!checkpoint) {
        res.status(404).json({ error: 'Checkpoint not found' });
        return;
      }

      res.json(checkpoint);
    } catch (error) {
      console.error('Error fetching checkpoint with files:', error);
      res.status(500).json({
        error: 'Failed to fetch checkpoint',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * GET /api/checkpoints/:id/files
 * Get all file contents for a checkpoint
 *
 * Response:
 * - files: Array of CheckpointFile objects
 * - total: Number of files
 *
 * @example
 * GET /api/checkpoints/550e8400-e29b-41d4-a716-446655440000/files
 */
router.get(
  '/checkpoints/:id/files',
  validateParams(checkpointIdSchema),
  async (_req: Request, res: Response) => {
    try {
      const { id } = res.locals.validatedParams;

      if (!CheckpointManager.checkpointExists(id)) {
        res.status(404).json({ error: 'Checkpoint not found' });
        return;
      }

      const files = CheckpointManager.getCheckpointFiles(id);

      res.json({
        files,
        total: files.length,
      });
    } catch (error) {
      console.error('Error fetching checkpoint files:', error);
      res.status(500).json({
        error: 'Failed to fetch checkpoint files',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * GET /api/checkpoints/:id/files/:filePath
 * Get a single file from a checkpoint
 *
 * Response:
 * - CheckpointFile object
 *
 * @example
 * GET /api/checkpoints/550e8400-e29b-41d4-a716-446655440000/files/src%2Findex.ts
 */
router.get('/checkpoints/:id/files/{*filePath}', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    // Get the file path from the wildcard parameter
    const filePath = req.params.filePath as string | undefined;

    if (!id || !filePath) {
      res.status(400).json({ error: 'Checkpoint ID and file path are required' });
      return;
    }

    // Validate checkpoint ID is UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      res.status(400).json({ error: 'Invalid checkpoint ID format' });
      return;
    }

    if (!CheckpointManager.checkpointExists(id)) {
      res.status(404).json({ error: 'Checkpoint not found' });
      return;
    }

    // Decode the file path (in case it was URL-encoded)
    const decodedPath = decodeURIComponent(filePath);
    const file = CheckpointManager.getCheckpointFile(id, decodedPath);

    if (!file) {
      res.status(404).json({ error: 'File not found in checkpoint' });
      return;
    }

    res.json(file);
  } catch (error) {
    console.error('Error fetching checkpoint file:', error);
    res.status(500).json({
      error: 'Failed to fetch checkpoint file',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PATCH /api/checkpoints/:id
 * Update checkpoint name or notes
 *
 * Request Body:
 * - name (string, optional): New checkpoint name
 * - notes (string, optional): New notes
 *
 * Response:
 * - Updated Checkpoint object
 *
 * @example
 * PATCH /api/checkpoints/550e8400-e29b-41d4-a716-446655440000
 * { "name": "New name", "notes": "Updated notes" }
 */
router.patch(
  '/checkpoints/:id',
  validateParams(checkpointIdSchema),
  validateBody(updateCheckpointSchema),
  async (_req: Request, res: Response) => {
    try {
      const { id } = res.locals.validatedParams;
      const updates = _req.body as UpdateCheckpointRequest;

      if (!updates.name && !updates.notes) {
        res.status(400).json({ error: 'No updates provided' });
        return;
      }

      const checkpoint = CheckpointManager.updateCheckpoint(id, updates);

      if (!checkpoint) {
        res.status(404).json({ error: 'Checkpoint not found' });
        return;
      }

      res.json(checkpoint);
    } catch (error) {
      console.error('Error updating checkpoint:', error);
      res.status(500).json({
        error: 'Failed to update checkpoint',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * DELETE /api/checkpoints/:id
 * Delete a checkpoint and all its files
 *
 * Response:
 * - success: true
 * - message: Confirmation message
 *
 * @example
 * DELETE /api/checkpoints/550e8400-e29b-41d4-a716-446655440000
 */
router.delete(
  '/checkpoints/:id',
  validateParams(checkpointIdSchema),
  async (_req: Request, res: Response) => {
    try {
      const { id } = res.locals.validatedParams;

      const deleted = CheckpointManager.deleteCheckpoint(id);

      if (!deleted) {
        res.status(404).json({ error: 'Checkpoint not found' });
        return;
      }

      res.json({
        success: true,
        message: 'Checkpoint deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting checkpoint:', error);
      res.status(500).json({
        error: 'Failed to delete checkpoint',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * GET /api/checkpoints/:id/diff/:otherId
 * Compare two checkpoints
 *
 * Response:
 * - CheckpointDiff object with added/removed/modified/unchanged files
 *
 * @example
 * GET /api/checkpoints/abc-123/diff/def-456
 */
router.get('/checkpoints/:id/diff/:otherId', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const otherId = req.params.otherId as string;

    if (!id || !otherId) {
      res.status(400).json({ error: 'Both checkpoint IDs are required' });
      return;
    }

    // Validate both IDs are UUIDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id) || !uuidRegex.test(otherId)) {
      res.status(400).json({ error: 'Invalid checkpoint ID format' });
      return;
    }

    const diff = CheckpointManager.compareCheckpoints(id, otherId);

    if (!diff) {
      res.status(404).json({ error: 'One or both checkpoints not found' });
      return;
    }

    res.json(diff);
  } catch (error) {
    console.error('Error comparing checkpoints:', error);
    res.status(500).json({
      error: 'Failed to compare checkpoints',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/checkpoints/:id/diff/:otherId/file
 * Get detailed file diff between two checkpoints for a specific file
 *
 * Query Parameters:
 * - path (string, required): File path to compare
 *
 * Response:
 * - CheckpointFileDiff object
 *
 * @example
 * GET /api/checkpoints/abc-123/diff/def-456/file?path=/src/index.ts
 */
router.get(
  '/checkpoints/:id/diff/:otherId/file',
  validateQuery(filePathSchema),
  async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const otherId = req.params.otherId as string;
      const { filePath } = res.locals.validatedQuery as { filePath: string };

      if (!id || !otherId) {
        res.status(400).json({ error: 'Both checkpoint IDs are required' });
        return;
      }

      // Validate both IDs are UUIDs
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id) || !uuidRegex.test(otherId)) {
        res.status(400).json({ error: 'Invalid checkpoint ID format' });
        return;
      }

      const fileDiff = CheckpointManager.getFileDiff(id, otherId, filePath);

      if (!fileDiff) {
        res.status(404).json({ error: 'File not found in either checkpoint' });
        return;
      }

      res.json(fileDiff);
    } catch (error) {
      console.error('Error getting file diff:', error);
      res.status(500).json({
        error: 'Failed to get file diff',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

export default router;
