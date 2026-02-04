/**
 * Database queries for Work Units
 *
 * Handles persistence and retrieval of work units and their sessions.
 */

import { getTranscriptDbInstance } from './transcript-connection';
import {
  initializeWorkUnitTables,
  rowToWorkUnit,
  rowToWorkUnitSession,
  rowToSessionCorrelationData,
  type WorkUnitRow,
  type WorkUnitSessionRow,
  type SessionCorrelationDataRow,
} from './work-unit-schema';
import type {
  WorkUnit,
  WorkUnitSession,
  SessionCorrelationData,
  WorkUnitListQuery,
  WorkUnitListResponse,
  WorkUnitConfidence,
} from '../types/work-unit';
import type { AgentType } from '../types/transcript';

/**
 * Initialize work unit database schema
 * Safe to call multiple times - uses IF NOT EXISTS
 */
export function initializeWorkUnitSchema(): void {
  const db = getTranscriptDbInstance();
  initializeWorkUnitTables(db);
}

/**
 * Get all work units with pagination and filtering
 */
export function getWorkUnits(query: WorkUnitListQuery = {}): WorkUnitListResponse {
  const db = getTranscriptDbInstance();

  const { offset = 0, limit = 20, confidence, agent, project } = query;

  // Build WHERE clauses
  const whereClauses: string[] = [];
  const params: Record<string, unknown> = {};

  if (confidence) {
    whereClauses.push('confidence = @confidence');
    params.confidence = confidence;
  }

  if (agent) {
    // Filter work units that include this agent type
    whereClauses.push('agents LIKE @agentFilter');
    params.agentFilter = `%"${agent}"%`;
  }

  if (project) {
    whereClauses.push('project_path LIKE @project');
    params.project = `%${project}%`;
  }

  const whereClause = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

  // Get total count
  const countQuery = `SELECT COUNT(*) as total FROM work_units ${whereClause}`;
  const countResult = db.prepare(countQuery).get(params) as { total: number };

  // Get paginated work units
  const workUnitsQuery = `
    SELECT *
    FROM work_units
    ${whereClause}
    ORDER BY start_time DESC
    LIMIT @limit OFFSET @offset
  `;

  const rows = db.prepare(workUnitsQuery).all({
    ...params,
    limit,
    offset,
  }) as WorkUnitRow[];

  // Convert rows to WorkUnit objects and load sessions
  const workUnits: WorkUnit[] = rows.map((row) => {
    const workUnit = rowToWorkUnit(row);
    workUnit.sessions = getWorkUnitSessions(workUnit.id);
    return workUnit;
  });

  // Count ungrouped sessions if requested
  let ungroupedCount: number | undefined;
  if (query.includeUngrouped) {
    const ungroupedResult = db
      .prepare(
        `
      SELECT COUNT(*) as count
      FROM session_metadata sm
      WHERE NOT EXISTS (
        SELECT 1 FROM work_unit_sessions wus WHERE wus.session_id = sm.session_id
      )
    `
      )
      .get() as { count: number };
    ungroupedCount = ungroupedResult.count;
  }

  return {
    workUnits,
    total: countResult.total,
    offset,
    limit,
    ungroupedCount,
  };
}

/**
 * Get a single work unit by ID
 */
export function getWorkUnitById(workUnitId: string): WorkUnit | null {
  const db = getTranscriptDbInstance();

  const row = db
    .prepare(
      `
    SELECT * FROM work_units WHERE id = ?
  `
    )
    .get(workUnitId) as WorkUnitRow | undefined;

  if (!row) {
    return null;
  }

  const workUnit = rowToWorkUnit(row);
  workUnit.sessions = getWorkUnitSessions(workUnitId);

  return workUnit;
}

/**
 * Get sessions for a work unit
 */
export function getWorkUnitSessions(workUnitId: string): WorkUnitSession[] {
  const db = getTranscriptDbInstance();

  const rows = db
    .prepare(
      `
    SELECT * FROM work_unit_sessions
    WHERE work_unit_id = ?
    ORDER BY start_time ASC
  `
    )
    .all(workUnitId) as WorkUnitSessionRow[];

  return rows.map(rowToWorkUnitSession);
}

/**
 * Get work unit for a specific session
 */
export function getWorkUnitBySessionId(sessionId: string): WorkUnit | null {
  const db = getTranscriptDbInstance();

  const sessionRow = db
    .prepare(
      `
    SELECT work_unit_id FROM work_unit_sessions WHERE session_id = ?
  `
    )
    .get(sessionId) as { work_unit_id: string } | undefined;

  if (!sessionRow) {
    return null;
  }

  return getWorkUnitById(sessionRow.work_unit_id);
}

/**
 * Insert or update a work unit
 */
