/**
 * Database schema for Work Units - Cross-Agent Session Stitching
 *
 * Tables:
 * - work_units: Core work unit metadata
 * - work_unit_sessions: Sessions belonging to each work unit
 * - session_correlation_data: Cached correlation data for each session
 */

import type { WorkUnitConfidence, CorrelationReason } from '../types/work-unit';

/**
 * Database row for work_units table
 * Stores work unit metadata for fast listing/filtering
 */
export interface WorkUnitRow {
  id: string; // UUID
  name: string; // Display name
  project_path: string; // Normalized project path
  agents: string; // JSON array of agent types
  confidence: WorkUnitConfidence;
  start_time: string; // ISO 8601 timestamp
  end_time: string; // ISO 8601 timestamp
  total_duration: number; // Total duration in seconds
  total_frames: number; // Total frames across sessions
  session_count: number; // Number of sessions
  files_touched: string; // JSON array of file paths
  created_at: string; // ISO 8601 timestamp
  updated_at: string; // ISO 8601 timestamp
}

/**
 * Database row for work_unit_sessions table
 * Links sessions to work units with correlation metadata
 */
export interface WorkUnitSessionRow {
  id: string; // Primary key (UUID)
  work_unit_id: string; // Foreign key to work_units
  session_id: string; // Session ID
  agent: string; // Agent type
  model: string | null; // Model identifier
  correlation_score: number; // 0-1 score
  join_reason: string; // JSON array of CorrelationReason
  start_time: string; // ISO 8601 timestamp
  end_time: string | null; // ISO 8601 timestamp
  duration: number | null; // Duration in seconds
  frame_count: number;
  first_user_message: string | null;
  created_at: string; // ISO 8601 timestamp
}

/**
 * Database row for session_correlation_data table
 * Caches extracted correlation data for faster recomputation
 */
export interface SessionCorrelationDataRow {
  session_id: string; // Primary key
  agent: string; // Agent type
  model: string | null; // Model identifier
  project_path: string; // Normalized project path
  cwd: string; // Working directory
  files_read: string; // JSON array of file paths
  files_modified: string; // JSON array of file paths
  start_time: number; // Epoch ms
  end_time: number | null; // Epoch ms
  duration: number | null; // Seconds
  frame_count: number;
  first_user_message: string | null;
  extracted_at: string; // ISO 8601 timestamp
}

/**
 * SQL to create work_units table
 */
export const CREATE_WORK_UNITS_TABLE = `
CREATE TABLE IF NOT EXISTS work_units (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  project_path TEXT NOT NULL,
  agents TEXT NOT NULL DEFAULT '[]',
  confidence TEXT NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  total_duration INTEGER NOT NULL DEFAULT 0,
  total_frames INTEGER NOT NULL DEFAULT 0,
  session_count INTEGER NOT NULL DEFAULT 0,
  files_touched TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_work_units_project_path ON work_units(project_path);
CREATE INDEX IF NOT EXISTS idx_work_units_confidence ON work_units(confidence);
CREATE INDEX IF NOT EXISTS idx_work_units_start_time ON work_units(start_time);
CREATE INDEX IF NOT EXISTS idx_work_units_updated_at ON work_units(updated_at);
`;

/**
 * SQL to create work_unit_sessions table
 */
export const CREATE_WORK_UNIT_SESSIONS_TABLE = `
CREATE TABLE IF NOT EXISTS work_unit_sessions (
  id TEXT PRIMARY KEY,
  work_unit_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  agent TEXT NOT NULL,
  model TEXT,
  correlation_score REAL NOT NULL DEFAULT 0,
  join_reason TEXT NOT NULL DEFAULT '[]',
  start_time TEXT NOT NULL,
  end_time TEXT,
  duration INTEGER,
  frame_count INTEGER NOT NULL DEFAULT 0,
  first_user_message TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (work_unit_id) REFERENCES work_units(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_work_unit_sessions_work_unit_id ON work_unit_sessions(work_unit_id);
CREATE INDEX IF NOT EXISTS idx_work_unit_sessions_session_id ON work_unit_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_work_unit_sessions_agent ON work_unit_sessions(agent);
CREATE INDEX IF NOT EXISTS idx_work_unit_sessions_start_time ON work_unit_sessions(start_time);
CREATE UNIQUE INDEX IF NOT EXISTS idx_work_unit_sessions_unique ON work_unit_sessions(session_id);
`;

