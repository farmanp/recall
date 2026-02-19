/**
 * React Query hooks for transcript-based API
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  SessionListQuery,
  SessionFramesQuery,
  SearchGlobalRequest,
} from '../types/transcript';
import type { CreateCheckpointRequest, RewindOptions } from '../types/competitive';
import * as api from '../api/transcriptClient';

/**
 * Fetch all sessions
 */
export function useSessions(query: SessionListQuery = {}) {
  return useQuery({
    queryKey: ['sessions', query],
    queryFn: () => api.fetchSessions(query),
  });
}

/**
 * Fetch session details
 */
export function useSessionDetails(sessionId: string | undefined) {
  return useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => api.fetchSessionDetails(sessionId!),
    enabled: !!sessionId,
  });
}

/**
 * Fetch session frames (playback data)
 */
export function useSessionFrames(sessionId: string | undefined, query: SessionFramesQuery = {}) {
  return useQuery({
    queryKey: ['session-frames', sessionId, query],
    queryFn: () => api.fetchSessionFrames(sessionId!, query),
    enabled: !!sessionId,
  });
}

/**
 * Fetch a single frame
 */
export function useFrame(sessionId: string | undefined, frameId: string | undefined) {
  return useQuery({
    queryKey: ['frame', sessionId, frameId],
    queryFn: () => api.fetchFrame(sessionId!, frameId!),
    enabled: !!sessionId && !!frameId,
  });
}

/**
 * Fetch commentary observations from claude-mem for a session
 */
export function useSessionCommentary(sessionId: string | undefined) {
  return useQuery({
    queryKey: ['session-commentary', sessionId],
    queryFn: () => api.fetchSessionCommentary(sessionId!),
    enabled: !!sessionId,
    // Don't throw on error - commentary is optional
    retry: false,
  });
}

/**
 * Global content search
 */
export function useGlobalSearch(query: SearchGlobalRequest) {
  return useQuery({
    queryKey: ['global-search', query],
    queryFn: () => api.searchGlobal(query),
    enabled: !!query.query && query.query.length > 2,
    placeholderData: (previousData) => previousData,
  });
}

// ============================================================================
// Competitive Features Hooks
// ============================================================================

// ----------------------------------------------------------------------------
// Phase 1: Git Context Hooks
// ----------------------------------------------------------------------------

/**
 * Fetch git context for a session
 */
export function useSessionGit(sessionId: string | undefined) {
  return useQuery({
    queryKey: ['session-git', sessionId],
    queryFn: () => api.fetchSessionGit(sessionId!),
    enabled: !!sessionId,
    retry: false, // Git info may not be available for all sessions
    staleTime: 30000, // Cache for 30 seconds
  });
}

// ----------------------------------------------------------------------------
// Phase 2: Checkpoint Hooks
// ----------------------------------------------------------------------------

/**
 * Fetch all checkpoints for a session
 */
export function useCheckpoints(sessionId: string | undefined) {
  return useQuery({
    queryKey: ['checkpoints', sessionId],
    queryFn: () => api.fetchCheckpoints(sessionId!),
    enabled: !!sessionId,
  });
}

/**
 * Create a new checkpoint
 */
export function useCreateCheckpoint(sessionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCheckpointRequest) => api.createCheckpoint(sessionId, data),
    onSuccess: () => {
      // Invalidate checkpoints list to refetch
      queryClient.invalidateQueries({ queryKey: ['checkpoints', sessionId] });
    },
  });
}

/**
 * Delete a checkpoint
 */
export function useDeleteCheckpoint(sessionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (checkpointId: string) => api.deleteCheckpoint(checkpointId),
    onSuccess: () => {
      // Invalidate checkpoints list to refetch
      queryClient.invalidateQueries({ queryKey: ['checkpoints', sessionId] });
    },
  });
}

/**
 * Compare two checkpoints
 */
export function useCompareCheckpoints() {
  return useMutation({
    mutationFn: ({
      checkpoint1Id,
      checkpoint2Id,
    }: {
      checkpoint1Id: string;
      checkpoint2Id: string;
    }) => api.compareCheckpoints(checkpoint1Id, checkpoint2Id),
  });
}

// ----------------------------------------------------------------------------
// Phase 3: Rewind Hooks
// ----------------------------------------------------------------------------

/**
 * Preview a rewind operation
 */
export function useRewindPreview(sessionId: string | undefined) {
  return useMutation({
    mutationFn: (frameIndex: number) => api.previewRewind(sessionId!, frameIndex),
  });
}

/**
 * Execute a rewind operation
 */
export function useExecuteRewind(sessionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ frameIndex, options }: { frameIndex: number; options: RewindOptions }) =>
      api.executeRewind(sessionId, frameIndex, options),
    onSuccess: () => {
      // Invalidate session data as files may have changed
      queryClient.invalidateQueries({ queryKey: ['session', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['session-frames', sessionId] });
    },
  });
}

/**
 * Undo a previous rewind
 */
export function useUndoRewind() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (rewindId: string) => api.undoRewind(rewindId),
    onSuccess: () => {
      // Invalidate all session queries as we don't know which session was affected
      queryClient.invalidateQueries({ queryKey: ['session'] });
      queryClient.invalidateQueries({ queryKey: ['session-frames'] });
    },
  });
}

// ----------------------------------------------------------------------------
// Phase 4: Summary Hooks
// ----------------------------------------------------------------------------

/**
 * Fetch session summary
 */
export function useSessionSummary(sessionId: string | undefined) {
  return useQuery({
    queryKey: ['session-summary', sessionId],
    queryFn: () => api.fetchSessionSummary(sessionId!),
    enabled: !!sessionId,
    retry: false, // Summary may not exist yet
    staleTime: 60000, // Cache for 1 minute
  });
}

/**
 * Regenerate session summary
 */
export function useRegenerateSummary(sessionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.regenerateSummary(sessionId),
    onSuccess: (data) => {
      // Update the cached summary
      queryClient.setQueryData(['session-summary', sessionId], data);
    },
  });
}

// ----------------------------------------------------------------------------
// Phase 5: Overview Stats Hooks
// ----------------------------------------------------------------------------

/**
 * Fetch overview statistics for the dashboard
 */
export function useOverviewStats() {
  return useQuery({
    queryKey: ['overview-stats'],
    queryFn: () => api.fetchOverviewStats(),
    staleTime: 30000, // Cache for 30 seconds
    refetchInterval: 60000, // Refetch every minute
  });
}

/**
 * Fetch folder statistics for project navigation
 */
export function useFolderStats() {
  return useQuery({
    queryKey: ['folder-stats'],
    queryFn: () => api.fetchFolderStats(),
    staleTime: 30000,
  });
}
