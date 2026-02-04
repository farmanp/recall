/**
 * Work Unit Correlator Service
 *
 * Implements the correlation algorithm that groups related sessions
 * across Claude, Codex, and Gemini into Work Units.
 *
 * Algorithm:
 * 1. Extract correlation data from all sessions (project, files, timestamps, cwd)
 * 2. Cluster by normalized project path (primary grouping)
 * 3. Split clusters by 4-hour time gaps
 * 4. Calculate file overlap score (Jaccard similarity)
 * 5. Assign confidence based on signals
 * 6. Persist work units to database
 */

import { v4 as uuidv4 } from 'uuid';
import type { AgentType } from '../types/transcript';
import type {
  WorkUnit,
  WorkUnitSession,
  SessionCorrelationData,
  WorkUnitConfidence,
  CorrelationReason,
  CorrelationConfig,
} from '../types/work-unit';
import { DEFAULT_CORRELATION_CONFIG } from '../types/work-unit';
export { DEFAULT_CORRELATION_CONFIG };
import { getTranscriptDbInstance } from '../db/transcript-connection';
import { getSessionIndexer } from '../parser/session-indexer';
import { ParserFactory } from '../parser/parser-factory';
import { detectAgentFromPath } from '../parser/agent-detector';

/**
 * Normalize a project path for comparison
 * Handles different formats: Claude (encoded), Codex (cwd), Gemini (hash)
 */
export function normalizeProjectPath(path: string): string {
  if (!path) return '';

  // Remove trailing slashes
  let normalized = path.replace(/\/+$/, '');

  // Handle home directory shorthand
  const home = process.env.HOME || '';
  if (home && normalized.startsWith(home)) {
    normalized = '~' + normalized.slice(home.length);
  }

  // Lowercase for comparison
  return normalized.toLowerCase();
}

/**
 * Calculate Jaccard similarity between two sets
 * Returns a value between 0 (no overlap) and 1 (identical)
 */
export function jaccardSimilarity(setA: string[], setB: string[]): number {
  if (setA.length === 0 && setB.length === 0) return 0;
  if (setA.length === 0 || setB.length === 0) return 0;

  const a = new Set(setA.map((f) => f.toLowerCase()));
  const b = new Set(setB.map((f) => f.toLowerCase()));

  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection++;
  }

  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Check if two sessions are within the time window
 */
export function isWithinTimeWindow(
  session1EndTime: number,
  session2StartTime: number,
  windowHours: number
): boolean {
  const windowMs = windowHours * 60 * 60 * 1000;
  return Math.abs(session2StartTime - session1EndTime) <= windowMs;
}

/**
 * Calculate correlation score between two sessions
 */
export function calculateCorrelationScore(
  session1: SessionCorrelationData,
  session2: SessionCorrelationData,
  config: CorrelationConfig = DEFAULT_CORRELATION_CONFIG
): { score: number; reasons: CorrelationReason[] } {
  let score = 0;
  const reasons: CorrelationReason[] = [];

  // 1. Project path match (weight: 0.5)
  const path1 = normalizeProjectPath(session1.projectPath);
  const path2 = normalizeProjectPath(session2.projectPath);
  if (path1 && path2 && path1 === path2) {
    score += 0.5;
    reasons.push('project_path_match');
  }

  // 2. File overlap (weight: 0.3)
  const files1 = [...session1.filesRead, ...session1.filesModified];
  const files2 = [...session2.filesRead, ...session2.filesModified];
  const fileOverlap = jaccardSimilarity(files1, files2);
  if (fileOverlap >= config.minFileOverlap) {
    score += 0.3 * fileOverlap;
    reasons.push('file_overlap');
  }

  // 3. Time proximity (weight: 0.15)
  const session1End = session1.endTime || session1.startTime;
  const session2Start = session2.startTime;
  if (isWithinTimeWindow(session1End, session2Start, config.timeWindowHours)) {
    // Scale by how close they are (closer = higher score)
    const gap = Math.abs(session2Start - session1End);
    const maxGap = config.timeWindowHours * 60 * 60 * 1000;
    const proximityScore = 1 - gap / maxGap;
    score += 0.15 * proximityScore;
    reasons.push('time_proximity');
  }

  // 4. CWD match (weight: 0.05)
  const cwd1 = normalizeProjectPath(session1.cwd);
  const cwd2 = normalizeProjectPath(session2.cwd);
  if (cwd1 && cwd2 && (cwd1.startsWith(cwd2) || cwd2.startsWith(cwd1))) {
    score += 0.05;
    reasons.push('cwd_match');
  }

  return { score, reasons };
}

/**
 * Determine confidence level from correlation score
 */
