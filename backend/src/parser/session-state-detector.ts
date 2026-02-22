/**
 * Session State Detector
 *
 * Determines if a Claude session is still ongoing (AI still responding)
 * based on content analysis, not file modification times.
 *
 * Approach:
 * - Track activity types in order: thinking, tool_use, tool_result, text output
 * - Find the last "ending" event (text output, interruption, ExitPlanMode, etc.)
 * - Session is ongoing if AI activities exist AFTER the last ending event
 */

import { TranscriptEntry, ContentBlock } from '../types/transcript';

/**
 * Activity types that indicate the AI is working
 */
type OngoingActivity = 'thinking' | 'tool_use' | 'tool_result';

/**
 * Activity types that indicate the AI has finished a response
 */
type EndingActivity =
  | 'text_output'
  | 'interruption'
  | 'exit_plan_mode'
  | 'user_rejection'
  | 'shutdown_response';

interface ActivityRecord {
  type: OngoingActivity | EndingActivity;
  timestamp: string;
}

/**
 * Check if a session is ongoing based on its transcript entries
 *
 * A session is considered "ongoing" if:
 * 1. There are AI activities (thinking, tool_use, tool_result) that have occurred
 *    AFTER the last "ending" event (text output, interruption, ExitPlanMode, etc.)
 * 2. OR if there's any ongoing activity and no ending event has been seen yet
 *
 * @param entries - Array of transcript entries (must be chronologically sorted)
 * @returns true if the session appears to be ongoing
 */
export function checkSessionOngoing(entries: TranscriptEntry[]): boolean {
  if (!entries || entries.length === 0) {
    return false;
  }

  // Track all activities in order
  const activities: ActivityRecord[] = [];

  for (const entry of entries) {
    const timestamp = entry.timestamp;

    // Check for user interruption
    if (entry.type === 'user' && entry.message?.content) {
      const content = entry.message.content;
      const textContent = extractTextContent(content);

      if (textContent.includes('[Request interrupted by user]')) {
        activities.push({ type: 'interruption', timestamp });
        continue;
      }
    }

    // Check assistant messages for activities
    if (entry.type === 'assistant' && entry.message?.content) {
      const content = entry.message.content;

      if (Array.isArray(content)) {
        // Process each content block
        for (const block of content) {
          const activity = classifyContentBlock(block);
          if (activity) {
            activities.push({ type: activity, timestamp });
          }
        }
      } else if (typeof content === 'string' && (content as string).trim()) {
        // String content is a text response
        activities.push({ type: 'text_output', timestamp });
      }
    }
  }

  // Find the last ending event
  let lastEndingIndex = -1;
  for (let i = activities.length - 1; i >= 0; i--) {
    const activity = activities[i];
    if (activity && isEndingActivity(activity.type)) {
      lastEndingIndex = i;
      break;
    }
  }

  // Check if there are any ongoing activities after the last ending event
  if (lastEndingIndex === -1) {
    // No ending event found - check if any ongoing activity exists
    return activities.some((a) => isOngoingActivity(a.type));
  }

  // Check for ongoing activities after the last ending event
  for (let i = lastEndingIndex + 1; i < activities.length; i++) {
    const activity = activities[i];
    if (activity && isOngoingActivity(activity.type)) {
      return true;
    }
  }

  return false;
}

/**
 * Classify a content block into an activity type
 */
function classifyContentBlock(block: ContentBlock): OngoingActivity | EndingActivity | null {
  if (!block || typeof block !== 'object') {
    return null;
  }

  switch (block.type) {
    case 'thinking':
      return 'thinking';

    case 'tool_use':
      // Check for special ending tools
      const toolUse = block as { type: 'tool_use'; name?: string; input?: Record<string, any> };

      if (toolUse.name === 'ExitPlanMode') {
        return 'exit_plan_mode';
      }

      // SendMessage with shutdown_response is an ending event
      if (toolUse.name === 'SendMessage' && toolUse.input?.type === 'shutdown_response') {
        return 'shutdown_response';
      }

      return 'tool_use';

    case 'tool_result':
      // Check for user rejection in tool results
      const toolResult = block as { type: 'tool_result'; content?: string | any[] };
      const resultContent = typeof toolResult.content === 'string' ? toolResult.content : '';

      if (resultContent.includes('User rejected') || resultContent.includes('rejected by user')) {
        return 'user_rejection';
      }

      return 'tool_result';

    case 'text':
      const textBlock = block as { type: 'text'; text?: string };
      if (textBlock.text && textBlock.text.trim()) {
        return 'text_output';
      }
      return null;

    default:
      return null;
  }
}

/**
 * Check if an activity type indicates ongoing work
 */
function isOngoingActivity(type: string): type is OngoingActivity {
  return type === 'thinking' || type === 'tool_use' || type === 'tool_result';
}

/**
 * Check if an activity type indicates the session has ended/paused
 */
function isEndingActivity(type: string): type is EndingActivity {
  return (
    type === 'text_output' ||
    type === 'interruption' ||
    type === 'exit_plan_mode' ||
    type === 'user_rejection' ||
    type === 'shutdown_response'
  );
}

/**
 * Extract text content from message content (string or array)
 */
function extractTextContent(content: string | ContentBlock[]): string {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .filter(
        (block): block is { type: 'text'; text: string } =>
          block.type === 'text' && typeof (block as any).text === 'string'
      )
      .map((block) => block.text)
      .join('\n');
  }

  return '';
}

/**
 * Quick check if session might be ongoing based on last few entries
 * This is a performance optimization for the session indexer which only reads
 * the first and last chunks of large files.
 *
 * @param lines - Array of JSON strings from the session file (typically last chunk)
 * @returns true if the session appears to be ongoing
 */
export function checkSessionOngoingFromLines(lines: string[]): boolean {
  if (!lines || lines.length === 0) {
    return false;
  }

  // Parse lines into entries (skip malformed ones)
  const entries: TranscriptEntry[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      if (entry.timestamp || entry.type) {
        entries.push(entry);
      }
    } catch {
      // Skip malformed JSON
    }
  }

  return checkSessionOngoing(entries);
}
