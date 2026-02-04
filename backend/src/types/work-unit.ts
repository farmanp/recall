/**
 * TypeScript interfaces for Work Units - Cross-Agent Session Stitching
 *
 * Work Units group related sessions across Claude, Codex, and Gemini
 * when they appear to be working on the same project/task.
 */

import type { AgentType } from './transcript';

/**
 * Confidence levels for work unit groupings
 * - high: Same project + file overlap >= 30%
 * - medium: Same project + low file overlap
 * - low: CWD/time proximity only
 */
export type WorkUnitConfidence = 'high' | 'medium' | 'low';

/**
 * Reasons why sessions were correlated into a work unit
 */
export type CorrelationReason =
  | 'project_path_match' // Sessions share the same project path
  | 'file_overlap' // Sessions touched overlapping files
  | 'time_proximity' // Sessions occurred within 4-hour window
  | 'cwd_match' // Sessions share working directory prefix
  | 'manual_override'; // User manually added session to work unit

/**
 * Work Unit - a group of related sessions across agents
 */
export interface WorkUnit {
  id: string; // UUID for the work unit
  name: string; // From project name or first prompt
  projectPath: string; // Normalized project path
  sessions: WorkUnitSession[]; // Chronologically ordered sessions
  agents: AgentType[]; // Unique agents involved
  confidence: WorkUnitConfidence;
  startTime: string; // ISO 8601 timestamp
  endTime: string; // ISO 8601 timestamp
  totalDuration: number; // Total duration in seconds
  totalFrames: number; // Total frames across all sessions
  filesTouched: string[]; // Unique files touched across sessions
  createdAt: string; // ISO 8601 timestamp
  updatedAt: string; // ISO 8601 timestamp
}

/**
 * Session within a work unit
 */
export interface WorkUnitSession {
  sessionId: string;
  agent: AgentType;
  model?: string; // e.g., "claude-opus-4", "gpt-4", "gemini-pro"
  correlationScore: number; // 0-1, how strongly correlated
  joinReason: CorrelationReason[]; // Why this session was included
  startTime: string; // ISO 8601 timestamp
  endTime?: string; // ISO 8601 timestamp
  duration?: number; // Duration in seconds
  frameCount: number;
  firstUserMessage?: string; // Preview text
}

/**
 * Correlation data extracted from a session for grouping
 */
export interface SessionCorrelationData {
  sessionId: string;
  agent: AgentType;
  model?: string;
  projectPath: string; // Normalized project path
  cwd: string; // Working directory
  filesRead: string[]; // Files read during session
  filesModified: string[]; // Files modified during session
  startTime: number; // Epoch ms
  endTime?: number; // Epoch ms
  duration?: number; // Seconds
  frameCount: number;
  firstUserMessage?: string;
}

/**
 * Correlation weights for different signals
 */
export const CORRELATION_WEIGHTS = {
  PROJECT_PATH: 0.5, // Strongest signal
  FILE_OVERLAP: 0.3, // Second strongest
  TIME_PROXIMITY: 0.15, // Supporting signal
  CWD_MATCH: 0.05, // Weakest signal
} as const;

/**
 * Configuration for correlation algorithm
 */
export interface CorrelationConfig {
  /** Maximum time gap (hours) between sessions to consider as same work unit */
  timeWindowHours: number;
  /** Minimum Jaccard similarity for file overlap to count */
  minFileOverlap: number;
  /** Minimum score to include session in work unit */
  minCorrelationScore: number;
  /** Threshold for high confidence */
  highConfidenceThreshold: number;
  /** Threshold for medium confidence */
  mediumConfidenceThreshold: number;
}

/**
 * Default correlation configuration
 */
export const DEFAULT_CORRELATION_CONFIG: CorrelationConfig = {
  timeWindowHours: 4,
  minFileOverlap: 0.1, // 10% overlap
  minCorrelationScore: 0.3,
  highConfidenceThreshold: 0.7,
  mediumConfidenceThreshold: 0.4,
};

/**
 * Work Unit List Query Parameters
 */
export interface WorkUnitListQuery {
  offset?: number;
  limit?: number;
  confidence?: WorkUnitConfidence;
  agent?: AgentType;
  project?: string;
  includeUngrouped?: boolean; // Include sessions not in any work unit
}

/**
 * Work Unit List Response
 */
export interface WorkUnitListResponse {
  workUnits: WorkUnit[];
  total: number;
  offset: number;
  limit: number;
  ungroupedCount?: number; // Sessions not in any work unit
}

/**
 * Work Unit Details Response
 */
export interface WorkUnitDetailsResponse {
  workUnit: WorkUnit;
  sessions: WorkUnitSession[];
}

/**
 * Recompute Request
 */
export interface RecomputeRequest {
  force?: boolean; // Force recompute even if recent
  sessionIds?: string[]; // Only recompute for specific sessions
}

/**
 * Recompute Response
 */
export interface RecomputeResponse {
  success: boolean;
  workUnitsCreated: number;
  workUnitsUpdated: number;
  sessionsProcessed: number;
  duration: number; // Processing time in ms
}

/**
 * Manual Override Request - Add/Remove session from work unit
 */
export interface WorkUnitOverrideRequest {
  action: 'add' | 'remove';
  sessionId: string;
  workUnitId?: string; // Target work unit (for add)
}

/**
 * Manual Override Response
 */
export interface WorkUnitOverrideResponse {
  success: boolean;
  workUnit?: WorkUnit;
  message: string;
}
