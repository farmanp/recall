/**
 * API Client for Transcript-based Backend
 * Communicates with backend/src/routes/sessions.ts and work-units.ts
 */

import type {
  SessionListResponse,
  SessionDetailsResponse,
  SessionFramesResponse,
  SessionListQuery,
  SessionFramesQuery,
  PlaybackFrame,
  CommentaryResponse,
  SearchResult,
  SearchGlobalRequest,
  SearchGlobalResponse,
} from '../types/transcript';
import type {
  WorkUnit,
  WorkUnitListQuery,
  WorkUnitListResponse,
  WorkUnitDetailsResponse,
  WorkUnitStats,
  RecomputeResponse,
  WorkUnitOverrideRequest,
  WorkUnitOverrideResponse,
} from '../types/work-unit';

const API_BASE_URL = '/api';

/**
 * Fetch all sessions
 */
export async function fetchSessions(query: SessionListQuery = {}): Promise<SessionListResponse> {
  const params = new URLSearchParams();
  if (query.offset !== undefined) params.append('offset', query.offset.toString());
  if (query.limit !== undefined) params.append('limit', query.limit.toString());
  if (query.project) params.append('project', query.project);
  if (query.agent) params.append('agent', query.agent);

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
export async function fetchSessionDetails(sessionId: string): Promise<SessionDetailsResponse> {
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
export async function fetchFrame(sessionId: string, frameId: string): Promise<PlaybackFrame> {
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
export async function fetchSessionCommentary(sessionId: string): Promise<CommentaryResponse> {
  const url = `${API_BASE_URL}/sessions/${sessionId}/commentary`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch commentary for session ${sessionId}: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Global content search
 */
export async function searchGlobal(query: SearchGlobalRequest): Promise<SearchGlobalResponse> {
  const params = new URLSearchParams();
  params.append('q', query.query);
  if (query.offset !== undefined) params.append('offset', query.offset.toString());
  if (query.limit !== undefined) params.append('limit', query.limit.toString());
  if (query.agent) params.append('agent', query.agent);
  if (query.project) params.append('project', query.project);

  const url = `${API_BASE_URL}/sessions/search?${params.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Search failed: ${response.statusText}`);
  }

  return response.json();
}

// ============================================================================
// Work Unit API Functions
// ============================================================================

/**
 * Fetch all work units with pagination and filtering
 */
export async function fetchWorkUnits(query: WorkUnitListQuery = {}): Promise<WorkUnitListResponse> {
  const params = new URLSearchParams();
  if (query.offset !== undefined) params.append('offset', query.offset.toString());
  if (query.limit !== undefined) params.append('limit', query.limit.toString());
  if (query.confidence) params.append('confidence', query.confidence);
  if (query.agent) params.append('agent', query.agent);
  if (query.project) params.append('project', query.project);
  if (query.includeUngrouped) params.append('includeUngrouped', 'true');

  const url = `${API_BASE_URL}/work-units?${params.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch work units: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch work unit statistics
 */
export async function fetchWorkUnitStats(): Promise<WorkUnitStats> {
  const url = `${API_BASE_URL}/work-units/stats`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch work unit stats: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch a single work unit by ID
 */
export async function fetchWorkUnit(workUnitId: string): Promise<WorkUnitDetailsResponse> {
  const url = `${API_BASE_URL}/work-units/${workUnitId}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch work unit ${workUnitId}: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch work unit for a specific session
 */
export async function fetchSessionWorkUnit(
  sessionId: string
): Promise<{ workUnit: WorkUnit } | null> {
  const url = `${API_BASE_URL}/sessions/${sessionId}/work-unit`;
  const response = await fetch(url);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch work unit for session ${sessionId}: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Trigger work unit recomputation
 */
export async function recomputeWorkUnits(force: boolean = false): Promise<RecomputeResponse> {
  const url = `${API_BASE_URL}/work-units/recompute`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ force }),
  });

  if (!response.ok) {
    throw new Error(`Failed to recompute work units: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Update a work unit (add/remove session)
 */
export async function updateWorkUnit(
  workUnitId: string,
  request: WorkUnitOverrideRequest
): Promise<WorkUnitOverrideResponse> {
  const url = `${API_BASE_URL}/work-units/${workUnitId}`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Failed to update work unit: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Delete a work unit
 */
export async function deleteWorkUnit(
  workUnitId: string
): Promise<{ success: boolean; message: string }> {
  const url = `${API_BASE_URL}/work-units/${workUnitId}`;
  const response = await fetch(url, { method: 'DELETE' });

  if (!response.ok) {
    throw new Error(`Failed to delete work unit: ${response.statusText}`);
  }

  return response.json();
}