export function determineConfidence(
  score: number,
  reasons: CorrelationReason[],
  config: CorrelationConfig = DEFAULT_CORRELATION_CONFIG
): WorkUnitConfidence {
  // High confidence: Same project + file overlap >= 30%
  if (
    reasons.includes('project_path_match') &&
    reasons.includes('file_overlap') &&
    score >= config.highConfidenceThreshold
  ) {
    return 'high';
  }

  // Medium confidence: Same project + low file overlap
  if (reasons.includes('project_path_match') && score >= config.mediumConfidenceThreshold) {
    return 'medium';
  }

  // Low confidence: Everything else
  return 'low';
}

/**
 * Extract correlation data from a session timeline
 */
export async function extractCorrelationData(
  sessionId: string,
  filePath: string
): Promise<SessionCorrelationData | null> {
  try {
    const agentType = detectAgentFromPath(filePath);
    const transcript = await ParserFactory.parseFile(filePath);
    const timeline = await ParserFactory.buildTimeline(transcript, agentType);

    // Extract files from all frames
    const filesRead = new Set<string>();
    const filesModified = new Set<string>();

    for (const frame of timeline.frames) {
      if (frame.context.filesRead) {
        frame.context.filesRead.forEach((f) => filesRead.add(f));
      }
      if (frame.context.filesModified) {
        frame.context.filesModified.forEach((f) => filesModified.add(f));
      }

      // Also extract from tool executions
      if (frame.toolExecution) {
        const tool = frame.toolExecution.tool;
        const input = frame.toolExecution.input;

        if (tool === 'Read' && input.file_path) {
          filesRead.add(input.file_path);
        } else if (tool === 'Write' && input.file_path) {
          filesModified.add(input.file_path);
        } else if (tool === 'Edit' && input.file_path) {
          filesRead.add(input.file_path);
          filesModified.add(input.file_path);
        }
      }
    }

    // Extract model info from first assistant response if available
    let model: string | undefined;
    // Model extraction would require parsing specific fields from the transcript
    // For now, we'll leave it undefined and add later

    return {
      sessionId,
      agent: timeline.agent,
      model,
      projectPath: timeline.project,
      cwd: timeline.metadata.cwd,
      filesRead: Array.from(filesRead),
      filesModified: Array.from(filesModified),
      startTime: timeline.startedAt,
      endTime: timeline.completedAt,
      duration: timeline.completedAt
        ? Math.round((timeline.completedAt - timeline.startedAt) / 1000)
        : undefined,
      frameCount: timeline.totalFrames,
      firstUserMessage: timeline.frames[0]?.userMessage?.text?.substring(0, 200),
    };
  } catch (error) {
    console.error(`Failed to extract correlation data for ${sessionId}:`, error);
    return null;
  }
}

/**
 * Main correlation algorithm - groups sessions into work units
 */
export async function computeWorkUnits(
  config: CorrelationConfig = DEFAULT_CORRELATION_CONFIG
): Promise<WorkUnit[]> {
  const indexer = getSessionIndexer();
  const allSessions = await indexer.getAllSessions();
  const correlationDataMap = new Map<string, SessionCorrelationData>();

  console.log(`Computing work units for ${allSessions.length} sessions...`);

  // Step 1: Extract correlation data for all sessions
  for (const session of allSessions) {
    const filePath = await indexer.findSessionFile(session.sessionId);
    if (!filePath) continue;

    const data = await extractCorrelationData(session.sessionId, filePath);
    if (data) {
      correlationDataMap.set(session.sessionId, data);
    }
  }

  console.log(`Extracted correlation data for ${correlationDataMap.size} sessions`);

  // Step 2: Group sessions by normalized project path
  const projectGroups = new Map<string, SessionCorrelationData[]>();
  for (const data of correlationDataMap.values()) {
    const normalizedPath = normalizeProjectPath(data.projectPath);
    if (!normalizedPath) continue;

    if (!projectGroups.has(normalizedPath)) {
      projectGroups.set(normalizedPath, []);
    }
    projectGroups.get(normalizedPath)!.push(data);
  }

  console.log(`Grouped into ${projectGroups.size} project clusters`);

  // Step 3: Split clusters by time gaps and create work units
  const workUnits: WorkUnit[] = [];

  for (const [projectPath, sessions] of projectGroups) {
    // Sort by start time
    sessions.sort((a, b) => a.startTime - b.startTime);

    // Split into sub-clusters based on time gaps
    const clusters: SessionCorrelationData[][] = [];
    let currentCluster: SessionCorrelationData[] = [];

    for (const session of sessions) {
      if (currentCluster.length === 0) {
        currentCluster.push(session);
      } else {
        const lastSession = currentCluster[currentCluster.length - 1]!;
        const lastEnd = lastSession.endTime || lastSession.startTime;

        if (isWithinTimeWindow(lastEnd, session.startTime, config.timeWindowHours)) {
          currentCluster.push(session);
        } else {
          // Time gap too large - start new cluster
          clusters.push(currentCluster);
          currentCluster = [session];
        }
      }
    }

    if (currentCluster.length > 0) {
      clusters.push(currentCluster);
    }

    // Create work unit for each cluster
    for (const cluster of clusters) {
      if (cluster.length === 0) continue;

      const workUnit = createWorkUnitFromCluster(cluster, projectPath, config);
      workUnits.push(workUnit);
    }
  }

  console.log(`Created ${workUnits.length} work units`);

  return workUnits;
}

