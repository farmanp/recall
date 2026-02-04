/**
 * SessionPlayerPage Component
 *
 * Video player-style interface for replaying Claude Code sessions
 */

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSessionDetails, useSessionFrames, useSessionCommentary } from '../hooks/useTranscriptApi';
import type { PlaybackFrame, CommentaryData } from '../types/transcript';
import { CodeBlock } from '../components/CodeBlock';
import { DiffViewer } from '../components/DiffViewer';
import { AgentBadge } from '../components/AgentBadge';
import { CommentaryTimeline, CommentaryCard } from '../components/CommentaryBubble';
import { TimelineScrubber } from '../components/session-player/TimelineScrubber';
import { FrameTypeFilters, findNextVisibleFrame, findPrevVisibleFrame } from '../components/session-player/FrameTypeFilters';
import { HelpPanel } from '../components/session-player/HelpPanel';
import { StatsPanel } from '../components/session-player/StatsPanel';
import { useSessionStats } from '../hooks/useSessionStats';
import { findMatchingFrameIndices, findNextMatchIndex, findPrevMatchIndex, highlightText } from '../lib/frameSearch';

type FrameType = 'user_message' | 'claude_thinking' | 'claude_response' | 'tool_execution';

export const SessionPlayerPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showCommentary, setShowCommentary] = useState(true);
  const [selectedCommentary, setSelectedCommentary] = useState<CommentaryData | null>(null);
  const [activeFrameTypes, setActiveFrameTypes] = useState<Set<FrameType>>(
    new Set(['user_message', 'claude_response', 'tool_execution', 'claude_thinking'])
  );
  const [compressionEnabled, setCompressionEnabled] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Fetch session details and all frames
  const { data: sessionDetails, isLoading: loadingDetails } = useSessionDetails(sessionId);
  const { data: framesData, isLoading: loadingFrames } = useSessionFrames(sessionId, {
    offset: 0,
    limit: 1000, // Load all frames for now
  });

  // Fetch commentary observations from claude-mem
  const { data: commentaryData } = useSessionCommentary(sessionId);

  const frames = framesData?.frames || [];
  const currentFrame = frames[currentFrameIndex];

  // Session statistics
  const stats = useSessionStats(frames);

  // Search matches
  const searchMatches = React.useMemo(
    () => findMatchingFrameIndices(frames, searchQuery),
    [frames, searchQuery]
  );

  // Auto-advance logic with frame filtering and dead air compression
  useEffect(() => {
    if (!isPlaying || !currentFrame || currentFrameIndex >= frames.length - 1) {
      return;
    }

    // Use compressed duration if compression is enabled, otherwise use original
    const baseDuration = compressionEnabled
      ? (currentFrame.duration || 2000)
      : (currentFrame.originalDuration || currentFrame.duration || 2000);
    const duration = baseDuration / playbackSpeed;

    timeoutRef.current = setTimeout(() => {
      const nextFrame = findNextVisibleFrame(currentFrameIndex + 1, frames, activeFrameTypes);
      setCurrentFrameIndex(nextFrame);
    }, duration);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isPlaying, currentFrameIndex, currentFrame, playbackSpeed, frames.length, frames, activeFrameTypes, compressionEnabled]);

  // Keyboard shortcuts with frame filtering
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ignore if typing in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Playback speed values for 1-5 keys
      const speedValues = [0.25, 0.5, 1, 2, 5];

      switch (e.key) {
        case ' ':
          e.preventDefault();
          setIsPlaying((prev) => !prev);
          break;
        case 'ArrowRight':
          e.preventDefault();
          setCurrentFrameIndex(findNextVisibleFrame(currentFrameIndex + 1, frames, activeFrameTypes));
          setIsPlaying(false);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          setCurrentFrameIndex(findPrevVisibleFrame(currentFrameIndex - 1, frames, activeFrameTypes));
          setIsPlaying(false);
          break;
        case 'Home':
          e.preventDefault();
          setCurrentFrameIndex(findNextVisibleFrame(0, frames, activeFrameTypes));
          setIsPlaying(false);
          break;
        case 'End':
          e.preventDefault();
          setCurrentFrameIndex(findPrevVisibleFrame(frames.length - 1, frames, activeFrameTypes));
          setIsPlaying(false);
          break;
        case '?':
          e.preventDefault();
          setShowHelp((prev) => !prev);
          break;
        case 'c':
        case 'C':
          e.preventDefault();
          setCompressionEnabled((prev) => !prev);
          break;
        case 's':
        case 'S':
          e.preventDefault();
          setShowStats((prev) => !prev);
          break;
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
          e.preventDefault();
          setPlaybackSpeed(speedValues[parseInt(e.key) - 1]);
          break;
        case 'Escape':
          e.preventDefault();
          setShowHelp(false);
          setShowStats(false);
          break;
        case 'n':
          // Next search match
          if (searchMatches.length > 0) {
            e.preventDefault();
            const nextIndex = findNextMatchIndex(currentFrameIndex, searchMatches);
            if (nextIndex !== -1) {
              setCurrentFrameIndex(nextIndex);
              setIsPlaying(false);
            }
          }
          break;
        case 'p':
          // Previous search match
          if (searchMatches.length > 0) {
            e.preventDefault();
            const prevIndex = findPrevMatchIndex(currentFrameIndex, searchMatches);
            if (prevIndex !== -1) {
              setCurrentFrameIndex(prevIndex);
              setIsPlaying(false);
            }
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [frames.length, frames, currentFrameIndex, activeFrameTypes, searchMatches]);

  if (loadingDetails || loadingFrames) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-300">Loading session...</p>
        </div>
      </div>
    );
  }

  if (!sessionDetails || !framesData || frames.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-center">
          <p className="text-xl text-gray-300">Session not found</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Back to Sessions
          </button>
        </div>
      </div>
    );
  }

  const progress = ((currentFrameIndex + 1) / frames.length) * 100;

  return (
    <div className="h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="text-gray-400 hover:text-white"
          >
            ← Back
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">{sessionDetails.slug}</h1>
              <AgentBadge agent={sessionDetails.agent} />
            </div>
            <p className="text-sm text-gray-400">{sessionDetails.project}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowStats(!showStats)}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              showStats
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
            title="Toggle statistics panel (s)"
          >
            Stats
          </button>
          <span className="text-sm text-gray-400">
            {framesData.total} frames
          </span>
        </div>
      </div>

      {/* Statistics Panel */}
      {showStats && (
        <StatsPanel stats={stats} onClose={() => setShowStats(false)} />
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Dead air compression indicator */}
          {currentFrame?.isCompressed && compressionEnabled && (
            <div className="mb-4 px-4 py-2 bg-amber-900/50 border border-amber-700 rounded-lg flex items-center gap-2 text-amber-300 text-sm">
              <span>Compressed</span>
              <span className="text-amber-400 font-mono">
                {Math.round((currentFrame.originalDuration || 0) / 1000)}s
              </span>
              <span className="text-amber-500">→</span>
              <span className="text-amber-400 font-mono">
                {Math.round((currentFrame.duration || 0) / 1000)}s
              </span>
            </div>
          )}
          {currentFrame && activeFrameTypes.has(currentFrame.type) && (
            <FrameRenderer frame={currentFrame} searchQuery={searchQuery} />
          )}
          {currentFrame && !activeFrameTypes.has(currentFrame.type) && (
            <div className="text-center py-12 text-gray-400">
              <p>This frame type is currently filtered.</p>
              <p className="text-sm mt-2">Enable "{currentFrame.type}" in the frame filters above.</p>
            </div>
          )}
        </div>
      </div>

      {/* Frame Type Filters */}
      <FrameTypeFilters
        frames={frames}
        activeFrameTypes={activeFrameTypes}
        onToggleFrameType={(type) => {
          setActiveFrameTypes((prev) => {
            const next = new Set(prev);
            if (next.has(type)) {
              next.delete(type);
            } else {
              next.add(type);
            }
            return next;
          });
        }}
        onToggleAll={(showAll) => {
          if (showAll) {
            setActiveFrameTypes(new Set(['user_message', 'claude_response', 'tool_execution', 'claude_thinking']));
          } else {
            setActiveFrameTypes(new Set());
          }
        }}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchMatchCount={searchMatches.length}
        onNextMatch={() => {
          const nextIndex = findNextMatchIndex(currentFrameIndex, searchMatches);
          if (nextIndex !== -1) {
            setCurrentFrameIndex(nextIndex);
            setIsPlaying(false);
          }
        }}
        onPrevMatch={() => {
          const prevIndex = findPrevMatchIndex(currentFrameIndex, searchMatches);
          if (prevIndex !== -1) {
            setCurrentFrameIndex(prevIndex);
            setIsPlaying(false);
          }
        }}
      />

      {/* Timeline Scrubber */}
      <TimelineScrubber
        frames={frames}
        currentFrameIndex={currentFrameIndex}
        onSeek={setCurrentFrameIndex}
        showCommentary={showCommentary}
        commentary={commentaryData?.commentary}
        activeFrameTypes={activeFrameTypes}
      />

      {/* Playback Controls */}
      <div className="bg-gray-800 border-t border-gray-700 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                const prevFrame = findPrevVisibleFrame(currentFrameIndex - 1, frames, activeFrameTypes);
                setCurrentFrameIndex(prevFrame);
              }}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded"
              disabled={currentFrameIndex === 0}
            >
              ⏮ Prev
            </button>

            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded font-semibold"
            >
              {isPlaying ? '⏸ Pause' : '▶️ Play'}
            </button>

            <button
              onClick={() => {
                const nextFrame = findNextVisibleFrame(currentFrameIndex + 1, frames, activeFrameTypes);
                setCurrentFrameIndex(nextFrame);
              }}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded"
              disabled={currentFrameIndex >= frames.length - 1}
            >
              Next ⏭
            </button>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showCommentary}
                onChange={(e) => setShowCommentary(e.target.checked)}
                className="rounded"
              />
              Commentary
              {commentaryData && commentaryData.commentary.length > 0 && (
                <span className="text-xs text-gray-400">
                  ({commentaryData.commentary.length})
                </span>
              )}
            </label>

            <button
              onClick={() => setCompressionEnabled(!compressionEnabled)}
              className={`px-3 py-2 rounded text-sm transition-colors ${
                compressionEnabled
                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                  : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
              }`}
              title={compressionEnabled ? 'Disable dead air compression' : 'Enable dead air compression'}
            >
              {compressionEnabled ? 'Skip Gaps' : 'Skip Gaps Off'}
            </button>

            <select
              value={playbackSpeed}
              onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
              className="px-3 py-2 bg-gray-700 rounded text-sm"
            >
              <option value={0.25}>0.25x</option>
              <option value={0.5}>0.5x</option>
              <option value={1}>1x</option>
              <option value={2}>2x</option>
              <option value={5}>5x</option>
            </select>

            <button
              onClick={() => setShowHelp(true)}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
              title="Keyboard shortcuts (?)"
            >
              ?
            </button>
          </div>
        </div>
      </div>

      {/* Commentary Card Modal */}
      {selectedCommentary && (
        <CommentaryCard
          commentary={selectedCommentary}
          onClose={() => setSelectedCommentary(null)}
        />
      )}

      {/* Help Panel Modal */}
      {showHelp && (
        <HelpPanel onClose={() => setShowHelp(false)} />
      )}
    </div>
  );
};

