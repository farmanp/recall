/**
 * GitHub Copilot CLI Parser
 *
 * Agent-specific parser for GitHub Copilot CLI JSONL event files.
 * Handles Copilot's event-based format with tool execution matching.
 */

import { AgentParser } from './base-parser';
import { AgentType } from './agent-detector';
import {
  TranscriptEntry,
  PlaybackFrame,
  ToolExecution,
  ToolUseBlock,
  ToolResultBlock,
} from '../types/transcript';

/**
 * Copilot event from events.jsonl file
 */
interface CopilotEvent {
  type: string;
  data: any;
  id: string;
  timestamp: string;
  parentId: string | null;
}

/**
 * Tool execution complete event data
 */
interface ToolExecutionComplete {
  toolCallId: string;
  success: boolean;
  result: {
    content: string;
    [key: string]: any;
  };
}

/**
 * Parser for GitHub Copilot CLI session events
 *
 * Copilot JSONL format specifics:
 * - Event-based structure with type field
 * - Events linked via parentId for threading
 * - session.start for initialization
 * - user.message for user inputs
 * - assistant.reasoning for thinking blocks
 * - assistant.message for responses with toolRequests array
 * - tool.execution_start/complete for tool execution lifecycle
 */
export class CopilotParser extends AgentParser {
  readonly agentType: AgentType = 'copilot';

  /**
   * Parse a raw Copilot event into a normalized TranscriptEntry
   *
   * Copilot events have:
   * - type: Event type (session.start, user.message, etc.)
   * - data: Event-specific payload
   * - id: Unique event identifier
   * - timestamp: ISO 8601 timestamp
   * - parentId: Reference to parent event (for threading)
   *
   * @param rawEntry - Raw JSON object from JSONL line
   * @returns Normalized transcript entry, or null to skip
   */
  parseEntry(rawEntry: any): TranscriptEntry | null {
    // Validate required fields
    if (!rawEntry || typeof rawEntry !== 'object') {
      return null;
    }

    if (!rawEntry.id || !rawEntry.timestamp || !rawEntry.type) {
      return null;
    }

    const event = rawEntry as CopilotEvent;

    // Map Copilot event types to transcript entry types
    let entryType: string;
    switch (event.type) {
      case 'user.message':
        entryType = 'user';
        break;
      case 'assistant.message':
      case 'assistant.reasoning':
        entryType = 'assistant';
        break;
      case 'tool.execution_start':
      case 'tool.execution_complete':
        entryType = 'tool_result';
        break;
      default:
        entryType = event.type;
    }

    // Create normalized entry
    const entry: TranscriptEntry = {
      uuid: event.id,
      parentUuid: event.parentId || undefined,
      timestamp: event.timestamp,
      type: entryType,
    };

    // Store the raw event data and type for later processing
    (entry as any).copilotEvent = event;

    return entry;
  }

  /**
   * Collect tool results from all entries into a map
   *
   * Copilot uses tool.execution_start and tool.execution_complete events
   * matched by toolCallId. We collect starts in a map, then match with
   * completes when building frames.
   *
   * @param entries - All transcript entries
   * @returns Map of toolCallId -> tool result data
   */
  collectToolResults(entries: TranscriptEntry[]): Map<string, ToolResultBlock> {
    const toolResultMap = new Map<string, ToolResultBlock>();

    // First pass: collect all tool.execution_complete events
    for (const entry of entries) {
      const event = (entry as any).copilotEvent as CopilotEvent | undefined;
      if (!event || event.type !== 'tool.execution_complete') {
        continue;
      }

      const completeData = event.data as ToolExecutionComplete;
      const toolCallId = completeData.toolCallId;

      // Build a ToolResultBlock from the completion event
      const resultContent = completeData.result?.content || '';
      const isError = !completeData.success;

      toolResultMap.set(toolCallId, {
        type: 'tool_result',
        tool_use_id: toolCallId,
        content: resultContent,
        is_error: isError,
      });
    }

    return toolResultMap;
  }

