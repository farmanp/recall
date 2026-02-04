/**
 * Parser Factory
 *
 * Factory class for selecting and using the appropriate parser
 * based on agent type (Claude, Codex, Gemini, etc.)
 */

import { AgentParser } from './base-parser';
import { ClaudeParser } from './claude-parser';
import { CodexParser } from './codex-parser';
import { GeminiParser } from './gemini-parser';
import { detectAgentFromPath, AgentType } from './agent-detector';
import { ParsedTranscript, SessionTimeline } from '../types/transcript';

/**
 * Factory for creating and managing agent-specific parsers
 *
 * Uses lazy initialization to create parser instances only when needed.
 * Provides methods for parsing files and building timelines with
 * automatic agent detection.
 */
export class ParserFactory {
  /**
   * Map of agent types to parser instances (lazy-initialized)
   */
  private static parsers: Map<AgentType, AgentParser> | null = null;

  /**
   * Initialize the parsers map on first use
   */
  private static initializeParsers(): void {
    if (ParserFactory.parsers === null) {
      ParserFactory.parsers = new Map<AgentType, AgentParser>([
        ['claude', new ClaudeParser()],
        ['codex', new CodexParser()],
        ['gemini', new GeminiParser()],
      ]);
    }
  }

  /**
   * Get parser for a specific agent type
   *
   * @param agentType - The agent type to get a parser for
   * @returns The parser instance for the specified agent type
   * @throws Error if no parser exists for the agent type
   */
  static getParser(agentType: AgentType): AgentParser {
    ParserFactory.initializeParsers();

    // Handle 'unknown' agent type by falling back to Claude parser
    if (agentType === 'unknown') {
      console.warn('Unknown agent type detected, falling back to Claude parser');
      const claudeParser = ParserFactory.parsers!.get('claude');
      if (claudeParser) {
        return claudeParser;
      }
      throw new Error('No fallback parser available: Claude parser not found');
    }

    const parser = ParserFactory.parsers!.get(agentType);

    if (!parser) {
      const availableTypes = Array.from(ParserFactory.parsers!.keys()).join(', ');
      throw new Error(
        `No parser available for agent type '${agentType}'. ` +
          `Available parsers: ${availableTypes}`
      );
    }

    return parser;
  }

  /**
   * Parse a file, auto-detecting the agent type from path
   *
   * Detects the agent type from the file path and uses the appropriate
   * parser to parse the transcript file.
   *
   * @param filePath - Path to the JSONL transcript file
   * @returns Parsed transcript with entries and metadata
   */
  static async parseFile(filePath: string): Promise<ParsedTranscript> {
    const agentType = detectAgentFromPath(filePath);
    const parser = ParserFactory.getParser(agentType);
    return parser.parseFile(filePath);
  }

  /**
   * Build timeline from parsed transcript
   *
   * Converts a parsed transcript into a playable session timeline.
   * Uses the parser for the transcript's agent type, or the specified
   * agent type if provided.
   *
   * @param transcript - Parsed transcript to build timeline from
   * @param agentType - Optional agent type override (auto-detects if not provided)
   * @returns Session timeline with playback frames
   */
  static async buildTimeline(
    transcript: ParsedTranscript,
    agentType?: AgentType
  ): Promise<SessionTimeline> {
    // Use provided agent type, or try to detect from metadata/entries
    const effectiveAgentType = agentType || ParserFactory.detectAgentFromTranscript(transcript);
    const parser = ParserFactory.getParser(effectiveAgentType);
    return parser.buildTimeline(transcript);
  }

  /**
   * Detect agent type from parsed transcript content
   *
   * Analyzes the transcript entries to determine which agent produced them.
   *
   * @param transcript - Parsed transcript to analyze
   * @returns Detected agent type
   */
  private static detectAgentFromTranscript(transcript: ParsedTranscript): AgentType {
    // Check if any entry has agent-specific markers
    for (const entry of transcript.entries.slice(0, 5)) {
      // Check for Claude markers
      if (entry.message?.content && Array.isArray(entry.message.content)) {
        for (const block of entry.message.content) {
          // Claude has thinking blocks with signatures
          if (block.type === 'thinking' && 'signature' in block && block.signature) {
            return 'claude';
          }
          // Claude tool_use format
          if (block.type === 'tool_use' && 'id' in block && 'name' in block) {
            return 'claude';
          }
        }
      }

      // Check for Codex/OpenAI markers
      if ((entry as any).model?.startsWith('o1') || (entry as any).model?.startsWith('gpt')) {
        return 'codex';
      }
      if ((entry as any).function_call || (entry as any).tool_calls) {
        return 'codex';
      }

      // Check for Gemini markers
      if ((entry as any).model?.startsWith('gemini')) {
        return 'gemini';
      }
    }

    // Default to unknown (will fall back to Claude parser)
    return 'unknown';
  }

  /**
   * Get all available agent types that have parsers
   *
   * @returns Array of agent types with registered parsers
   */
  static getAvailableAgentTypes(): AgentType[] {
    ParserFactory.initializeParsers();
    return Array.from(ParserFactory.parsers!.keys());
  }

  /**
   * Check if a parser exists for the given agent type
   *
   * @param agentType - The agent type to check
   * @returns True if a parser is available
   */
  static hasParser(agentType: AgentType): boolean {
    ParserFactory.initializeParsers();
    return ParserFactory.parsers!.has(agentType) || agentType === 'unknown';
  }

  /**
   * Clear the parser cache (useful for testing)
   */
  static clearCache(): void {
    ParserFactory.parsers = null;
  }
}