/**
 * Create a work unit from a cluster of sessions
 */
function createWorkUnitFromCluster(
  cluster: SessionCorrelationData[],
  projectPath: string,
  config: CorrelationConfig
): WorkUnit {
  // Sort by start time
  cluster.sort((a, b) => a.startTime - b.startTime);

  // These assertions are safe because we only call this function when cluster.length > 0
  const firstSession = cluster[0]!;
  const lastSession = cluster[cluster.length - 1]!;

  // Collect all files touched
  const allFiles = new Set<string>();
  const agents = new Set<AgentType>();
  let totalDuration = 0;
  let totalFrames = 0;

  // Calculate correlation scores and build session list
  const workUnitSessions: WorkUnitSession[] = cluster.map((session, index) => {
    // Add files
    session.filesRead.forEach((f) => allFiles.add(f));
    session.filesModified.forEach((f) => allFiles.add(f));
    agents.add(session.agent);
    totalDuration += session.duration || 0;
    totalFrames += session.frameCount;

    // Calculate correlation to the cluster anchor (first session)
    let correlationScore = 1.0;
    let joinReason: CorrelationReason[] = ['project_path_match'];

    if (index > 0) {
      const result = calculateCorrelationScore(firstSession, session, config);
      correlationScore = result.score;
      joinReason = result.reasons;
    }

    return {
      sessionId: session.sessionId,
      agent: session.agent,
      model: session.model,
      correlationScore,
      joinReason,
      startTime: new Date(session.startTime).toISOString(),
      endTime: session.endTime ? new Date(session.endTime).toISOString() : undefined,
      duration: session.duration,
      frameCount: session.frameCount,
      firstUserMessage: session.firstUserMessage,
    };
  });

  // Determine overall confidence based on average score
  const avgScore =
    workUnitSessions.reduce((sum, s) => sum + s.correlationScore, 0) / workUnitSessions.length;

  // Check for file overlap across all sessions
  const hasGoodFileOverlap =
    cluster.length > 1 &&
    cluster.some((s, i) => {
      if (i === 0) return false;
      const files1 = [...firstSession.filesRead, ...firstSession.filesModified];
      const files2 = [...s.filesRead, ...s.filesModified];
      return jaccardSimilarity(files1, files2) >= 0.3;
    });

  let confidence: WorkUnitConfidence = 'low';
  if (avgScore >= config.highConfidenceThreshold || hasGoodFileOverlap) {
    confidence = 'high';
  } else if (avgScore >= config.mediumConfidenceThreshold) {
    confidence = 'medium';
  }

  // Extract project name from path
  const pathParts = projectPath.split('/').filter(Boolean);
  const projectName = pathParts[pathParts.length - 1] || 'Unknown Project';

  // Use first user message as name if project name is generic
  const name = firstSession.firstUserMessage?.substring(0, 50) || projectName;

  const now = new Date().toISOString();

  return {
    id: uuidv4(),
    name,
    projectPath,
    sessions: workUnitSessions,
    agents: Array.from(agents),
    confidence,
    startTime: new Date(firstSession.startTime).toISOString(),
    endTime: new Date(lastSession.endTime || lastSession.startTime).toISOString(),
    totalDuration,
    totalFrames,
    filesTouched: Array.from(allFiles),
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Get session's work unit ID (if any)
 */
export function getSessionWorkUnitId(sessionId: string): string | null {
  const db = getTranscriptDbInstance();

  const row = db
    .prepare(
      `
    SELECT work_unit_id FROM work_unit_sessions WHERE session_id = ?
  `
    )
    .get(sessionId) as { work_unit_id: string } | undefined;

  return row?.work_unit_id || null;
}

/**
 * Get ungrouped sessions (not in any work unit)
 */
export async function getUngroupedSessions(): Promise<string[]> {
  const db = getTranscriptDbInstance();
  const indexer = getSessionIndexer();

  // Get all session IDs from filesystem
  const allSessions = await indexer.getAllSessions();
  const allSessionIds = new Set(allSessions.map((s) => s.sessionId));

  // Get session IDs that are in work units
  const grouped = db
    .prepare(
      `
    SELECT session_id FROM work_unit_sessions
  `
    )
    .all() as { session_id: string }[];

  const groupedIds = new Set(grouped.map((r) => r.session_id));

  // Return sessions not in any work unit
  return Array.from(allSessionIds).filter((id) => !groupedIds.has(id));
}
