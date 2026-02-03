import { getDbInstance } from './connection';
import type {
  Session,
  SessionEvent,
  SessionListQuery,
  SessionEventsQuery
} from './schema';

/**
 * Raw event from database (before JSON parsing)
 * JSON fields are still strings and need to be parsed
 */
interface RawSessionEvent extends Omit<SessionEvent, 'facts' | 'concepts' | 'files_read' | 'files_modified'> {
  facts?: string;
  concepts?: string;
  files_read?: string;
  files_modified?: string;
}

/**
 * Get all sessions with optional filtering and pagination
 *
 * Fetches sessions from the claude-mem database with support for:
 * - Pagination (offset/limit)
 * - Project filtering
 * - Date range filtering
 *
 * Results are ordered by most recent first (started_at_epoch DESC).
 *
 * @param {SessionListQuery} query - Query parameters
 * @param {number} [query.offset=0] - Number of sessions to skip
 * @param {number} [query.limit=20] - Maximum number of sessions to return
 * @param {string} [query.project] - Filter by project name (exact match)
 * @param {string} [query.dateStart] - Filter sessions started after this date (ISO 8601)
 * @param {string} [query.dateEnd] - Filter sessions started before this date (ISO 8601)
 * @returns {{ sessions: Session[]; total: number }} Paginated sessions and total count
 *
 * @example
 * // Get first 10 sessions
 * const result = getSessions({ limit: 10, offset: 0 });
 * console.log(`Found ${result.total} total sessions`);
 * console.log(`Showing ${result.sessions.length} sessions`);
 *
 * @example
 * // Filter by project and date
 * const result = getSessions({
 *   project: 'my-project',
 *   dateStart: '2026-02-01T00:00:00.000Z',
 *   limit: 20
 * });
 */
export function getSessions(query: SessionListQuery): { sessions: Session[]; total: number } {
  const db = getDbInstance();

  const {
    offset = 0,
    limit = 20,
    project,
    dateStart,
    dateEnd
  } = query;

  // Build WHERE clauses
  const whereClauses: string[] = [];
  const params: Record<string, unknown> = {};

  if (project) {
    whereClauses.push('project = @project');
    params.project = project;
  }

  if (dateStart) {
    whereClauses.push('started_at_epoch >= @dateStart');
    params.dateStart = new Date(dateStart).getTime();
  }

  if (dateEnd) {
    whereClauses.push('started_at_epoch <= @dateEnd');
    params.dateEnd = new Date(dateEnd).getTime();
  }

  const whereClause = whereClauses.length > 0
    ? 'WHERE ' + whereClauses.join(' AND ')
    : '';

  // Get total count
  const countQuery = `SELECT COUNT(*) as total FROM sdk_sessions ${whereClause}`;
  const countResult = db.prepare(countQuery).get(params) as { total: number };
  const total = countResult.total;

  // Get paginated sessions
  const sessionsQuery = `
    SELECT *
    FROM sdk_sessions
    ${whereClause}
    ORDER BY started_at_epoch DESC
    LIMIT @limit OFFSET @offset
  `;

  const sessions = db.prepare(sessionsQuery).all({
    ...params,
    limit,
    offset
  }) as Session[];

  return { sessions, total };
}

/**
 * Get a single session by its UUID
 *
 * Fetches session metadata from the sdk_sessions table.
 * Returns null if the session doesn't exist.
 *
 * @param {string} sessionId - Claude session UUID (claude_session_id)
 * @returns {Session | null} Session object or null if not found
 *
 * @example
 * const session = getSessionById('550e8400-e29b-41d4-a716-446655440000');
 * if (session) {
 *   console.log(`Project: ${session.project}`);
 *   console.log(`Prompts: ${session.prompt_counter}`);
 * }
 */
