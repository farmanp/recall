/**
 * API Routes for Work Units
 *
 * Endpoints:
 * - GET  /api/work-units          - List work units
 * - GET  /api/work-units/stats    - Get work unit statistics
 * - GET  /api/work-units/:id      - Get work unit details
 * - GET  /api/work-units/:id/sessions - Get paginated sessions in work unit
 * - POST /api/work-units/recompute - Trigger recomputation
 * - PATCH /api/work-units/:id     - Update work unit (add/remove session)
 * - DELETE /api/work-units/:id    - Delete work unit
 */

import { Router, Request, Response } from 'express';
import type { AgentType } from '../types/transcript';
import type { WorkUnitListQuery, WorkUnitConfidence, RecomputeResponse } from '../types/work-unit';
import {
  initializeWorkUnitSchema,
  getWorkUnits,
  getWorkUnitById,
  getWorkUnitSessions,
  getWorkUnitBySessionId,
  saveAllWorkUnits,
  addSessionToWorkUnit,
  removeSessionFromWorkUnit,
  deleteWorkUnit,
  getWorkUnitStats,
} from '../db/work-unit-queries';
import { computeWorkUnits, DEFAULT_CORRELATION_CONFIG } from '../services/work-unit-correlator';
import { getSessionIndexer } from '../parser/session-indexer';

const router = Router();

// Initialize work unit schema on module load
initializeWorkUnitSchema();

/**
 * Helper to safely extract string query parameters
 */
function getStringParam(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  return undefined;
}

