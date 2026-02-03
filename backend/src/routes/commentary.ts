import { Router, Request, Response } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';

const router = Router();
const execAsync = promisify(exec);

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
router.get('/:id/commentary', async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.id as string;
    if (!sessionId) {
      res.status(400).json({ error: 'Session ID is required' });
      return;
    }

    // Query claude-mem for observations matching this session ID
    const observations = await queryClaudeMemObservations(sessionId);

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
 * Query claude-mem MCP server for observations
 * Uses the claude CLI with MCP integration
 */
async function queryClaudeMemObservations(sessionId: string): Promise<MemObservation[]> {
  try {
    // Use the claude-mem MCP search to find observations for this session
    // The search command queries the claude-mem sqlite database
    const query = JSON.stringify({
      session_id: sessionId,
      limit: 100,
    });

    // Execute search via MCP server
    // Note: This assumes claude-mem MCP server is running and configured
    const command = `claude mcp call claude-mem search '${query}'`;

    const { stdout, stderr } = await execAsync(command);

    if (stderr) {
      console.warn('claude-mem search warning:', stderr);
    }

    // Parse the MCP response
    const response = JSON.parse(stdout);

    // Extract observations from the response
    // The exact format depends on claude-mem's response structure
    const observations: MemObservation[] = [];

    if (response && response.results) {
      for (const result of response.results) {
        observations.push({
          id: result.id,
          timestamp: result.timestamp || Date.now(),
          session_id: sessionId,
          type: result.type || 'observation',
          title: result.title || result.summary || 'Observation',
          content: result.content || result.text || '',
          metadata: result.metadata,
        });
      }
    }

    return observations;
  } catch (error) {
    console.error('Error querying claude-mem:', error);
    // Return empty array if claude-mem is not available
    // This allows the app to work without claude-mem installed
    return [];
  }
}

/**
 * Alternative implementation using direct sqlite access
 * This is a fallback if MCP server is not available
 * Exported for potential future use or testing
 */
export async function queryClaudeMemDirect(sessionId: string): Promise<MemObservation[]> {
  try {
    // Import better-sqlite3
    const Database = require('better-sqlite3');
    const os = require('os');
    const path = require('path');

    // claude-mem stores data in ~/.claude-mem/memory.db
    const dbPath = path.join(os.homedir(), '.claude-mem', 'memory.db');

    const db = new Database(dbPath, { readonly: true });

    // Query observations for this session
    const stmt = db.prepare(`
      SELECT
        id,
        timestamp,
        session_id,
        type,
        title,
        content,
        metadata
      FROM observations
      WHERE session_id = ?
      ORDER BY timestamp ASC
    `);

    const rows = stmt.all(sessionId);

    db.close();

    // Map to MemObservation format
    return rows.map((row: any) => ({
      id: row.id,
      timestamp: row.timestamp,
      session_id: row.session_id,
      type: row.type || 'observation',
      title: row.title || 'Observation',
      content: row.content || '',
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    }));
  } catch (error) {
    console.error('Error querying claude-mem database directly:', error);
    return [];
  }
}

export default router;
