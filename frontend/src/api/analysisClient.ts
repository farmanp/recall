/**
 * API Client for Drift Analysis
 *
 * Communicates with backend/src/routes/analysis.ts
 *
 * @module api/analysisClient
 */

import type {
  DriftAnalysisResult,
  ImpactSummaryResponse,
  BaselinesListResponse,
  BaselineComputeResponse,
  DriftStatsResponse,
} from '../types/analysis';

const API_BASE_URL = '/api';

// ============================================================================
// Session Analysis
// ============================================================================

/**
 * Fetch drift analysis for a session
 *
 * Returns cached analysis if available, computes on-demand if not.
 *
 * @param sessionId - Session UUID
 * @param options - Optional parameters
 * @param options.refresh - Force re-analysis (default: false)
 * @param options.source - Data source ('db' or 'filesystem', default: 'db')
 * @returns DriftAnalysisResult
 *
 * @example
 * const analysis = await fetchAnalysis('4b198fdf-b80d-4bbc-806f-2900282cdc56');
 * console.log(analysis.impact.scope); // 'moderate'
 * console.log(analysis.findings.length); // 3
 */
export async function fetchAnalysis(
  sessionId: string,
  options: { refresh?: boolean; source?: 'db' | 'filesystem' } = {}
): Promise<DriftAnalysisResult> {
  const params = new URLSearchParams();

  if (options.refresh) {
    params.append('refresh', 'true');
  }
  // Default to filesystem to match session player behavior
  params.append('source', options.source ?? 'filesystem');

  const queryString = params.toString();
  const url = `${API_BASE_URL}/sessions/${encodeURIComponent(sessionId)}/analysis${
    queryString ? `?${queryString}` : ''
  }`;

  const response = await fetch(url);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    if (response.status === 404) {
      throw new Error('Session not found. Try re-importing the session or refreshing the page.');
    }
    throw new Error(error.error || error.message || `Analysis failed (${response.status})`);
  }

  return response.json();
}

/**
 * Fetch just the impact summary (lightweight)
 *
 * @param sessionId - Session UUID
 * @returns ImpactSummaryResponse
 *
 * @example
 * const { impact } = await fetchImpactSummary('4b198fdf-b80d-4bbc-806f-2900282cdc56');
 * console.log(impact.filesAffected); // 12
 */
export async function fetchImpactSummary(sessionId: string): Promise<ImpactSummaryResponse> {
  const url = `${API_BASE_URL}/sessions/${encodeURIComponent(sessionId)}/analysis/impact`;

  const response = await fetch(url);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Failed to fetch impact summary: ${response.status}`);
  }

  return response.json();
}

/**
 * Delete cached analysis for a session
 *
 * @param sessionId - Session UUID
 * @returns Success indicator
 */
export async function deleteAnalysis(
  sessionId: string
): Promise<{ success: boolean; message: string }> {
  const url = `${API_BASE_URL}/sessions/${encodeURIComponent(sessionId)}/analysis`;

  const response = await fetch(url, { method: 'DELETE' });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Failed to delete analysis: ${response.status}`);
  }

  return response.json();
}

// ============================================================================
// Baselines
// ============================================================================

/**
 * List all computed baselines
 *
 * @returns BaselinesListResponse
 *
 * @example
 * const { baselines } = await fetchBaselines();
 * console.log(baselines[0].repoPath); // '/Users/me/project'
 */
export async function fetchBaselines(): Promise<BaselinesListResponse> {
  const url = `${API_BASE_URL}/analysis/baselines`;

  const response = await fetch(url);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Failed to fetch baselines: ${response.status}`);
  }

  return response.json();
}

/**
 * Trigger baseline computation for a repo
 *
 * @param repoPath - Repository root path
 * @param options - Optional parameters
 * @param options.language - Language to analyze (default: 'typescript')
 * @param options.topLevelDir - Scope (default: '*')
 * @param options.forceRefresh - Force re-computation (default: false)
 * @returns BaselineComputeResponse
 *
 * @example
 * const result = await computeBaseline('/Users/me/project');
 * console.log(result.baselineId); // 1
 */
export async function computeBaseline(
  repoPath: string,
  options: {
    language?: string;
    topLevelDir?: string;
    forceRefresh?: boolean;
  } = {}
): Promise<BaselineComputeResponse> {
  const url = `${API_BASE_URL}/analysis/baselines`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      repoPath,
      language: options.language || 'typescript',
      topLevelDir: options.topLevelDir || '*',
      forceRefresh: options.forceRefresh || false,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Failed to compute baseline: ${response.status}`);
  }

  return response.json();
}

/**
 * Delete a baseline
 *
 * @param id - Baseline ID
 * @returns Success indicator
 */
export async function deleteBaseline(id: number): Promise<{ success: boolean; message: string }> {
  const url = `${API_BASE_URL}/analysis/baselines/${id}`;

  const response = await fetch(url, { method: 'DELETE' });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Failed to delete baseline: ${response.status}`);
  }

  return response.json();
}

// ============================================================================
// Statistics
// ============================================================================

/**
 * Fetch drift analysis statistics
 *
 * @returns DriftStatsResponse
 *
 * @example
 * const stats = await fetchDriftStats();
 * console.log(stats.totalFindings); // 42
 */
export async function fetchDriftStats(): Promise<DriftStatsResponse> {
  const url = `${API_BASE_URL}/analysis/stats`;

  const response = await fetch(url);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Failed to fetch statistics: ${response.status}`);
  }

  return response.json();
}
