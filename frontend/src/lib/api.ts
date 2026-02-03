/**
 * API Client
 *
 * Fetch functions for backend API
 */

import type {
  SessionListResponse,
  SessionDetailsResponse,
  SessionEventsResponse,
  SessionListQuery,
  SessionEventsQuery,
} from '@/types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

/**
 * Fetch sessions list
 */
export async function fetchSessions(query: SessionListQuery = {}): Promise<SessionListResponse> {
  const params = new URLSearchParams();

  if (query.offset !== undefined) params.set('offset', query.offset.toString());
  if (query.limit !== undefined) params.set('limit', query.limit.toString());
  if (query.project) params.set('project', query.project);
  if (query.dateStart) params.set('dateStart', query.dateStart);
  if (query.dateEnd) params.set('dateEnd', query.dateEnd);

  const url = `${API_BASE_URL}/api/sessions?${params.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch sessions: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch session details
 */
export async function fetchSessionDetails(sessionId: string): Promise<SessionDetailsResponse> {
  const url = `${API_BASE_URL}/api/sessions/${sessionId}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch session details: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch session events
 */
export async function fetchSessionEvents(
  sessionId: string,
  query: SessionEventsQuery = {}
): Promise<SessionEventsResponse> {
  const params = new URLSearchParams();

  if (query.offset !== undefined) params.set('offset', query.offset.toString());
  if (query.limit !== undefined) params.set('limit', query.limit.toString());
  if (query.types) params.set('types', query.types);
  if (query.afterTs !== undefined) params.set('afterTs', query.afterTs.toString());

  const url = `${API_BASE_URL}/api/sessions/${sessionId}/events?${params.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch session events: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Health check
 */
export async function healthCheck(): Promise<{ status: string; timestamp: string }> {
  const url = `${API_BASE_URL}/api/health`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Health check failed: ${response.statusText}`);
  }

  return response.json();
}
