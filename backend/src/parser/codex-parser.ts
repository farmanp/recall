/**
 * Codex Parser
 *
 * Parses OpenAI Codex CLI session files (.jsonl format).
 * Handles OpenAI function calling format and normalizes to our transcript types.
 */

import { AgentParser } from './base-parser';
import { AgentType } from './agent-detector';
import {
  TranscriptEntry,
  PlaybackFrame,
  ToolUseBlock,
  ToolResultBlock,
  ToolExecution,
} from '../types/transcript';

/**
 * OpenAI function call structure within tool_calls array
 */
interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

/**
 * Raw Codex JSONL entry structure
 * Codex wraps entries in type/payload structure:
 * { type: "response_item", payload: { role, content, ... } }
 * or { type: "session_meta", payload: { id, cwd, ... } }
 */
interface RawCodexEntry {
  // Wrapper fields
  type?: 'response_item' | 'session_meta' | 'message' | string;
  payload?: {
    type?: string;
    id?: string;
    role?: 'user' | 'assistant' | 'tool' | 'system' | 'developer';
    content?: CodexContentPart[] | string | null;
    tool_calls?: OpenAIToolCall[];
    tool_call_id?: string;
    name?: string;
    cwd?: string;
    [key: string]: any;
  };
  // Direct fields (for older format)
  id?: string;
  timestamp?: string;
  created?: number;
  model?: string;
  role?: 'user' | 'assistant' | 'tool' | 'system' | 'developer';
  content?: CodexContentPart[] | string | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
  name?: string;
  cwd?: string;
  [key: string]: any;
}

/**
 * Codex content part structure
 */
interface CodexContentPart {
  type: 'input_text' | 'output_text' | 'text' | 'image_url' | 'refusal' | string;
  text?: string;
  image_url?: { url: string };
}

/**
 * Parser for OpenAI Codex CLI sessions
 *
 * Codex uses OpenAI's function calling format:
 * - tool_calls: [{ type: 'function', function: { name, arguments } }]
 * - Tool results: { role: 'tool', tool_call_id, content }
 */
export class CodexParser extends AgentParser {
  readonly agentType: AgentType = 'codex';

  /**
   * Track tool call IDs to their normalized ToolUseBlock
   * Used to match tool results back to their calls
   */
  private toolCallRegistry = new Map<string, ToolUseBlock>();

  /**
   * Parse a raw Codex JSONL entry into a normalized TranscriptEntry
   */
  parseEntry(rawEntry: RawCodexEntry): TranscriptEntry | null {
    // Handle session_meta entries - extract cwd for later use
    if (rawEntry.type === 'session_meta') {
      // Store session metadata but don't create a frame for it
      return null;
    }

    // Unwrap payload if present (new Codex format)
    const entry = rawEntry.payload || rawEntry;

    // Skip entries without meaningful content
    const role = entry.role;
    const content = entry.content;
    const toolCalls = entry.tool_calls;

    if (!role && !content && !toolCalls) {
      return null;
    }

    // Skip developer/system messages (internal context)
    if (role === 'developer' || role === 'system') {
      return null;
    }

    // Generate UUID if not present
    const uuid = entry.id || rawEntry.id || this.generateUuid();

    // Extract timestamp (from wrapper or entry)
    const timestamp = rawEntry.timestamp || this.extractTimestamp(entry);

    // Determine entry type
    const type = this.determineEntryType(entry);

    // Build normalized message
    const message = this.buildMessage(entry);

    // Extract working directory
    const cwd = entry.cwd || rawEntry.cwd;

    // Build the normalized entry
    const normalizedEntry: TranscriptEntry = {
      uuid,
      timestamp,
      type,
      message,
      cwd,
      // Preserve original fields for debugging
      _raw: rawEntry,
    };

    // Add model info if present
    if (entry.model || rawEntry.model) {
      (normalizedEntry as any).model = entry.model || rawEntry.model;
    }

    return normalizedEntry;
  }

