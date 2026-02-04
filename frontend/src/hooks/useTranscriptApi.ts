/**
 * React Query hooks for transcript-based API
 */

import { useQuery } from '@tanstack/react-query';
import type { SessionListQuery, SessionFramesQuery, SearchGlobalRequest } from '../types/transcript';
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
export function useSessionFrames(
  sessionId: string | undefined,
  query: SessionFramesQuery = {}
) {
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
