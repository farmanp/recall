/**
 * TypeScript interfaces for Work Units
 * Matches backend/src/types/work-unit.ts
 */

import type { AgentType } from './transcript';

/**
 * Confidence levels for work unit groupings
 */
export type WorkUnitConfidence = 'high' | 'medium' | 'low';

/**
 * Reasons why sessions were correlated into a work unit
 */
export type CorrelationReason =
  | 'project_path_match'
  | 'file_overlap'
  | 'time_proximity'
  | 'cwd_match'
  | 'manual_override';

/**
 * Work Unit - a group of related sessions across agents
 */
export interface WorkUnit {
  id: string;
  name: string;
  projectPath: string;
  sessions: WorkUnitSession[];
  agents: AgentType[];
  confidence: WorkUnitConfidence;
  startTime: string;
  endTime: string;
  totalDuration: number;
  totalFrames: number;
  filesTouched: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Session within a work unit
 */
export interface WorkUnitSession {
  sessionId: string;
  agent: AgentType;
  model?: string;
  correlationScore: number;
  joinReason: CorrelationReason[];
  startTime: string;
  endTime?: string;
  duration?: number;
  frameCount: number;
  firstUserMessage?: string;
}

/**
 * Work Unit List Query Parameters
 */
export interface WorkUnitListQuery {
  offset?: number;
  limit?: number;
  confidence?: WorkUnitConfidence;
  agent?: AgentType;
  project?: string;
  includeUngrouped?: boolean;
}

/**
 * Work Unit List Response
 */
export interface WorkUnitListResponse {
  workUnits: WorkUnit[];
  total: number;
  offset: number;
  limit: number;
  ungroupedCount?: number;
}

/**
 * Work Unit Details Response
 */
export interface WorkUnitDetailsResponse {
  workUnit: WorkUnit;
  sessions: WorkUnitSession[];
}

/**
 * Work Unit Statistics
 */
export interface WorkUnitStats {
  total: number;
  byConfidence: Record<WorkUnitConfidence, number>;
  byAgent: Record<string, number>;
  ungroupedSessions: number;
}

/**
 * Recompute Response
 */
export interface RecomputeResponse {
  success: boolean;
  workUnitsCreated: number;
  workUnitsUpdated: number;
  sessionsProcessed: number;
  duration: number;
}

/**
 * Work Unit Override Request
 */
export interface WorkUnitOverrideRequest {
  action: 'add' | 'remove';
  sessionId: string;
}

/**
 * Work Unit Override Response
 */
export interface WorkUnitOverrideResponse {
  success: boolean;
  workUnit?: WorkUnit;
  message: string;
}