  /**
   * Collect tool results from entries into a map
   *
   * In Codex format, tool results come as separate entries with:
   * - role: 'tool'
   * - tool_call_id: matches the id from the original tool_call
   * - content: the result
   */
  collectToolResults(entries: TranscriptEntry[]): Map<string, ToolResultBlock> {
    const resultMap = new Map<string, ToolResultBlock>();

    for (const entry of entries) {
      const raw = (entry as any)._raw as RawCodexEntry | undefined;

      // Check for tool result entries
      if (raw?.role === 'tool' && raw.tool_call_id) {
        const content = this.extractContentAsString(raw.content);

        const toolResult: ToolResultBlock = {
          type: 'tool_result',
          tool_use_id: raw.tool_call_id,
          content,
          is_error: this.isErrorContent(content),
        };

        resultMap.set(raw.tool_call_id, toolResult);
      }

      // Also check message.content for tool_result blocks (normalized format)
      if (entry.message?.content) {
        for (const block of entry.message.content) {
          if (block.type === 'tool_result') {
            resultMap.set(block.tool_use_id, block as ToolResultBlock);
          }
        }
      }
    }

    return resultMap;
  }

  /**
   * Extract tool execution from a tool use block and its result
   */
  extractToolExecution(
    toolUse: ToolUseBlock,
    toolResult: ToolResultBlock | undefined
  ): ToolExecution {
    const output = this.extractToolOutput(toolResult);
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

    // Process each content block
    for (const block of entry.message.content) {
      switch (block.type) {
        case 'text':
          // Text block - could be user message or assistant response
          if (entry.message.role === 'user') {
            frames.push({
              id: `${entry.uuid}-user-text`,
              type: 'user_message',
              timestamp,
              agent: 'codex',
              userMessage: {
                text: block.text,
              },
              context: { cwd },
            });
          } else if (entry.message.role === 'assistant') {
            frames.push({
              id: `${entry.uuid}-assistant-text`,
              type: 'claude_response', // Reuse existing type for compatibility
              timestamp,
              agent: 'codex',
              claudeResponse: {
                text: block.text,
              },
              context: { cwd },
            });
          }
          break;

        case 'thinking':
          // Thinking block (Codex o1/o3 may have reasoning)
          if ('thinking' in block) {
            frames.push({
              id: `${entry.uuid}-thinking`,
              type: 'claude_thinking', // Reuse existing type
              timestamp,
              agent: 'codex',
              thinking: {
                text: block.thinking,
                // Codex doesn't have signatures
              },
              context: { cwd },
            });
          }
          break;

        case 'tool_use':
          // Tool call - match with result
          const toolUse = block as ToolUseBlock;
          const toolResult = toolResultMap.get(toolUse.id);

          const toolExecution = this.extractToolExecution(toolUse, toolResult);

          frames.push({
            id: `${entry.uuid}-tool-${toolUse.id}`,
            type: 'tool_execution',
            timestamp,
            agent: 'codex',
            toolExecution,
            context: {
              cwd,
              ...this.extractFileContext(toolUse),
            },
          });
          break;

        case 'tool_result':
          // Tool results are handled when processing tool_use
          break;

        default:
          // Unknown block type - skip
          break;
      }
    }

    return frames;
  }

  // ============================================
  // Private helper methods
  // ============================================