/**
 * Tool Output Block Component
 * Intelligently displays tool output with syntax highlighting when appropriate
 */
const ToolOutputBlock: React.FC<{
  tool: string;
  output: string;
  isError: boolean;
}> = ({ tool, output, isError }) => {
  const [isFormatted, setIsFormatted] = React.useState(true);

  // Handle empty output
  if (!output || output.trim() === '') {
    return (
      <div className="bg-gray-950 rounded p-4 font-mono text-sm border border-gray-800">
        <div className="text-gray-500 italic text-center">
          (no output)
        </div>
      </div>
    );
  }

  // Detect if output is truncated with a file path
  const truncationMatch = output.match(/\[Truncated\. Full output: (.+)\]/);
  const truncatedFilePath = truncationMatch ? truncationMatch[1] : null;

  // Try to parse and beautify JSON
  const tryBeautifyJson = (content: string): { success: boolean; formatted: string } => {
    try {
      const parsed = JSON.parse(content);
      return {
        success: true,
        formatted: JSON.stringify(parsed, null, 2)
      };
    } catch {
      return { success: false, formatted: content };
    }
  };

  // Determine if output should be syntax highlighted
  const shouldHighlight = (toolName: string, content: string): boolean => {
    // Tools that typically output code
    const codeTools = ['Read', 'Write', 'Edit', 'Grep', 'NotebookEdit'];
    if (codeTools.includes(toolName)) return true;

    // Check for code-like patterns
    const hasCodePatterns = /^(function|class|const|let|var|import|export|def|public|private)/m.test(content);
    const hasJsonPattern = /^\s*[{\[]/.test(content.trim());

    return hasCodePatterns || hasJsonPattern;
  };

  // Detect language from Bash output
  const detectBashOutputLanguage = (content: string): string => {
    // Check for common file extensions in output
    if (content.includes('.json')) return 'json';
    if (content.includes('.py')) return 'python';
    if (content.includes('.js') || content.includes('.ts')) return 'javascript';
    if (content.includes('.yml') || content.includes('.yaml')) return 'yaml';

    // Check for JSON content
    if (/^\s*[{\[]/.test(content.trim())) {
      try {
        JSON.parse(content);
        return 'json';
      } catch {
        // Not valid JSON
      }
    }

    return 'bash';
  };

  // Determine language
  let language = 'plaintext';
  if (tool === 'Bash') {
    language = detectBashOutputLanguage(output);
  } else if (tool === 'Read' || tool === 'Write' || tool === 'Edit') {
    language = 'javascript'; // Default, will be overridden by file extension
  } else if (tool === 'Grep') {
    language = 'plaintext';
  }

  // Try to beautify JSON if formatted mode is on
  const isJson = language === 'json' || /^\s*[{\[]/.test(output.trim());
  const beautifyResult = (isJson && isFormatted && !isError) ? tryBeautifyJson(output) : { success: false, formatted: output };
  const processedOutput = beautifyResult.success ? beautifyResult.formatted : output;

  // Truncate very long output
  const maxLength = 2000;
  const truncated = processedOutput.length > maxLength;
  const displayOutput = truncated ? processedOutput.substring(0, maxLength) : processedOutput;

  // Render format toggle button
  const FormatToggle = () => {
    if (!isJson || isError) return null;

    return (
      <div className="flex justify-end mb-2">
        <button
          onClick={() => setIsFormatted(!isFormatted)}
          className="px-3 py-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded border border-gray-700 transition-colors"
        >
          {isFormatted ? '📋 Raw' : '✨ Format'}
        </button>
      </div>
    );
  };

  // Render truncation notice
  const TruncationNotice = () => {
    if (!truncated && !truncatedFilePath) return null;

    return (
      <div className="mt-2 px-3 py-2 bg-gray-900 border border-gray-800 rounded text-xs">
        {truncatedFilePath ? (
          <div className="text-gray-400">
            <span className="text-yellow-500">⚠ Output truncated.</span> Full output:
            <code className="ml-2 px-2 py-0.5 bg-gray-950 rounded text-gray-300 font-mono text-xs">
              {truncatedFilePath}
            </code>
          </div>
        ) : (
          <div className="text-gray-500 text-center">
            Output truncated ({output.length.toLocaleString()} characters total)
          </div>
        )}
      </div>
    );
  };

  if (shouldHighlight(tool, output) && !isError) {
    return (
      <div>
        <FormatToggle />
        <CodeBlock
          code={displayOutput}
          language={language}
          showLineNumbers={true}
          maxHeight="500px"
        />
        <TruncationNotice />
      </div>
    );
  }

  // Plain text output (for simple bash commands, errors, etc.)
  return (
    <div>
      <FormatToggle />
      <div className={`bg-gray-950 rounded p-4 font-mono text-sm overflow-x-auto border ${
        isError ? 'border-red-800' : 'border-gray-800'
      }`} style={{ maxHeight: '500px' }}>
        <pre className={`whitespace-pre-wrap ${isError ? 'text-red-400' : 'text-gray-300'}`}>
          {displayOutput}
        </pre>
      </div>
      <TruncationNotice />
    </div>
  );
};

/**
 * Frame Renderer Component
 */
const FrameRenderer: React.FC<{ frame: PlaybackFrame; searchQuery?: string }> = ({ frame, searchQuery = '' }) => {
  const frameTypeColors = {
    user_message: 'bg-blue-900 border-blue-700',
    claude_thinking: 'bg-purple-900 border-purple-700',
    claude_response: 'bg-green-900 border-green-700',
    tool_execution: 'bg-orange-900 border-orange-700',
  };

  // Get agent display name (capitalize first letter)
  const agentName = frame.agent
    ? frame.agent.charAt(0).toUpperCase() + frame.agent.slice(1)
    : 'AI';

  const frameTypeLabels = {
    user_message: '👤 User',
    claude_thinking: `🧠 ${agentName} Thinking`,
    claude_response: `🤖 ${agentName}`,
    tool_execution: '🛠️ Tool Execution',
  };

  const bgColor = frameTypeColors[frame.type] || 'bg-gray-800 border-gray-700';

  return (
    <div className={`${bgColor} border rounded-lg p-6 mb-4`}>
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-semibold">{frameTypeLabels[frame.type]}</span>
        <span className="text-xs text-gray-400">
          {new Date(frame.timestamp).toLocaleTimeString()}
        </span>
      </div>

      {frame.userMessage && (
        <div className="prose prose-invert max-w-none">
          <p className="whitespace-pre-wrap">
            {highlightText(frame.userMessage.text, searchQuery)}
          </p>
        </div>
      )}

      {frame.thinking && (
        <div className="prose prose-invert max-w-none">
          <p className="whitespace-pre-wrap text-gray-300 italic">
            {highlightText(frame.thinking.text, searchQuery)}
          </p>
        </div>
      )}

      {frame.claudeResponse && (
        <div className="prose prose-invert max-w-none">
          <p className="whitespace-pre-wrap">
            {highlightText(frame.claudeResponse.text, searchQuery)}
          </p>
        </div>
      )}

      {frame.toolExecution && (
        <div>
          <div className="mb-3">
            <span className="px-2 py-1 bg-gray-700 rounded text-xs font-mono">
              {frame.toolExecution.tool}
            </span>
          </div>

          {frame.toolExecution.fileDiff ? (
            <DiffViewer
              filePath={frame.toolExecution.fileDiff.filePath}
              oldContent={frame.toolExecution.fileDiff.oldContent}
              newContent={frame.toolExecution.fileDiff.newContent}
              language={frame.toolExecution.fileDiff.language}
              isEdit={frame.toolExecution.tool === 'Edit'}
            />
          ) : (
            <ToolOutputBlock
              tool={frame.toolExecution.tool}
              output={frame.toolExecution.output.content}
              isError={frame.toolExecution.output.isError}
            />
          )}
        </div>
      )}
    </div>
  );
};
