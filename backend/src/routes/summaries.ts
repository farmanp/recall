/**
 * Session Summary Routes
 *
 * API endpoints for session auto-summarization.
 * Summaries are generated using heuristics (no LLM required).
 *
 * @module routes/summaries
 */

import { Router, Request, Response } from 'express';
import { Summarizer } from '../services/summarizer';
import {
  getSummary,
  storeSummary,
  getSummaryStats,
  initializeSummarySchema,
  getSessionsWithoutSummaries,
  storeSummariesBatch,
} from '../db/summary-queries';
import { getTranscriptFrames, getTranscriptSessionById } from '../db/transcript-queries';
import { ParserFactory } from '../parser/parser-factory';
import { detectAgentFromPath } from '../parser/agent-detector';
import { getSessionIndexer } from '../parser/session-indexer';

const router = Router();

// Ensure schema is initialized when routes are loaded
initializeSummarySchema();

/**
 * GET /api/sessions/:sessionId/summary
 * Get summary for a session
 *
 * Returns cached summary if available, otherwise generates one on-demand.
 *
 * URL Parameters:
 * - sessionId: Session UUID
 *
 * Query Parameters:
 * - source: Data source ('db' or 'filesystem', default: 'db')
 *
 * Response:
 * - summary: SessionSummary object
 * - cached: Whether the summary was retrieved from cache
 *
 * @example
 * GET /api/sessions/4b198fdf-b80d-4bbc-806f-2900282cdc56/summary
 * GET /api/sessions/4b198fdf-b80d-4bbc-806f-2900282cdc56/summary?source=filesystem
 */
router.get('/:sessionId/summary', async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;
    if (!sessionId) {
      res.status(400).json({ error: 'Session ID is required' });
      return;
    }

    const source = typeof req.query.source === 'string' ? req.query.source : 'db';

    // Check for cached summary first
    const existingSummary = getSummary(sessionId);
    if (existingSummary) {
      res.json({
        summary: existingSummary,
        cached: true,
      });
      return;
    }

    // No cached summary, need to generate one
    let frames;

    if (source === 'db') {
      // Check if session exists in database
      const session = getTranscriptSessionById(sessionId);
      if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      // Get all frames from database
      const result = getTranscriptFrames(sessionId, { limit: 10000 });
      frames = result.frames;
    } else {
      // Get frames from filesystem
      const indexer = getSessionIndexer();
      const filePath = await indexer.findSessionFile(sessionId);

      if (!filePath) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      const agentType = detectAgentFromPath(filePath);
      const transcript = await ParserFactory.parseFile(filePath);
      const timeline = await ParserFactory.buildTimeline(transcript, agentType);
      frames = timeline.frames;
    }

    if (!frames || frames.length === 0) {
      res.status(404).json({ error: 'No frames found for session' });
      return;
    }

    // Generate summary
    const summary = Summarizer.generateSummary(sessionId, frames);

    // Store for future use
    storeSummary(summary);

    res.json({
      summary,
      cached: false,
    });
  } catch (error) {
    console.error('Error fetching session summary:', error);
    res.status(500).json({
      error: 'Failed to fetch session summary',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/sessions/:sessionId/summary/regenerate
 * Force regenerate summary for a session
 *
 * Always generates a fresh summary, ignoring any cached version.
 *
 * URL Parameters:
 * - sessionId: Session UUID
 *
 * Query Parameters:
 * - source: Data source ('db' or 'filesystem', default: 'db')
 *
 * Response:
 * - summary: SessionSummary object
 * - regenerated: true
 *
 * @example
 * POST /api/sessions/4b198fdf-b80d-4bbc-806f-2900282cdc56/summary/regenerate
 */
router.post('/:sessionId/summary/regenerate', async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;
    if (!sessionId) {
      res.status(400).json({ error: 'Session ID is required' });
      return;
    }

    const source = typeof req.query.source === 'string' ? req.query.source : 'db';

    let frames;

    if (source === 'db') {
      // Check if session exists in database
      const session = getTranscriptSessionById(sessionId);
      if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      // Get all frames from database
      const result = getTranscriptFrames(sessionId, { limit: 10000 });
      frames = result.frames;
    } else {
      // Get frames from filesystem
      const indexer = getSessionIndexer();
      const filePath = await indexer.findSessionFile(sessionId);

      if (!filePath) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      const agentType = detectAgentFromPath(filePath);
      const transcript = await ParserFactory.parseFile(filePath);
      const timeline = await ParserFactory.buildTimeline(transcript, agentType);
      frames = timeline.frames;
    }

    if (!frames || frames.length === 0) {
      res.status(404).json({ error: 'No frames found for session' });
      return;
    }

    // Generate fresh summary
    const summary = Summarizer.generateSummary(sessionId, frames);

    // Store (overwrites any existing)
    storeSummary(summary);

    res.json({
      summary,
      regenerated: true,
    });
  } catch (error) {
    console.error('Error regenerating session summary:', error);
    res.status(500).json({
      error: 'Failed to regenerate session summary',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/summaries/stats
 * Get summary statistics
 *
 * Returns aggregate information about stored summaries.
 *
 * Response:
 * - total: Total number of summaries
 * - heuristic: Number generated by heuristics
 * - llm: Number generated by LLM
 * - avgErrorCount: Average error count across sessions
 * - avgFilesChanged: Average files changed per session
 *
 * @example
 * GET /api/summaries/stats
 */
router.get('/stats', (_req: Request, res: Response) => {
  try {
    const stats = getSummaryStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching summary stats:', error);
    res.status(500).json({
      error: 'Failed to fetch summary stats',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/summaries/generate-batch
 * Generate summaries for sessions that don't have them
 *
 * Background job to generate summaries for sessions missing them.
 *
 * Body Parameters:
 * - limit: Maximum number of sessions to process (default: 10, max: 100)
 *
 * Response:
 * - generated: Number of summaries generated
 * - errors: Number of errors encountered
 * - sessionIds: Array of processed session IDs
 *
 * @example
 * POST /api/summaries/generate-batch
 * { "limit": 20 }
 */
router.post('/generate-batch', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Math.max(1, req.body.limit || 10), 100);

    // Find sessions without summaries
    const sessionIds = getSessionsWithoutSummaries(limit);

    if (sessionIds.length === 0) {
      res.json({
        generated: 0,
        errors: 0,
        sessionIds: [],
        message: 'All sessions have summaries',
      });
      return;
    }

    const summaries = [];
    const errors: Array<{ sessionId: string; error: string }> = [];

    for (const sessionId of sessionIds) {
      try {
        // Get frames from database
        const result = getTranscriptFrames(sessionId, { limit: 10000 });

        if (result.frames.length === 0) {
          errors.push({ sessionId, error: 'No frames found' });
          continue;
        }

        // Generate summary
        const summary = Summarizer.generateSummary(sessionId, result.frames);
        summaries.push(summary);
      } catch (error) {
        errors.push({
          sessionId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Batch store all summaries
    if (summaries.length > 0) {
      storeSummariesBatch(summaries);
    }

    res.json({
      generated: summaries.length,
      errors: errors.length,
      sessionIds: summaries.map((s) => s.sessionId),
      errorDetails: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Error generating batch summaries:', error);
    res.status(500).json({
      error: 'Failed to generate batch summaries',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