  /**
   * Generate a UUID for entries without one
   */
  private generateUuid(): string {
    return (
      'codex-' +
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }

  /**
   * Extract timestamp from raw entry
   */
  private extractTimestamp(raw: RawCodexEntry): string {
    // Try various timestamp formats
    if (raw.timestamp) {
      return raw.timestamp;
    }
    if (raw.created) {
      // Unix timestamp (seconds)
      return new Date(raw.created * 1000).toISOString();
    }
    // Fallback to now
    return new Date().toISOString();
  }

  /**
   * Determine entry type from raw entry
   */
  private determineEntryType(raw: RawCodexEntry): string {
    if (raw.role === 'user') {
      return 'user';
    }
    if (raw.role === 'assistant') {
      return 'assistant';
    }
    if (raw.role === 'tool') {
      return 'tool_result';
    }
    if (raw.role === 'system') {
      return 'system';
    }
    return 'unknown';
  }

  /**
   * Build normalized message from raw Codex entry
   */
  private buildMessage(raw: RawCodexEntry):
    | {
        role: 'user' | 'assistant' | 'system';
        content: any[];
      }
    | undefined {
    if (!raw.role) {
      return undefined;
    }

    // Map OpenAI roles to our roles
    let role: 'user' | 'assistant' | 'system';
    if (raw.role === 'tool') {
      // Tool results are stored but processed separately
      role = 'assistant';
    } else {
      role = raw.role as 'user' | 'assistant' | 'system';
    }

    const content: any[] = [];

    // Handle tool result entries specially
    if (raw.role === 'tool' && raw.tool_call_id) {
      content.push({
        type: 'tool_result',
        tool_use_id: raw.tool_call_id,
        content: this.extractContentAsString(raw.content),
        is_error: this.isErrorContent(this.extractContentAsString(raw.content)),
      });
      return { role, content };
    }

    // Add text content
    if (raw.content) {
      const textContent = this.extractContentAsString(raw.content);
      if (textContent) {
        content.push({
          type: 'text',
          text: textContent,
        });
      }
    }

    // Convert OpenAI tool_calls to our tool_use format
    if (raw.tool_calls && Array.isArray(raw.tool_calls)) {
      for (const tc of raw.tool_calls) {
        if (tc.type === 'function' && tc.function) {
          // Parse arguments from JSON string
          let input: Record<string, any> = {};
          try {
            input = JSON.parse(tc.function.arguments);
          } catch {
            // If parsing fails, store as raw string
            input = { _raw: tc.function.arguments };
          }

          const toolUseBlock: ToolUseBlock = {
            type: 'tool_use',
            id: tc.id,
            name: tc.function.name,
            input,
          };

          // Register for later matching with results
          this.toolCallRegistry.set(tc.id, toolUseBlock);

          content.push(toolUseBlock);
        }
      }
    }

    if (content.length === 0) {
      return undefined;
    }

    return { role, content };
  }

  /**
   * Extract content as string from various formats
   */
  private extractContentAsString(content: string | CodexContentPart[] | null | undefined): string {
    if (!content) {
      return '';
    }

    if (typeof content === 'string') {
      return content;
    }

    if (Array.isArray(content)) {
      // Extract text from content parts (handle input_text, output_text, text)
      const textParts = content
        .filter(
          (part): part is CodexContentPart & { text: string } =>
            (part.type === 'text' || part.type === 'input_text' || part.type === 'output_text') &&
            typeof part.text === 'string'
        )
        .map((part) => part.text);
      return textParts.join('\n');
    }

    return '';
  }

  /**
   * Check if content appears to be an error
   */
  private isErrorContent(content: string): boolean {
    if (!content) {
      return false;
    }

    const lowerContent = content.toLowerCase();

    // Check for common error indicators
    if (
      lowerContent.includes('error:') ||
      lowerContent.includes('exception:') ||
      lowerContent.includes('failed:') ||
      lowerContent.includes('traceback')
    ) {
      return true;
    }

    // Check for non-zero exit codes
    const exitMatch = content.match(/exit code[:\s]+(\d+)/i);
    if (exitMatch && exitMatch[1] && parseInt(exitMatch[1], 10) !== 0) {
      return true;
    }

    return false;
  }

  /**
   * Override extractProjectName for Codex path structure
   * Codex: ~/.codex/sessions/{session}.jsonl
   */
  protected override extractProjectName(_filePath: string): string | undefined {
    // Codex doesn't encode project in path like Claude does
    // Project is determined from cwd in the first entry
    return undefined;
  }
}

// Export as both named and default export
export default CodexParser;
