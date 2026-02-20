/**
 * Token Usage Types
 *
 * Types for token consumption statistics displayed on the dashboard.
 */

/**
 * Aggregated token overview
 */
export interface TokenOverview {
  total: {
    input: number;
    output: number;
    total: number;
  };
  cache: {
    created: number;
    read: number;
    hitRate: number; // Percentage
  };
  estimatedCostCents: number;
  sessionCount: number;
}

/**
 * Token stats per folder
 */
export interface FolderTokenStats {
  folder: string;
  name: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  sessionCount: number;
  costCents: number;
}

/**
 * Token stats per agent
 */
export interface AgentTokenStats {
  agent: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  sessionCount: number;
}

/**
 * Daily token usage
 */
export interface DailyTokenUsage {
  date: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  sessionCount: number;
}

/**
 * Full token stats response
 */
export interface TokenStatsResponse {
  overall: TokenOverview;
  byFolder: FolderTokenStats[];
  byAgent: AgentTokenStats[];
  overTime: DailyTokenUsage[];
}

/**
 * Session with token usage
 */
export interface SessionTokenUsage {
  sessionId: string;
  slug: string;
  project: string;
  startTime: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costCents: number;
}

/**
 * Folder-specific token stats response
 */
export interface FolderTokenStatsResponse {
  folder: string;
  stats: TokenOverview;
  sessions: Array<{
    sessionId: string;
    slug: string;
    startTime: string;
    inputTokens: number;
    outputTokens: number;
    costCents: number;
  }>;
}
