/**
 * Drift Analysis Routes
 *
 * API endpoints for drift analysis and impact assessment.
 * Analysis is on-demand (not post-import) to keep session imports fast.
 *
 * @module routes/analysis
 */

import { Router, Request, Response } from 'express';
import {
  analyzeSession,
  getCachedAnalysisResult,
  deleteAnalysis,
} from '../services/drift-analyzer';
import { buildBaseline, buildAllBaselines } from '../services/baseline-builder';
import {
  initializeDriftSchema,
  getAllBaselines,
  getBaselineById,
  deleteBaseline,
  getDriftStats,
} from '../db/drift-queries';
import { getTranscriptFrames, getTranscriptSessionById } from '../db/transcript-queries';
import { ParserFactory } from '../parser/parser-factory';
import { detectAgentFromPath } from '../parser/agent-detector';
import { getSessionIndexer } from '../parser/session-indexer';

const router = Router();

// Ensure schema is initialized when routes are loaded
initializeDriftSchema();

// ============================================================================
// Session Analysis Endpoints
// ============================================================================

/**
 * GET /api/sessions/:sessionId/analysis
 * Get drift analysis for a session
 *
 * Returns cached analysis if available, otherwise computes on-demand.
 *
 * URL Parameters:
 * - sessionId: Session UUID
 *
 * Query Parameters:
 * - refresh: Set to 'true' to force re-analysis (default: false)
 * - source: Data source ('db' or 'filesystem', default: 'db')
 *
 * Response:
 * - DriftAnalysisResult object
 *
 * @example
 * GET /api/sessions/4b198fdf-b80d-4bbc-806f-2900282cdc56/analysis
 * GET /api/sessions/4b198fdf-b80d-4bbc-806f-2900282cdc56/analysis?refresh=true
 */
