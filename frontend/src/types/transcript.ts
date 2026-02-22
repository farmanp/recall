/**
 * TypeScript interfaces for Claude Code session transcript data structures
 * Matches backend/src/types/transcript.ts
 */

export type AgentType = 'claude' | 'codex' | 'gemini' | 'unknown';

/**
 * Token usage metrics from API response
 */
export interface TokenUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  service_tier?: string;
}

/**
 * Token attribution by category for detailed breakdown
 */
export interface TokenAttribution {
  userInput: number; // Tokens from user messages
  toolOutput: number; // Tokens from tool results
  thinking: number; // Tokens from thinking blocks
  response: number; // Tokens from assistant responses
  claudeMd: number; // Tokens from CLAUDE.md context injection
  cache: number; // Tokens read from cache
}

/**
 * Context compaction event data
 */
export interface CompactionInfo {
  tokensBefore: number; // Context size before compaction
  tokensAfter: number; // Context size after compaction
  summarizedFrames?: number; // How many frames were compacted
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
  agent?: AgentType;
  tokenUsage?: TokenUsage; // Token usage metrics from API response

  // User message
  userMessage?: {
    text: string;
  };

  // Claude thinking
  thinking?: {
    text: string;
    signature?: string;
    tokenCount?: number; // Codex o1 reasoning token count
  };

  // Claude response
  claudeResponse?: {
    text: string;
  };

  // Tool execution
  toolExecution?: ToolExecution;

  // Context compaction event (when type === 'context_compaction')
  compaction?: CompactionInfo;

  // Context
  context: FrameContext;

  // Hierarchy fields for subagent trees
  parentFrameId?: string; // Parent frame that spawned this frame/subagent
  isSubagent?: boolean; // Whether this frame belongs to a subagent
  agentId?: string; // Unique identifier for subagent (for grouping)
  taskDescription?: string; // Description from Task tool when spawning subagent

  // Context window tracking
  phaseNumber?: number; // Context phase (1-based, increments after compaction)
  accumulatedContext?: number; // Running total of context tokens at this frame

  // Token attribution
  tokenAttribution?: TokenAttribution; // Per-category token breakdown
  estimatedCostCents?: number; // Estimated cost for this turn
}

export type FrameType =
  | 'user_message'
  | 'claude_thinking'
  | 'claude_response'
  | 'tool_execution'
  | 'context_compaction';

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
  agent?: AgentType;
  startedAt: number; // epoch ms
  completedAt?: number; // epoch ms
  frames: PlaybackFrame[];
  totalFrames: number;
  metadata: {
    claudeVersion?: string;
    agentVersion?: string;
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
  agent?: AgentType;
  model?: string; // AI model used (e.g., "claude-opus-4-5-20251101")
  startTime: string;
  endTime?: string;
  duration?: number; // seconds
  eventCount: number;
  cwd: string;
  firstUserMessage?: string;
  claudeMdFiles?: ClaudeMdInfo[]; // CLAUDE.md files loaded during session
  isOngoing?: boolean; // True if session is still active (live)
}

/**
 * API Response types
 */
export interface SessionListResponse {
  sessions: SessionMetadata[];
  total: number;
  offset: number;
  limit: number;
  source?: 'filesystem' | 'db';
  agent?: AgentType;
  hasClaudeMd?: boolean;
  cwdFilter?: string | null; // Current working directory filter (null if showAll=true or no filter)
  totalUnfiltered?: number; // Total sessions before CWD filter was applied
}

export interface SessionDetailsResponse {
  sessionId: string;
  slug: string;
  project: string;
  agent?: AgentType;
  startedAt: number;
  completedAt?: number;
  totalFrames: number;
  metadata: {
    claudeVersion?: string;
    agentVersion?: string;
    gitBranch?: string;
    cwd: string;
    claudeMdFiles?: ClaudeMdInfo[]; // CLAUDE.md files loaded during session
  };
}

export interface SessionFramesResponse {
  frames: PlaybackFrame[];
  total: number;
  offset: number;
  limit: number;
}

/**
 * API Query parameters
 */
export interface SessionListQuery {
  offset?: number;
  limit?: number;
  project?: string;
  agent?: AgentType;
  hasClaudeMd?: boolean;
  source?: 'filesystem' | 'db';
  showAll?: boolean; // Bypass CWD filter to show sessions from all directories
}

export interface SessionFramesQuery {
  offset?: number;
  limit?: number;
  source?: 'filesystem' | 'db';
}

/**
 * Commentary types for claude-mem integration
 */
export interface CommentaryData {
  id: number;
  timestamp: number;
  frameIndex?: number;
  type: string;
  title: string;
  content: string;
  metadata?: Record<string, any>;
}

export interface CommentaryResponse {
  commentary: CommentaryData[];
  total: number;
  sessionId: string;
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