/**
 * SQL to create session_correlation_data table
 */
export const CREATE_SESSION_CORRELATION_DATA_TABLE = `
CREATE TABLE IF NOT EXISTS session_correlation_data (
  session_id TEXT PRIMARY KEY,
  agent TEXT NOT NULL,
  model TEXT,
  project_path TEXT NOT NULL,
  cwd TEXT NOT NULL DEFAULT '',
  files_read TEXT NOT NULL DEFAULT '[]',
  files_modified TEXT NOT NULL DEFAULT '[]',
  start_time INTEGER NOT NULL,
  end_time INTEGER,
  duration INTEGER,
  frame_count INTEGER NOT NULL DEFAULT 0,
  first_user_message TEXT,
  extracted_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_session_correlation_project_path ON session_correlation_data(project_path);
CREATE INDEX IF NOT EXISTS idx_session_correlation_agent ON session_correlation_data(agent);
CREATE INDEX IF NOT EXISTS idx_session_correlation_start_time ON session_correlation_data(start_time);
`;

/**
 * Initialize work unit tables in the database
 */
export function initializeWorkUnitTables(db: import('better-sqlite3').Database): void {
  // Create tables (each CREATE TABLE is a separate statement)
  const statements = [
    CREATE_WORK_UNITS_TABLE,
    CREATE_WORK_UNIT_SESSIONS_TABLE,
    CREATE_SESSION_CORRELATION_DATA_TABLE,
  ];

  for (const sql of statements) {
    // Split by semicolon and execute each statement
    const individualStatements = sql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const statement of individualStatements) {
      db.exec(statement);
    }
  }
}

/**
 * Convert WorkUnitRow to WorkUnit
 */
export function rowToWorkUnit(row: WorkUnitRow): import('../types/work-unit').WorkUnit {
  return {
    id: row.id,
    name: row.name,
    projectPath: row.project_path,
    sessions: [], // Will be populated separately
    agents: JSON.parse(row.agents),
    confidence: row.confidence,
    startTime: row.start_time,
    endTime: row.end_time,
    totalDuration: row.total_duration,
    totalFrames: row.total_frames,
    filesTouched: JSON.parse(row.files_touched),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Convert WorkUnitSessionRow to WorkUnitSession
 */
export function rowToWorkUnitSession(
  row: WorkUnitSessionRow
): import('../types/work-unit').WorkUnitSession {
  return {
    sessionId: row.session_id,
    agent: row.agent as import('../types/transcript').AgentType,
    model: row.model || undefined,
    correlationScore: row.correlation_score,
    joinReason: JSON.parse(row.join_reason) as CorrelationReason[],
    startTime: row.start_time,
    endTime: row.end_time || undefined,
    duration: row.duration || undefined,
    frameCount: row.frame_count,
    firstUserMessage: row.first_user_message || undefined,
  };
}

/**
 * Convert SessionCorrelationDataRow to SessionCorrelationData
 */
export function rowToSessionCorrelationData(
  row: SessionCorrelationDataRow
): import('../types/work-unit').SessionCorrelationData {
  return {
    sessionId: row.session_id,
    agent: row.agent as import('../types/transcript').AgentType,
    model: row.model || undefined,
    projectPath: row.project_path,
    cwd: row.cwd,
    filesRead: JSON.parse(row.files_read),
    filesModified: JSON.parse(row.files_modified),
    startTime: row.start_time,
    endTime: row.end_time || undefined,
    duration: row.duration || undefined,
    frameCount: row.frame_count,
    firstUserMessage: row.first_user_message || undefined,
  };
}
