/**
 * Insights Provider Interface
 *
 * Abstracts the insights feature to support multiple implementation modes:
 * - Free tier: SaaS API calls to hosted service
 * - Pro tier: Local execution via @recall-insights/core package
 */

export interface SessionInsights {
  sessionId: string;
  timestamp: string;

  // Behavior metrics
  behavior: {
    decisiveness: number;
    toolRetries: number;
    errorRecoveryRate: number;
    patternScore: number;
  };

  // Complexity metrics
  complexity: {
    avgCyclomatic: number;
    avgCognitive: number;
    maxNesting: number;
    complexityDelta: number;
  };

  // Cost metrics
  cost: {
    totalTokens: number;
    estimatedCostUSD: number;
    tokensByFile: { file: string; tokens: number }[];
    tokensByTool: { tool: string; tokens: number }[];
  };

  // Quality metrics
  quality: {
    antipatterns: Array<{
      type: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      file: string;
      line: number;
      message: string;
    }>;
    clSizeScore: number;
    testCoverageRatio: number;
    changeCoherence: number;
  };

  // Recommendations
  recommendations: string[];

  // Metadata
  tier: 'free' | 'pro';
  analysisTimeMs: number;
}

export interface InsightsProvider {
  /**
   * Get insights for a single session
   */
  analyzeSession(sessionId: string): Promise<SessionInsights>;

  /**
   * Get aggregate insights across multiple sessions
   */
  analyzeRepo(projectPath: string): Promise<RepoInsights>;

  /**
   * Check if insights are available for a session
   */
  isAvailable(sessionId: string): Promise<boolean>;

  /**
   * Get the current tier
   */
  getTier(): 'free' | 'pro' | 'none';
}

export interface RepoInsights {
  projectPath: string;
  timestamp: string;
  sessionCount: number;

  // Aggregated metrics
  avgDecisiveness: number;
  avgComplexity: number;
  totalCost: number;

  // Trends
  trends: {
    decisiveness: number[]; // Last 30 sessions
    complexity: number[];
    cost: number[];
  };

  // Top issues
  topAntipatterns: Array<{
    type: string;
    count: number;
    severity: string;
  }>;

  // Agent comparison (if multiple agents used)
  agentComparison?: {
    claude: { avgDecisiveness: number; avgCost: number };
    codex?: { avgDecisiveness: number; avgCost: number };
    gemini?: { avgDecisiveness: number; avgCost: number };
    copilot?: { avgDecisiveness: number; avgCost: number };
  };

  tier: 'free' | 'pro';
}

/**
 * Configuration for insights providers
 */
export interface InsightsConfig {
  // For SaaS API (free tier)
  apiKey?: string;
  apiUrl?: string;

  // For local execution (pro tier)
  localConfigPath?: string;

  // License key for pro tier
  licenseKey?: string;
}
