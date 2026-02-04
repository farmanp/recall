import {
  TranscriptEntry,
  ParsedTranscript,
  PlaybackFrame,
  SessionTimeline,
  ToolExecution,
  ToolUseBlock,
  ToolResultBlock,
  FileDiff,
} from '../types/transcript';

/**
 * Build a playable timeline from parsed transcript
 * Converts raw entries into structured PlaybackFrame objects
 */
export async function buildTimeline(transcript: ParsedTranscript): Promise<SessionTimeline> {
  const frames: PlaybackFrame[] = [];

  // Track tool results to match with tool calls
  const toolResultMap = new Map<string, ToolResultBlock>();

  // First pass: collect all tool results
  for (const entry of transcript.entries) {
    if (entry.message?.content) {
      for (const block of entry.message.content) {
        if (block.type === 'tool_result') {
          toolResultMap.set(block.tool_use_id, block as ToolResultBlock);
        }
      }
    }
  }

  // Second pass: build frames
  for (const entry of transcript.entries) {
    const entryFrames = extractFramesFromEntry(entry, toolResultMap);
    frames.push(...entryFrames);
  }

  // Calculate frame durations
  calculateFrameDurations(frames);

  // Build timeline metadata
  const startedAt = new Date(transcript.metadata.startTime).getTime();
  const completedAt = transcript.metadata.endTime
    ? new Date(transcript.metadata.endTime).getTime()
    : undefined;

  return {
    sessionId: transcript.sessionId,
    slug: transcript.metadata.slug || 'unknown-session',
    project: transcript.metadata.projectName || 'Unknown Project',
    agent: 'claude' as const, // Legacy builder defaults to Claude
    startedAt,
    completedAt,
    frames,
    totalFrames: frames.length,
    metadata: {
      cwd: transcript.metadata.cwd || '',
      claudeVersion: transcript.metadata.claudeVersion,
    },
  };
}

/**
 * Extract playback frames from a single transcript entry
 */
function extractFramesFromEntry(
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
  const contentBlocks = Array.isArray(content) ? content : [{ type: 'text', text: content }];

  // Process each content block
  for (const block of contentBlocks) {
    switch (block.type) {
      case 'text':
        // Text block - could be user message or Claude response
        if (entry.message.role === 'user') {
          frames.push({
            id: `${entry.uuid}-user-text`,
            type: 'user_message',
            timestamp,
            userMessage: {
              text: block.text,
            },
            context: { cwd },
          });
        } else if (entry.message.role === 'assistant') {
          frames.push({
            id: `${entry.uuid}-assistant-text`,
            type: 'claude_response',
            timestamp,
            claudeResponse: {
              text: block.text,
            },
            context: { cwd },
          });
        }
        break;

      case 'thinking':
        // Thinking block
        if ('thinking' in block) {
          frames.push({
            id: `${entry.uuid}-thinking`,
            type: 'claude_thinking',
            timestamp,
            thinking: {
              text: block.thinking,
              signature: block.signature,
            },
            context: { cwd },
          });
        }
        break;

      case 'tool_use':
        // Tool call - match with result
        const toolUse = block as ToolUseBlock;
        const toolResult = toolResultMap.get(toolUse.id);

        if (toolResult) {
          const toolExecution = buildToolExecution(toolUse, toolResult);
          frames.push({
            id: `${entry.uuid}-tool-${toolUse.id}`,
            type: 'tool_execution',
            timestamp,
            toolExecution,
            context: {
              cwd,
              ...extractFileContext(toolUse),
            },
          });
        } else {
          // Tool call without result yet (might be in-progress)
          // Create a placeholder frame
          frames.push({
            id: `${entry.uuid}-tool-${toolUse.id}`,
            type: 'tool_execution',
            timestamp,
            toolExecution: {
              tool: toolUse.name,
              input: toolUse.input,
              output: {
                content: '(No result available)',
                isError: false,
              },
            },
            context: {
              cwd,
              ...extractFileContext(toolUse),
            },
          });
        }
        break;

      // tool_result blocks are handled when processing tool_use
      case 'tool_result':
        break;

      default:
        // Unknown block type - skip
        break;
    }
  }

  return frames;
}

/**
 * Build ToolExecution object from tool call and result
 */
function buildToolExecution(toolUse: ToolUseBlock, toolResult: ToolResultBlock): ToolExecution {
  const output = extractToolOutput(toolResult);
  const fileDiff = extractFileDiff(toolUse, toolResult);

  return {
    tool: toolUse.name,
    input: toolUse.input,
    output,
    fileDiff,
  };
}

/**
 * Extract tool output from tool result block
 */
function extractToolOutput(toolResult: ToolResultBlock): {
  content: string;
  isError: boolean;
  exitCode?: number;
} {
  let content = '';
  let isError = toolResult.is_error || false;
  let exitCode: number | undefined;

  // Handle different content formats
  if (typeof toolResult.content === 'string') {
    content = toolResult.content;
  } else if (Array.isArray(toolResult.content)) {
    // Content is array of blocks
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

/**
 * Extract file diff for file operations (Write, Edit)
 */
function extractFileDiff(
  toolUse: ToolUseBlock,
  _toolResult: ToolResultBlock
): FileDiff | undefined {
  const input = toolUse.input;

  if (toolUse.name === 'Write' && input.file_path && input.content) {
    return {
      filePath: input.file_path,
      newContent: input.content,
      language: inferLanguage(input.file_path),
    };
  }

  if (toolUse.name === 'Edit' && input.file_path && input.old_string && input.new_string) {
    return {
      filePath: input.file_path,
      oldContent: input.old_string,
      newContent: input.new_string,
      language: inferLanguage(input.file_path),
    };
  }

  return undefined;
}

/**
 * Infer programming language from file extension
 */
function inferLanguage(filePath: string): string {
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

  return languageMap[ext || ''] || 'text';
}

/**
 * Extract file context (files read/modified) from tool use
 */
function extractFileContext(toolUse: ToolUseBlock): {
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

// Dead air compression constants
const DEAD_AIR_THRESHOLD = 5000; // 5 seconds - compress gaps longer than this
const COMPRESSED_DURATION = 1500; // Compress long gaps to 1.5 seconds

/**
 * Calculate duration for each frame based on content and timing
 * Applies dead air compression for gaps > DEAD_AIR_THRESHOLD
 */
function calculateFrameDurations(frames: PlaybackFrame[]): void {
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
        frame.duration = getDefaultDuration(frame);
        frame.isCompressed = true;
      }
    } else {
      // Last frame - use default duration
      frame.duration = getDefaultDuration(frame);
    }
  }
}

/**
 * Get default duration for a frame based on its type and content
 */
function getDefaultDuration(frame: PlaybackFrame): number {
  switch (frame.type) {
    case 'user_message':
      // 2-3 seconds based on length
      const userText = frame.userMessage?.text || '';
      return userText.length > 200 ? 3000 : 2000;

    case 'claude_thinking':
      // 1 second (collapsed by default)
      return 1000;

    case 'claude_response':
      // 3-5 seconds based on length
      const responseText = frame.claudeResponse?.text || '';
      return Math.min(5000, 3000 + responseText.length / 100);

    case 'tool_execution':
      // 2 seconds for most tools, 1 second for file ops
      const toolName = frame.toolExecution?.tool || '';
      return toolName === 'Bash' ? 2000 : 1000;

    default:
      return 2000;
  }
}
