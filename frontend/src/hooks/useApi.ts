/**
 * React Query hooks for Recall API
 */

import { useQuery, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import { apiClient, ApiClientError } from '../api/client';
import type {
  SessionListResponse,
  SessionDetailsResponse,
  SessionEventsResponse,
  HealthCheckResponse,
  SessionListQuery,
  SessionEventsQuery,
  SessionEvent,
  Observation,
  UserPrompt,
} from '../../../shared/types';

/**
 * Query keys for React Query cache management
 */
export const queryKeys = {
  health: ['health'] as const,
  sessions: (query?: SessionListQuery) => ['sessions', query] as const,
  session: (id: string | number) => ['sessions', id] as const,
  sessionEvents: (id: string | number, query?: SessionEventsQuery) =>
    ['sessions', id, 'events', query] as const,
  event: (
    sessionId: string | number,
    eventType: 'prompt' | 'observation',
    eventId: string | number
  ) => ['sessions', sessionId, 'events', eventType, eventId] as const,
};

/**
 * Hook for health check endpoint
 * GET /api/health
 */
export function useHealthCheck(
  options?: Omit<UseQueryOptions<HealthCheckResponse, ApiClientError>, 'queryKey' | 'queryFn'>
): UseQueryResult<HealthCheckResponse, ApiClientError> {
  return useQuery<HealthCheckResponse, ApiClientError>({
    queryKey: queryKeys.health,
    queryFn: () => apiClient.healthCheck(),
    ...options,
  });
}

/**
 * Hook for listing sessions with optional filtering
 * GET /api/sessions?offset=0&limit=20&project=...&dateStart=...&dateEnd=...
 */
export function useSessions(
  query?: SessionListQuery,
  options?: Omit<UseQueryOptions<SessionListResponse, ApiClientError>, 'queryKey' | 'queryFn'>
): UseQueryResult<SessionListResponse, ApiClientError> {
  return useQuery<SessionListResponse, ApiClientError>({
    queryKey: queryKeys.sessions(query),
    queryFn: () => apiClient.listSessions(query),
    ...options,
  });
}

/**
 * Hook for getting session details by ID
 * GET /api/sessions/:id
 */
export function useSession(
  id: string | number | undefined,
  options?: Omit<UseQueryOptions<SessionDetailsResponse, ApiClientError>, 'queryKey' | 'queryFn'>
): UseQueryResult<SessionDetailsResponse, ApiClientError> {
  return useQuery<SessionDetailsResponse, ApiClientError>({
    queryKey: queryKeys.session(id!),
    queryFn: () => apiClient.getSession(id!),
    enabled: id !== undefined,
    ...options,
  });
}

/**
 * Hook for getting session events with optional filtering
 * GET /api/sessions/:id/events?offset=0&limit=100&types=...&afterTs=...
 */
export function useSessionEvents(
  id: string | number | undefined,
  query?: SessionEventsQuery,
  options?: Omit<UseQueryOptions<SessionEventsResponse, ApiClientError>, 'queryKey' | 'queryFn'>
): UseQueryResult<SessionEventsResponse, ApiClientError> {
  return useQuery<SessionEventsResponse, ApiClientError>({
    queryKey: queryKeys.sessionEvents(id!, query),
    queryFn: () => apiClient.getSessionEvents(id!, query),
    enabled: id !== undefined,
    ...options,
  });
}

/**
 * Hook for getting a specific event by type and ID
 * GET /api/sessions/:sessionId/events/:eventType/:eventId
 */
export function useEvent(
  sessionId: string | number | undefined,
  eventType: 'prompt' | 'observation' | undefined,
  eventId: string | number | undefined,
  options?: Omit<
    UseQueryOptions<SessionEvent | Observation | UserPrompt, ApiClientError>,
    'queryKey' | 'queryFn'
  >
): UseQueryResult<SessionEvent | Observation | UserPrompt, ApiClientError> {
  return useQuery<SessionEvent | Observation | UserPrompt, ApiClientError>({
    queryKey: queryKeys.event(sessionId!, eventType!, eventId!),
    queryFn: () => apiClient.getEvent(sessionId!, eventType!, eventId!),
    enabled: sessionId !== undefined && eventType !== undefined && eventId !== undefined,
    ...options,
  });
}

/**
 * Helper hook for getting all sessions (pagination helper)
 */
export function useAllSessions(
  project?: string,
  options?: Omit<UseQueryOptions<SessionListResponse, ApiClientError>, 'queryKey' | 'queryFn'>
) {
  return useSessions({ offset: 0, limit: 100, project }, options);
}

/**
 * Helper hook for getting all events for a session (pagination helper)
 */
export function useAllSessionEvents(
  id: string | number | undefined,
  types?: string,
  options?: Omit<UseQueryOptions<SessionEventsResponse, ApiClientError>, 'queryKey' | 'queryFn'>
) {
  return useSessionEvents(id, { offset: 0, limit: 1000, types }, options);
}

/**
 * Hook for getting session with auto-refetch while active
 */
export function useLiveSession(id: string | number | undefined, refetchInterval: number = 5000) {
  return useSession(id, {
    refetchInterval: (query) => {
      // Only refetch if session is active
      if (query.state.data?.session.status === 'active') {
        return refetchInterval;
      }
      return false;
    },
  });
}

/**
 * Hook for getting events with auto-refetch for active sessions
 */
export function useLiveSessionEvents(
  id: string | number | undefined,
  query?: SessionEventsQuery,
  refetchInterval: number = 5000
) {
  return useSessionEvents(id, query, {
    refetchInterval,
  });
}