router.get('/:sessionId/analysis', async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;
    if (!sessionId) {
      res.status(400).json({ error: 'Session ID is required' });
      return;
    }

    const refresh = req.query.refresh === 'true';
    const source = typeof req.query.source === 'string' ? req.query.source : 'db';

    // Check cache first (unless refresh requested)
    if (!refresh) {
      const cached = getCachedAnalysisResult(sessionId);
      if (cached) {
        res.json({
          ...cached,
          cached: true,
        });
        return;
      }
    }

    // Load session frames - try database first, fall back to filesystem
    let frames;
    let cwd: string;
    let skipCache = false;

    // Try database first
    const sessionMeta = getTranscriptSessionById(sessionId);
    if (sessionMeta && source === 'db') {
      cwd = sessionMeta.cwd;

      // Load frames from database
      const dbResult = getTranscriptFrames(sessionId, { limit: 10000 });
      frames = dbResult.frames;
    } else {
      // Fall back to filesystem - can't cache since session isn't in DB
      skipCache = true;

      const indexer = getSessionIndexer();
      const sessionFilePath = await indexer.findSessionFile(sessionId);

      if (!sessionFilePath) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      // Parse file and build timeline
      const agent = detectAgentFromPath(sessionFilePath);
      const transcript = await ParserFactory.parseFile(sessionFilePath);
      const timeline = await ParserFactory.buildTimeline(transcript, agent);
      cwd = timeline.metadata.cwd;
      frames = timeline.frames;
    }

    // Run analysis
    const result = await analyzeSession(sessionId, frames, cwd, refresh, skipCache);

    res.json({
      ...result,
      cached: false,
    });
  } catch (err) {
    console.error('[Analysis] Error:', err);
    res.status(500).json({
      error: 'Failed to analyze session',
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

/**
 * GET /api/sessions/:sessionId/analysis/impact
 * Get just the impact summary (lightweight)
 *
 * Returns only the impact portion of the analysis.
 * Useful for quick overview without full findings.
 *
 * @example
 * GET /api/sessions/4b198fdf-b80d-4bbc-806f-2900282cdc56/analysis/impact
 */
router.get('/:sessionId/analysis/impact', async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;
    if (!sessionId) {
      res.status(400).json({ error: 'Session ID is required' });
      return;
    }

    // Try cache first
    const cached = getCachedAnalysisResult(sessionId);
    if (cached) {
      res.json({
        impact: cached.impact,
        cached: true,
      });
      return;
    }

    // Need to compute full analysis to get impact
    let frames;
    let cwd: string;
    let skipCache = false;

    const sessionMeta = getTranscriptSessionById(sessionId);
    if (sessionMeta) {
      cwd = sessionMeta.cwd;
      const framesResult = getTranscriptFrames(sessionId, { limit: 10000 });
      frames = framesResult.frames;
    } else {
      // Fall back to filesystem
      skipCache = true;

      const indexer = getSessionIndexer();
      const sessionFilePath = await indexer.findSessionFile(sessionId);

      if (!sessionFilePath) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      const agent = detectAgentFromPath(sessionFilePath);
      const transcript = await ParserFactory.parseFile(sessionFilePath);
      const timeline = await ParserFactory.buildTimeline(transcript, agent);
      cwd = timeline.metadata.cwd;
      frames = timeline.frames;
    }

    const result = await analyzeSession(sessionId, frames, cwd, false, skipCache);

    res.json({
      impact: result.impact,
      cached: false,
    });
  } catch (err) {
    console.error('[Analysis] Error:', err);
    res.status(500).json({
      error: 'Failed to get impact summary',
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

/**
 * DELETE /api/sessions/:sessionId/analysis
 * Delete cached analysis for a session
 *
 * @example
 * DELETE /api/sessions/4b198fdf-b80d-4bbc-806f-2900282cdc56/analysis
 */
router.delete('/:sessionId/analysis', (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;
    if (!sessionId) {
      res.status(400).json({ error: 'Session ID is required' });
      return;
    }

    const deleted = deleteAnalysis(sessionId);

    res.json({
      success: deleted,
      message: deleted ? 'Analysis deleted' : 'No analysis found',
    });
  } catch (err) {
    console.error('[Analysis] Error:', err);
    res.status(500).json({
      error: 'Failed to delete analysis',
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

// ============================================================================
// Baseline Endpoints
// ============================================================================

/**
 * GET /api/analysis/baselines
 * List all computed baselines
 *
 * @example
 * GET /api/analysis/baselines
 */
router.get('/baselines', (_req: Request, res: Response) => {
  try {
    const baselines = getAllBaselines();

    res.json({
      baselines: baselines.map((b) => ({
        id: b.id,
        repoPath: b.repoPath,
        language: b.language,
        topLevelDir: b.topLevelDir,
        tags: b.tags,
        computedAt: b.computedAt,
        version: b.version,
        filesAnalyzed: b.filesAnalyzed,
      })),
    });
  } catch (err) {
    console.error('[Analysis] Error:', err);
    res.status(500).json({
      error: 'Failed to list baselines',
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

/**
 * POST /api/analysis/baselines
 * Trigger baseline computation
 *
 * Body:
 * - repoPath: Repository root path (required)
 * - language: Language to analyze (default: 'typescript')
 * - topLevelDir: Top-level directory scope (default: '*')
 * - forceRefresh: Force re-computation (default: false)
 *
 * @example
 * POST /api/analysis/baselines
 * { "repoPath": "/Users/me/project", "language": "typescript" }
 */
router.post('/baselines', async (req: Request, res: Response) => {
  try {
    const { repoPath, language = 'typescript', topLevelDir = '*', forceRefresh = false } = req.body;

    if (!repoPath) {
      res.status(400).json({ error: 'repoPath is required' });
      return;
    }

    const baseline = await buildBaseline(repoPath, language, topLevelDir, forceRefresh);

    res.json({
      baselineId: baseline.id,
      status: 'completed',
      filesAnalyzed: baseline.filesAnalyzed,
      tags: baseline.tags,
      computedAt: baseline.computedAt,
    });
  } catch (err) {
    console.error('[Analysis] Error:', err);
    res.status(500).json({
      error: 'Failed to compute baseline',
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

/**
 * POST /api/analysis/baselines/all
 * Compute baselines for all languages in a repo
 *
 * Body:
 * - repoPath: Repository root path (required)
 * - forceRefresh: Force re-computation (default: false)
 *
 * @example
 * POST /api/analysis/baselines/all
 * { "repoPath": "/Users/me/project" }
 */
router.post('/baselines/all', async (req: Request, res: Response) => {
  try {
    const { repoPath, forceRefresh = false } = req.body;

    if (!repoPath) {
      res.status(400).json({ error: 'repoPath is required' });
      return;
    }

    const baselines = await buildAllBaselines(repoPath, forceRefresh);

    res.json({
      baselines: baselines.map((b) => ({
        id: b.id,
        language: b.language,
        filesAnalyzed: b.filesAnalyzed,
        tags: b.tags,
      })),
    });
  } catch (err) {
    console.error('[Analysis] Error:', err);
    res.status(500).json({
      error: 'Failed to compute baselines',
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

/**
 * GET /api/analysis/baselines/:id
 * Get baseline details
 *
 * @example
 * GET /api/analysis/baselines/1
 */
router.get('/baselines/:id', (req: Request, res: Response) => {
  try {
    const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = idParam ? parseInt(idParam, 10) : NaN;
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid baseline ID' });
      return;
    }

    const baseline = getBaselineById(id);
    if (!baseline) {
      res.status(404).json({ error: 'Baseline not found' });
      return;
    }

    res.json(baseline);
  } catch (err) {
    console.error('[Analysis] Error:', err);
    res.status(500).json({
      error: 'Failed to get baseline',
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

/**
 * DELETE /api/analysis/baselines/:id
 * Delete a baseline
 *
 * @example
 * DELETE /api/analysis/baselines/1
 */
router.delete('/baselines/:id', (req: Request, res: Response) => {
  try {
    const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = idParam ? parseInt(idParam, 10) : NaN;
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid baseline ID' });
      return;
    }

    const deleted = deleteBaseline(id);

    res.json({
      success: deleted,
      message: deleted ? 'Baseline deleted' : 'Baseline not found',
    });
  } catch (err) {
    console.error('[Analysis] Error:', err);
    res.status(500).json({
      error: 'Failed to delete baseline',
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

// ============================================================================
// Statistics Endpoints
// ============================================================================

/**
 * GET /api/analysis/stats
 * Get drift analysis statistics
 *
 * @example
 * GET /api/analysis/stats
 */
router.get('/stats', (_req: Request, res: Response) => {
  try {
    const stats = getDriftStats();

    res.json(stats);
  } catch (err) {
    console.error('[Analysis] Error:', err);
    res.status(500).json({
      error: 'Failed to get statistics',
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

export default router;