  /**
   * Build ToolExecution from tool execution start and complete events
   *
   * @param toolUse - Tool use block with tool name and input
   * @param toolResult - Corresponding tool result block (may be undefined)
   * @returns Tool execution object for playback
   */
  extractToolExecution(
    toolUse: ToolUseBlock,
    toolResult: ToolResultBlock | undefined
  ): ToolExecution {
    // Extract output from result
    const output = this.extractToolOutput(toolResult);

    // Extract file diff for write/edit operations
    const fileDiff = this.extractFileDiff(toolUse, toolResult);

    return {
      tool: toolUse.name,
      input: toolUse.input,
      output,
      fileDiff,
    };
  }

  /**
   * Extract playback frames from a single transcript entry
   *
   * Copilot entries can produce multiple frames:
   * - user_message: From user.message events
   * - claude_thinking: From assistant.reasoning events
   * - claude_response: From assistant.message events
   * - tool_execution: From tool.execution_start matched with complete
   *
   * @param entry - Transcript entry
   * @param toolResultMap - Map of tool results for matching
   * @returns Array of playback frames
   */
  extractFramesFromEntry(
    entry: TranscriptEntry,
    toolResultMap: Map<string, ToolResultBlock>
  ): PlaybackFrame[] {
    const frames: PlaybackFrame[] = [];
    const event = (entry as any).copilotEvent as CopilotEvent | undefined;

    if (!event) {
      return frames;
    }

    const timestamp = new Date(entry.timestamp).getTime();
    const cwd = ''; // Copilot doesn't include cwd in events

    switch (event.type) {
      case 'user.message': {
        const content = event.data?.content || event.data?.transformedContent || '';
        if (content.trim()) {
          frames.push({
            id: `${entry.uuid}-user-message`,
            type: 'user_message',
            timestamp,
            agent: 'copilot',
            userMessage: {
              text: content,
            },
            context: { cwd },
          });
        }
        break;
      }

      case 'assistant.reasoning': {
        const content = event.data?.content || '';
        if (content.trim()) {
          frames.push({
            id: `${entry.uuid}-reasoning`,
            type: 'claude_thinking',
            timestamp,
            agent: 'copilot',
            thinking: {
              text: content,
            },
            context: { cwd },
          });
        }
        break;
      }

      case 'assistant.message': {
        // Assistant message can have text content and/or tool requests
        const messageContent = event.data?.content || '';
        if (messageContent.trim()) {
          frames.push({
            id: `${entry.uuid}-assistant-message`,
            type: 'claude_response',
            timestamp,
            agent: 'copilot',
            claudeResponse: {
              text: messageContent,
            },
            context: { cwd },
          });
        }

        // Process tool requests from this message
        const toolRequests = event.data?.toolRequests || [];
        for (let i = 0; i < toolRequests.length; i++) {
          const toolRequest = toolRequests[i];
          const toolCallId = toolRequest.toolCallId;
          const toolName = toolRequest.name;
          const args = toolRequest.arguments || {};

          // Create a ToolUseBlock
          const toolUse: ToolUseBlock = {
            type: 'tool_use',
            id: toolCallId,
            name: toolName,
            input: args,
          };

          // Get the result from the map
          const toolResult = toolResultMap.get(toolCallId);

          // Build tool execution
          const toolExecution = this.extractToolExecution(toolUse, toolResult);

          // Extract file context
          const fileContext = this.extractFileContext(toolUse);

          frames.push({
            id: `${entry.uuid}-tool-${i}`,
            type: 'tool_execution',
            timestamp,
            agent: 'copilot',
            toolExecution,
            context: {
              cwd,
              ...fileContext,
            },
          });
        }
        break;
      }

      // tool.execution_start and tool.execution_complete are processed
      // via the assistant.message event's toolRequests array
      default:
        // Skip other event types (session.start, session.info, etc.)
        break;
    }

    return frames;
  }
}
