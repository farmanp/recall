import { Router, Request, Response } from 'express';
import { LRUCache } from 'lru-cache';
import { getSessionIndexer } from '../parser/session-indexer';
import { ParserFactory } from '../parser/parser-factory';
import { detectAgentFromPath } from '../parser/agent-detector';
import { SessionTimeline } from '../types/transcript';
import {
  getTranscriptSessions,
  getTranscriptFrames,
  searchGlobalFrames,
} from '../db/transcript-queries';
import { SearchGlobalRequest } from '../types/transcript';
import { validateClaudeMdPath } from '../utils/path-security';
import { validateQuery, validateParams } from '../middleware/validation';
import {
  sessionListSchema,
  sessionIdSchema,
  frameListSchema,
  searchQuerySchema,
  claudeMdCompareSchema,
  claudeMdPathSchema,
  SessionListParams,
  FrameListParams,
  SearchQueryParams,
  ClaudeMdCompareParams,
  ClaudeMdPathParams,
} from '../validation/schemas';

const router = Router();

/**
 * Check if a session's cwd matches the filter directory
 * Returns true if session cwd is the filter directory or a subdirectory of it
 */
function matchesCwd(sessionCwd: string, filterCwd: string): boolean {
  if (!sessionCwd || !filterCwd) return false;
  // Normalize paths by removing trailing slashes
  const normalizedSession = sessionCwd.replace(/\/$/, '');
  const normalizedFilter = filterCwd.replace(/\/$/, '');
  // Match if session is in or under the filter directory
  return (
    normalizedSession === normalizedFilter || normalizedSession.startsWith(normalizedFilter + '/')
  );
}

// Global LRU cache for parsed timelines to prevent memory leaks
// Capped at 50 sessions (~200MB max) with 30-minute TTL
const timelineCache = new LRUCache<string, SessionTimeline>({
  max: 50, // Maximum 50 sessions in memory
  ttl: 1000 * 60 * 30, // 30 minute TTL
  updateAgeOnGet: true, // Reset TTL on access (LRU behavior)
});

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
 * GET /api/sessions/cwd-filter
 * Get the current CWD filter configuration
 *
 * Response:
 * - enabled: Whether CWD filtering is enabled
 * - cwd: The current working directory filter (null if disabled)
 *
 * @example
 * GET /api/sessions/cwd-filter
 * { "enabled": true, "cwd": "/Users/me/projects/myapp" }
 */
router.get('/cwd-filter', (_req: Request, res: Response) => {
  const indexer = getSessionIndexer();
  const cwdFilter = indexer.getCwdFilter();
  res.json({
    enabled: cwdFilter !== null,
    cwd: cwdFilter,
  });
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
router.get('/', validateQuery(sessionListSchema), async (_req: Request, res: Response) => {
  try {
    const {
      source,
      offset,
      limit,
      project: projectFilter,
      agent,
      hasClaudeMd,
      showAll,
    } = res.locals.validatedQuery as SessionListParams;

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

      // Apply CWD filter unless showAll is true
      const cwdFilter = indexer.getCwdFilter();
      if (!showAll && cwdFilter) {
        sessions = sessions.filter((s) => matchesCwd(s.cwd, cwdFilter));
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
        cwdFilter: !showAll ? cwdFilter : null,
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
router.get('/search', validateQuery(searchQuerySchema), async (_req: Request, res: Response) => {
  try {
    const {
      q: query,
      limit,
      offset,
      agent,
      project,
    } = res.locals.validatedQuery as SearchQueryParams;

    const searchReq: SearchGlobalRequest = {
      query,
      limit,
      offset,
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

    // Return timeline without frames, but include claudeMdFiles from indexer metadata
    const { frames, ...timelineMetadata } = timeline;

    res.json({
      ...timelineMetadata,
      metadata: {
        ...timelineMetadata.metadata,
        claudeMdFiles: metadata.claudeMdFiles || [],
      },
    });
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
router.get(
  '/:id/frames',
  validateParams(sessionIdSchema),
  validateQuery(frameListSchema),
  async (_req: Request, res: Response) => {
    try {
      const { id: sessionId } = res.locals.validatedParams;
      const { source, offset, limit } = res.locals.validatedQuery as FrameListParams;

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
  }
);

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
router.get(
  '/claudemd/compare',
  validateQuery(claudeMdCompareSchema),
  async (_req: Request, res: Response) => {
    try {
      const { from: fromId, to: toId } = res.locals.validatedQuery as ClaudeMdCompareParams;

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
  }
);

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

/**
 * GET /api/claudemd/content
 * Fetch the content of a CLAUDE.md file from the filesystem
 *
 * Query Parameters:
 * - path: Absolute path to the CLAUDE.md file
 *
 * Response:
 * - content: File content as string
 * - exists: Whether the file exists
 *
 * Security:
 * - Only allows reading files named exactly CLAUDE.md
 * - Only allows files within whitelisted directories (~/.claude/projects, ~/Documents, ~/projects)
 * - Resolves symlinks to prevent traversal escapes
 */
router.get(
  '/claudemd/content',
  validateQuery(claudeMdPathSchema),
  async (_req: Request, res: Response) => {
    try {
      const { path: filePath } = res.locals.validatedQuery as ClaudeMdPathParams;

      // Security validation with directory whitelist and symlink detection
      const validation = validateClaudeMdPath(filePath);
      if (!validation.isValid) {
        res.status(403).json({ error: validation.error });
        return;
      }

      const fs = await import('fs');
      const safePath = validation.resolvedPath!;

      // Check if file exists
      if (!fs.existsSync(safePath)) {
        res.json({ exists: false, content: null });
        return;
      }

      // Read the file content
      const content = fs.readFileSync(safePath, 'utf-8');

      res.json({ exists: true, content });
    } catch (error) {
      console.error('Error reading CLAUDE.md file:', error);
      res.status(500).json({
        error: 'Failed to read file',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

export default router;
