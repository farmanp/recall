/**
 * TypeScript types for transcript database schema
 *
 * This module defines the schema for persisting Claude Code session transcripts
 * to SQLite. The database stores parsed playback frames, tool executions, and
 * file diffs for fast querying without re-parsing .jsonl files.
 */

import type {
  SessionMetadata,
  PlaybackFrame,
  ToolExecution,
  FileDiff,
} from '../types/transcript';

/**
 * Database row for session_metadata table
 * Stores high-level session info for fast listing/filtering
 */
export interface SessionMetadataRow {
  session_id: string;
  slug: string;
  project: string;
  start_time: string;           // ISO 8601 timestamp
  end_time: string | null;      // ISO 8601 timestamp
  duration_seconds: number | null;
  event_count: number;
  frame_count: number;
  cwd: string;
  first_user_message: string | null;
  parsed_at: string;            // ISO 8601 timestamp when imported
}

/**
 * Database row for playback_frames table
 * Stores core playback data for session replay
 */
export interface PlaybackFrameRow {
  id: string;
  session_id: string;
  frame_type: 'user_message' | 'claude_thinking' | 'claude_response' | 'tool_execution';
  timestamp_ms: number;         // epoch milliseconds
  duration_ms: number | null;   // duration to next frame
  user_message_text: string | null;
  thinking_text: string | null;
  thinking_signature: string | null;
  response_text: string | null;
  cwd: string;
  files_read: string | null;    // JSON array
  files_modified: string | null; // JSON array
}

/**
 * Database row for tool_executions table
 * Stores tool call details (Bash, Read, Write, Edit, etc.)
 */
export interface ToolExecutionRow {
  id: string;
  frame_id: string;
  tool_name: string;            // "Bash", "Read", "Write", "Edit", etc.
  tool_input: string;           // JSON object
  output_content: string;
  is_error: number;             // SQLite stores boolean as INTEGER (0 or 1)
  exit_code: number | null;     // for Bash commands
}

/**
 * Database row for file_diffs table
 * Stores file edits (Edit/Write tool operations)
 */
export interface FileDiffRow {
  id: string;
  tool_execution_id: string;
  file_path: string;
  old_content: string | null;   // null for new files
  new_content: string;
  language: string;             // for syntax highlighting
}

/**
 * Database row for parsing_status table
 * Tracks import progress for bulk imports
 */
export interface ParsingStatusRow {
  session_id: string;
  transcript_file_path: string;
  total_entries: number;
  frames_created: number;
  status: 'pending' | 'completed' | 'failed';
  started_at: string;           // ISO 8601 timestamp
  completed_at: string | null;  // ISO 8601 timestamp
  error_message: string | null;
}

/**
 * API Response types
 */

export interface TranscriptSessionListResponse {
  sessions: SessionMetadata[];
  total: number;
  offset: number;
  limit: number;
}

export interface TranscriptSessionDetailsResponse {
  session: SessionMetadata;
  frameCount: number;
  toolExecutionCount: number;
  fileDiffCount: number;
}

export interface TranscriptFramesResponse {
  frames: PlaybackFrame[];
  total: number;
  offset: number;
  limit: number;
  sessionId: string;
}

export interface ImportStatusResponse {
  status: 'idle' | 'importing' | 'completed' | 'failed';
  totalSessions: number;
  completedSessions: number;
  failedSessions: number;
  currentSession?: string;
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
}

/**
 * API Query parameters
 */

export interface TranscriptSessionListQuery {
  offset?: number;
  limit?: number;
  project?: string;
  dateStart?: string;   // ISO 8601
  dateEnd?: string;     // ISO 8601
}

export interface TranscriptFramesQuery {
  offset?: number;
  limit?: number;
  afterTimestamp?: number;  // epoch ms
  frameTypes?: string;      // comma-separated: "user_message,tool_execution"
}

/**
 * Import job configuration
 */
export interface ImportJobConfig {
  sourcePath?: string;          // default: ~/.claude/projects/
  parallel?: number;            // default: 10
  skipExisting?: boolean;       // default: true
  onProgress?: (completed: number, total: number) => void;
}
