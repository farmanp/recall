import { getTranscriptDbInstance } from './transcript-connection';
import type {
  SessionMetadataRow,
  PlaybackFrameRow,
  ToolExecutionRow,
  FileDiffRow,
  ParsingStatusRow,
  TranscriptSessionListQuery,
  TranscriptFramesQuery,
} from './transcript-schema';
import type {
  SessionMetadata,
  PlaybackFrame,
  ToolExecution,
  FileDiff,
  SearchGlobalRequest,
  SearchGlobalResponse,
  SearchResult,
} from '../types/transcript';

/**
 * Initialize database schema
 *
 * Creates all tables with proper indexes and foreign keys.
 * Safe to call multiple times - uses IF NOT EXISTS.
 *
 * @example
 * initializeTranscriptSchema();
 * console.log('Database schema initialized');
 */
export function initializeTranscriptSchema(): void {
  const db = getTranscriptDbInstance();

  // 1. SESSION_METADATA - create table first without agent_type for migration compatibility
  db.exec(`
    CREATE TABLE IF NOT EXISTS session_metadata (
      session_id TEXT PRIMARY KEY,
      slug TEXT NOT NULL,
      project TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT,
      duration_seconds INTEGER,
      event_count INTEGER NOT NULL DEFAULT 0,
      frame_count INTEGER NOT NULL DEFAULT 0,
      cwd TEXT NOT NULL,
      first_user_message TEXT,
      parsed_at TEXT NOT NULL
    );
  `);

  // Migration: Add agent_type column if it doesn't exist
  const sessionColumns = db.pragma('table_info(session_metadata)') as Array<{ name: string }>;
  const hasAgentTypeInSessions = sessionColumns.some((col) => col.name === 'agent_type');
  if (!hasAgentTypeInSessions) {
    db.exec(`ALTER TABLE session_metadata ADD COLUMN agent_type TEXT NOT NULL DEFAULT 'claude'`);
  }

  // Create indexes after migration
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_session_project
      ON session_metadata(project);

    CREATE INDEX IF NOT EXISTS idx_session_start_time
      ON session_metadata(start_time DESC);

    CREATE INDEX IF NOT EXISTS idx_sessions_agent
      ON session_metadata(agent_type);
  `);

  // 2. PLAYBACK_FRAMES - create table first without agent_type for migration compatibility
  db.exec(`
    CREATE TABLE IF NOT EXISTS playback_frames (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      frame_type TEXT NOT NULL,
      timestamp_ms INTEGER NOT NULL,
      duration_ms INTEGER,
      user_message_text TEXT,
      thinking_text TEXT,
      thinking_signature TEXT,
      response_text TEXT,
      cwd TEXT NOT NULL,
      files_read TEXT,
      files_modified TEXT,
      FOREIGN KEY (session_id) REFERENCES session_metadata(session_id)
    );
  `);

  // Migration: Add agent_type column to playback_frames if it doesn't exist
  const frameColumns = db.pragma('table_info(playback_frames)') as Array<{ name: string }>;
  const hasAgentTypeInFrames = frameColumns.some((col) => col.name === 'agent_type');
  if (!hasAgentTypeInFrames) {
    db.exec(`ALTER TABLE playback_frames ADD COLUMN agent_type TEXT NOT NULL DEFAULT 'claude'`);
  }

  // Create indexes after migration
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_frame_session_timestamp
      ON playback_frames(session_id, timestamp_ms);

    CREATE INDEX IF NOT EXISTS idx_frame_type
      ON playback_frames(frame_type);
  `);

  // 3. TOOL_EXECUTIONS
  db.exec(`
    CREATE TABLE IF NOT EXISTS tool_executions (
      id TEXT PRIMARY KEY,
      frame_id TEXT NOT NULL,
      tool_name TEXT NOT NULL,
      tool_input TEXT NOT NULL,
      output_content TEXT NOT NULL,
      is_error INTEGER NOT NULL DEFAULT 0,
      exit_code INTEGER,
      FOREIGN KEY (frame_id) REFERENCES playback_frames(id)
    );

    CREATE INDEX IF NOT EXISTS idx_tool_frame
      ON tool_executions(frame_id);

    CREATE INDEX IF NOT EXISTS idx_tool_name
      ON tool_executions(tool_name);
  `);

  // 4. FILE_DIFFS
  db.exec(`
    CREATE TABLE IF NOT EXISTS file_diffs (
      id TEXT PRIMARY KEY,
      tool_execution_id TEXT NOT NULL,
      file_path TEXT NOT NULL,
      old_content TEXT,
      new_content TEXT NOT NULL,
      language TEXT NOT NULL,
      FOREIGN KEY (tool_execution_id) REFERENCES tool_executions(id)
    );

    CREATE INDEX IF NOT EXISTS idx_diff_tool_execution
      ON file_diffs(tool_execution_id);

    CREATE INDEX IF NOT EXISTS idx_diff_file_path
      ON file_diffs(file_path);
  `);

  // 5. PARSING_STATUS
  db.exec(`
    CREATE TABLE IF NOT EXISTS parsing_status (
      session_id TEXT PRIMARY KEY,
      transcript_file_path TEXT NOT NULL,
      total_entries INTEGER NOT NULL,
      frames_created INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      started_at TEXT NOT NULL,
      completed_at TEXT,
      error_message TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_parsing_status
      ON parsing_status(status);
  `);
}

