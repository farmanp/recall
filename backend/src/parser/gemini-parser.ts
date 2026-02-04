/**
 * Gemini Parser
 *
 * Parses Google Gemini CLI session files (.json format).
 * Gemini uses a single JSON file per session with all messages in an array.
 */

import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import { AgentParser } from './base-parser';
import { AgentType } from './agent-detector';
import {
  TranscriptEntry,
  PlaybackFrame,
  ToolUseBlock,
  ToolResultBlock,
  ToolExecution,
  ParsedTranscript,
} from '../types/transcript';

/**
 * Gemini tool call structure
 */
interface GeminiToolCall {
  id: string;
  name: string;
  args: Record<string, any>;
  result?: Array<{
    functionResponse?: {
      id: string;
      name: string;
      response: {
        output?: string;
        error?: string;
      };
    };
  }>;
  status: 'success' | 'error' | string;
  timestamp: string;
  displayName?: string;
  description?: string;
}

/**
 * Gemini thought structure
 */
interface GeminiThought {
  subject: string;
  description: string;
  timestamp: string;
}

/**
 * Gemini message structure
 */
interface GeminiMessage {
  id: string;
  timestamp: string;
  type: 'user' | 'gemini' | 'system';
  content: string;
  toolCalls?: GeminiToolCall[];
  thoughts?: GeminiThought[];
  model?: string;
  tokens?: {
    input: number;
    output: number;
    cached?: number;
    thoughts?: number;
    tool?: number;
    total?: number;
  };
}

/**
 * Gemini session file structure
 */
interface GeminiSessionFile {
  sessionId: string;
  projectHash: string;
  startTime: string;
  lastUpdated?: string;
  messages: GeminiMessage[];
}

/**
 * Parser for Google Gemini CLI sessions
 *
 * Gemini uses single JSON files with structure:
 * { sessionId, projectHash, startTime, messages: [...] }
 */
export class GeminiParser extends AgentParser {
  readonly agentType: AgentType = 'gemini';

  /**
   * Generate a simple UUID for entries without an ID
   */
  private generateUuid(): string {
    return crypto.randomUUID();
  }

  /**
   * Override readFile to handle single JSON format instead of JSONL
   */
  protected async readFile(filePath: string): Promise<string[]> {
    const content = await fs.readFile(filePath, 'utf-8');
    const session: GeminiSessionFile = JSON.parse(content);

    // Convert messages to individual JSON lines for processing
    return session.messages.map((msg) => JSON.stringify(msg));
  }

  /**
   * Parse a Gemini message into a normalized TranscriptEntry
   */
  parseEntry(rawEntry: GeminiMessage): TranscriptEntry | null {
    // Skip empty messages without content or tool calls
    if (!rawEntry.content && !rawEntry.toolCalls?.length && !rawEntry.thoughts?.length) {
      return null;
    }

    // Skip system messages
    if (rawEntry.type === 'system') {
      return null;
    }

    const uuid = rawEntry.id || this.generateUuid();
    const timestamp = rawEntry.timestamp;

    // Determine entry type
    const type = this.determineEntryType(rawEntry);

    // Build normalized message
    const message = this.buildMessage(rawEntry);

    const entry: TranscriptEntry = {
      uuid,
      timestamp,
      type,
      message,
      _raw: rawEntry,
    };

    // Add model info if present
    if (rawEntry.model) {
      (entry as any).model = rawEntry.model;
    }

    return entry;
  }

  /**
   * Determine the entry type from a Gemini message
   */
  private determineEntryType(msg: GeminiMessage): string {
    if (msg.type === 'user') {
      return 'user';
    }
    if (msg.type === 'gemini') {
      if (msg.toolCalls?.length) {
        return 'assistant_with_tools';
      }
      return 'assistant';
    }
    return 'unknown';
  }

  /**
   * Build normalized message from Gemini message
   */
  private buildMessage(msg: GeminiMessage): TranscriptEntry['message'] {
    const content: any[] = [];

    // Add text content
    if (msg.content) {
      content.push({
        type: 'text',
        text: msg.content,
      });
    }

    // Add thinking blocks from thoughts
    if (msg.thoughts?.length) {
      for (const thought of msg.thoughts) {
        content.push({
          type: 'thinking',
          thinking: `**${thought.subject}**\n\n${thought.description}`,
        });
      }
    }

    // Add tool use blocks
    if (msg.toolCalls?.length) {
      for (const toolCall of msg.toolCalls) {
        // Add tool_use block
        content.push({
          type: 'tool_use',
          id: toolCall.id,
          name: toolCall.name,
          input: toolCall.args,
        });

        // Add tool_result block if result is present
        if (toolCall.result?.length) {
          const funcResponse = toolCall.result[0]?.functionResponse;
          if (funcResponse) {
            const output = funcResponse.response?.output || funcResponse.response?.error || '';
            content.push({
              type: 'tool_result',
              tool_use_id: toolCall.id,
              content: output,
              is_error: toolCall.status === 'error' || !!funcResponse.response?.error,
            });
          }
        }
      }
    }

    return {
      role: msg.type === 'user' ? 'user' : 'assistant',
      content,
    };
  }

