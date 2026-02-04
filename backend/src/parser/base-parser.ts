/**
 * Abstract Base Parser
 *
 * Provides common functionality and defines the interface for
 * agent-specific transcript parsers (Claude, Codex, Gemini, etc.)
 */

import fs from 'fs';
import readline from 'readline';
import path from 'path';
import { AgentType, detectAgentFromPath, getAgentInfo } from './agent-detector';
import { createHash } from 'crypto';
import {
  TranscriptEntry,
  ParsedTranscript,
  TranscriptMetadata,
  PlaybackFrame,
  SessionTimeline,
  ToolExecution,
  ToolUseBlock,
  ToolResultBlock,
  FileDiff,
  ClaudeMdInfo,
} from '../types/transcript';

// Dead air compression constants
const DEAD_AIR_THRESHOLD = 5000; // 5 seconds - compress gaps longer than this
const COMPRESSED_DURATION = 1500; // Compress long gaps to 1.5 seconds

/**
 * Abstract base class for transcript parsers
 *
 * Implements the Template Method pattern - subclasses override specific
 * methods while the overall parsing flow remains consistent.
 */
export abstract class AgentParser {
  /**
   * The agent type this parser handles
   */
  abstract readonly agentType: AgentType;

  /**
   * Parse a JSONL transcript file
   *
   * Template method that orchestrates the parsing process.
   * Subclasses override specific extraction methods.
   *
   * @param filePath - Path to the JSONL file
   * @returns Parsed transcript with entries and metadata
   */
  async parseFile(filePath: string): Promise<ParsedTranscript> {
    const entries: TranscriptEntry[] = [];

    // Create read stream for line-by-line processing
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    // Parse each line as JSON
    for await (const line of rl) {
      if (line.trim()) {
        try {
          const rawEntry = JSON.parse(line);
          const entry = this.parseEntry(rawEntry);
          if (entry) {
            entries.push(entry);
          }
        } catch (error) {
          console.warn(`Failed to parse line in ${filePath}:`, error);
          // Continue parsing other lines
        }
      }
    }

    // Sort by timestamp for chronological order
    entries.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return timeA - timeB;
    });

    // Extract metadata from entries
    const metadata = this.extractMetadata(entries, filePath);

    // Session ID from first entry or filename
    const sessionId = this.extractSessionId(entries, filePath);

    return {
      sessionId,
      entries,
      metadata,
    };
  }

  /**
   * Build a playable timeline from parsed transcript
   *
   * Converts raw entries into structured PlaybackFrame objects.
   *
   * @param transcript - Parsed transcript
   * @returns Session timeline with playback frames
   */
  async buildTimeline(transcript: ParsedTranscript): Promise<SessionTimeline> {
    const frames: PlaybackFrame[] = [];

    // Track tool results to match with tool calls
    const toolResultMap = this.collectToolResults(transcript.entries);

    // Build frames from entries
    for (const entry of transcript.entries) {
      const entryFrames = this.extractFramesFromEntry(entry, toolResultMap);
      frames.push(...entryFrames);
    }

    // Calculate frame durations
    this.calculateFrameDurations(frames);

    // Build timeline metadata
    const startedAt = new Date(transcript.metadata.startTime).getTime();
    const completedAt = transcript.metadata.endTime
      ? new Date(transcript.metadata.endTime).getTime()
      : undefined;

    // Extract CLAUDE.md files from entries (Phase 2: content + hash for deduplication)
    const claudeMdFiles = this.extractClaudeMdFiles(
      transcript.entries,
      transcript.metadata.startTime
    );

    return {
      sessionId: transcript.sessionId,
      slug: transcript.metadata.slug || 'unknown-session',
      project: transcript.metadata.projectName || 'Unknown Project',
      agent: this.agentType,
      startedAt,
      completedAt,
      frames,
      totalFrames: frames.length,
      metadata: {
        cwd: transcript.metadata.cwd || '',
        claudeVersion: transcript.metadata.claudeVersion,
        agentVersion: transcript.metadata.agentVersion,
        claudeMdFiles,
      },
    };
  }

  // ============================================
  // Abstract methods - must be implemented by subclasses
  // ============================================

  /**
   * Parse a raw JSON entry into a normalized TranscriptEntry
   *
   * @param rawEntry - Raw JSON object from JSONL line
   * @returns Normalized transcript entry, or null to skip
   */
  abstract parseEntry(rawEntry: any): TranscriptEntry | null;

  /**
   * Extract tool execution from a tool use block and its result
   *
   * @param toolUse - Tool use block
   * @param toolResult - Corresponding tool result block
   * @returns Tool execution object
   */
  abstract extractToolExecution(
    toolUse: ToolUseBlock,
    toolResult: ToolResultBlock | undefined
  ): ToolExecution;

  /**
   * Collect tool results from entries into a map
   *
   * @param entries - All transcript entries
   * @returns Map of tool_use_id -> tool result
   */
  abstract collectToolResults(entries: TranscriptEntry[]): Map<string, ToolResultBlock>;

  /**
   * Extract playback frames from a single transcript entry
   *
   * @param entry - Transcript entry
   * @param toolResultMap - Map of tool results
   * @returns Array of playback frames
   */
  abstract extractFramesFromEntry(
    entry: TranscriptEntry,
    toolResultMap: Map<string, ToolResultBlock>
  ): PlaybackFrame[];

  // ============================================
  // Protected methods - can be overridden by subclasses
  // ============================================

  /**
   * Extract session ID from entries or filename
   */
  protected extractSessionId(entries: TranscriptEntry[], filePath: string): string {
    // Try to get from first entry
    if (entries[0]?.sessionId) {
      return entries[0].sessionId;
    }
    // Fall back to filename
    return path.basename(filePath, '.jsonl');
  }

  /**
   * Extract metadata from parsed transcript entries
   */
  protected extractMetadata(entries: TranscriptEntry[], filePath: string): TranscriptMetadata {
    const firstEntry = entries[0];
    const lastEntry = entries[entries.length - 1];

    // Extract project name from file path
    const projectName = this.extractProjectName(filePath);

    // Extract slug - look through first few entries
    const slug = this.extractSlug(entries);

    // Get agent info
    const agentInfo = getAgentInfo(filePath, firstEntry);

    return {
      startTime: firstEntry?.timestamp || new Date().toISOString(),
      endTime: lastEntry?.timestamp,
      totalEntries: entries.length,
      cwd: firstEntry?.cwd,
      slug,
      projectName,
      agentVersion: agentInfo.version,
    };
  }

  /**
   * Extract project name from file path
   * Can be overridden for agent-specific path structures
   */
  protected extractProjectName(filePath: string): string | undefined {
    const agentType = detectAgentFromPath(filePath);

    if (agentType === 'claude') {
      // Claude: ~/.claude/projects/{encoded-project-path}/{session}.jsonl
      const pathParts = filePath.split(path.sep);
      const projectsIndex = pathParts.indexOf('projects');
      const encodedPath = pathParts[projectsIndex + 1];
      if (projectsIndex >= 0 && encodedPath) {
        return this.decodeProjectPath(encodedPath);
      }
    } else if (agentType === 'codex') {
      // Codex: ~/.codex/sessions/{session}.jsonl
      // Project is extracted from first entry's cwd, not path
      return undefined;
    }

    return undefined;
  }

  /**
   * Decode encoded project path (Claude-specific)
   */
  protected decodeProjectPath(encoded: string): string {
    return encoded.replace(/^-/, '/').replace(/-/g, '/');
  }

  /**
   * Extract human-readable slug from transcript entries
   */
  protected extractSlug(entries: TranscriptEntry[]): string | undefined {
    for (const entry of entries.slice(0, 10)) {
      if ((entry as any).slug) {
        return (entry as any).slug;
      }
      if (entry.type === 'session_metadata' && (entry as any).slug) {
        return (entry as any).slug;
      }
    }
    return undefined;
  }

  /**
   * Extract CLAUDE.md file references and content from transcript entries
   * Looks for patterns like "Contents of /path/CLAUDE.md:\n<content>"
   *
   * @param entries - Parsed transcript entries
   * @param startTime - Session start time (fallback for timestamps)
   * @returns Array of CLAUDE.md file info with content and hash
   */
  protected extractClaudeMdFiles(entries: TranscriptEntry[], startTime: string): ClaudeMdInfo[] {
    const claudeMdFiles: ClaudeMdInfo[] = [];
    const seenPaths = new Set<string>();

    for (const entry of entries) {
      // Get timestamp for this entry
      const entryTimestamp = entry.timestamp || startTime;

      // Check raw entry content for CLAUDE.md references
      const rawEntry = (entry as any).rawEntry || entry;

      // Try to extract text content from various entry formats
      let textContent = '';

      // Claude format: { message: { content: [...] } }
      if (rawEntry.message?.content) {
        const content = rawEntry.message.content;
        if (Array.isArray(content)) {
          textContent = content
            .map((block: any) => {
              if (block.type === 'text') return block.text || '';
              if (block.type === 'thinking') return block.thinking || '';
              if (block.type === 'tool_result' && typeof block.content === 'string') {
                return block.content;
              }
              return '';
            })
            .join('\n');
        } else if (typeof content === 'string') {
          textContent = content;
        }
      }

      if (!textContent) continue;

      // Pattern to match CLAUDE.md paths and content
      const claudeMdContentRegex =
        /Contents of ([^\s:]+CLAUDE\.md)(?:\s*\([^)]+\))?:\s*\n([\s\S]*?)(?=\nContents of [^\s:]+:|$)/gi;

      let match;
      while ((match = claudeMdContentRegex.exec(textContent)) !== null) {
        const claudeMdPath = match[1];
        const claudeMdContent = match[2]?.trim() || '';

        if (!claudeMdPath) continue;

        // Filter out placeholder/example paths
        if (
          (!claudeMdPath.startsWith('/') && !claudeMdPath.startsWith('~')) ||
          claudeMdPath.includes('/path/') ||
          claudeMdPath.includes('/path/to/') ||
          claudeMdPath.startsWith('.../') ||
          claudeMdPath.startsWith('[')
        ) {
          continue;
        }

        // Deduplicate by path - keep only first occurrence
        if (seenPaths.has(claudeMdPath)) {
          continue;
        }

        seenPaths.add(claudeMdPath);

        // Compute content hash for deduplication
        const contentHash = claudeMdContent
          ? createHash('sha256').update(claudeMdContent, 'utf8').digest('hex')
          : undefined;

        claudeMdFiles.push({
          path: claudeMdPath,
          loadedAt: entryTimestamp,
          content: claudeMdContent || undefined,
          contentHash,
        });
      }
    }

    return claudeMdFiles;
  }

  // ============================================
  // Shared utility methods
  // ============================================

  /**
   * Calculate duration for each frame based on timing
   * Applies dead air compression for long gaps
   */
  protected calculateFrameDurations(frames: PlaybackFrame[]): void {
    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      if (!frame) continue;

      const nextFrame = frames[i + 1];

      if (nextFrame) {
        // Actual time to next frame
        const actualDuration = nextFrame.timestamp - frame.timestamp;

        if (actualDuration > DEAD_AIR_THRESHOLD) {
          // Dead air detected - compress it
          frame.originalDuration = actualDuration;
          frame.duration = COMPRESSED_DURATION;
          frame.isCompressed = true;
        } else if (actualDuration < 30000) {
          // Normal duration - use as-is
          frame.duration = actualDuration;
        } else {
          // Very long gap (> 30s) - use default duration but mark as compressed
          frame.originalDuration = actualDuration;
          frame.duration = this.getDefaultDuration(frame);
          frame.isCompressed = true;
        }
      } else {
        // Last frame - use default duration
        frame.duration = this.getDefaultDuration(frame);
      }
    }
  }

  /**
   * Get default duration for a frame based on its type and content
   */
  protected getDefaultDuration(frame: PlaybackFrame): number {
    switch (frame.type) {
      case 'user_message':
        const userText = frame.userMessage?.text || '';
        return userText.length > 200 ? 3000 : 2000;

      case 'claude_thinking':
        return 1000;

      case 'claude_response':
        const responseText = frame.claudeResponse?.text || '';
        return Math.min(5000, 3000 + responseText.length / 100);

      case 'tool_execution':
        const toolName = frame.toolExecution?.tool || '';
        return toolName === 'Bash' ? 2000 : 1000;

      default:
        return 2000;
    }
  }

  /**
   * Infer programming language from file extension
   */
  protected inferLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';

    const languageMap: Record<string, string> = {
      ts: 'typescript',
      tsx: 'tsx',
      js: 'javascript',
      jsx: 'jsx',
      py: 'python',
      rb: 'ruby',
      go: 'go',
      rs: 'rust',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
      cs: 'csharp',
      php: 'php',
      swift: 'swift',
      kt: 'kotlin',
      sh: 'bash',
      bash: 'bash',
      zsh: 'bash',
      json: 'json',
      yaml: 'yaml',
      yml: 'yaml',
      xml: 'xml',
      html: 'html',
      css: 'css',
      scss: 'scss',
      sass: 'sass',
      md: 'markdown',
      sql: 'sql',
    };

    return languageMap[ext] || 'text';
  }

  /**
   * Extract file diff for file operations (Write, Edit)
   */
  protected extractFileDiff(
    toolUse: ToolUseBlock,
    _toolResult: ToolResultBlock | undefined
  ): FileDiff | undefined {
    const input = toolUse.input;

    if (toolUse.name === 'Write' && input.file_path && input.content) {
      return {
        filePath: input.file_path,
        newContent: input.content,
        language: this.inferLanguage(input.file_path),
      };
    }

    if (toolUse.name === 'Edit' && input.file_path && input.old_string && input.new_string) {
      return {
        filePath: input.file_path,
        oldContent: input.old_string,
        newContent: input.new_string,
        language: this.inferLanguage(input.file_path),
      };
    }

    return undefined;
  }

  /**
   * Extract file context from tool use
   */
  protected extractFileContext(toolUse: ToolUseBlock): {
    filesRead?: string[];
    filesModified?: string[];
  } {
    const context: { filesRead?: string[]; filesModified?: string[] } = {};

    if (toolUse.name === 'Read' && toolUse.input.file_path) {
      context.filesRead = [toolUse.input.file_path];
    }

    if ((toolUse.name === 'Write' || toolUse.name === 'Edit') && toolUse.input.file_path) {
      context.filesModified = [toolUse.input.file_path];
    }

    return context;
  }

  /**
   * Extract tool output from tool result block
   */
  protected extractToolOutput(toolResult: ToolResultBlock | undefined): {
    content: string;
    isError: boolean;
    exitCode?: number;
  } {
    if (!toolResult) {
      return {
        content: '(No result available)',
        isError: false,
      };
    }

    let content = '';
    let isError = toolResult.is_error || false;
    let exitCode: number | undefined;

    // Handle different content formats
    if (typeof toolResult.content === 'string') {
      content = toolResult.content;
    } else if (Array.isArray(toolResult.content)) {
      const textBlocks = toolResult.content
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text);
      content = textBlocks.join('\n');
    }

    // Extract exit code for Bash commands
    if (content.includes('Exit code:')) {
      const match = content.match(/Exit code: (\d+)/);
      if (match && match[1]) {
        exitCode = parseInt(match[1], 10);
        isError = exitCode !== 0;
      }
    }

    return { content, isError, exitCode };
  }
}
