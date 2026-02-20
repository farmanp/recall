/**
 * Token Usage Query Functions
 *
 * Provides aggregation queries for token consumption statistics.
 * Used by the overview dashboard to display usage metrics.
 */

import { getTranscriptDbInstance } from './transcript-connection';

/**
 * Token statistics for a single session
 */
export interface SessionTokenStats {
  sessionId: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  estimatedCostCents: number;
}

/**
 * Aggregated token statistics
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
    hitRate: number; // Percentage of tokens read from cache
  };
  estimatedCostCents: number;
  sessionCount: number;
}

/**
 * Token statistics per folder
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
 * Token statistics per agent
 */
export interface AgentTokenStats {
  agent: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  sessionCount: number;
}

/**
 * Initialize token usage schema (migration-compatible)
 * Safe to call multiple times - adds columns if they don't exist.
 */
export function initializeTokenSchema(): void {
  const db = getTranscriptDbInstance();

  // Check if columns exist and add them if not
  const columns = db.pragma('table_info(session_metadata)') as Array<{ name: string }>;
  const columnNames = columns.map((col) => col.name);

  if (!columnNames.includes('total_input_tokens')) {
    db.exec('ALTER TABLE session_metadata ADD COLUMN total_input_tokens INTEGER DEFAULT 0');
  }
  if (!columnNames.includes('total_output_tokens')) {
    db.exec('ALTER TABLE session_metadata ADD COLUMN total_output_tokens INTEGER DEFAULT 0');
  }
  if (!columnNames.includes('cache_creation_tokens')) {
    db.exec('ALTER TABLE session_metadata ADD COLUMN cache_creation_tokens INTEGER DEFAULT 0');
  }
  if (!columnNames.includes('cache_read_tokens')) {
    db.exec('ALTER TABLE session_metadata ADD COLUMN cache_read_tokens INTEGER DEFAULT 0');
  }
  if (!columnNames.includes('estimated_cost_cents')) {
    db.exec('ALTER TABLE session_metadata ADD COLUMN estimated_cost_cents INTEGER DEFAULT 0');
  }

  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_sessions_folder_tokens
      ON session_metadata(project, total_input_tokens, total_output_tokens);
    CREATE INDEX IF NOT EXISTS idx_sessions_cost
      ON session_metadata(estimated_cost_cents DESC);
  `);
}

/**
 * Update token usage for a session
 */
export function updateSessionTokens(
  sessionId: string,
  tokens: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
    estimatedCostCents: number;
  }
): void {
  const db = getTranscriptDbInstance();

  db.prepare(
    `
    UPDATE session_metadata
    SET
      total_input_tokens = @inputTokens,
      total_output_tokens = @outputTokens,
      cache_creation_tokens = @cacheCreationTokens,
      cache_read_tokens = @cacheReadTokens,
      estimated_cost_cents = @estimatedCostCents
    WHERE session_id = @sessionId
  `
  ).run({
    sessionId,
    inputTokens: tokens.inputTokens,
    outputTokens: tokens.outputTokens,
    cacheCreationTokens: tokens.cacheCreationTokens,
    cacheReadTokens: tokens.cacheReadTokens,
    estimatedCostCents: tokens.estimatedCostCents,
  });
}

/**
 * Get overall token usage statistics
 */
export function getTokenOverview(cwdFilter?: string): TokenOverview {
  const db = getTranscriptDbInstance();

  let whereClause = '';
  const params: Record<string, unknown> = {};

  if (cwdFilter) {
    whereClause = "WHERE cwd LIKE @cwdFilter || '%' OR cwd = @cwdFilter";
    params.cwdFilter = cwdFilter;
  }

  const result = db
    .prepare(
      `
    SELECT
      COALESCE(SUM(total_input_tokens), 0) as totalInput,
      COALESCE(SUM(total_output_tokens), 0) as totalOutput,
      COALESCE(SUM(cache_creation_tokens), 0) as cacheCreated,
      COALESCE(SUM(cache_read_tokens), 0) as cacheRead,
      COALESCE(SUM(estimated_cost_cents), 0) as totalCostCents,
      COUNT(*) as sessionCount
    FROM session_metadata
    ${whereClause}
  `
    )
    .get(params) as {
    totalInput: number;
    totalOutput: number;
    cacheCreated: number;
    cacheRead: number;
    totalCostCents: number;
    sessionCount: number;
  };

  const totalTokens = result.totalInput + result.totalOutput;
  const totalCacheableTokens = result.totalInput; // Input tokens can be cached
  const cacheHitRate =
    totalCacheableTokens > 0
      ? Math.round((result.cacheRead / (result.cacheRead + result.totalInput)) * 100)
      : 0;

  return {
    total: {
      input: result.totalInput,
      output: result.totalOutput,
      total: totalTokens,
    },
    cache: {
      created: result.cacheCreated,
      read: result.cacheRead,
      hitRate: cacheHitRate,
    },
    estimatedCostCents: result.totalCostCents,
    sessionCount: result.sessionCount,
  };
}

/**
 * Get token usage grouped by project folder
 */
export function getTokensByFolder(limit: number = 10): FolderTokenStats[] {
  const db = getTranscriptDbInstance();

  const results = db
    .prepare(
      `
    SELECT
      project as folder,
      COALESCE(SUM(total_input_tokens), 0) as inputTokens,
      COALESCE(SUM(total_output_tokens), 0) as outputTokens,
      COALESCE(SUM(total_input_tokens + total_output_tokens), 0) as totalTokens,
      COUNT(*) as sessionCount,
      COALESCE(SUM(estimated_cost_cents), 0) as costCents
    FROM session_metadata
    GROUP BY project
    HAVING totalTokens > 0
    ORDER BY totalTokens DESC
    LIMIT @limit
  `
    )
    .all({ limit }) as Array<{
    folder: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    sessionCount: number;
    costCents: number;
  }>;

  return results.map((row) => ({
    folder: row.folder,
    name: row.folder.split('/').pop() || row.folder,
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    totalTokens: row.totalTokens,
    sessionCount: row.sessionCount,
    costCents: row.costCents,
  }));
}

/**
 * Get token usage grouped by agent type
 */
export function getTokensByAgent(): AgentTokenStats[] {
  const db = getTranscriptDbInstance();

  const results = db
    .prepare(
      `
    SELECT
      agent_type as agent,
      COALESCE(SUM(total_input_tokens), 0) as inputTokens,
      COALESCE(SUM(total_output_tokens), 0) as outputTokens,
      COALESCE(SUM(total_input_tokens + total_output_tokens), 0) as totalTokens,
      COUNT(*) as sessionCount
    FROM session_metadata
    GROUP BY agent_type
    ORDER BY totalTokens DESC
  `
    )
    .all() as Array<{
    agent: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    sessionCount: number;
  }>;

  return results;
}

/**
 * Get token usage for a specific folder
 */
export function getTokensForFolder(folderPath: string): {
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
} {
  const db = getTranscriptDbInstance();

  // Get aggregate stats
  const stats = getTokenOverview(folderPath);

  // Get individual sessions
  const sessions = db
    .prepare(
      `
    SELECT
      session_id as sessionId,
      slug,
      start_time as startTime,
      COALESCE(total_input_tokens, 0) as inputTokens,
      COALESCE(total_output_tokens, 0) as outputTokens,
      COALESCE(estimated_cost_cents, 0) as costCents
    FROM session_metadata
    WHERE project = @folderPath
    ORDER BY start_time DESC
    LIMIT 50
  `
    )
    .all({ folderPath }) as Array<{
    sessionId: string;
    slug: string;
    startTime: string;
    inputTokens: number;
    outputTokens: number;
    costCents: number;
  }>;

  return {
    folder: folderPath,
    stats,
    sessions,
  };
}

/**
 * Get sessions with highest token usage
 */
export function getTopTokenSessions(limit: number = 10): Array<{
  sessionId: string;
  slug: string;
  project: string;
  startTime: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costCents: number;
}> {
  const db = getTranscriptDbInstance();

  return db
    .prepare(
      `
    SELECT
      session_id as sessionId,
      slug,
      project,
      start_time as startTime,
      COALESCE(total_input_tokens, 0) as inputTokens,
      COALESCE(total_output_tokens, 0) as outputTokens,
      COALESCE(total_input_tokens + total_output_tokens, 0) as totalTokens,
      COALESCE(estimated_cost_cents, 0) as costCents
    FROM session_metadata
    WHERE totalTokens > 0
    ORDER BY totalTokens DESC
    LIMIT @limit
  `
    )
    .all({ limit }) as Array<{
    sessionId: string;
    slug: string;
    project: string;
    startTime: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    costCents: number;
  }>;
}

/**
 * Get token usage over time (daily aggregates)
 */
export function getTokenUsageOverTime(days: number = 30): Array<{
  date: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  sessionCount: number;
}> {
  const db = getTranscriptDbInstance();

  return db
    .prepare(
      `
    SELECT
      DATE(start_time) as date,
      COALESCE(SUM(total_input_tokens), 0) as inputTokens,
      COALESCE(SUM(total_output_tokens), 0) as outputTokens,
      COALESCE(SUM(total_input_tokens + total_output_tokens), 0) as totalTokens,
      COUNT(*) as sessionCount
    FROM session_metadata
    WHERE start_time >= DATE('now', '-' || @days || ' days')
    GROUP BY DATE(start_time)
    ORDER BY date ASC
  `
    )
    .all({ days }) as Array<{
    date: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    sessionCount: number;
  }>;
}

/**
 * Calculate estimated cost in cents based on token usage
 * Uses Anthropic's pricing tiers:
 * - Claude 3 Opus: $15/MTok input, $75/MTok output
 * - Claude 3.5 Sonnet: $3/MTok input, $15/MTok output
 * - Claude 3 Haiku: $0.25/MTok input, $1.25/MTok output
 *
 * Default assumes Sonnet-tier pricing for conservative estimates
 */
export function calculateEstimatedCost(
  inputTokens: number,
  outputTokens: number,
  model?: string
): number {
  // Pricing per million tokens (convert to per-token)
  let inputPricePerMillion = 3.0; // Sonnet default
  let outputPricePerMillion = 15.0;

  if (model) {
    const modelLower = model.toLowerCase();
    if (modelLower.includes('opus')) {
      inputPricePerMillion = 15.0;
      outputPricePerMillion = 75.0;
    } else if (modelLower.includes('haiku')) {
      inputPricePerMillion = 0.25;
      outputPricePerMillion = 1.25;
    } else if (modelLower.includes('sonnet')) {
      inputPricePerMillion = 3.0;
      outputPricePerMillion = 15.0;
    }
  }

  const inputCostDollars = (inputTokens / 1_000_000) * inputPricePerMillion;
  const outputCostDollars = (outputTokens / 1_000_000) * outputPricePerMillion;

  // Return cents (rounded)
  return Math.round((inputCostDollars + outputCostDollars) * 100);
}
