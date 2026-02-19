/**
 * Stats API Routes
 *
 * Provides aggregated statistics for the Overview dashboard
 */

import { Router, Request, Response } from 'express';
import { getSessionIndexer } from '../parser/session-indexer';
import type { AgentType } from '../types/transcript';

const router = Router();

interface OverviewStats {
  totalSessions: number;
  thisWeek: number;
  avgDurationMs: number;
  liveCount: number;
  agentBreakdown: Record<AgentType | 'unknown', number>;
  activityByDay: Array<{ date: string; count: number }>;
}

/**
 * Check if a session's cwd matches the filter directory
 */
function matchesCwd(sessionCwd: string, filterCwd: string): boolean {
  if (!sessionCwd || !filterCwd) return false;
  const normalizedSession = sessionCwd.replace(/\/$/, '');
  const normalizedFilter = filterCwd.replace(/\/$/, '');
  return (
    normalizedSession === normalizedFilter || normalizedSession.startsWith(normalizedFilter + '/')
  );
}

/**
 * GET /api/stats/overview
 * Get aggregated statistics for the dashboard overview
 *
 * Response:
 * - totalSessions: Total number of sessions
 * - thisWeek: Sessions created in the last 7 days
 * - avgDurationMs: Average session duration in milliseconds
 * - liveCount: Number of ongoing/live sessions
 * - agentBreakdown: Sessions per agent type
 * - activityByDay: Session count per day (last 30 days)
 */
router.get('/overview', async (_req: Request, res: Response) => {
  try {
    const indexer = getSessionIndexer();

    // Fetch all sessions
    let sessions = await indexer.getAllSessions();

    // Apply CWD filter (matching session list behavior)
    const cwdFilter = indexer.getCwdFilter();
    if (cwdFilter) {
      sessions = sessions.filter((s) => matchesCwd(s.cwd, cwdFilter));
    }

    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Calculate stats
    let totalDuration = 0;
    let sessionsWithDuration = 0;
    let liveCount = 0;
    let thisWeekCount = 0;

    const agentBreakdown: Record<string, number> = {
      claude: 0,
      codex: 0,
      gemini: 0,
      unknown: 0,
    };

    // Activity by day map
    const activityMap = new Map<string, number>();

    // Initialize last 30 days with zero counts
    for (let i = 0; i < 30; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0] as string;
      activityMap.set(dateStr, 0);
    }

    // Process sessions
    for (const session of sessions) {
      // Duration
      if (session.duration && session.duration > 0) {
        totalDuration += session.duration * 1000; // Convert seconds to ms
        sessionsWithDuration++;
      }

      // Live count
      if (session.isOngoing) {
        liveCount++;
      }

      // This week
      const sessionDate = new Date(session.startTime);
      if (sessionDate >= weekAgo) {
        thisWeekCount++;
      }

      // Agent breakdown
      const agent = session.agent || 'unknown';
      agentBreakdown[agent] = (agentBreakdown[agent] || 0) + 1;

      // Activity by day (last 30 days)
      if (sessionDate >= thirtyDaysAgo) {
        const dateStr = sessionDate.toISOString().split('T')[0] as string;
        activityMap.set(dateStr, (activityMap.get(dateStr) || 0) + 1);
      }
    }

    // Convert activity map to sorted array
    const activityByDay = Array.from(activityMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const stats: OverviewStats = {
      totalSessions: sessions.length,
      thisWeek: thisWeekCount,
      avgDurationMs:
        sessionsWithDuration > 0 ? Math.round(totalDuration / sessionsWithDuration) : 0,
      liveCount,
      agentBreakdown: agentBreakdown as Record<AgentType | 'unknown', number>,
      activityByDay,
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching overview stats:', error);
    res.status(500).json({
      error: 'Failed to fetch overview statistics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/stats/folders
 * Get session counts grouped by project folder
 *
 * Response:
 * - folders: Array of { path, name, sessionCount, liveCount, lastActivity }
 */
router.get('/folders', async (_req: Request, res: Response) => {
  try {
    const indexer = getSessionIndexer();

    // Fetch all sessions (bypass CWD filter for folder view)
    const sessions = await indexer.getAllSessions();

    // Group by project folder
    const folderMap = new Map<
      string,
      {
        path: string;
        name: string;
        sessionCount: number;
        liveCount: number;
        lastActivity: string;
      }
    >();

    for (const session of sessions) {
      const folderPath = session.project;
      const existing = folderMap.get(folderPath);

      if (existing) {
        existing.sessionCount++;
        if (session.isOngoing) existing.liveCount++;
        if (new Date(session.startTime) > new Date(existing.lastActivity)) {
          existing.lastActivity = session.startTime;
        }
      } else {
        folderMap.set(folderPath, {
          path: folderPath,
          name: folderPath.split('/').pop() || folderPath,
          sessionCount: 1,
          liveCount: session.isOngoing ? 1 : 0,
          lastActivity: session.startTime,
        });
      }
    }

    // Sort by last activity
    const folders = Array.from(folderMap.values()).sort(
      (a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
    );

    res.json({ folders, total: folders.length });
  } catch (error) {
    console.error('Error fetching folder stats:', error);
    res.status(500).json({
      error: 'Failed to fetch folder statistics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