export function getSessionById(sessionId: string): Session | null {
  const db = getDbInstance();

  const session = db.prepare(`
    SELECT *
    FROM sdk_sessions
    WHERE claude_session_id = ?
  `).get(sessionId) as Session | undefined;

  return session || null;
}

/**
 * Get statistics for a session
 *
 * Calculates the total number of events, prompts, and observations
 * for a given session. Useful for displaying session metadata.
 *
 * @param {string} sessionId - Claude session UUID
 * @returns {{ eventCount: number; promptCount: number; observationCount: number } | null}
 *          Statistics object or null if session not found
 *
 * @example
 * const stats = getSessionStats('550e8400-e29b-41d4-a716-446655440000');
 * if (stats) {
 *   console.log(`Total events: ${stats.eventCount}`);
 *   console.log(`Prompts: ${stats.promptCount}`);
 *   console.log(`Observations: ${stats.observationCount}`);
 * }
 */
export function getSessionStats(sessionId: string): {
  eventCount: number;
  promptCount: number;
  observationCount: number;
} | null {
  const db = getDbInstance();

  // Get prompt count
  const promptCountResult = db.prepare(`
    SELECT COUNT(*) as count
    FROM user_prompts
    WHERE claude_session_id = ?
  `).get(sessionId) as { count: number } | undefined;

  // Get observation count
  const obsCountResult = db.prepare(`
    SELECT COUNT(*) as count
    FROM observations o
    INNER JOIN sdk_sessions s ON o.sdk_session_id = s.sdk_session_id
    WHERE s.claude_session_id = ?
  `).get(sessionId) as { count: number } | undefined;

  if (!promptCountResult || !obsCountResult) {
    return null;
  }

  const promptCount = promptCountResult.count;
  const observationCount = obsCountResult.count;

  return {
    eventCount: promptCount + observationCount,
    promptCount,
    observationCount
  };
}

/**
 * Get session timeline events with TIME-FIRST ordering
 *
 * This is the core timeline reconstruction algorithm, validated in Phase 0.
 * Events are ordered chronologically with prompts appearing before observations.
 *
 * **Ordering Algorithm:**
 * 1. PRIMARY: Timestamp (ts ASC) - Chronological order
 * 2. SECONDARY: Prompt number (COALESCE(prompt_number, 999999) ASC) - Group by prompt
 * 3. TERTIARY: Kind rank (kind_rank ASC) - Prompts before observations
 * 4. FINAL: Row ID (row_id ASC) - Stable tiebreaker
 *
 * **JSON Field Parsing:**
 * The following fields are automatically parsed from JSON strings:
 * - facts
 * - concepts
 * - files_read
 * - files_modified
 *
 * **Validation:**
 * This query has been validated on sessions with up to 902 events and passes
 * all ordering checks (monotonic timestamps, prompt-before-observation, etc.)
 *
 * @param {string} sessionId - Claude session UUID
 * @param {SessionEventsQuery} query - Filter and pagination options
 * @param {number} [query.offset=0] - Number of events to skip
 * @param {number} [query.limit=100] - Maximum number of events to return
 * @param {string} [query.types] - Comma-separated observation types (e.g., "feature,bugfix")
 * @param {number} [query.afterTs] - Only return events after this timestamp (epoch ms)
 * @returns {{ events: SessionEvent[]; total: number }} Ordered events and total count
 *
 * @example
 * // Get first 100 events
 * const result = getSessionEvents(sessionId, { limit: 100, offset: 0 });
 * console.log(`Total events: ${result.total}`);
 * console.log(`Fetched: ${result.events.length}`);
 *
 * @example
 * // Get only feature observations
 * const result = getSessionEvents(sessionId, {
 *   types: 'feature',
 *   limit: 50
 * });
 *
 * @example
 * // Infinite scroll pagination
 * const page1 = getSessionEvents(sessionId, { limit: 100, offset: 0 });
 * const page2 = getSessionEvents(sessionId, { limit: 100, offset: 100 });
 */
