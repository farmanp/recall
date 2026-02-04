/**
 * TypeScript interfaces for Claude Code session transcript data structures
 * Matches backend/src/types/transcript.ts
 */

export type AgentType = 'claude' | 'codex' | 'gemini' | 'unknown';

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
  };
}

/**
 * Session metadata for listing
 */
export interface SessionMetadata {
  sessionId: string;
  slug: string;
  project: string;
  agent?: AgentType;
  startTime: string;
  endTime?: string;
  duration?: number; // seconds
  eventCount: number;
  cwd: string;
  firstUserMessage?: string;
}

/**
 * API Response types
 */
export interface SessionListResponse {
  sessions: SessionMetadata[];
  total: number;
  offset: number;
  limit: number;
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
}

export interface SessionFramesQuery {
  offset?: number;
  limit?: number;
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
