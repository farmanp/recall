import { Router, Request, Response } from 'express';
import { getSessionIndexer } from '../parser/session-indexer';
import { ParserFactory } from '../parser/parser-factory';
import { detectAgentFromPath } from '../parser/agent-detector';
import { SessionTimeline, AgentType } from '../types/transcript';
import {
  getTranscriptSessions,
  getTranscriptFrames,
  searchGlobalFrames,
} from '../db/transcript-queries';
import { SearchGlobalRequest } from '../types/transcript';

const router = Router();

// Global cache for parsed timelines (optional optimization)
const timelineCache = new Map<string, SessionTimeline>();

/**
 * Data source type for session queries
 */
type DataSource = 'filesystem' | 'db';

/**
 * Helper to get data source from query parameter
 * Defaults to 'filesystem' for backwards compatibility
 */
function getDataSource(req: Request): DataSource {
  const source = getStringParam(req.query.source);
  if (source === 'db') {
    return 'db';
  }
  return 'filesystem';
}

/**
 * Helper to safely extract string query parameters
 */
function getStringParam(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  return undefined;
}

/**
 * GET /api/agents
 * List available agents and their session counts
 *
 * Response:
 * - agents: Array of available agent types
 * - counts: Object mapping agent type to session count
 *
 * @example
 * GET /api/agents
 * {
 *   "agents": ["claude", "codex"],
 *   "counts": { "claude": 150, "codex": 25 }
 * }
 */
