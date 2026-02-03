/**
 * Shared types for Claude Code Session Replay
 * These types are used by both frontend and backend
 */

/**
 * Database entity types
 */
export interface Session {
  id: number;
  claude_session_id: string;
  sdk_session_id: string;
  project: string;
  user_prompt: string | null;
  started_at: string;
  started_at_epoch: number;
  completed_at: string | null;
  completed_at_epoch: number | null;
  status: 'active' | 'completed' | 'failed';
  prompt_counter: number;
}

export interface Observation {
  id: number;
  sdk_session_id: string;
  project: string;
  type: 'decision' | 'bugfix' | 'feature' | 'refactor' | 'discovery' | 'change';
  title: string;
  subtitle: string;
  text: string;
  facts: string;           // JSON array
  narrative: string;
  concepts: string;        // JSON array
  files_read: string;      // JSON array
  files_modified: string;  // JSON array
  prompt_number: number | null;
  created_at: string;
  created_at_epoch: number;
  discovery_tokens: number;
}

export interface UserPrompt {
  id: number;
  claude_session_id: string;
  prompt_number: number;
  prompt_text: string;
  created_at: string;
  created_at_epoch: number;
}

/**
 * Combined timeline event for playback
 */
export interface SessionEvent {
  event_type: 'prompt' | 'observation';
  row_id: number;
  prompt_number: number | null;
  ts: number;              // created_at_epoch
  text: string;
  kind_rank: number;
  // If observation, include additional fields:
  obs_type?: Observation['type'];
  title?: string;
  subtitle?: string;
  facts?: string[];
  narrative?: string;
  concepts?: string[];
  files_read?: string[];
  files_modified?: string[];
}

/**
 * API Response types
 */
export interface SessionListResponse {
  sessions: Session[];
  total: number;
  offset: number;
  limit: number;
}

export interface SessionDetailsResponse {
  session: Session;
  eventCount: number;
  promptCount: number;
  observationCount: number;
}

export interface SessionEventsResponse {
  events: SessionEvent[];
  total: number;
  offset: number;
  limit: number;
  sessionId: string;
}

export interface HealthCheckResponse {
  status: 'ok' | 'error';
  timestamp: number;
  database?: 'connected' | 'disconnected';
}

/**
 * API Query parameters
 */
export interface SessionListQuery {
  offset?: number;
  limit?: number;
  project?: string;
  dateStart?: string;
  dateEnd?: string;
}

export interface SessionEventsQuery {
  offset?: number;
  limit?: number;
  types?: string; // Comma-separated observation types
  afterTs?: number;
}

/**
 * API Error types
 */
export interface ApiError {
  error: string;
  message?: string;
  statusCode?: number;
}

/**
 * Frontend-specific types
 */
export type EventType = 'prompt' | 'observation';
export type ObservationType = Observation['type'];
export type SessionStatus = Session['status'];
