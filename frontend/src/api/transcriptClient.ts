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
  SearchResult,
  SearchGlobalRequest,
  SearchGlobalResponse,
} from '../types/transcript';

const API_BASE_URL = '/api';

export interface ShareLinkOptions {
  enableRedaction: boolean;
  expiresIn: '1h' | '24h' | '7d' | 'never';
}

export interface ShareLinkResponse {
  shareId: string;
  url: string;
  expiresAt: string | null;
}

export interface SharedSessionFrame {
  type: string;
  content: unknown;
}

export interface SharedSessionData {
  session: {
    slug: string;
    project: string;
    startedAt: string;
  };
  frames: SharedSessionFrame[];
  expiresAt: string | null;
  redactionEnabled?: boolean;
}

/**
 * Fetch all sessions
 */
export async function fetchSessions(query: SessionListQuery = {}): Promise<SessionListResponse> {
  const params = new URLSearchParams();
  // Default to filesystem source since sessions are indexed from the filesystem
  const source = query.source ?? 'filesystem';
  params.append('source', source);
  if (query.offset !== undefined) params.append('offset', query.offset.toString());
  if (query.limit !== undefined) params.append('limit', query.limit.toString());
  if (query.project) params.append('project', query.project);
  if (query.agent) params.append('agent', query.agent);
  if (query.hasClaudeMd) params.append('hasClaudeMd', 'true');
  if (query.showAll) params.append('showAll', 'true');

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
  // Default to filesystem to support sessions not yet imported to DB
  params.append('source', query.source ?? 'filesystem');
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
 * Create a shareable link for a session
 */
export async function createShareLink(
  sessionId: string,
  options: ShareLinkOptions
): Promise<ShareLinkResponse> {
  const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}/share`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  });

  if (!response.ok) {
    throw new Error('Failed to create share link');
  }

  return response.json();
}

/**
 * Fetch a shared session by share ID
 */
export async function getSharedSession(
  shareId: string,
  token?: string
): Promise<SharedSessionData> {
  const requestUrl = `${API_BASE_URL}/shared/${shareId}`;
  const response = token
    ? await fetch(requestUrl, { headers: { 'X-Share-Token': token } })
    : await fetch(requestUrl);

  if (!response.ok) {
    throw new Error('Share link invalid or expired');
  }

  return response.json();
}

/**
 * Revoke an existing share link
 */
export async function revokeShareLink(shareId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/shares/${shareId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to revoke share link');
  }
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
// Competitive Features API Functions
// ============================================================================

import type {
  GitContext,
  Checkpoint,
  CreateCheckpointRequest,
  RewindPlan,
  RewindOptions,
  RewindResult,
  SessionSummary,
} from '../types/competitive';

// ----------------------------------------------------------------------------
// Phase 1: Git Context API
// ----------------------------------------------------------------------------

/**
 * Fetch git context for a session
 */
export async function fetchSessionGit(sessionId: string): Promise<GitContext> {
  const url = `${API_BASE_URL}/sessions/${sessionId}/git`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch git info: ${response.statusText}`);
  }

  return response.json();
}

// ----------------------------------------------------------------------------
// Phase 2: Checkpoints API
// ----------------------------------------------------------------------------

/**
 * Fetch all checkpoints for a session
 */
