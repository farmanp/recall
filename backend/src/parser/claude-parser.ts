/**
 * Claude Parser
 *
 * Agent-specific parser for Claude Code JSONL transcripts.
 * Handles Claude's specific format including thinking blocks with signatures,
 * tool_use/tool_result matching, and multi-turn conversations.
 */

import { AgentParser } from './base-parser';
import { AgentType } from './agent-detector';
import {
  TranscriptEntry,
  PlaybackFrame,
  ToolExecution,
  ToolUseBlock,
  ToolResultBlock,
  ContentBlock,
} from '../types/transcript';

/**
 * Parser for Claude Code session transcripts
 *
 * Claude JSONL format specifics:
 * - Has `thinking` blocks with `signature` field for extended thinking
 * - Uses `tool_use` with `id` and `name` fields for tool calls
 * - Uses `tool_result` with `tool_use_id` to match results to calls
 * - Entries have `uuid`, `parentUuid`, `timestamp`, `cwd`, `sessionId` fields
 * - Content can be string or array of ContentBlock
 */
export class ClaudeParser extends AgentParser {
  readonly agentType: AgentType = 'claude';

  /**
   * Parse a raw JSON entry into a normalized TranscriptEntry
   *
   * Claude entries have:
   * - uuid: Unique identifier
   * - parentUuid: Reference to parent entry (for threading)
   * - timestamp: ISO 8601 timestamp
   * - type: Entry type (user, assistant, etc.)
   * - message: Contains role and content
   * - cwd: Current working directory
   * - sessionId: Session identifier
   *
   * @param rawEntry - Raw JSON object from JSONL line
   * @returns Normalized transcript entry, or null to skip
   */
  parseEntry(rawEntry: any): TranscriptEntry | null {
    // Validate required fields
    if (!rawEntry || typeof rawEntry !== 'object') {
      return null;
    }

    // Must have at least uuid and timestamp
    if (!rawEntry.uuid || !rawEntry.timestamp) {
      return null;
    }

    // Normalize the entry
    const entry: TranscriptEntry = {
      uuid: rawEntry.uuid,
      parentUuid: rawEntry.parentUuid,
      timestamp: rawEntry.timestamp,
      type: rawEntry.type || this.inferEntryType(rawEntry),
      message: rawEntry.message,
      cwd: rawEntry.cwd,
      sessionId: rawEntry.sessionId,
    };

    // Copy through any additional fields (slug, etc.)
    if (rawEntry.slug) {
      (entry as any).slug = rawEntry.slug;
    }

    return entry;
  }

  /**
   * Infer entry type from message role if not explicitly provided
   */
  private inferEntryType(rawEntry: any): string {
    if (rawEntry.message?.role === 'user') {
      return 'user';
    }
    if (rawEntry.message?.role === 'assistant') {
      return 'assistant';
    }
    return 'unknown';
  }

  /**
   * Collect tool results from all entries into a map
   *
   * Claude uses tool_result blocks within user messages to provide
   * results back to the assistant. These are keyed by tool_use_id
   * to match with the corresponding tool_use blocks.
   *
   * @param entries - All transcript entries
   * @returns Map of tool_use_id -> tool result block
   */
  collectToolResults(entries: TranscriptEntry[]): Map<string, ToolResultBlock> {
    const toolResultMap = new Map<string, ToolResultBlock>();

    for (const entry of entries) {
      if (!entry.message?.content) {
        continue;
      }

      // Handle content as array or string
      const content = entry.message.content;
      const contentBlocks: ContentBlock[] = Array.isArray(content) ? content : [];

      // Extract tool_result blocks
      for (const block of contentBlocks) {
        if (block.type === 'tool_result') {
          const toolResult = block as ToolResultBlock;
          toolResultMap.set(toolResult.tool_use_id, toolResult);
        }
      }
    }

    return toolResultMap;
  }

  /**
   * Build ToolExecution from tool_use and tool_result blocks
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

    // Extract file diff for Write/Edit operations
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
   * Claude entries can produce multiple frames:
   * - user_message: From user role text content
   * - claude_thinking: From thinking blocks
   * - claude_response: From assistant role text content
   * - tool_execution: From tool_use blocks (matched with results)
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

    if (!entry.message?.content) {
      return frames;
    }

    const timestamp = new Date(entry.timestamp).getTime();
    const cwd = entry.cwd || '';

    // Handle content as string or array
    const content = entry.message.content;
    const contentBlocks: ContentBlock[] = Array.isArray(content)
      ? content
      : [{ type: 'text', text: String(content) } as ContentBlock];

    // Track text blocks for aggregation
    let textIndex = 0;
    let thinkingIndex = 0;
    let toolIndex = 0;

    // Process each content block
    for (const block of contentBlocks) {
      switch (block.type) {
        case 'text': {
          const textBlock = block as { type: 'text'; text: string };
          // Skip empty text blocks
          if (!textBlock.text || !textBlock.text.trim()) {
            break;
          }

          if (entry.message.role === 'user') {
            frames.push({
              id: `${entry.uuid}-user-text-${textIndex++}`,
              type: 'user_message',
              timestamp,
              agent: 'claude',
              userMessage: {
                text: textBlock.text,
              },
              context: { cwd },
            });
          } else if (entry.message.role === 'assistant') {
            frames.push({
              id: `${entry.uuid}-assistant-text-${textIndex++}`,
              type: 'claude_response',
              timestamp,
              agent: 'claude',
              claudeResponse: {
                text: textBlock.text,
              },
              context: { cwd },
            });
          }
          break;
        }

        case 'thinking': {
          const thinkingBlock = block as {
            type: 'thinking';
            thinking: string;
            signature?: string;
          };

          // Skip empty thinking blocks
          if (!thinkingBlock.thinking || !thinkingBlock.thinking.trim()) {
            break;
          }

          frames.push({
            id: `${entry.uuid}-thinking-${thinkingIndex++}`,
            type: 'claude_thinking',
            timestamp,
            agent: 'claude',
            thinking: {
              text: thinkingBlock.thinking,
              signature: thinkingBlock.signature,
            },
            context: { cwd },
          });
          break;
        }

        case 'tool_use': {
          const toolUse = block as ToolUseBlock;
          const toolResult = toolResultMap.get(toolUse.id);

          // Build tool execution
          const toolExecution = this.extractToolExecution(toolUse, toolResult);

          // Extract file context
          const fileContext = this.extractFileContext(toolUse);

          frames.push({
            id: `${entry.uuid}-tool-${toolUse.id || toolIndex++}`,
            type: 'tool_execution',
            timestamp,
            agent: 'claude',
            toolExecution,
            context: {
              cwd,
              ...fileContext,
            },
          });
          break;
        }

        case 'tool_result':
          // Tool results are handled when processing tool_use blocks
          // via the toolResultMap - skip them here
          break;

        default:
          // Unknown block type - skip
          break;
      }
    }

    return frames;
  }
}

// Export as default and named export
export default ClaudeParser;