/**
 * Get all sessions with pagination and filtering
 *
 * @param {TranscriptSessionListQuery} query - Query parameters
 * @returns {{ sessions: SessionMetadata[]; total: number }} Paginated sessions
 *
 * @example
 * const result = getTranscriptSessions({ limit: 20, offset: 0 });
 * console.log(`Found ${result.total} sessions`);
 */
export function getTranscriptSessions(query: TranscriptSessionListQuery): {
  sessions: SessionMetadata[];
  total: number;
} {
  const db = getTranscriptDbInstance();

  const {
    offset = 0,
    limit = 20,
    project,
    agent,
    dateStart,
    dateEnd,
  } = query;

  // Build WHERE clauses
  const whereClauses: string[] = [];
  const params: Record<string, unknown> = {};

  if (project) {
    whereClauses.push('project = @project');
    params.project = project;
  }

  if (agent) {
    whereClauses.push('agent_type = @agent');
    params.agent = agent;
  }

  if (dateStart) {
    whereClauses.push('start_time >= @dateStart');
    params.dateStart = dateStart;
  }

  if (dateEnd) {
    whereClauses.push('start_time <= @dateEnd');
    params.dateEnd = dateEnd;
  }

  const whereClause = whereClauses.length > 0
    ? 'WHERE ' + whereClauses.join(' AND ')
    : '';

  // Get total count
  const countQuery = `SELECT COUNT(*) as total FROM session_metadata ${whereClause}`;
  const countResult = db.prepare(countQuery).get(params) as { total: number };
  const total = countResult.total;

  // Get paginated sessions
  const sessionsQuery = `
    SELECT *
    FROM session_metadata
    ${whereClause}
    ORDER BY start_time DESC
    LIMIT @limit OFFSET @offset
  `;

  const rows = db.prepare(sessionsQuery).all({
    ...params,
    limit,
    offset,
  }) as SessionMetadataRow[];

  // Convert rows to SessionMetadata
  const sessions: SessionMetadata[] = rows.map(row => ({
    sessionId: row.session_id,
    slug: row.slug,
    project: row.project,
    agent: (row.agent_type || 'claude') as SessionMetadata['agent'],
    startTime: row.start_time,
    endTime: row.end_time || undefined,
    duration: row.duration_seconds || undefined,
    eventCount: row.event_count,
    cwd: row.cwd,
    firstUserMessage: row.first_user_message || undefined,
  }));

  return { sessions, total };
}

/**
 * Perform a global search across all transcript content
 */
