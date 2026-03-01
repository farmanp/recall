/**
 * Insights API Routes
 *
 * Provides access to recall-insights features through the backend API.
 */

import express from 'express';
import { createInsightsProvider, getConfiguredTier } from '../services/insights-factory.js';

const router = express.Router();

/**
 * GET /api/insights/status
 * Check if insights are available and which tier
 */
router.get('/status', async (req, res) => {
  const tier = getConfiguredTier();

  res.json({
    available: tier !== 'none',
    tier,
    features:
      tier === 'pro'
        ? {
            sessionAnalysis: true,
            repoAnalysis: true,
            unlimitedUsage: true,
            allAnalyzers: true,
            customThresholds: true,
            privacy: 'complete',
          }
        : tier === 'free'
          ? {
              sessionAnalysis: true,
              repoAnalysis: false,
              unlimitedUsage: false,
              allAnalyzers: false,
              customThresholds: false,
              privacy: 'metadata-only',
            }
          : {},
    upgradeUrl: tier !== 'pro' ? 'https://recall-insights.com/pricing' : null,
  });
});

/**
 * GET /api/insights/session/:sessionId
 * Get insights for a specific session
 */
router.get('/session/:sessionId', async (req, res) => {
  try {
    const provider = await createInsightsProvider();
    const insights = await provider.analyzeSession(req.params.sessionId);

    res.json({
      success: true,
      insights,
    });
  } catch (error: any) {
    if (error.code === 'INSIGHTS_NOT_AVAILABLE') {
      return res.status(402).json({
        success: false,
        error: error.message,
        upgradeUrl: error.upgradeUrl,
        options: error.options,
      });
    }

    if (error.message?.includes('quota exceeded')) {
      return res.status(402).json({
        success: false,
        error: error.message,
        upgradeUrl: 'https://recall-insights.com/pricing',
      });
    }

    console.error('[Insights] Error analyzing session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze session',
      details: error.message,
    });
  }
});

/**
 * GET /api/insights/repo
 * Get aggregate insights for a repository/project
 */
router.get('/repo', async (req, res) => {
  const projectPath = req.query.path as string;

  if (!projectPath) {
    return res.status(400).json({
      success: false,
      error: 'Missing required query parameter: path',
    });
  }

  try {
    const provider = await createInsightsProvider();
    const insights = await provider.analyzeRepo(projectPath);

    res.json({
      success: true,
      insights,
    });
  } catch (error: any) {
    if (error.code === 'INSIGHTS_NOT_AVAILABLE') {
      return res.status(402).json({
        success: false,
        error: error.message,
        upgradeUrl: error.upgradeUrl,
        options: error.options,
      });
    }

    if (error.message?.includes('requires Pro tier')) {
      return res.status(402).json({
        success: false,
        error: error.message,
        upgradeUrl: 'https://recall-insights.com/pricing',
      });
    }

    console.error('[Insights] Error analyzing repo:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze repository',
      details: error.message,
    });
  }
});

/**
 * POST /api/insights/batch
 * Analyze multiple sessions at once
 */
router.post('/batch', async (req, res) => {
  const { sessionIds } = req.body;

  if (!Array.isArray(sessionIds) || sessionIds.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Expected array of sessionIds in request body',
    });
  }

  try {
    const provider = await createInsightsProvider();

    // Analyze in parallel
    const results = await Promise.allSettled(sessionIds.map((id) => provider.analyzeSession(id)));

    const successful = results.filter((r) => r.status === 'fulfilled').map((r: any) => r.value);

    const failed = results
      .filter((r) => r.status === 'rejected')
      .map((r: any, i) => ({
        sessionId: sessionIds[i],
        error: r.reason.message,
      }));

    res.json({
      success: true,
      analyzed: successful.length,
      failed: failed.length,
      results: successful,
      errors: failed,
    });
  } catch (error: any) {
    if (error.code === 'INSIGHTS_NOT_AVAILABLE') {
      return res.status(402).json({
        success: false,
        error: error.message,
        upgradeUrl: error.upgradeUrl,
        options: error.options,
      });
    }

    console.error('[Insights] Error in batch analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Batch analysis failed',
      details: error.message,
    });
  }
});

export default router;