router.get('/agents', async (_req: Request, res: Response) => {
  try {
    const indexer = getSessionIndexer();
    const available = await indexer.getAvailableAgents();
    res.json(available);
  } catch (error) {
    console.error('Error fetching agents:', error);
    res.status(500).json({
      error: 'Failed to fetch agents',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/sessions
 * List all available sessions
 *
 * Query Parameters:
 * - source (string): Data source - 'filesystem' or 'db' (default: 'filesystem')
 * - offset (number): Skip N sessions (default: 0)
 * - limit (number): Return N sessions (default: 20)
 * - project (string): Filter by project name
 * - agent (string): Filter by agent type ('claude', 'codex', 'gemini', 'unknown')
 *
 * Response:
 * - sessions: Array of session metadata
 * - total: Total number of sessions
 * - offset: Current offset
 * - limit: Current limit
 * - source: Data source used
 * - agent: Agent filter if applied
 *
 * @example
 * GET /api/sessions?limit=10&offset=0
 * GET /api/sessions?source=db&limit=10
 * GET /api/sessions?project=/Users/fpirzada/Documents/cc_mem_video_player
 * GET /api/sessions?agent=claude
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const source = getDataSource(req);
    const offsetStr = getStringParam(req.query.offset);
    const limitStr = getStringParam(req.query.limit);
    const offset = offsetStr ? parseInt(offsetStr, 10) : 0;
    const limit = limitStr ? parseInt(limitStr, 10) : 20;
    const projectFilter = getStringParam(req.query.project);
    const agent = getStringParam(req.query.agent) as AgentType | undefined;
    const hasClaudeMd = req.query.hasClaudeMd === 'true';

    if (source === 'db') {
      // Use database
      const result = getTranscriptSessions({
        offset,
        limit,
        project: projectFilter,
        agent,
      });

      res.json({
        sessions: result.sessions,
        total: result.total,
        offset,
        limit,
        source: 'db',
        agent,
      });
    } else {
      // Use filesystem (existing implementation)
      const indexer = getSessionIndexer();
      let sessions = await indexer.getAllSessions();

      // Filter by project if specified
      if (projectFilter) {
        sessions = sessions.filter((s) => s.project.includes(projectFilter));
      }

      // Filter by agent if specified
      if (agent) {
        sessions = sessions.filter((s) => s.agent === agent);
      }

      // Filter by CLAUDE.md presence if specified
      if (hasClaudeMd) {
        sessions = sessions.filter((s) => s.claudeMdFiles && s.claudeMdFiles.length > 0);
      }

      // Sort by start time (most recent first)
      sessions.sort((a, b) => {
        return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
      });

      // Apply pagination
      const paginatedSessions = sessions.slice(offset, offset + limit);

      res.json({
        sessions: paginatedSessions,
        total: sessions.length,
        offset,
        limit,
        source: 'filesystem',
        agent,
        hasClaudeMd,
      });
    }
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({
      error: 'Failed to fetch sessions',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
});

/**
 * GET /api/sessions/search
 * Global content search across all sessions
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const query = getStringParam(req.query.q);
    if (!query) {
      res.status(400).json({ error: 'Search query "q" is required' });
      return;
    }

    const limitStr = getStringParam(req.query.limit);
    const offsetStr = getStringParam(req.query.offset);
    const agent = getStringParam(req.query.agent) as any;
    const project = getStringParam(req.query.project);

    const searchReq: SearchGlobalRequest = {
      query,
      limit: limitStr ? parseInt(limitStr, 10) : 50,
      offset: offsetStr ? parseInt(offsetStr, 10) : 0,
      agent,
      project,
    };

    const results = searchGlobalFrames(searchReq);
    res.json(results);
  } catch (error) {
    console.error('Error performing global search:', error);
    res.status(500).json({
      error: 'Failed to perform search',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/sessions/:id
 * Get session timeline metadata (without frames)
 *
 * URL Parameters:
 * - id: Session UUID
 *
 * Response:
 * - SessionTimeline object (without frames array)
 *
 * Status Codes:
 * - 200: Success
 * - 404: Session not found
 * - 500: Internal error
 *
 * @example
 * GET /api/sessions/4b198fdf-b80d-4bbc-806f-2900282cdc56
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.id as string;
    if (!sessionId) {
      res.status(400).json({ error: 'Session ID is required' });
      return;
    }

    const indexer = getSessionIndexer();

    // Get session metadata from index
    const metadata = await indexer.getSessionMetadata(sessionId);
    if (!metadata) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    // Build timeline to get full metadata
    const timeline = await getOrBuildTimeline(sessionId);
    if (!timeline) {
      res.status(404).json({ error: 'Failed to load session timeline' });
      return;
    }

    // Return timeline without frames
    const { frames, ...timelineMetadata } = timeline;

    res.json(timelineMetadata);
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({
      error: 'Failed to fetch session',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/sessions/:id/frames
 * Get playback frames for a session with pagination
 *
 * URL Parameters:
 * - id: Session UUID
 *
 * Query Parameters:
 * - source (string): Data source - 'filesystem' or 'db' (default: 'filesystem')
 * - offset (number): Skip N frames (default: 0)
 * - limit (number): Return N frames (default: 100)
 *
 * Response:
 * - frames: Array of PlaybackFrame objects
 * - total: Total number of frames
 * - offset: Current offset
 * - limit: Current limit
 * - source: Data source used
 *
 * Status Codes:
 * - 200: Success
 * - 404: Session not found
 * - 500: Internal error
 *
 * @example
 * GET /api/sessions/4b198fdf-b80d-4bbc-806f-2900282cdc56/frames?offset=0&limit=100
 * GET /api/sessions/4b198fdf-b80d-4bbc-806f-2900282cdc56/frames?source=db&offset=0&limit=100
 */
router.get('/:id/frames', async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.id as string;
    if (!sessionId) {
      res.status(400).json({ error: 'Session ID is required' });
      return;
    }

    const source = getDataSource(req);
    const offsetStr = getStringParam(req.query.offset);
    const limitStr = getStringParam(req.query.limit);
    const offset = offsetStr ? parseInt(offsetStr, 10) : 0;
    const limit = limitStr ? parseInt(limitStr, 10) : 100;

    if (source === 'db') {
      // Use database
      const result = getTranscriptFrames(sessionId, { offset, limit });

      res.json({
        frames: result.frames,
        total: result.total,
        offset,
        limit,
        source: 'db',
      });
    } else {
      // Use filesystem (existing implementation)
      const timeline = await getOrBuildTimeline(sessionId);
      if (!timeline) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      const paginatedFrames = timeline.frames.slice(offset, offset + limit);

      res.json({
        frames: paginatedFrames,
        total: timeline.totalFrames,
        offset,
        limit,
        source: 'filesystem',
      });
    }
  } catch (error) {
    console.error('Error fetching session frames:', error);
    res.status(500).json({
      error: 'Failed to fetch session frames',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/sessions/:id/frames/:frameId
 * Get a single playback frame by ID
 *
 * URL Parameters:
 * - id: Session UUID
 * - frameId: Frame ID
 *
 * Response:
 * - PlaybackFrame object
 *
 * Status Codes:
 * - 200: Success
 * - 404: Session or frame not found
 * - 500: Internal error
 *
 * @example
 * GET /api/sessions/4b198fdf-b80d-4bbc-806f-2900282cdc56/frames/abc123-user-text
 */
router.get('/:id/frames/:frameId', async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.id as string;
    const frameId = req.params.frameId as string;

    if (!sessionId || !frameId) {
      res.status(400).json({ error: 'Session ID and Frame ID are required' });
      return;
    }

    // Build or get cached timeline
    const timeline = await getOrBuildTimeline(sessionId);
    if (!timeline) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    // Find frame by ID
    const frame = timeline.frames.find((f) => f.id === frameId);
    if (!frame) {
      res.status(404).json({ error: 'Frame not found' });
      return;
    }

    res.json(frame);
  } catch (error) {
    console.error('Error fetching frame:', error);
    res.status(500).json({
      error: 'Failed to fetch frame',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/sessions/:id/refresh
 * Refresh cached timeline for a session
 * Forces re-parsing of transcript file
 *
 * URL Parameters:
 * - id: Session UUID
 *
 * Response:
 * - success: boolean
 * - message: string
 *
 * @example
 * POST /api/sessions/4b198fdf-b80d-4bbc-806f-2900282cdc56/refresh
 */
router.post('/:id/refresh', async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.id as string;
    if (!sessionId) {
      res.status(400).json({ error: 'Session ID is required' });
      return;
    }

    // Clear cache
    timelineCache.delete(sessionId);

    // Rebuild timeline
    const timeline = await getOrBuildTimeline(sessionId);
    if (!timeline) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    res.json({
      success: true,
      message: 'Timeline refreshed successfully',
      totalFrames: timeline.totalFrames,
    });
  } catch (error) {
    console.error('Error refreshing session:', error);
    res.status(500).json({
      error: 'Failed to refresh session',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/sessions/:id/claudemd-history
 * Get CLAUDE.md version history for the project of a given session
 *
 * Returns all CLAUDE.md versions used across sessions for the project,
 * with date ranges and session counts for each version.
 *
 * URL Parameters:
 * - id: Session UUID
 *
 * Response:
 * - project: Project name
 * - versions: Array of ClaudeMdVersion objects
 *
 * @example
 * GET /api/sessions/4b198fdf-b80d-4bbc-806f-2900282cdc56/claudemd-history
 */
router.get('/:id/claudemd-history', async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.id as string;

    const { getSessionById } = await import('../db/queries');
    const { getClaudeMdHistory } = await import('../db/claudemd-queries');

    // Get session to determine project
    const session = getSessionById(sessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    // Get CLAUDE.md history for this project
    const history = getClaudeMdHistory(session.project);

    res.json(history);
  } catch (error) {
    console.error('Error fetching CLAUDE.md history:', error);
    res.status(500).json({
      error: 'Failed to fetch CLAUDE.md history',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/claudemd/compare
 * Compare two CLAUDE.md snapshots side-by-side
 *
 * Query Parameters:
 * - from: Snapshot ID (number)
 * - to: Snapshot ID (number)
 *
 * Response:
 * - from: ClaudeMdSnapshot object
 * - to: ClaudeMdSnapshot object
 *
 * @example
 * GET /api/claudemd/compare?from=1&to=2
 */
router.get('/claudemd/compare', async (req: Request, res: Response) => {
  try {
    const fromStr = getStringParam(req.query.from);
    const toStr = getStringParam(req.query.to);

    if (!fromStr || !toStr) {
      res.status(400).json({ error: 'Both "from" and "to" snapshot IDs are required' });
      return;
    }

    const fromId = parseInt(fromStr, 10);
    const toId = parseInt(toStr, 10);

    if (isNaN(fromId) || isNaN(toId)) {
      res.status(400).json({ error: 'Snapshot IDs must be valid numbers' });
      return;
    }

    const { compareClaudeMdSnapshots } = await import('../db/claudemd-queries');

    const comparison = compareClaudeMdSnapshots(fromId, toId);

    if (!comparison) {
      res.status(404).json({ error: 'One or both snapshots not found' });
      return;
    }

    res.json(comparison);
  } catch (error) {
    console.error('Error comparing CLAUDE.md snapshots:', error);
    res.status(500).json({
      error: 'Failed to compare snapshots',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/sessions/:id/claudemd-snapshots
 * Get all CLAUDE.md snapshots linked to a specific session
 *
 * URL Parameters:
 * - id: Session UUID
 *
 * Response:
 * - snapshots: Array of ClaudeMdSnapshot objects
 *
 * @example
 * GET /api/sessions/4b198fdf-b80d-4bbc-806f-2900282cdc56/claudemd-snapshots
 */
router.get('/:id/claudemd-snapshots', async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.id as string;

    const { getSessionClaudeMdSnapshots } = await import('../db/claudemd-queries');

    const snapshots = getSessionClaudeMdSnapshots(sessionId);

    res.json({ snapshots });
  } catch (error) {
    console.error('Error fetching session CLAUDE.md snapshots:', error);
    res.status(500).json({
      error: 'Failed to fetch CLAUDE.md snapshots',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Helper: Get or build timeline for a session
 * Uses cache if available, otherwise parses transcript file
 * Automatically detects agent type from file path
 */
async function getOrBuildTimeline(sessionId: string): Promise<SessionTimeline | null> {
  // Check cache first
  if (timelineCache.has(sessionId)) {
    return timelineCache.get(sessionId)!;
  }

  // Find session file
  const indexer = getSessionIndexer();
  const filePath = await indexer.findSessionFile(sessionId);

  if (!filePath) {
    return null;
  }

  // Detect agent type from file path
  const agentType = detectAgentFromPath(filePath);

  // Parse transcript and build timeline using ParserFactory
  const transcript = await ParserFactory.parseFile(filePath);
  const timeline = await ParserFactory.buildTimeline(transcript, agentType);

  // Cache for future requests
  timelineCache.set(sessionId, timeline);

  return timeline;
}

export default router;
