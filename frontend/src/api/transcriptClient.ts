/**
 * API Client for Transcript-based Backend
 * Communicates with backend/src/routes/sessions.ts
 */

import type {
  SessionListResponse,
  SessionDetailsResponse,
  SessionFramesResponse,
  SessionListQuery,
  SessionFramesQuery,
  PlaybackFrame,
  CommentaryResponse,
} from '../types/transcript';

const API_BASE_URL = '/api';

/**
 * Fetch all sessions
 */
export async function fetchSessions(
  query: SessionListQuery = {}
): Promise<SessionListResponse> {
  const params = new URLSearchParams();
  if (query.offset !== undefined) params.append('offset', query.offset.toString());
  if (query.limit !== undefined) params.append('limit', query.limit.toString());
  if (query.project) params.append('project', query.project);

  const url = `${API_BASE_URL}/sessions?${params.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch sessions: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch session timeline metadata (without frames)
 */
export async function fetchSessionDetails(
  sessionId: string
): Promise<SessionDetailsResponse> {
  const url = `${API_BASE_URL}/sessions/${sessionId}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch session ${sessionId}: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch playback frames for a session
 */
export async function fetchSessionFrames(
  sessionId: string,
  query: SessionFramesQuery = {}
): Promise<SessionFramesResponse> {
  const params = new URLSearchParams();
  if (query.offset !== undefined) params.append('offset', query.offset.toString());
  if (query.limit !== undefined) params.append('limit', query.limit.toString());

  const url = `${API_BASE_URL}/sessions/${sessionId}/frames?${params.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch frames for session ${sessionId}: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch a single frame by ID
 */
export async function fetchFrame(
  sessionId: string,
  frameId: string
): Promise<PlaybackFrame> {
  const url = `${API_BASE_URL}/sessions/${sessionId}/frames/${frameId}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch frame ${frameId}: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Refresh session timeline cache
 */
export async function refreshSession(sessionId: string): Promise<{
  success: boolean;
  message: string;
  totalFrames: number;
}> {
  const url = `${API_BASE_URL}/sessions/${sessionId}/refresh`;
  const response = await fetch(url, { method: 'POST' });

  if (!response.ok) {
    throw new Error(`Failed to refresh session ${sessionId}: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch commentary observations from claude-mem for a session
 */
export async function fetchSessionCommentary(
  sessionId: string
): Promise<CommentaryResponse> {
  const url = `${API_BASE_URL}/sessions/${sessionId}/commentary`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch commentary for session ${sessionId}: ${response.statusText}`);
  }

  return response.json();
}