export async function fetchCheckpoints(sessionId: string): Promise<Checkpoint[]> {
  const url = `${API_BASE_URL}/sessions/${sessionId}/checkpoints`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch checkpoints: ${response.statusText}`);
  }

  const data = await response.json();
  return data.checkpoints || data;
}

/**
 * Create a new checkpoint for a session
 */
export async function createCheckpoint(
  sessionId: string,
  data: CreateCheckpointRequest
): Promise<Checkpoint> {
  const url = `${API_BASE_URL}/sessions/${sessionId}/checkpoints`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`Failed to create checkpoint: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Delete a checkpoint
 */
export async function deleteCheckpoint(checkpointId: string): Promise<void> {
  const url = `${API_BASE_URL}/checkpoints/${checkpointId}`;
  const response = await fetch(url, { method: 'DELETE' });

  if (!response.ok) {
    throw new Error(`Failed to delete checkpoint: ${response.statusText}`);
  }
}

/**
 * Compare two checkpoints
 */
export async function compareCheckpoints(
  checkpoint1Id: string,
  checkpoint2Id: string
): Promise<{
  checkpoint1: Checkpoint;
  checkpoint2: Checkpoint;
  filesDiff: { added: string[]; removed: string[]; modified: string[] };
}> {
  const url = `${API_BASE_URL}/checkpoints/compare?from=${checkpoint1Id}&to=${checkpoint2Id}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to compare checkpoints: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Export a checkpoint to a named git branch
 */
export async function exportCheckpointToGit(
  checkpointId: string,
  branchName: string
): Promise<{
  success: boolean;
  branchName?: string;
  commitSha?: string;
  message?: string;
  error?: string;
  redactionStats?: {
    totalRedactions: number;
    byPattern: Record<string, number>;
  };
}> {
  const url = `${API_BASE_URL}/checkpoints/${checkpointId}/export`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ branchName }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    return { success: false, error: error.error || error.message || response.statusText };
  }

  return response.json();
}

// ----------------------------------------------------------------------------
// Phase 3: Rewind API
// ----------------------------------------------------------------------------

/**
 * Preview a rewind operation (dry run)
 */
export async function previewRewind(sessionId: string, frameIndex: number): Promise<RewindPlan> {
  const url = `${API_BASE_URL}/sessions/${sessionId}/rewind/preview`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ frameIndex }),
  });

  if (!response.ok) {
    throw new Error(`Failed to preview rewind: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Execute a rewind operation
 */
export async function executeRewind(
  sessionId: string,
  frameIndex: number,
  options: RewindOptions
): Promise<RewindResult> {
  const url = `${API_BASE_URL}/sessions/${sessionId}/rewind/execute`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ frameIndex, ...options }),
  });

  if (!response.ok) {
    throw new Error(`Failed to execute rewind: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Undo a previous rewind operation
 */
export async function undoRewind(rewindId: string): Promise<{
  success: boolean;
  filesRestored: number;
  errors: string[];
}> {
  const url = `${API_BASE_URL}/rewind/${rewindId}/undo`;
  const response = await fetch(url, { method: 'POST' });

  if (!response.ok) {
    throw new Error(`Failed to undo rewind: ${response.statusText}`);
  }

  return response.json();
}

// ----------------------------------------------------------------------------
// Phase 4: Summary API
// ----------------------------------------------------------------------------

/**
 * Fetch session summary (may be cached)
 */
export async function fetchSessionSummary(sessionId: string): Promise<SessionSummary> {
  const url = `${API_BASE_URL}/sessions/${sessionId}/summary`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch summary: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Regenerate session summary (force new generation)
 */
export async function regenerateSummary(sessionId: string): Promise<SessionSummary> {
  const url = `${API_BASE_URL}/sessions/${sessionId}/summary/regenerate`;
  const response = await fetch(url, { method: 'POST' });

  if (!response.ok) {
    throw new Error(`Failed to regenerate summary: ${response.statusText}`);
  }

  return response.json();
}

// ----------------------------------------------------------------------------
// Phase 5: Stats/Overview API
// ----------------------------------------------------------------------------

import type { AgentType } from '../types/transcript';

export interface OverviewStats {
  totalSessions: number;
  thisWeek: number;
  avgDurationMs: number;
  liveCount: number;
  agentBreakdown: Record<AgentType, number>;
  activityByDay: Array<{ date: string; count: number }>;
}

export interface FolderStats {
  folders: Array<{
    path: string;
    name: string;
    sessionCount: number;
    liveCount: number;
    lastActivity: string;
  }>;
  total: number;
}

/**
 * Fetch overview statistics for the dashboard
 */
export async function fetchOverviewStats(): Promise<OverviewStats> {
  const url = `${API_BASE_URL}/stats/overview`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch overview stats: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch folder statistics for project navigation
 */
export async function fetchFolderStats(): Promise<FolderStats> {
  const url = `${API_BASE_URL}/stats/folders`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch folder stats: ${response.statusText}`);
  }

  return response.json();
}

// ----------------------------------------------------------------------------
// Phase 6: Token Usage Stats API
// ----------------------------------------------------------------------------

import type { TokenStatsResponse, FolderTokenStatsResponse } from '../types/tokens';

/**
 * Fetch overall token usage statistics
 */
export async function fetchTokenStats(): Promise<TokenStatsResponse> {
  const url = `${API_BASE_URL}/stats/tokens`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch token stats: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch token usage for a specific folder
 */
export async function fetchFolderTokenStats(folderPath: string): Promise<FolderTokenStatsResponse> {
  const url = `${API_BASE_URL}/stats/tokens/folder?path=${encodeURIComponent(folderPath)}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch folder token stats: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch sessions with highest token usage
 */
export async function fetchTopTokenSessions(
  limit: number = 10
): Promise<{ sessions: Array<import('../types/tokens').SessionTokenUsage> }> {
  const url = `${API_BASE_URL}/stats/tokens/top?limit=${limit}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch top token sessions: ${response.statusText}`);
  }

  return response.json();
}