export function getSessionEvents(
  sessionId: string,
  query: SessionEventsQuery
): { events: SessionEvent[]; total: number } {
  const db = getDbInstance();

  const {
    offset = 0,
    limit = 100,
    types,
    afterTs
  } = query;

  // Build observation type filter
  let obsTypeFilter = '';
  const obsParams: string[] = [];

  if (types) {
    const typeArray = types.split(',').map(t => t.trim());
    obsTypeFilter = ` AND o.type IN (${typeArray.map(() => '?').join(',')})`;
    obsParams.push(...typeArray);
  }

  // Build afterTs filter
  const afterTsFilter = afterTs ? ' AND combined.ts > ?' : '';
  const afterTsParam = afterTs ? [afterTs] : [];

  // Get total count first
  const countQuery = `
    SELECT COUNT(*) as total FROM (
      SELECT
        'prompt' as event_type,
        p.created_at_epoch as ts
      FROM user_prompts p
      WHERE p.claude_session_id = ?

      UNION ALL

      SELECT
        'observation' as event_type,
        o.created_at_epoch as ts
      FROM observations o
      INNER JOIN sdk_sessions s ON o.sdk_session_id = s.sdk_session_id
      WHERE s.claude_session_id = ?
      ${obsTypeFilter}
    ) combined
    ${afterTsFilter}
  `;

  const countResult = db.prepare(countQuery).get(
    sessionId,
    sessionId,
    ...obsParams,
    ...afterTsParam
  ) as { total: number };

  const total = countResult.total;

  // Get paginated events using TIME-FIRST ordering
  const eventsQuery = `
    SELECT * FROM (
      SELECT
        'prompt' as event_type,
        p.id as row_id,
        p.prompt_number,
        p.created_at_epoch as ts,
        p.prompt_text as text,
        0 as kind_rank,
        NULL as obs_type,
        NULL as title,
        NULL as subtitle,
        NULL as facts,
        NULL as narrative,
        NULL as concepts,
        NULL as files_read,
        NULL as files_modified
      FROM user_prompts p
      WHERE p.claude_session_id = ?

      UNION ALL

      SELECT
        'observation' as event_type,
        o.id as row_id,
        o.prompt_number,
        o.created_at_epoch as ts,
        COALESCE(o.title, o.narrative, o.text) as text,
        1 as kind_rank,
        o.type as obs_type,
        o.title,
        o.subtitle,
        o.facts,
        o.narrative,
        o.concepts,
        o.files_read,
        o.files_modified
      FROM observations o
      INNER JOIN sdk_sessions s ON o.sdk_session_id = s.sdk_session_id
      WHERE s.claude_session_id = ?
      ${obsTypeFilter}
    ) combined
    ${afterTsFilter}
    ORDER BY
      ts ASC,
      COALESCE(prompt_number, 999999) ASC,
      kind_rank ASC,
      row_id ASC
    LIMIT ? OFFSET ?
  `;

  const rawEvents = db.prepare(eventsQuery).all(
    sessionId,
    sessionId,
    ...obsParams,
    ...afterTsParam,
    limit,
    offset
  ) as RawSessionEvent[];

  // Parse JSON fields
  const parsedEvents: SessionEvent[] = rawEvents.map(event => {
    if (event.event_type === 'observation') {
      return {
        ...event,
        facts: event.facts ? tryParseJSON(event.facts) : undefined,
        concepts: event.concepts ? tryParseJSON(event.concepts) : undefined,
        files_read: event.files_read ? tryParseJSON(event.files_read) : undefined,
        files_modified: event.files_modified ? tryParseJSON(event.files_modified) : undefined,
      };
    }
    return event as SessionEvent;
  });

  return { events: parsedEvents, total };
}

