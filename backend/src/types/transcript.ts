/**
 * TypeScript interfaces for AI coding agent session transcript data structures
 * Supports multiple agents: Claude, Codex, Gemini, etc.
 * Based on actual .jsonl transcript formats from various agent session directories.
 */

/**
 * Supported AI coding agent types
 */
export type AgentType = 'claude' | 'codex' | 'gemini' | 'unknown';

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
export type ContentBlock = TextBlock | ThinkingBlock | ToolUseBlock | ToolResultBlock;

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
  agentVersion?: string; // Generic version field for any agent
}

/**
 * Playback frame - the basic unit for video player
 */
export interface PlaybackFrame {
  id: string;
  type: FrameType;
  timestamp: number; // epoch ms
  duration?: number; // ms to next frame (for auto-advance)
  originalDuration?: number; // uncompressed duration (for UI indicator)
  isCompressed?: boolean; // flag for visual indicator when dead air is compressed
  agent?: AgentType; // Which agent produced this frame

  // User message
  userMessage?: {
    text: string;
  };

  // Agent thinking (Claude, Codex reasoning, etc.)
  thinking?: {
    text: string;
    signature?: string; // Claude-specific
    tokenCount?: number; // Codex o1 reasoning token count
  };

  // Agent response
  claudeResponse?: {
    text: string;
  };

  // Tool execution
  toolExecution?: ToolExecution;

  // Context
  context: FrameContext;
}

export type FrameType = 'user_message' | 'claude_thinking' | 'claude_response' | 'tool_execution';

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
  agent: AgentType; // Which agent produced this session
  startedAt: number; // epoch ms
  completedAt?: number; // epoch ms
  frames: PlaybackFrame[];
  totalFrames: number;
  metadata: {
    claudeVersion?: string;
    agentVersion?: string; // Generic version for any agent
    gitBranch?: string;
    cwd: string;
    claudeMdFiles?: ClaudeMdInfo[]; // CLAUDE.md files loaded during session
  };
}

/**
 * CLAUDE.md file information for observability
 */
export interface ClaudeMdInfo {
  path: string; // Full path to the CLAUDE.md file
  loadedAt: string; // ISO 8601 timestamp when first seen
  content?: string; // Optional: the actual content (fetched on demand)
}

/**
 * Session metadata for listing
 */
export interface SessionMetadata {
  sessionId: string;
  slug: string;
  project: string;
  agent?: AgentType; // Which agent produced this session
  model?: string; // AI model used (e.g., "claude-opus-4-5-20251101")
  startTime: string;
  endTime?: string;
  duration?: number; // seconds
  eventCount: number;
  cwd: string;
  firstUserMessage?: string;
  claudeMdFiles?: ClaudeMdInfo[]; // CLAUDE.md files loaded during session
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

/**
 * Global search result
 */
export interface SearchResult {
  sessionId: string;
  slug: string;
  project: string;
  frameId: string;
  frameType: FrameType;
  timestamp: number;
  snippet: string;
  matchType: 'user_message' | 'thinking' | 'response' | 'tool_output' | 'file_change';
  agent?: AgentType;
}

export interface SearchGlobalRequest {
  query: string;
  limit?: number;
  offset?: number;
  agent?: AgentType;
  project?: string;
}

export interface SearchGlobalResponse {
  results: SearchResult[];
  total: number;
  query: string;
  limit: number;
  offset: number;
}