export function searchGlobalFrames(req: SearchGlobalRequest): SearchGlobalResponse {
  const db = getTranscriptDbInstance();
  const { query, limit = 50, offset = 0, agent, project } = req;
  const likeQuery = `%${query}%`;

  const whereClauses: string[] = [];
  const params: any = { likeQuery };

  const searchClause = `(
    f.user_message_text LIKE @likeQuery OR 
    f.thinking_text LIKE @likeQuery OR 
    f.response_text LIKE @likeQuery OR 
    t.output_content LIKE @likeQuery OR 
    d.new_content LIKE @likeQuery
  )`;
  whereClauses.push(searchClause);

  if (agent) {
    whereClauses.push('s.agent_type = @agent');
    params.agent = agent;
  }
  if (project) {
    whereClauses.push('s.project = @project');
    params.project = project;
  }

  const whereClause = 'WHERE ' + whereClauses.join(' AND ');

  // Count total matches
  const countQuery = `
    SELECT COUNT(DISTINCT f.id) as total
    FROM playback_frames f
    JOIN session_metadata s ON f.session_id = s.session_id
    LEFT JOIN tool_executions t ON t.frame_id = f.id
    LEFT JOIN file_diffs d ON d.tool_execution_id = t.id
    ${whereClause}
  `;
  const countResult = db.prepare(countQuery).get(params) as { total: number };

  // Get results with snippets
  const resultsQuery = `
    SELECT 
      f.id as frameId,
      f.session_id as sessionId,
      f.frame_type as frameType,
      f.timestamp_ms as timestamp,
      f.user_message_text,
      f.thinking_text,
      f.response_text,
      f.agent_type as agent,
      s.slug,
      s.project,
      t.output_content,
      d.new_content as file_content
    FROM playback_frames f
    JOIN session_metadata s ON f.session_id = s.session_id
    LEFT JOIN tool_executions t ON t.frame_id = f.id
    LEFT JOIN file_diffs d ON d.tool_execution_id = t.id
    ${whereClause}
    GROUP BY f.id
    ORDER BY f.timestamp_ms DESC
    LIMIT @limit OFFSET @offset
  `;

  const rows = db.prepare(resultsQuery).all({ ...params, limit, offset }) as any[];

  const results: SearchResult[] = rows.map(row => {
    // Utility to create a snippet
    const createSnippet = (text: string | null): string | null => {
      if (!text) return null;
      const index = text.toLowerCase().indexOf(query.toLowerCase());
      if (index === -1) return text.substring(0, 100);
      const start = Math.max(0, index - 40);
      const end = Math.min(text.length, index + query.length + 60);
      let snippet = text.substring(start, end);
      if (start > 0) snippet = '...' + snippet;
      if (end < text.length) snippet = snippet + '...';
      return snippet;
    };

    let snippet = '';
    let matchType: SearchResult['matchType'] = 'user_message';

    if (row.user_message_text?.toLowerCase().includes(query.toLowerCase())) {
      snippet = createSnippet(row.user_message_text) || '';
      matchType = 'user_message';
    } else if (row.response_text?.toLowerCase().includes(query.toLowerCase())) {
      snippet = createSnippet(row.response_text) || '';
      matchType = 'response';
    } else if (row.thinking_text?.toLowerCase().includes(query.toLowerCase())) {
      snippet = createSnippet(row.thinking_text) || '';
      matchType = 'thinking';
    } else if (row.output_content?.toLowerCase().includes(query.toLowerCase())) {
      snippet = createSnippet(row.output_content) || '';
      matchType = 'tool_output';
    } else if (row.file_content?.toLowerCase().includes(query.toLowerCase())) {
      snippet = createSnippet(row.file_content) || '';
      matchType = 'file_change';
    } else {
      // Fallback
      snippet = row.user_message_text || row.response_text || row.thinking_text || '';
      if (snippet.length > 100) snippet = snippet.substring(0, 100) + '...';
    }

    return {
      sessionId: row.sessionId,
      slug: row.slug,
      project: row.project,
      frameId: row.frameId,
      frameType: row.frameType,
      timestamp: row.timestamp,
      snippet,
      matchType,
      agent: row.agent as any
    };
  });

  return {
    results,
    total: countResult.total,
    query,
    limit,
    offset
  };
}

/**
 * Get a single session by ID
 *
 * @param {string} sessionId - Session UUID
 * @returns {SessionMetadata | null} Session or null if not found
 *
 * @example
 * const session = getTranscriptSessionById('abc-123');
 * if (session) {
 *   console.log(`Project: ${session.project}`);
 * }
 */
export function getTranscriptSessionById(sessionId: string): SessionMetadata | null {
  const db = getTranscriptDbInstance();

  const row = db.prepare(`
    SELECT *
    FROM session_metadata
    WHERE session_id = ?
  `).get(sessionId) as SessionMetadataRow | undefined;

  if (!row) {
    return null;
  }

  return {
    sessionId: row.session_id,
    slug: row.slug,
    project: row.project,
    agent: (row.agent_type || 'claude') as SessionMetadata['agent'],
    startTime: row.start_time,
    endTime: row.end_time || undefined,
    duration: row.duration_seconds || undefined,
    eventCount: row.event_count,
    cwd: row.cwd,
    firstUserMessage: row.first_user_message || undefined,
  };
}