/**
 * GET /api/work-units
 * List all work units with pagination and filtering
 *
 * Query Parameters:
 * - offset (number): Skip N work units (default: 0)
 * - limit (number): Return N work units (default: 20)
 * - confidence (string): Filter by confidence level ('high', 'medium', 'low')
 * - agent (string): Filter by agent type ('claude', 'codex', 'gemini')
 * - project (string): Filter by project name/path
 * - includeUngrouped (boolean): Include count of ungrouped sessions
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const offsetStr = getStringParam(req.query.offset);
    const limitStr = getStringParam(req.query.limit);
    const confidence = getStringParam(req.query.confidence) as WorkUnitConfidence | undefined;
    const agent = getStringParam(req.query.agent) as AgentType | undefined;
    const project = getStringParam(req.query.project);
    const includeUngrouped = req.query.includeUngrouped === 'true';

    const query: WorkUnitListQuery = {
      offset: offsetStr ? parseInt(offsetStr, 10) : 0,
      limit: limitStr ? parseInt(limitStr, 10) : 20,
      confidence,
      agent,
      project,
      includeUngrouped,
    };

    const result = getWorkUnits(query);

    res.json(result);
  } catch (error) {
    console.error('Error fetching work units:', error);
    res.status(500).json({
      error: 'Failed to fetch work units',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/work-units/stats
 * Get work unit statistics
 */
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const stats = getWorkUnitStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching work unit stats:', error);
    res.status(500).json({
      error: 'Failed to fetch work unit stats',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/work-units/:id
 * Get a single work unit by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const workUnitId = req.params.id as string;

    if (!workUnitId) {
      res.status(400).json({ error: 'Work unit ID is required' });
      return;
    }

    const workUnit = getWorkUnitById(workUnitId);

    if (!workUnit) {
      res.status(404).json({ error: 'Work unit not found' });
      return;
    }

    res.json({ workUnit, sessions: workUnit.sessions });
  } catch (error) {
    console.error('Error fetching work unit:', error);
    res.status(500).json({
      error: 'Failed to fetch work unit',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/work-units/:id/sessions
 * Get sessions for a work unit with pagination
 */
router.get('/:id/sessions', async (req: Request, res: Response) => {
  try {
    const workUnitId = req.params.id as string;
    const offsetStr = getStringParam(req.query.offset);
    const limitStr = getStringParam(req.query.limit);
    const offset = offsetStr ? parseInt(offsetStr, 10) : 0;
    const limit = limitStr ? parseInt(limitStr, 10) : 20;

    if (!workUnitId) {
      res.status(400).json({ error: 'Work unit ID is required' });
      return;
    }

    const allSessions = getWorkUnitSessions(workUnitId);
    const paginatedSessions = allSessions.slice(offset, offset + limit);

    res.json({
      sessions: paginatedSessions,
      total: allSessions.length,
      offset,
      limit,
    });
  } catch (error) {
    console.error('Error fetching work unit sessions:', error);
    res.status(500).json({
      error: 'Failed to fetch work unit sessions',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/work-units/recompute
 * Trigger recomputation of all work units
 *
 * Body:
 * - force (boolean): Force recompute even if recent
 */
router.post('/recompute', async (_req: Request, res: Response) => {
  try {
    const startTime = Date.now();

    // Compute work units
    const workUnits = await computeWorkUnits(DEFAULT_CORRELATION_CONFIG);

    // Save to database
    saveAllWorkUnits(workUnits);

    const duration = Date.now() - startTime;

    // Get session count
    const indexer = getSessionIndexer();
    const allSessions = await indexer.getAllSessions();

    const response: RecomputeResponse = {
      success: true,
      workUnitsCreated: workUnits.length,
      workUnitsUpdated: 0,
      sessionsProcessed: allSessions.length,
      duration,
    };

    res.json(response);
  } catch (error) {
    console.error('Error recomputing work units:', error);
    res.status(500).json({
      error: 'Failed to recompute work units',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PATCH /api/work-units/:id
 * Update a work unit (add/remove session)
 *
 * Body:
 * - action: 'add' | 'remove'
 * - sessionId: string
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const workUnitId = req.params.id as string;
    const { action, sessionId } = req.body;

    if (!workUnitId) {
      res.status(400).json({ error: 'Work unit ID is required' });
      return;
    }

    if (!action || !sessionId) {
      res.status(400).json({ error: 'action and sessionId are required' });
      return;
    }

    if (action !== 'add' && action !== 'remove') {
      res.status(400).json({ error: 'action must be "add" or "remove"' });
      return;
    }

    const workUnit = getWorkUnitById(workUnitId);
    if (!workUnit) {
      res.status(404).json({ error: 'Work unit not found' });
      return;
    }

    let success = false;

    if (action === 'add') {
      // Get session metadata
      const indexer = getSessionIndexer();
      const metadata = await indexer.getSessionMetadata(sessionId);

      if (!metadata) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      success = addSessionToWorkUnit(
        workUnitId,
        sessionId,
        metadata.agent || 'unknown',
        metadata.startTime,
        metadata.endTime,
        metadata.duration,
        metadata.eventCount,
        metadata.firstUserMessage
      );
    } else {
      success = removeSessionFromWorkUnit(workUnitId, sessionId);
    }

    if (success) {
      const updatedWorkUnit = getWorkUnitById(workUnitId);
      res.json({
        success: true,
        workUnit: updatedWorkUnit,
        message: `Session ${action === 'add' ? 'added to' : 'removed from'} work unit`,
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to update work unit',
      });
    }
  } catch (error) {
    console.error('Error updating work unit:', error);
    res.status(500).json({
      error: 'Failed to update work unit',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * DELETE /api/work-units/:id
 * Delete a work unit
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const workUnitId = req.params.id as string;

    if (!workUnitId) {
      res.status(400).json({ error: 'Work unit ID is required' });
      return;
    }

    const success = deleteWorkUnit(workUnitId);

    if (success) {
      res.json({ success: true, message: 'Work unit deleted' });
    } else {
      res.status(404).json({ error: 'Work unit not found' });
    }
  } catch (error) {
    console.error('Error deleting work unit:', error);
    res.status(500).json({
      error: 'Failed to delete work unit',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/sessions/:id/work-unit
 * Get work unit for a specific session
 * (This is mounted at a different path in server.ts)
 */
export async function getSessionWorkUnit(req: Request, res: Response): Promise<void> {
  try {
    const sessionId = req.params.id as string;

    if (!sessionId) {
      res.status(400).json({ error: 'Session ID is required' });
      return;
    }

    const workUnit = getWorkUnitBySessionId(sessionId);

    if (!workUnit) {
      res.status(404).json({ error: 'No work unit found for this session' });
      return;
    }

    res.json({ workUnit });
  } catch (error) {
    console.error('Error fetching session work unit:', error);
    res.status(500).json({
      error: 'Failed to fetch session work unit',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

export default router;