/**
 * Get a single event by its type and ID
 *
 * Fetches either a prompt or observation by its database row ID.
 * For observations, JSON fields are automatically parsed.
 *
 * @param {('prompt' | 'observation')} eventType - Type of event to fetch
 * @param {number} eventId - Database row ID of the event
 * @returns {SessionEvent | null} Event object or null if not found
 *
 * @example
 * // Get a prompt
 * const prompt = getEventById('prompt', 123);
 * if (prompt) {
 *   console.log(`Prompt: ${prompt.text}`);
 * }
 *
 * @example
 * // Get an observation
 * const obs = getEventById('observation', 456);
 * if (obs) {
 *   console.log(`Type: ${obs.obs_type}`);
 *   console.log(`Title: ${obs.title}`);
 *   console.log(`Files modified: ${obs.files_modified?.join(', ')}`);
 * }
 */
export function getEventById(eventType: 'prompt' | 'observation', eventId: number): SessionEvent | null {
  const db = getDbInstance();

  if (eventType === 'prompt') {
    const prompt = db.prepare(`
      SELECT
        'prompt' as event_type,
        id as row_id,
        prompt_number,
        created_at_epoch as ts,
        prompt_text as text,
        0 as kind_rank
      FROM user_prompts
      WHERE id = ?
    `).get(eventId) as SessionEvent | undefined;

    return prompt || null;
  } else {
    const rawObs = db.prepare(`
      SELECT
        'observation' as event_type,
        id as row_id,
        prompt_number,
        created_at_epoch as ts,
        COALESCE(title, narrative, text) as text,
        1 as kind_rank,
        type as obs_type,
        title,
        subtitle,
        facts,
        narrative,
        concepts,
        files_read,
        files_modified
      FROM observations
      WHERE id = ?
    `).get(eventId) as RawSessionEvent | undefined;

    if (!rawObs) {
      return null;
    }

    // Parse JSON fields
    const obs: SessionEvent = {
      ...rawObs,
      facts: rawObs.facts ? tryParseJSON(rawObs.facts) : undefined,
      concepts: rawObs.concepts ? tryParseJSON(rawObs.concepts) : undefined,
      files_read: rawObs.files_read ? tryParseJSON(rawObs.files_read) : undefined,
      files_modified: rawObs.files_modified ? tryParseJSON(rawObs.files_modified) : undefined,
    };
    return obs;
  }
}

/**
 * Get a list of all unique project names
 *
 * Returns all distinct project names from the sessions table,
 * sorted alphabetically. Useful for project filter dropdowns.
 *
 * @returns {string[]} Array of project names
 *
 * @example
 * const projects = getProjects();
 * console.log(`Found ${projects.length} projects:`);
 * projects.forEach(p => console.log(`  - ${p}`));
 */
export function getProjects(): string[] {
  const db = getDbInstance();

  const results = db.prepare(`
    SELECT DISTINCT project
    FROM sdk_sessions
    ORDER BY project ASC
  `).all() as { project: string }[];

  return results.map(r => r.project);
}

/**
 * Helper function to safely parse JSON array fields
 *
 * Attempts to parse a JSON string into a string array.
 * Returns undefined if parsing fails or result is not an array.
 * Used for parsing facts, concepts, files_read, and files_modified fields.
 *
 * @param {string} jsonString - JSON string to parse (e.g., '["item1", "item2"]')
 * @returns {string[] | undefined} Parsed array or undefined on failure
 *
 * @example
 * const facts = tryParseJSON('["fact 1", "fact 2"]');
 * // Returns: ["fact 1", "fact 2"]
 *
 * @example
 * const invalid = tryParseJSON('not valid json');
 * // Returns: undefined
 *
 * @example
 * const notArray = tryParseJSON('{"key": "value"}');
 * // Returns: undefined (not an array)
 */
function tryParseJSON(jsonString: string): string[] | undefined {
  try {
    const parsed = JSON.parse(jsonString);
    if (Array.isArray(parsed)) {
      return parsed as string[];
    }
    return undefined;
  } catch {
    return undefined;
  }
}