  /**
   * Collect tool results from entries
   * Gemini includes results inline with tool calls, so we extract them here
   */
  collectToolResults(entries: TranscriptEntry[]): Map<string, ToolResultBlock> {
    const resultMap = new Map<string, ToolResultBlock>();

    for (const entry of entries) {
      const raw = (entry as any)._raw as GeminiMessage | undefined;

      if (raw?.toolCalls) {
        for (const toolCall of raw.toolCalls) {
          if (toolCall.result?.length) {
            const funcResponse = toolCall.result[0]?.functionResponse;
            if (funcResponse) {
              const output = funcResponse.response?.output || funcResponse.response?.error || '';
              const toolResult: ToolResultBlock = {
                type: 'tool_result',
                tool_use_id: toolCall.id,
                content: output,
                is_error: toolCall.status === 'error' || !!funcResponse.response?.error,
              };
              resultMap.set(toolCall.id, toolResult);
            }
          }
        }
      }

      // Also check normalized message content
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
   * Extract tool execution from tool use and result
   */
  extractToolExecution(
    toolUse: ToolUseBlock,
    toolResult: ToolResultBlock | undefined
  ): ToolExecution {
    const tool = toolUse.name;
    const input = toolUse.input || {};
    const isError = toolResult?.is_error || false;

    // Extract content as string, handling both string and ContentBlock[] formats
    let contentStr = '';
    if (toolResult?.content) {
      if (typeof toolResult.content === 'string') {
        contentStr = toolResult.content;
      } else if (Array.isArray(toolResult.content)) {
        contentStr = toolResult.content
          .filter((b: any) => b.type === 'text')
          .map((b: any) => b.text)
          .join('\n');
      }
    }

    // Try to extract exit code for shell commands
    let exitCode: number | undefined;
    if (tool === 'shell' || tool === 'run_shell_command') {
      const exitMatch = contentStr.match(/exit code[:\s]+(\d+)/i);
      if (exitMatch && exitMatch[1]) {
        exitCode = parseInt(exitMatch[1], 10);
      }
    }

    return {
      tool,
      input,
      output: {
        content: contentStr,
        isError,
        exitCode,
      },
    };
  }

  /**
   * Extract frames from a single entry
   */
  extractFramesFromEntry(
    entry: TranscriptEntry,
    toolResultMap: Map<string, ToolResultBlock>
  ): PlaybackFrame[] {
    const frames: PlaybackFrame[] = [];
    const raw = (entry as any)._raw as GeminiMessage | undefined;
    const timestamp = new Date(entry.timestamp).getTime();

    // User message
    if (entry.message?.role === 'user') {
      const textContent = entry.message.content
        .filter((b: any) => b.type === 'text')
        .map((b: any) => b.text)
        .join('\n');

      if (textContent) {
        frames.push({
          id: `${entry.uuid}-user-text`,
          type: 'user_message',
          timestamp,
          agent: 'gemini',
          userMessage: {
            text: textContent,
          },
          context: {
            cwd: entry.cwd || '',
          },
        });
      }
    }

    // Assistant response
    if (entry.message?.role === 'assistant') {
      // Extract thinking from thoughts
      if (raw?.thoughts?.length) {
        const thinkingText = raw.thoughts
          .map((t) => `**${t.subject}**\n\n${t.description}`)
          .join('\n\n---\n\n');

        frames.push({
          id: `${entry.uuid}-thinking`,
          type: 'claude_thinking', // Using same type for consistency
          timestamp,
          agent: 'gemini',
          thinking: {
            text: thinkingText,
          },
          context: {
            cwd: entry.cwd || '',
          },
        });
      }

      // Extract text response
      const textContent = entry.message.content
        .filter((b: any) => b.type === 'text')
        .map((b: any) => b.text)
        .join('\n');

      if (textContent) {
        frames.push({
          id: `${entry.uuid}-response`,
          type: 'claude_response', // Using same type for consistency
          timestamp,
          agent: 'gemini',
          claudeResponse: {
            text: textContent,
          },
          context: {
            cwd: entry.cwd || '',
          },
        });
      }

      // Extract tool executions
      const toolUseBlocks = entry.message.content.filter(
        (b: any) => b.type === 'tool_use'
      ) as ToolUseBlock[];

      for (const toolUse of toolUseBlocks) {
        const toolResult = toolResultMap.get(toolUse.id);
        const toolExecution = this.extractToolExecution(toolUse, toolResult);

        frames.push({
          id: `${entry.uuid}-tool-${toolUse.id}`,
          type: 'tool_execution',
          timestamp,
          agent: 'gemini',
          toolExecution,
          context: {
            cwd: entry.cwd || '',
          },
        });
      }
    }

    return frames;
  }

  /**
   * Override parseFile to handle Gemini's JSON format
   */
  async parseFile(filePath: string): Promise<ParsedTranscript> {
    // Read the JSON file
    const content = await fs.readFile(filePath, 'utf-8');
    const session: GeminiSessionFile = JSON.parse(content);

    // Parse each message into entries
    const entries: TranscriptEntry[] = [];
    for (const msg of session.messages) {
      const entry = this.parseEntry(msg);
      if (entry) {
        entries.push(entry);
      }
    }

    // Extract metadata
    const metadata = {
      startTime: session.startTime,
      endTime: session.lastUpdated,
      totalEntries: entries.length,
      cwd: '', // Gemini doesn't store cwd at session level
      agentVersion: session.messages[0]?.model,
    };

    return {
      sessionId: session.sessionId,
      entries,
      metadata,
    };
  }
}
