/**
 * TypeScript interfaces for Claude Code session transcript data structures
 * Based on actual .jsonl transcript format from ~/.claude/projects/
 */

/**
 * Raw entry from .jsonl transcript file
 */
export interface TranscriptEntry {
  uuid: string;
  parentUuid?: string;
  timestamp: string; // ISO 8601 timestamp
  type: TranscriptEntryType;
  message?: Message;
  cwd?: string;
  sessionId?: string;
  [key: string]: any; // Allow additional fields
}

export type TranscriptEntryType =
  | 'user'
  | 'assistant'
  | 'progress'
  | 'file-history-snapshot'
  | 'tool_result'
  | string; // Allow other types we haven't discovered yet

/**
 * Message structure within transcript entries
 */
export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: ContentBlock[];
}

/**
 * Content blocks within messages
 */
export type ContentBlock =
  | TextBlock
  | ThinkingBlock
  | ToolUseBlock
  | ToolResultBlock;

export interface TextBlock {
  type: 'text';
  text: string;
}

export interface ThinkingBlock {
  type: 'thinking';
  thinking: string;
  signature?: string;
}

export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, any>;
}

export interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string | ContentBlock[];
  is_error?: boolean;
}

/**
 * Parsed transcript with all entries organized
 */
export interface ParsedTranscript {
  sessionId: string;
  entries: TranscriptEntry[];
  metadata: TranscriptMetadata;
}

/**
 * Metadata extracted from transcript
 */
export interface TranscriptMetadata {
  startTime: string;
  endTime?: string;
  totalEntries: number;
  cwd?: string;
  slug?: string;
  projectName?: string;
  claudeVersion?: string;
}

/**
 * Playback frame - the basic unit for video player
 */
export interface PlaybackFrame {
  id: string;
  type: FrameType;
  timestamp: number; // epoch ms
  duration?: number; // ms to next frame (for auto-advance)

  // User message
  userMessage?: {
    text: string;
  };

  // Claude thinking
  thinking?: {
    text: string;
    signature?: string;
  };

  // Claude response
  claudeResponse?: {
    text: string;
  };

  // Tool execution
  toolExecution?: ToolExecution;

  // Context
  context: FrameContext;
}

export type FrameType =
  | 'user_message'
  | 'claude_thinking'
  | 'claude_response'
  | 'tool_execution';

export interface ToolExecution {
  tool: string; // "Bash", "Read", "Write", "Edit", etc.
  input: Record<string, any>; // tool parameters
  output: {
    content: string; // stdout/stderr or file content
    isError: boolean;
    exitCode?: number;
  };
  // For file edits
  fileDiff?: FileDiff;
}

export interface FileDiff {
  filePath: string;
  oldContent?: string;
  newContent: string;
  language: string; // for syntax highlighting
}

export interface FrameContext {
  cwd: string;
  filesRead?: string[];
  filesModified?: string[];
}

/**
 * Session timeline - complete playback data
 */
export interface SessionTimeline {
  sessionId: string;
  slug: string;
  project: string;
  startedAt: number; // epoch ms
  completedAt?: number; // epoch ms
  frames: PlaybackFrame[];
  totalFrames: number;
  metadata: {
    claudeVersion?: string;
    gitBranch?: string;
    cwd: string;
  };
}

/**
 * Session metadata for listing
 */
export interface SessionMetadata {
  sessionId: string;
  slug: string;
  project: string;
  startTime: string;
  endTime?: string;
  duration?: number; // seconds
  eventCount: number;
  cwd: string;
  firstUserMessage?: string;
}

/**
 * Link to claude-mem observation for commentary bubbles
 */
export interface MemoryCommentary {
  observationId: number;
  timestamp: string;
  type: 'bugfix' | 'feature' | 'decision' | 'discovery' | 'insight';
  title: string;
  summary?: string;
  // Will be fetched on-demand using mem-search skill
}

/**
 * Playback frame with optional claude-mem commentary
 */
export interface AnnotatedPlaybackFrame extends PlaybackFrame {
  commentary?: MemoryCommentary[];
}
