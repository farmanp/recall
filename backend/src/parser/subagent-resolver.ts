/**
 * Subagent Resolver
 *
 * Resolves and links subagent session files to their parent sessions.
 * Handles discovery of subagent JSONL files and linking of playback frames
 * to create a unified hierarchical view of multi-agent sessions.
 */

import fs from 'fs/promises';
import path from 'path';
import { PlaybackFrame } from '../types/transcript';

/**
 * Scan session directory for subagent JSONL files
 *
 * Looks for patterns:
 * - agent_*.jsonl files in the session directory
 * - Files in agent subdirectories (e.g., agents/, subagents/)
 * - Task-spawned agent files with naming conventions
 *
 * @param sessionDir - Path to the session directory
 * @returns Array of absolute file paths to subagent JSONL files
 */
export async function resolveSubagentFiles(sessionDir: string): Promise<string[]> {
  const subagentFiles: string[] = [];

  try {
    // Check if directory exists
    const dirStats = await fs.stat(sessionDir);
    if (!dirStats.isDirectory()) {
      return subagentFiles;
    }

    const entries = await fs.readdir(sessionDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(sessionDir, entry.name);

      if (entry.isFile()) {
        // Pattern 1: agent_*.jsonl files in session directory
        if (entry.name.match(/^agent_.*\.jsonl$/i)) {
          subagentFiles.push(fullPath);
        }
        // Pattern 2: subagent_*.jsonl files
        else if (entry.name.match(/^subagent_.*\.jsonl$/i)) {
          subagentFiles.push(fullPath);
        }
        // Pattern 3: task_*.jsonl files (spawned by Task tool)
        else if (entry.name.match(/^task_.*\.jsonl$/i)) {
          subagentFiles.push(fullPath);
        }
      } else if (entry.isDirectory()) {
        // Pattern 4: Check known subdirectory patterns
        const subdirName = entry.name.toLowerCase();
        if (
          subdirName === 'agents' ||
          subdirName === 'subagents' ||
          subdirName === 'tasks' ||
          subdirName === 'spawned'
        ) {
          // Scan subdirectory for JSONL files
          const subDirFiles = await scanSubdirectoryForJsonl(fullPath);
          subagentFiles.push(...subDirFiles);
        }
      }
    }
  } catch (error) {
    // Directory doesn't exist or can't be read - return empty array
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn(`[SubagentResolver] Failed to scan session directory ${sessionDir}:`, error);
    }
  }

  return subagentFiles;
}

/**
 * Scan a subdirectory for JSONL files
 *
 * @param dirPath - Path to subdirectory
 * @returns Array of absolute file paths to JSONL files
 */
async function scanSubdirectoryForJsonl(dirPath: string): Promise<string[]> {
  const jsonlFiles: string[] = [];

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.jsonl')) {
        jsonlFiles.push(path.join(dirPath, entry.name));
      }
    }
  } catch (error) {
    console.warn(`[SubagentResolver] Failed to scan subdirectory ${dirPath}:`, error);
  }

  return jsonlFiles;
}

/**
 * Link subagent frames to their parent Task frame
 *
 * Finds Task tool executions in the main frames and links
 * corresponding subagent frames via parentFrameId. Sets
 * isSubagent=true and assigns agentId for grouping.
 *
 * @param mainFrames - Frames from the main/parent session
 * @param subagentFrames - Frames from subagent sessions
 * @returns Merged array of frames with linking metadata set
 */
export function linkSubagentFrames(
  mainFrames: PlaybackFrame[],
  subagentFrames: PlaybackFrame[]
): PlaybackFrame[] {
  // If no subagent frames, return main frames unchanged
  if (subagentFrames.length === 0) {
    return mainFrames;
  }

  // Find Task tool executions in main frames
  const taskFrames = mainFrames.filter(
    (frame) => frame.type === 'tool_execution' && frame.toolExecution?.tool === 'Task'
  );

  // If no Task frames, return main frames unchanged (subagent frames are orphaned)
  if (taskFrames.length === 0) {
    console.warn(
      '[SubagentResolver] Found subagent frames but no Task tool executions in main frames'
    );
    return mainFrames;
  }

  // Create a copy of subagent frames with linking metadata
  const linkedSubagentFrames = linkFramesToTasks(taskFrames, subagentFrames);

  // Merge main frames and linked subagent frames, sorted by timestamp
  const mergedFrames = [...mainFrames, ...linkedSubagentFrames];
  mergedFrames.sort((a, b) => a.timestamp - b.timestamp);

  return mergedFrames;
}

/**
 * Link subagent frames to their parent Task frames
 *
 * Uses timestamp proximity to match subagent frames to Task frames.
 * Subagent frames are assigned to the most recent Task that started
 * before the subagent frame timestamp.
 *
 * @param taskFrames - Task tool execution frames from main session
 * @param subagentFrames - All subagent frames to be linked
 * @returns Subagent frames with parentFrameId, isSubagent, and agentId set
 */
