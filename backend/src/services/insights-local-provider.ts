/**
 * Local Insights Provider (Pro Tier)
 *
 * Runs recall-insights locally using the @recall-insights/core package.
 * - Full features (all analyzers)
 * - No usage limits
 * - Complete privacy (no data leaves your machine)
 * - Requires license key
 */

import type {
  InsightsProvider,
  SessionInsights,
  RepoInsights,
  InsightsConfig,
} from './insights-provider.js';

export class LocalInsightsProvider implements InsightsProvider {
  private insightsCore: any;
  private licenseKey: string;
  private initialized = false;

  constructor(config: InsightsConfig) {
    this.licenseKey = config.licenseKey || process.env.RECALL_INSIGHTS_LICENSE_KEY || '';

    if (!this.licenseKey) {
      throw new Error(
        'RECALL_INSIGHTS_LICENSE_KEY required for Pro tier. Get your license at https://recall-insights.com/pricing'
      );
    }
  }

  async initialize() {
    if (this.initialized) return;

    try {
      // Dynamic import to avoid bundling the package
      const { default: RecallInsights } = await import('@recall-insights/core');

      this.insightsCore = new RecallInsights({
        licenseKey: this.licenseKey,
        // Use recall's transcript database
        transcriptDbPath: process.env.RECALL_TRANSCRIPT_DB || '~/.claude/transcripts.db',
        // DuckDB for analytics
        analyticsDbPath: process.env.RECALL_INSIGHTS_DB || '~/.recall/insights.duckdb',
        // Optional config file
        configPath: process.env.RECALL_INSIGHTS_CONFIG || './recall-insights.config.yaml',
      });

      // Validate license
      await this.insightsCore.validateLicense();

      this.initialized = true;
    } catch (error: any) {
      if (error.code === 'MODULE_NOT_FOUND') {
        throw new Error(
          '@recall-insights/core not installed. Install with: npm install @recall-insights/core'
        );
      }
      if (error.message?.includes('Invalid license')) {
        throw new Error('Invalid license key. Contact support at support@recall-insights.com');
      }
      throw error;
    }
  }

  async analyzeSession(sessionId: string): Promise<SessionInsights> {
    await this.initialize();

    // Run full analysis locally
    const result = await this.insightsCore.analyzeSession(sessionId, {
      // Enable all analyzers
      analyzers: [
        'behavior-analyzer',
        'complexity-analyzer',
        'antipattern-detector',
        'cost-analyzer',
        'cl-size-analyzer',
        'test-coverage-analyzer',
        'change-coherence-analyzer',
        'doc-gap-analyzer',
        'comment-quality-analyzer',
        'hotspot-analyzer',
        'failure-classifier',
        'sequence-analyzer',
      ],
      // Use custom thresholds from config file
      useConfigThresholds: true,
    });

    // Map to standard format
    return {
      sessionId,
      timestamp: new Date().toISOString(),

      behavior: {
        decisiveness: result.behavior.decisiveness,
        toolRetries: result.behavior.retryCount,
        errorRecoveryRate: result.behavior.errorRecoveryRate,
        patternScore: result.behavior.patternScore,
      },

      complexity: {
        avgCyclomatic: result.complexity.avgCyclomatic,
        avgCognitive: result.complexity.avgCognitive,
        maxNesting: result.complexity.maxNesting,
        complexityDelta: result.complexity.delta,
      },

      cost: {
        totalTokens: result.cost.totalTokens,
        estimatedCostUSD: result.cost.estimatedCostUSD,
        tokensByFile: result.cost.byFile,
        tokensByTool: result.cost.byTool,
      },

      quality: {
        antipatterns: result.antipatterns.map((ap: any) => ({
          type: ap.type,
          severity: ap.severity,
          file: ap.file,
          line: ap.line,
          message: ap.message,
        })),
        clSizeScore: result.googlePractices.clSizeScore,
        testCoverageRatio: result.googlePractices.testCoverageRatio,
        changeCoherence: result.googlePractices.changeCoherence,
      },

      recommendations: result.recommendations,

      tier: 'pro',
      analysisTimeMs: result.analysisTimeMs,
    };
  }

  async analyzeRepo(projectPath: string): Promise<RepoInsights> {
    await this.initialize();

    // Full repo analysis (no limits)
    const result = await this.insightsCore.analyzeRepo(projectPath, {
      includeAllSessions: true,
      computeTrends: true,
      compareAgents: true,
    });

    return {
      projectPath,
      timestamp: new Date().toISOString(),
      sessionCount: result.sessionCount,

      avgDecisiveness: result.avgDecisiveness,
      avgComplexity: result.avgComplexity,
      totalCost: result.totalCost,

      trends: result.trends,
      topAntipatterns: result.topAntipatterns,
      agentComparison: result.agentComparison,

      tier: 'pro',
    };
  }

  async isAvailable(sessionId: string): Promise<boolean> {
    try {
      await this.initialize();
      return this.insightsCore.sessionExists(sessionId);
    } catch {
      return false;
    }
  }

  getTier(): 'pro' {
    return 'pro';
  }
}