/**
 * Get playback frames for a session
 *
 * @param {string} sessionId - Session UUID
 * @param {TranscriptFramesQuery} query - Filter and pagination options
 * @returns {{ frames: PlaybackFrame[]; total: number }} Frames and total count
 *
 * @example
 * const result = getTranscriptFrames('abc-123', { limit: 100, offset: 0 });
 * console.log(`Total frames: ${result.total}`);
 */
export function getTranscriptFrames(
  sessionId: string,
  query: TranscriptFramesQuery
): { frames: PlaybackFrame[]; total: number } {
  const db = getTranscriptDbInstance();

  const {
    offset = 0,
    limit = 100,
    afterTimestamp,
    frameTypes,
  } = query;

  // Build WHERE clauses
  const whereClauses: string[] = ['session_id = @sessionId'];
  const params: Record<string, unknown> = { sessionId };

  if (afterTimestamp) {
    whereClauses.push('timestamp_ms > @afterTimestamp');
    params.afterTimestamp = afterTimestamp;
  }

  if (frameTypes) {
    const types = frameTypes.split(',').map(t => t.trim());
    const placeholders = types.map((_, i) => `@type${i}`).join(',');
    whereClauses.push(`frame_type IN (${placeholders})`);
    types.forEach((type, i) => {
      params[`type${i}`] = type;
    });
  }

  const whereClause = 'WHERE ' + whereClauses.join(' AND ');

  // Get total count
  const countQuery = `SELECT COUNT(*) as total FROM playback_frames ${whereClause}`;
  const countResult = db.prepare(countQuery).get(params) as { total: number };
  const total = countResult.total;

  // Get paginated frames
  const framesQuery = `
    SELECT *
    FROM playback_frames
    ${whereClause}
    ORDER BY timestamp_ms ASC
    LIMIT @limit OFFSET @offset
  `;

  const rows = db.prepare(framesQuery).all({
    ...params,
    limit,
    offset,
  }) as PlaybackFrameRow[];

  // Convert rows to PlaybackFrame objects
  const frames: PlaybackFrame[] = rows.map(row => convertRowToFrame(row));

  return { frames, total };
}

/**
 * Get tool execution for a frame
 *
 * @param {string} frameId - Frame ID
 * @returns {ToolExecution | null} Tool execution or null
 */
export function getToolExecution(frameId: string): ToolExecution | null {
  const db = getTranscriptDbInstance();

  const row = db.prepare(`
    SELECT *
    FROM tool_executions
    WHERE frame_id = ?
  `).get(frameId) as ToolExecutionRow | undefined;

  if (!row) {
    return null;
  }

  // Get file diff if it exists
  const diffRow = db.prepare(`
    SELECT *
    FROM file_diffs
    WHERE tool_execution_id = ?
  `).get(row.id) as FileDiffRow | undefined;

  return {
    tool: row.tool_name,
    input: JSON.parse(row.tool_input),
    output: {
      content: row.output_content,
      isError: row.is_error === 1,
      exitCode: row.exit_code || undefined,
    },
    fileDiff: diffRow ? {
      filePath: diffRow.file_path,
      oldContent: diffRow.old_content || undefined,
      newContent: diffRow.new_content,
      language: diffRow.language,
    } : undefined,
  };
}

/**
 * Insert a session into the database
 *
 * @param {SessionMetadata} session - Session metadata
 *
 * @example
 * insertSession({
 *   sessionId: 'abc-123',
 *   slug: 'my-session',
 *   project: 'MyProject',
 *   startTime: '2026-02-02T12:00:00Z',
 *   eventCount: 0,
 *   cwd: '/home/user/project'
 * });
 */
export function insertSession(session: SessionMetadata): void {
  const db = getTranscriptDbInstance();

  db.prepare(`
    INSERT OR REPLACE INTO session_metadata (
      session_id,
      slug,
      project,
      agent_type,
      start_time,
      end_time,
      duration_seconds,
      event_count,
      frame_count,
      cwd,
      first_user_message,
      parsed_at
    ) VALUES (
      @sessionId,
      @slug,
      @project,
      @agentType,
      @startTime,
      @endTime,
      @duration,
      @eventCount,
      @frameCount,
      @cwd,
      @firstUserMessage,
      @parsedAt
    )
  `).run({
    sessionId: session.sessionId,
    slug: session.slug,
    project: session.project,
    agentType: session.agent || 'claude',
    startTime: session.startTime,
    endTime: session.endTime || null,
    duration: session.duration || null,
    eventCount: session.eventCount,
    frameCount: 0, // Will be updated as frames are inserted
    cwd: session.cwd,
    firstUserMessage: session.firstUserMessage || null,
    parsedAt: new Date().toISOString(),
  });
}