function linkFramesToTasks(
  taskFrames: PlaybackFrame[],
  subagentFrames: PlaybackFrame[]
): PlaybackFrame[] {
  // Sort task frames by timestamp (ascending)
  const sortedTaskFrames = [...taskFrames].sort((a, b) => a.timestamp - b.timestamp);

  // Group subagent frames by their source (agentId derived from frame id pattern)
  const framesByAgent = groupFramesByAgent(subagentFrames);

  const linkedFrames: PlaybackFrame[] = [];

  // For each agent's frames, find the parent Task frame
  for (const [agentId, agentFrames] of framesByAgent) {
    // Find earliest timestamp in this agent's frames
    const earliestTimestamp = Math.min(...agentFrames.map((f) => f.timestamp));

    // Find the most recent Task frame that started before this subagent
    const parentTaskFrame = findParentTaskFrame(sortedTaskFrames, earliestTimestamp);

    // Link all frames from this agent to the parent Task
    for (const frame of agentFrames) {
      linkedFrames.push({
        ...frame,
        parentFrameId: parentTaskFrame?.id,
        isSubagent: true,
        agentId,
        taskDescription: parentTaskFrame ? extractTaskDescription(parentTaskFrame) : undefined,
      });
    }
  }

  return linkedFrames;
}

/**
 * Group frames by their agent ID
 *
 * Extracts agent ID from frame.agentId if set, otherwise derives
 * from the frame ID pattern (e.g., "agent_123-..." -> "agent_123")
 *
 * @param frames - Frames to group
 * @returns Map of agentId -> frames
 */
function groupFramesByAgent(frames: PlaybackFrame[]): Map<string, PlaybackFrame[]> {
  const grouped = new Map<string, PlaybackFrame[]>();

  for (const frame of frames) {
    // Use existing agentId or derive from frame ID
    const agentId = frame.agentId || deriveAgentIdFromFrameId(frame.id);

    if (!grouped.has(agentId)) {
      grouped.set(agentId, []);
    }
    grouped.get(agentId)!.push(frame);
  }

  return grouped;
}

/**
 * Derive agent ID from frame ID
 *
 * Frame IDs typically follow patterns like:
 * - "agent_abc123-user-text-0" -> "agent_abc123"
 * - "subagent_xyz-tool-..." -> "subagent_xyz"
 * - Standard UUID format -> use as-is
 *
 * @param frameId - The frame ID to parse
 * @returns Derived agent ID
 */
function deriveAgentIdFromFrameId(frameId: string): string {
  // Pattern: agent_xxx-... or subagent_xxx-...
  const agentMatch = frameId.match(/^((?:sub)?agent_[^-]+)/i);
  if (agentMatch && agentMatch[1]) {
    return agentMatch[1];
  }

  // Pattern: task_xxx-...
  const taskMatch = frameId.match(/^(task_[^-]+)/i);
  if (taskMatch && taskMatch[1]) {
    return taskMatch[1];
  }

  // Fallback: use first UUID segment or the whole ID
  const uuidMatch = frameId.match(/^([a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})/i);
  if (uuidMatch && uuidMatch[1]) {
    return uuidMatch[1];
  }

  // Last resort: use the part before the first dash
  const firstSegment = frameId.split('-')[0];
  return firstSegment || 'unknown-agent';
}

/**
 * Find the parent Task frame for a subagent based on timestamp
 *
 * Returns the most recent Task frame that started before the
 * given timestamp, representing the Task that spawned the subagent.
 *
 * @param sortedTaskFrames - Task frames sorted by timestamp (ascending)
 * @param subagentTimestamp - Timestamp of the subagent's first frame
 * @returns The parent Task frame, or undefined if none found
 */
function findParentTaskFrame(
  sortedTaskFrames: PlaybackFrame[],
  subagentTimestamp: number
): PlaybackFrame | undefined {
  let parentFrame: PlaybackFrame | undefined;

  for (const taskFrame of sortedTaskFrames) {
    if (taskFrame.timestamp <= subagentTimestamp) {
      parentFrame = taskFrame;
    } else {
      // Task frames are sorted, so we can stop once we pass the timestamp
      break;
    }
  }

  return parentFrame;
}

/**
 * Extract task description from a Task tool execution frame
 *
 * For tool_execution frames with tool="Task", extracts the
 * task description from the input parameters.
 *
 * @param frame - A PlaybackFrame to extract task description from
 * @returns The task description string, or undefined if not a Task frame
 */
export function extractTaskDescription(frame: PlaybackFrame): string | undefined {
  // Must be a tool_execution frame with Task tool
  if (frame.type !== 'tool_execution') {
    return undefined;
  }

  if (frame.toolExecution?.tool !== 'Task') {
    return undefined;
  }

  const input = frame.toolExecution.input;
  if (!input || typeof input !== 'object') {
    return undefined;
  }

  // Common parameter names for task description
  // Check various possible field names used by Task tool implementations
  const description =
    input.description ||
    input.task ||
    input.prompt ||
    input.query ||
    input.message ||
    input.instruction ||
    input.instructions;

  if (typeof description === 'string') {
    return description;
  }

  // If description is an array of strings, join them
  if (Array.isArray(description)) {
    return description.filter((item) => typeof item === 'string').join('\n');
  }

  return undefined;
}
