import { Router, Request, Response } from 'express';
import { validateParams } from '../middleware/validation';
import { sessionIdSchema } from '../validation/schemas';
import { getDbInstance, isClaudeMemAvailable } from '../db/connection';

const router = Router();

/**
 * Observation from claude-mem
 */
export interface MemObservation {
  id: number;
  timestamp: number; // epoch ms
  session_id: string;
  type: string; // decision, feature, bugfix, etc.
  title: string;
  content: string;
  metadata?: Record<string, any>;
}

/**
 * Commentary bubble mapped to frame timeline
 */
export interface CommentaryBubble {
  id: number;
  timestamp: number; // epoch ms
  frameIndex?: number; // matched frame index (if found)
  type: string;
  title: string;
  content: string;
  metadata?: Record<string, any>;
}

/**
 * GET /api/sessions/:id/commentary
 * Get claude-mem observations for a session mapped to timeline
 *
 * URL Parameters:
 * - id: Session UUID
 *
 * Response:
 * - commentary: Array of CommentaryBubble objects
 * - total: Total number of observations
 * - sessionId: The session ID
 *
 * Status Codes:
 * - 200: Success
 * - 500: Internal error
 *
 * @example
 * GET /api/sessions/4b198fdf-b80d-4bbc-806f-2900282cdc56/commentary
 */
router.get('/:id/commentary', validateParams(sessionIdSchema), (_req: Request, res: Response) => {
  try {
    const { id: sessionId } = res.locals.validatedParams;
    if (!sessionId) {
      res.status(400).json({ error: 'Session ID is required' });
      return;
    }

    // Query claude-mem for observations matching this session ID
    const observations = queryClaudeMemObservations(sessionId);

    // Map observations to commentary bubbles
    const commentary: CommentaryBubble[] = observations.map((obs) => ({
      id: obs.id,
      timestamp: obs.timestamp,
      type: obs.type,
      title: obs.title,
      content: obs.content,
      metadata: obs.metadata,
    }));

    res.json({
      commentary,
      total: commentary.length,
      sessionId,
    });
  } catch (error) {
    console.error('Error fetching commentary:', error);
    res.status(500).json({
      error: 'Failed to fetch commentary',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Query claude-mem database directly for observations
 * Uses the existing database connection from connection.ts
 */
function queryClaudeMemObservations(sessionId: string): MemObservation[] {
  // Check if claude-mem is available
  if (!isClaudeMemAvailable()) {
    return [];
  }

  const db = getDbInstance();
  if (!db) {
    return [];
  }

  try {
    // Query observations by joining sdk_sessions to match the content_session_id
    // The sessionId from recall is stored as content_session_id in sdk_sessions
    const rows = db
      .prepare(
        `
      SELECT
        o.id,
        o.created_at_epoch as timestamp,
        o.memory_session_id as session_id,
        o.type,
        o.title,
        o.text,
        o.narrative,
        o.subtitle,
        o.facts,
        o.concepts,
        o.files_read,
        o.files_modified
      FROM observations o
      INNER JOIN sdk_sessions s ON o.memory_session_id = s.memory_session_id
      WHERE s.content_session_id = ?
      ORDER BY o.created_at_epoch ASC
      LIMIT 100
    `
      )
      .all(sessionId) as Array<{
      id: number;
      timestamp: number;
      session_id: string;
      type: string;
      title: string | null;
      text: string | null;
      narrative: string | null;
      subtitle: string | null;
      facts: string | null;
      concepts: string | null;
      files_read: string | null;
      files_modified: string | null;
    }>;

    // Map to MemObservation format
    return rows.map((row) => ({
      id: row.id,
      timestamp: row.timestamp,
      session_id: row.session_id,
      type: row.type || 'observation',
      title: row.title || row.subtitle || 'Observation',
      content: row.narrative || row.text || '',
      metadata: {
        facts: row.facts ? tryParseJSON(row.facts) : undefined,
        concepts: row.concepts ? tryParseJSON(row.concepts) : undefined,
        files_read: row.files_read ? tryParseJSON(row.files_read) : undefined,
        files_modified: row.files_modified ? tryParseJSON(row.files_modified) : undefined,
      },
    }));
  } catch (error) {
    console.error('Error querying claude-mem observations:', error);
    return [];
  }
}

/**
 * Helper to safely parse JSON fields
 */
function tryParseJSON(jsonString: string): unknown {
  try {
    return JSON.parse(jsonString);
  } catch {
    return undefined;
  }
}

export default router;