export function upsertWorkUnit(workUnit: WorkUnit): void {
  const db = getTranscriptDbInstance();

  // Upsert work unit
  db.prepare(
    `
    INSERT OR REPLACE INTO work_units (
      id, name, project_path, agents, confidence,
      start_time, end_time, total_duration, total_frames,
      session_count, files_touched, created_at, updated_at
    ) VALUES (
      @id, @name, @projectPath, @agents, @confidence,
      @startTime, @endTime, @totalDuration, @totalFrames,
      @sessionCount, @filesTouched, @createdAt, @updatedAt
    )
  `
  ).run({
    id: workUnit.id,
    name: workUnit.name,
    projectPath: workUnit.projectPath,
    agents: JSON.stringify(workUnit.agents),
    confidence: workUnit.confidence,
    startTime: workUnit.startTime,
    endTime: workUnit.endTime,
    totalDuration: workUnit.totalDuration,
    totalFrames: workUnit.totalFrames,
    sessionCount: workUnit.sessions.length,
    filesTouched: JSON.stringify(workUnit.filesTouched),
    createdAt: workUnit.createdAt,
    updatedAt: workUnit.updatedAt,
  });

  // Delete existing session mappings
  db.prepare(
    `
    DELETE FROM work_unit_sessions WHERE work_unit_id = ?
  `
  ).run(workUnit.id);

  // Insert session mappings
  const insertSession = db.prepare(`
    INSERT INTO work_unit_sessions (
      id, work_unit_id, session_id, agent, model,
      correlation_score, join_reason, start_time, end_time,
      duration, frame_count, first_user_message, created_at
    ) VALUES (
      @id, @workUnitId, @sessionId, @agent, @model,
      @correlationScore, @joinReason, @startTime, @endTime,
      @duration, @frameCount, @firstUserMessage, @createdAt
    )
  `);

  for (const session of workUnit.sessions) {
    insertSession.run({
      id: `${workUnit.id}-${session.sessionId}`,
      workUnitId: workUnit.id,
      sessionId: session.sessionId,
      agent: session.agent,
      model: session.model || null,
      correlationScore: session.correlationScore,
      joinReason: JSON.stringify(session.joinReason),
      startTime: session.startTime,
      endTime: session.endTime || null,
      duration: session.duration || null,
      frameCount: session.frameCount,
      firstUserMessage: session.firstUserMessage || null,
      createdAt: new Date().toISOString(),
    });
  }
}

/**
 * Delete a work unit and its session mappings
 */
export function deleteWorkUnit(workUnitId: string): boolean {
  const db = getTranscriptDbInstance();

  // Sessions are deleted via CASCADE
  const result = db
    .prepare(
      `
    DELETE FROM work_units WHERE id = ?
  `
    )
    .run(workUnitId);

  return result.changes > 0;
}

/**
 * Save all work units (used after recomputation)
 */
export function saveAllWorkUnits(workUnits: WorkUnit[]): void {
  const db = getTranscriptDbInstance();

  // Use a transaction for atomicity
  const saveAll = db.transaction(() => {
    // Clear existing work units
    db.prepare('DELETE FROM work_unit_sessions').run();
    db.prepare('DELETE FROM work_units').run();

    // Insert all work units
    for (const workUnit of workUnits) {
      upsertWorkUnit(workUnit);
    }
  });

  saveAll();
}

/**
 * Add a session to a work unit manually
 */
export function addSessionToWorkUnit(
  workUnitId: string,
  sessionId: string,
  agent: AgentType,
  startTime: string,
  endTime?: string,
  duration?: number,
  frameCount: number = 0,
  firstUserMessage?: string
): boolean {
  const db = getTranscriptDbInstance();

  try {
    // Insert session mapping
    db.prepare(
      `
      INSERT OR REPLACE INTO work_unit_sessions (
        id, work_unit_id, session_id, agent, model,
        correlation_score, join_reason, start_time, end_time,
        duration, frame_count, first_user_message, created_at
      ) VALUES (
        @id, @workUnitId, @sessionId, @agent, @model,
        @correlationScore, @joinReason, @startTime, @endTime,
        @duration, @frameCount, @firstUserMessage, @createdAt
      )
    `
    ).run({
      id: `${workUnitId}-${sessionId}`,
      workUnitId,
      sessionId,
      agent,
      model: null,
      correlationScore: 1.0,
      joinReason: JSON.stringify(['manual_override']),
      startTime,
      endTime: endTime || null,
      duration: duration || null,
      frameCount,
      firstUserMessage: firstUserMessage || null,
      createdAt: new Date().toISOString(),
    });

    // Update work unit metadata
    updateWorkUnitMetadata(workUnitId);

    return true;
  } catch (error) {
    console.error('Failed to add session to work unit:', error);
    return false;
  }
}

/**
 * Remove a session from a work unit
 */
export function removeSessionFromWorkUnit(workUnitId: string, sessionId: string): boolean {
  const db = getTranscriptDbInstance();

  const result = db
    .prepare(
      `
    DELETE FROM work_unit_sessions
    WHERE work_unit_id = ? AND session_id = ?
  `
    )
    .run(workUnitId, sessionId);

  if (result.changes > 0) {
    // Update work unit metadata
    updateWorkUnitMetadata(workUnitId);

    // Check if work unit is now empty
    const remaining = db
      .prepare(
        `
      SELECT COUNT(*) as count FROM work_unit_sessions WHERE work_unit_id = ?
    `
      )
      .get(workUnitId) as { count: number };

    if (remaining.count === 0) {
      // Delete empty work unit
      deleteWorkUnit(workUnitId);
    }

    return true;
  }

  return false;
}