/**
 * Insert a playback frame into the database
 *
 * @param {string} sessionId - Session UUID
 * @param {PlaybackFrame} frame - Playback frame
 *
 * @example
 * insertFrame('abc-123', frame);
 */
export function insertFrame(sessionId: string, frame: PlaybackFrame): void {
  const db = getTranscriptDbInstance();

  db.prepare(`
    INSERT OR REPLACE INTO playback_frames (
      id,
      session_id,
      frame_type,
      timestamp_ms,
      duration_ms,
      user_message_text,
      thinking_text,
      thinking_signature,
      response_text,
      cwd,
      files_read,
      files_modified,
      agent_type
    ) VALUES (
      @id,
      @sessionId,
      @frameType,
      @timestampMs,
      @durationMs,
      @userMessageText,
      @thinkingText,
      @thinkingSignature,
      @responseText,
      @cwd,
      @filesRead,
      @filesModified,
      @agentType
    )
  `).run({
    id: frame.id,
    sessionId,
    frameType: frame.type,
    timestampMs: frame.timestamp,
    durationMs: frame.duration || null,
    userMessageText: frame.userMessage?.text || null,
    thinkingText: frame.thinking?.text || null,
    thinkingSignature: frame.thinking?.signature || null,
    responseText: frame.claudeResponse?.text || null,
    cwd: frame.context.cwd,
    filesRead: frame.context.filesRead ? JSON.stringify(frame.context.filesRead) : null,
    filesModified: frame.context.filesModified ? JSON.stringify(frame.context.filesModified) : null,
    agentType: frame.agent || 'claude',
  });
}

/**
 * Insert a tool execution into the database
 *
 * @param {string} frameId - Frame ID
 * @param {ToolExecution} toolExecution - Tool execution data
 *
 * @example
 * insertToolExecution('frame-123', toolExecution);
 */
export function insertToolExecution(frameId: string, toolExecution: ToolExecution): void {
  const db = getTranscriptDbInstance();

  const toolId = `${frameId}-tool`;

  db.prepare(`
    INSERT OR REPLACE INTO tool_executions (
      id,
      frame_id,
      tool_name,
      tool_input,
      output_content,
      is_error,
      exit_code
    ) VALUES (
      @id,
      @frameId,
      @toolName,
      @toolInput,
      @outputContent,
      @isError,
      @exitCode
    )
  `).run({
    id: toolId,
    frameId,
    toolName: toolExecution.tool,
    toolInput: JSON.stringify(toolExecution.input),
    outputContent: toolExecution.output.content,
    isError: toolExecution.output.isError ? 1 : 0,
    exitCode: toolExecution.output.exitCode || null,
  });

  // Insert file diff if present
  if (toolExecution.fileDiff) {
    insertFileDiff(toolId, toolExecution.fileDiff);
  }
}

/**
 * Insert a file diff into the database
 *
 * @param {string} toolExecutionId - Tool execution ID
 * @param {FileDiff} fileDiff - File diff data
 *
 * @example
 * insertFileDiff('tool-123', fileDiff);
 */
export function insertFileDiff(toolExecutionId: string, fileDiff: FileDiff): void {
  const db = getTranscriptDbInstance();

  db.prepare(`
    INSERT OR REPLACE INTO file_diffs (
      id,
      tool_execution_id,
      file_path,
      old_content,
      new_content,
      language
    ) VALUES (
      @id,
      @toolExecutionId,
      @filePath,
      @oldContent,
      @newContent,
      @language
    )
  `).run({
    id: `${toolExecutionId}-diff`,
    toolExecutionId,
    filePath: fileDiff.filePath,
    oldContent: fileDiff.oldContent || null,
    newContent: fileDiff.newContent,
    language: fileDiff.language,
  });
}

/**
 * Update frame count for a session
 *
 * @param {string} sessionId - Session UUID
 *
 * @example
 * updateSessionFrameCount('abc-123');
 */
export function updateSessionFrameCount(sessionId: string): void {
  const db = getTranscriptDbInstance();

  db.prepare(`
    UPDATE session_metadata
    SET frame_count = (
      SELECT COUNT(*) FROM playback_frames WHERE session_id = @sessionId
    )
    WHERE session_id = @sessionId
  `).run({ sessionId });
}

