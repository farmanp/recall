/**
 * React Query hooks for drift analysis API
 *
 * @module hooks/useAnalysis
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../api/analysisClient';
import type {
  DriftAnalysisResult,
  ImpactSummary,
  BaselineSummary,
  DriftStatsResponse,
} from '../types/analysis';

// ============================================================================
// Session Analysis Hooks
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
 * @returns React Query result with DriftAnalysisResult
 *
 * @example
 * const { data: analysis, isLoading, error } = useAnalysis(sessionId);
 * if (analysis) {
 *   console.log(analysis.impact.scope); // 'moderate'
 * }
 */
export function useAnalysis(
  sessionId: string | undefined,
  options: { refresh?: boolean; source?: 'db' | 'filesystem'; enabled?: boolean } = {}
) {
  const { enabled = true, ...queryOptions } = options;
  return useQuery<DriftAnalysisResult>({
    queryKey: ['session-analysis', sessionId, queryOptions],
    queryFn: () => api.fetchAnalysis(sessionId!, queryOptions),
    enabled: !!sessionId && enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes - analysis is expensive to compute
    gcTime: 30 * 60 * 1000, // 30 minutes cache
  });
}

/**
 * Fetch just the impact summary (lightweight)
 *
 * @param sessionId - Session UUID
 * @returns React Query result with ImpactSummary
 *
 * @example
 * const { data } = useImpactSummary(sessionId);
 * if (data) {
 *   console.log(data.impact.filesAffected); // 12
 * }
 */
export function useImpactSummary(sessionId: string | undefined) {
  return useQuery<{ impact: ImpactSummary; cached: boolean }>({
    queryKey: ['session-impact', sessionId],
    queryFn: () => api.fetchImpactSummary(sessionId!),
    enabled: !!sessionId,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

/**
 * Mutation to refresh analysis
 *
 * @returns Mutation function and state
 *
 * @example
 * const { mutate: refreshAnalysis } = useRefreshAnalysis();
 * refreshAnalysis(sessionId);
 */
export function useRefreshAnalysis() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sessionId: string) => api.fetchAnalysis(sessionId, { refresh: true }),
    onSuccess: (data, sessionId) => {
      // Update cache with new data
      queryClient.setQueryData(['session-analysis', sessionId, {}], data);
      queryClient.setQueryData(['session-impact', sessionId], {
        impact: data.impact,
        cached: false,
      });
    },
  });
}

/**
 * Mutation to delete cached analysis
 *
 * @returns Mutation function and state
 */
export function useDeleteAnalysis() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sessionId: string) => api.deleteAnalysis(sessionId),
    onSuccess: (_, sessionId) => {
      // Invalidate cache
      queryClient.invalidateQueries({ queryKey: ['session-analysis', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['session-impact', sessionId] });
    },
  });
}

// ============================================================================
// Baseline Hooks
// ============================================================================

/**
 * Fetch all computed baselines
 *
 * @returns React Query result with baselines list
 *
 * @example
 * const { data } = useBaselines();
 * if (data) {
 *   console.log(data.baselines.length);
 * }
 */
export function useBaselines() {
  return useQuery<{ baselines: BaselineSummary[] }>({
    queryKey: ['analysis-baselines'],
    queryFn: () => api.fetchBaselines(),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Mutation to compute a baseline
 *
 * @returns Mutation function and state
 *
 * @example
 * const { mutate: computeBaseline } = useComputeBaseline();
 * computeBaseline({ repoPath: '/Users/me/project' });
 */
export function useComputeBaseline() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      repoPath,
      language,
      topLevelDir,
      forceRefresh,
    }: {
      repoPath: string;
      language?: string;
      topLevelDir?: string;
      forceRefresh?: boolean;
    }) => api.computeBaseline(repoPath, { language, topLevelDir, forceRefresh }),
    onSuccess: () => {
      // Invalidate baselines list
      queryClient.invalidateQueries({ queryKey: ['analysis-baselines'] });
    },
  });
}

/**
 * Mutation to delete a baseline
 *
 * @returns Mutation function and state
 */
export function useDeleteBaseline() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => api.deleteBaseline(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analysis-baselines'] });
    },
  });
}

// ============================================================================
// Statistics Hooks
// ============================================================================

/**
 * Fetch drift analysis statistics
 *
 * @returns React Query result with statistics
 */
export function useDriftStats() {
  return useQuery<DriftStatsResponse>({
    queryKey: ['analysis-stats'],
    queryFn: () => api.fetchDriftStats(),
    staleTime: 60 * 1000, // 1 minute
  });
}