/**
 * Update work unit metadata after session changes
 */
function updateWorkUnitMetadata(workUnitId: string): void {
  const db = getTranscriptDbInstance();

  // Recalculate aggregates from sessions
  const sessions = db
    .prepare(
      `
    SELECT * FROM work_unit_sessions
    WHERE work_unit_id = ?
    ORDER BY start_time ASC
  `
    )
    .all(workUnitId) as WorkUnitSessionRow[];

  if (sessions.length === 0) return;

  const firstSession = sessions[0]!;
  const lastSession = sessions[sessions.length - 1]!;

  // Collect unique agents
  const agents = [...new Set(sessions.map((s) => s.agent))];

  // Calculate totals
  const totalDuration = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
  const totalFrames = sessions.reduce((sum, s) => sum + s.frame_count, 0);

  // Update work unit
  db.prepare(
    `
    UPDATE work_units SET
      agents = @agents,
      start_time = @startTime,
      end_time = @endTime,
      total_duration = @totalDuration,
      total_frames = @totalFrames,
      session_count = @sessionCount,
      updated_at = @updatedAt
    WHERE id = @id
  `
  ).run({
    id: workUnitId,
    agents: JSON.stringify(agents),
    startTime: firstSession.start_time,
    endTime: lastSession.end_time || lastSession.start_time,
    totalDuration,
    totalFrames,
    sessionCount: sessions.length,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Cache session correlation data
 */
export function cacheSessionCorrelationData(data: SessionCorrelationData): void {
  const db = getTranscriptDbInstance();

  db.prepare(
    `
    INSERT OR REPLACE INTO session_correlation_data (
      session_id, agent, model, project_path, cwd,
      files_read, files_modified, start_time, end_time,
      duration, frame_count, first_user_message, extracted_at
    ) VALUES (
      @sessionId, @agent, @model, @projectPath, @cwd,
      @filesRead, @filesModified, @startTime, @endTime,
      @duration, @frameCount, @firstUserMessage, @extractedAt
    )
  `
  ).run({
    sessionId: data.sessionId,
    agent: data.agent,
    model: data.model || null,
    projectPath: data.projectPath,
    cwd: data.cwd,
    filesRead: JSON.stringify(data.filesRead),
    filesModified: JSON.stringify(data.filesModified),
    startTime: data.startTime,
    endTime: data.endTime || null,
    duration: data.duration || null,
    frameCount: data.frameCount,
    firstUserMessage: data.firstUserMessage || null,
    extractedAt: new Date().toISOString(),
  });
}

/**
 * Get cached session correlation data
 */
export function getCachedCorrelationData(sessionId: string): SessionCorrelationData | null {
  const db = getTranscriptDbInstance();

  const row = db
    .prepare(
      `
    SELECT * FROM session_correlation_data WHERE session_id = ?
  `
    )
    .get(sessionId) as SessionCorrelationDataRow | undefined;

  if (!row) return null;

  return rowToSessionCorrelationData(row);
}

/**
 * Get all cached correlation data
 */
export function getAllCachedCorrelationData(): SessionCorrelationData[] {
  const db = getTranscriptDbInstance();

  const rows = db
    .prepare(
      `
    SELECT * FROM session_correlation_data ORDER BY start_time DESC
  `
    )
    .all() as SessionCorrelationDataRow[];

  return rows.map(rowToSessionCorrelationData);
}

/**
 * Get work unit statistics
 */
export function getWorkUnitStats(): {
  total: number;
  byConfidence: Record<WorkUnitConfidence, number>;
  byAgent: Record<string, number>;
  ungroupedSessions: number;
} {
  const db = getTranscriptDbInstance();

  const total = (
    db
      .prepare(
        `
    SELECT COUNT(*) as count FROM work_units
  `
      )
      .get() as { count: number }
  ).count;

  const byConfidence = {
    high: 0,
    medium: 0,
    low: 0,
  };

  const confidenceRows = db
    .prepare(
      `
    SELECT confidence, COUNT(*) as count FROM work_units GROUP BY confidence
  `
    )
    .all() as { confidence: WorkUnitConfidence; count: number }[];

  for (const row of confidenceRows) {
    byConfidence[row.confidence] = row.count;
  }

  // Count work units by agent involvement
  const byAgent: Record<string, number> = {};
  const workUnits = db.prepare('SELECT agents FROM work_units').all() as {
    agents: string;
  }[];

  for (const row of workUnits) {
    const agents = JSON.parse(row.agents) as string[];
    for (const agent of agents) {
      byAgent[agent] = (byAgent[agent] || 0) + 1;
    }
  }

  // Count ungrouped sessions
  const ungroupedSessions = (
    db
      .prepare(
        `
    SELECT COUNT(*) as count
    FROM session_metadata sm
    WHERE NOT EXISTS (
      SELECT 1 FROM work_unit_sessions wus WHERE wus.session_id = sm.session_id
    )
  `
      )
      .get() as { count: number }
  ).count;

  return {
    total,
    byConfidence,
    byAgent,
    ungroupedSessions,
  };
}