/**
 * Create or update parsing status
 *
 * @param {string} sessionId - Session UUID
 * @param {Partial<ParsingStatusRow>} status - Status fields to update
 *
 * @example
 * updateParsingStatus('abc-123', {
 *   status: 'completed',
 *   completed_at: new Date().toISOString()
 * });
 */
export function updateParsingStatus(
  sessionId: string,
  status: Partial<ParsingStatusRow>
): void {
  const db = getTranscriptDbInstance();

  // Get existing status if any
  const existing = db.prepare(`
    SELECT * FROM parsing_status WHERE session_id = ?
  `).get(sessionId) as ParsingStatusRow | undefined;

  if (existing) {
    // Update existing
    const updates: string[] = [];
    const params: Record<string, unknown> = { sessionId };

    if (status.status !== undefined) {
      updates.push('status = @status');
      params.status = status.status;
    }
    if (status.frames_created !== undefined) {
      updates.push('frames_created = @frames_created');
      params.frames_created = status.frames_created;
    }
    if (status.completed_at !== undefined) {
      updates.push('completed_at = @completed_at');
      params.completed_at = status.completed_at;
    }
    if (status.error_message !== undefined) {
      updates.push('error_message = @error_message');
      params.error_message = status.error_message;
    }

    if (updates.length > 0) {
      db.prepare(`
        UPDATE parsing_status
        SET ${updates.join(', ')}
        WHERE session_id = @sessionId
      `).run(params);
    }
  } else {
    // Insert new
    db.prepare(`
      INSERT INTO parsing_status (
        session_id,
        transcript_file_path,
        total_entries,
        frames_created,
        status,
        started_at,
        completed_at,
        error_message
      ) VALUES (
        @sessionId,
        @transcript_file_path,
        @total_entries,
        @frames_created,
        @status,
        @started_at,
        @completed_at,
        @error_message
      )
    `).run({
      sessionId,
      transcript_file_path: status.transcript_file_path || '',
      total_entries: status.total_entries || 0,
      frames_created: status.frames_created || 0,
      status: status.status || 'pending',
      started_at: status.started_at || new Date().toISOString(),
      completed_at: status.completed_at || null,
      error_message: status.error_message || null,
    });
  }
}

/**
 * Get all unique project names from transcript database
 *
 * @returns {string[]} Array of project names
 *
 * @example
 * const projects = getTranscriptProjects();
 * console.log(`Found ${projects.length} projects`);
 */
export function getTranscriptProjects(): string[] {
  const db = getTranscriptDbInstance();

  const results = db.prepare(`
    SELECT DISTINCT project
    FROM session_metadata
    ORDER BY project ASC
  `).all() as { project: string }[];

  return results.map(r => r.project);
}

/**
 * Helper: Convert database row to PlaybackFrame
 */
function convertRowToFrame(row: PlaybackFrameRow): PlaybackFrame {
  const frame: PlaybackFrame = {
    id: row.id,
    type: row.frame_type as PlaybackFrame['type'],
    timestamp: row.timestamp_ms,
    duration: row.duration_ms || undefined,
    agent: (row.agent_type || 'claude') as PlaybackFrame['agent'],
    context: {
      cwd: row.cwd,
      filesRead: row.files_read ? JSON.parse(row.files_read) : undefined,
      filesModified: row.files_modified ? JSON.parse(row.files_modified) : undefined,
    },
  };

  if (row.user_message_text) {
    frame.userMessage = { text: row.user_message_text };
  }

  if (row.thinking_text) {
    frame.thinking = {
      text: row.thinking_text,
      signature: row.thinking_signature || undefined,
    };
  }

  if (row.response_text) {
    frame.claudeResponse = { text: row.response_text };
  }

  // Load tool execution if this is a tool frame
  if (row.frame_type === 'tool_execution') {
    const toolExecution = getToolExecution(row.id);
    if (toolExecution) {
      frame.toolExecution = toolExecution;
    }
  }

  return frame;
}

/**
 * Helper: Get import statistics
 *
 * @returns {{ total: number; pending: number; completed: number; failed: number }}
 */
export function getImportStats(): {
  total: number;
  pending: number;
  completed: number;
  failed: number;
} {
  const db = getTranscriptDbInstance();

  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
    FROM parsing_status
  `).get() as {
    total: number;
    pending: number;
    completed: number;
    failed: number;
  };

  return stats;
}
