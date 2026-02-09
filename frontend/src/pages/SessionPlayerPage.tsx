/**
 * SessionPlayerPage Component
 *
 * Video player-style interface for replaying Claude Code sessions
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  useSessionDetails,
  useSessionFrames,
  useSessionCommentary,
} from '../hooks/useTranscriptApi';
import type { PlaybackFrame, CommentaryData, SessionTimeline } from '../types/transcript';
import ReactMarkdown from 'react-markdown';
import { CodeBlock } from '../components/CodeBlock';
import { DiffViewer } from '../components/DiffViewer';
import { AgentBadge } from '../components/AgentBadge';
import { ModelBadge } from '../components/ModelBadge';
import {
  ChevronLeft,
  Share2,
  Play,
  Pause,
  FastForward,
  Settings,
  Download,
  Info,
  Zap,
  Search as SearchIcon,
  Folder,
  FolderOpen,
  Calendar,
  Hash,
  MessageSquare,
  Layout,
  FileText,
} from 'lucide-react';
import { CommentaryTimeline, CommentaryCard } from '../components/CommentaryBubble';
import { TimelineScrubber } from '../components/session-player/TimelineScrubber';
import { ChatView } from '../components/session-player/ChatView';
import { FrameTypeFilters } from '../components/session-player/FrameTypeFilters';
import {
  findNextVisibleFrame,
  findPrevVisibleFrame,
} from '../components/session-player/frameTypeFiltersUtils';
import { HelpPanel } from '../components/session-player/HelpPanel';
import { StatsPanel } from '../components/session-player/StatsPanel';
import { ClaudeMdPanel } from '../components/session-player/ClaudeMdPanel';
import { ArtifactsPanel } from '../components/session-player/ArtifactsPanel';
import { useSessionStats } from '../hooks/useSessionStats';
import {
  findMatchingFrameIndices,
  findNextMatchIndex,
  findPrevMatchIndex,
  highlightText,
} from '../lib/frameSearch';
import { sessionToMarkdown, downloadFile } from '../lib/exportSession';

type FrameType = 'user_message' | 'claude_thinking' | 'claude_response' | 'tool_execution';

export const SessionPlayerPage: React.FC = () => {
  const { sessionId, frameIndex } = useParams<{ sessionId: string; frameIndex?: string }>();
  const navigate = useNavigate();
  const mountedRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // State tracks current position, initialized from URL via lazy initializer
  const [currentFrameIndex, setCurrentFrameIndex] = useState(() => {
    // Read from URL at mount time
    if (frameIndex !== undefined) {
      const parsed = parseInt(frameIndex, 10);
      if (!isNaN(parsed)) return parsed;
    }
    return 0;
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showCommentary, setShowCommentary] = useState(true);
  const [selectedCommentary, setSelectedCommentary] = useState<CommentaryData | null>(null);
  const [activeFrameTypes, setActiveFrameTypes] = useState<Set<FrameType>>(
    new Set(['user_message', 'claude_response', 'tool_execution', 'claude_thinking'])
  );
  const [toolFilterEnabled, setToolFilterEnabled] = useState(true);
  const [activeToolNames, setActiveToolNames] = useState<Set<string>>(new Set());
  const [toolErrorsOnly, setToolErrorsOnly] = useState(false);
  const [compressionEnabled, setCompressionEnabled] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showClaudeMd, setShowClaudeMd] = useState(false);
  const [showArtifacts, setShowArtifacts] = useState(false);
  const [artifactViewMode, setArtifactViewMode] = useState<'cumulative' | 'full'>('cumulative');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'timeline' | 'chat'>('timeline');

  // Fetch session details and all frames
  const { data: sessionDetails, isLoading: loadingDetails } = useSessionDetails(sessionId);
  const { data: framesData, isLoading: loadingFrames } = useSessionFrames(sessionId, {
    offset: 0,
    limit: 1000, // Load all frames for now
  });

  // Fetch commentary observations from claude-mem
  const { data: commentaryData } = useSessionCommentary(sessionId);

  const frames = useMemo(() => framesData?.frames ?? [], [framesData?.frames]);
  const currentFrame = useMemo(() => frames[currentFrameIndex], [frames, currentFrameIndex]);
  const availableToolNames = useMemo(() => {
    const names = new Set<string>();
    for (const frame of frames) {
      if (frame.type === 'tool_execution') {
        names.add(frame.toolExecution?.tool || 'Unknown Tool');
      }
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [frames]);
  const isEndOfSession = frames.length > 0 && currentFrameIndex >= frames.length - 1;
  const activeFrameCount = activeFrameTypes.size;

  const isFrameVisible = React.useCallback(
    (frame: PlaybackFrame): boolean => {
      if (!activeFrameTypes.has(frame.type as FrameType)) {
        return false;
      }

      if (frame.type === 'tool_execution' && toolFilterEnabled) {
        const toolName = frame.toolExecution?.tool || 'Unknown Tool';

        if (activeToolNames.size > 0 && !activeToolNames.has(toolName)) {
          return false;
        }

        if (toolErrorsOnly && !frame.toolExecution?.output?.isError) {
          return false;
        }
      }

      return true;
    },
    [activeFrameTypes, toolFilterEnabled, activeToolNames, toolErrorsOnly]
  );

  useEffect(() => {
    setActiveToolNames((prev) => {
      const available = new Set(availableToolNames);
      const pruned = new Set(Array.from(prev).filter((name) => available.has(name)));
      if (pruned.size > 0) {
        return pruned;
      }
      return new Set(availableToolNames);
    });
  }, [availableToolNames]);

  // Mark as mounted after data has loaded
  useEffect(() => {
    // Only mark as mounted once frames have loaded
    if (frames.length > 0 && !mountedRef.current) {
      // Add a small delay after frames load to ensure stability
      const timer = setTimeout(() => {
        mountedRef.current = true;
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [frames.length]);

  // Clear any stale localStorage on mount (legacy cleanup)
  useEffect(() => {
    if (sessionId) {
      localStorage.removeItem(`recall:playback:${sessionId}`);
    }
  }, [sessionId]);

  // Update frame index (URL sync removed - was causing refresh bugs)
  const handleFrameChange = (newIndex: number) => {
    setCurrentFrameIndex(newIndex);
  };

  // Session statistics
  const stats = useSessionStats(frames);

  // Search matches
  const searchMatches = React.useMemo(
    () => findMatchingFrameIndices(frames, searchQuery),
    [frames, searchQuery]
  );

  // Current match rank (0-indexed position of current frame in matches)
  const currentMatchRank = React.useMemo(() => {
    if (searchMatches.length === 0) return -1;
    // Find the closest previous or current match index
    const index = [...searchMatches].reverse().findIndex((m) => m <= currentFrameIndex);
    if (index === -1) return -1;
    return searchMatches.length - 1 - index;
  }, [searchMatches, currentFrameIndex]);

  // Auto-advance logic with frame filtering and dead air compression
  useEffect(() => {
    if (!isPlaying || !currentFrame || currentFrameIndex >= frames.length - 1) {
      return;
    }

    // Use compressed duration if compression is enabled, otherwise use original
    const baseDuration = compressionEnabled
      ? currentFrame.duration || 2000
      : currentFrame.originalDuration || currentFrame.duration || 2000;
    const duration = baseDuration / playbackSpeed;

    timeoutRef.current = setTimeout(() => {
      const nextFrame = findNextVisibleFrame(
        currentFrameIndex + 1,
        frames,
        activeFrameTypes,
        isFrameVisible
      );
      handleFrameChange(nextFrame);
    }, duration);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [
    isPlaying,
    currentFrameIndex,
    currentFrame,
    playbackSpeed,
    frames.length,
    frames,
    activeFrameTypes,
    isFrameVisible,
    compressionEnabled,
  ]);

  // URL is updated directly in handleFrameChange, no sync effect needed

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
          handleFrameChange(
            findNextVisibleFrame(currentFrameIndex + 1, frames, activeFrameTypes, isFrameVisible)
          );
          setIsPlaying(false);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handleFrameChange(
            findPrevVisibleFrame(currentFrameIndex - 1, frames, activeFrameTypes, isFrameVisible)
          );
          setIsPlaying(false);
          break;
        case 'Home':
          e.preventDefault();
          handleFrameChange(findNextVisibleFrame(0, frames, activeFrameTypes, isFrameVisible));
          setIsPlaying(false);
          break;
        case 'End':
          e.preventDefault();
          handleFrameChange(
            findPrevVisibleFrame(frames.length - 1, frames, activeFrameTypes, isFrameVisible)
          );
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
        case 'a':
        case 'A':
          e.preventDefault();
          setShowArtifacts((prev) => !prev);
          break;
        case 'd':
        case 'D':
          e.preventDefault();
          setShowClaudeMd((prev) => !prev);
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
          if (showHelp) {
            setShowHelp(false);
          } else if (showStats) {
            setShowStats(false);
          } else if (showClaudeMd) {
            setShowClaudeMd(false);
          } else if (showArtifacts) {
            setShowArtifacts(false);
          } else {
            navigate('/');
          }
          break;
        case 'u':
          // Jump to next user message
          const nextUser = frames.findIndex(
            (f, i) => i > currentFrameIndex && f.type === 'user_message'
          );
          if (nextUser !== -1) handleFrameChange(nextUser);
          break;
        case 't':
          // Jump to next tool execution
          const nextTool = frames.findIndex(
            (f, i) => i > currentFrameIndex && f.type === 'tool_execution'
          );
          if (nextTool !== -1) handleFrameChange(nextTool);
          break;
        case 'r':
          // Jump to next AI response
          const nextResp = frames.findIndex(
            (f, i) => i > currentFrameIndex && f.type === 'claude_response'
          );
          if (nextResp !== -1) handleFrameChange(nextResp);
          break;
        case 'm':
          // Jump to next thinking frame
          const nextThink = frames.findIndex(
            (f, i) => i > currentFrameIndex && f.type === 'claude_thinking'
          );
          if (nextThink !== -1) handleFrameChange(nextThink);
          break;
        case 'n':
          // Next search match
          if (searchMatches.length > 0) {
            e.preventDefault();
            const nextIndex = findNextMatchIndex(currentFrameIndex, searchMatches);
            if (nextIndex !== -1) {
              handleFrameChange(nextIndex);
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
              handleFrameChange(prevIndex);
              setIsPlaying(false);
            }
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [
    frames.length,
    frames,
    currentFrameIndex,
    activeFrameTypes,
    searchMatches,
    navigate,
    showHelp,
    showStats,
    showClaudeMd,
    showArtifacts,
    isFrameVisible,
  ]);

  if (loadingDetails || loadingFrames) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading session...</p>
        </div>
      </div>
    );
  }

  if (!sessionDetails || frames.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-950">
        <div className="text-center">
          <p className="text-xl text-gray-400">Session not found</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-100 overflow-hidden">
      {/* Header */}
      <div className="bg-gray-900/50 backdrop-blur-xl border-b border-white/5 px-6 py-4 flex items-center justify-between relative z-20">
        <div className="flex items-center gap-6">
          <button
            onClick={() => navigate('/')}
            className="p-2.5 hover:bg-gray-800 rounded-xl border border-white/5 transition-all text-gray-400 hover:text-white group"
            title="Back to Dashboard"
          >
            <ChevronLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
          </button>

          <div className="flex flex-col">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-black tracking-tight text-white line-clamp-1">
                {sessionDetails?.slug || 'Loading session...'}
              </h1>
              {sessionDetails && (
                <div className="flex items-center gap-2 px-2 py-0.5 bg-blue-500/10 text-blue-400 text-[10px] font-black uppercase tracking-widest rounded-full border border-blue-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                  Session Replay
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-300 font-mono">
              <Folder className="w-3 h-3" />
              <span>{sessionDetails?.project.split('/').pop()}</span>
              <span className="opacity-30">•</span>
              <Calendar className="w-3 h-3" />
              <span>
                {sessionDetails && new Date(sessionDetails.startedAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 mr-4 px-4 py-2 bg-gray-800/50 rounded-2xl border border-white/5">
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                Total Events
              </span>
              <span className="text-sm font-bold text-white">{frames.length}</span>
            </div>
            <div className="w-[1px] h-6 bg-gray-700" />
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                Agent
              </span>
              <div className="mt-0.5 flex items-center gap-2">
                <AgentBadge agent={sessionDetails?.agent} />
                <ModelBadge model={sessionDetails?.metadata?.agentVersion} />
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              if (sessionDetails) {
                const timeline: SessionTimeline = {
                  ...sessionDetails,
                  frames,
                };
                const markdown = sessionToMarkdown(timeline);
                downloadFile(`${sessionDetails.slug}.md`, markdown);
              }
            }}
            className="inline-flex items-center gap-2 px-3 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-xl border border-white/5 transition-all active:scale-95"
            title="Export session to Markdown"
            aria-label="Export session to Markdown"
          >
            <Download className="w-5 h-5" />
            <span className="hidden xl:inline text-xs font-semibold">Export</span>
          </button>

          <button
            onClick={() => setViewMode(viewMode === 'timeline' ? 'chat' : 'timeline')}
            className={`inline-flex items-center gap-2 px-3 py-2.5 rounded-xl transition-all border active:scale-95 ${
              viewMode === 'chat'
                ? 'bg-purple-600 border-purple-500 text-white'
                : 'bg-gray-800 border-white/5 text-gray-300 hover:text-white'
            }`}
            title={`Switch to ${viewMode === 'timeline' ? 'Chat' : 'Timeline'} View`}
            aria-label={`Switch to ${viewMode === 'timeline' ? 'Chat' : 'Timeline'} View`}
          >
            {viewMode === 'timeline' ? (
              <MessageSquare className="w-5 h-5" />
            ) : (
              <Layout className="w-5 h-5" />
            )}
            <span className="hidden xl:inline text-xs font-semibold">
              {viewMode === 'timeline' ? 'Chat' : 'Timeline'}
            </span>
          </button>

          <button
            onClick={() => setShowClaudeMd(!showClaudeMd)}
            className={`inline-flex items-center gap-2 px-3 py-2.5 rounded-xl transition-all border active:scale-95 ${
              showClaudeMd
                ? 'bg-emerald-600 border-emerald-500 text-white'
                : sessionDetails?.metadata?.claudeMdFiles?.length
                  ? 'bg-gray-800 border-white/5 text-gray-300 hover:text-white'
                  : 'bg-gray-800 border-white/5 text-gray-600 cursor-not-allowed'
            }`}
            title={`Project instructions (d) - ${sessionDetails?.metadata?.claudeMdFiles?.length || 0} CLAUDE.md files`}
            disabled={!sessionDetails?.metadata?.claudeMdFiles?.length}
            aria-label="Open project instructions"
          >
            <FileText className="w-5 h-5" />
            <span className="hidden xl:inline text-xs font-semibold">Instructions</span>
          </button>

          <button
            onClick={() => setShowArtifacts(!showArtifacts)}
            className={`inline-flex items-center gap-2 px-3 py-2.5 rounded-xl transition-all border active:scale-95 ${
              showArtifacts
                ? 'bg-cyan-600 border-cyan-500 text-white'
                : 'bg-gray-800 border-white/5 text-gray-300 hover:text-white'
            }`}
            title="File Artifacts (a)"
            aria-label="Open file artifacts"
          >
            <FolderOpen className="w-5 h-5" />
            <span className="hidden xl:inline text-xs font-semibold">Artifacts</span>
          </button>

          <button
            onClick={() => setShowStats(!showStats)}
            className={`inline-flex items-center gap-2 px-3 py-2.5 rounded-xl transition-all border active:scale-95 ${
              showStats
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'bg-gray-800 border-white/5 text-gray-300 hover:text-white'
            }`}
            title="Toggle statistics panel (s)"
            aria-label="Toggle statistics panel"
          >
            <Settings className="w-5 h-5 shadow-lg" />
            <span className="hidden xl:inline text-xs font-semibold">Stats</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {viewMode === 'chat' ? (
        <ChatView
          frames={frames}
          currentFrameIndex={currentFrameIndex}
          isPlaying={isPlaying}
          searchQuery={searchQuery}
          activeFrameTypes={activeFrameTypes}
        />
      ) : (
        <div className="flex-1 overflow-y-auto px-6 py-8">
          <div className="max-w-4xl mx-auto">
            {/* Dead air compression indicator */}
            {currentFrame?.isCompressed && compressionEnabled && (
              <div className="mb-4 px-4 py-2 bg-amber-900/50 border border-amber-700 rounded-lg flex items-center gap-2 text-amber-300 text-sm">
                <Zap className="w-4 h-4 fill-current" />
                <span>
                  Compressed Gap: {Math.round((currentFrame.originalDuration || 0) / 1000)}s
                </span>
                <span className="text-amber-500">→</span>
                <span>{Math.round((currentFrame.duration || 0) / 1000)}s</span>
              </div>
            )}

            {currentFrame && isFrameVisible(currentFrame) ? (
              <FrameRenderer frame={currentFrame} searchQuery={searchQuery} />
            ) : (
              currentFrame && (
                <div className="text-center py-24 text-gray-600">
                  <div className="w-16 h-16 bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/5">
                    <SearchIcon className="w-8 h-8 opacity-20" />
                  </div>
                  <p className="font-bold uppercase tracking-widest text-[10px]">Frame Filtered</p>
                  <p className="text-sm mt-1 opacity-50">
                    Enable "{currentFrame.type.replace('_', ' ')}" to view this part of the session.
                  </p>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* Footer Area: Side Filters + Scrubber + Controls */}
      <div className="relative z-30 border-t border-white/5 bg-gray-900/55 px-6 py-4">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="xl:sticky xl:top-3 xl:self-start">
            <FrameTypeFilters
              frames={frames}
              activeFrameTypes={activeFrameTypes}
              onToggleFrameType={(type) => {
                setActiveFrameTypes((prev) => {
                  const next = new Set(prev);
                  if (next.has(type)) next.delete(type);
                  else next.add(type);
                  return next;
                });
              }}
              onToggleAll={(showAll) => {
                if (showAll)
                  setActiveFrameTypes(
                    new Set([
                      'user_message',
                      'claude_response',
                      'tool_execution',
                      'claude_thinking',
                    ])
                  );
                else setActiveFrameTypes(new Set());
              }}
              availableToolNames={availableToolNames}
              activeToolNames={activeToolNames}
              onToggleToolName={(toolName) => {
                setActiveToolNames((prev) => {
                  const next = new Set(prev);
                  if (next.has(toolName)) next.delete(toolName);
                  else next.add(toolName);
                  return next;
                });
              }}
              onToggleAllTools={(showAll) => {
                if (showAll) {
                  setActiveToolNames(new Set(availableToolNames));
                } else {
                  setActiveToolNames(new Set());
                }
              }}
              toolFilterEnabled={toolFilterEnabled}
              onToolFilterEnabledChange={setToolFilterEnabled}
              toolErrorsOnly={toolErrorsOnly}
              onToolErrorsOnlyChange={setToolErrorsOnly}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              searchMatchCount={searchMatches.length}
              currentMatchRank={currentMatchRank}
              onNextMatch={() => {
                const nextIndex = findNextMatchIndex(currentFrameIndex, searchMatches);
                if (nextIndex !== -1) {
                  handleFrameChange(nextIndex);
                  setIsPlaying(false);
                }
              }}
              onPrevMatch={() => {
                const prevIndex = findPrevMatchIndex(currentFrameIndex, searchMatches);
                if (prevIndex !== -1) {
                  handleFrameChange(prevIndex);
                  setIsPlaying(false);
                }
              }}
            />
          </aside>

          <div className="min-w-0">
            <div className="mb-2 flex items-center justify-between text-xs text-gray-300">
              <span>
                {searchQuery.trim().length > 0
                  ? searchMatches.length > 0
                    ? `Search: ${searchMatches.length} matches`
                    : 'Search: no matches'
                  : 'Search: off'}
              </span>
              <span>Filters: {activeFrameCount}/4 active</span>
            </div>

            <TimelineScrubber
              frames={frames}
              currentFrameIndex={currentFrameIndex}
              onSeek={handleFrameChange}
              showCommentary={showCommentary}
              commentary={commentaryData?.commentary}
              activeFrameTypes={activeFrameTypes}
              isFrameVisible={isFrameVisible}
            />

            {/* Playback Controls Bar */}
            <div className="bg-gray-900/60 backdrop-blur-md border-t border-white/5 px-6 py-6 transition-all duration-300">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const prevFrame = findPrevVisibleFrame(
                        currentFrameIndex - 1,
                        frames,
                        activeFrameTypes,
                        isFrameVisible
                      );
                      handleFrameChange(prevFrame);
                      setIsPlaying(false);
                    }}
                    className="p-2.5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-xl border border-white/5 transition-all disabled:opacity-20 active:scale-95"
                    disabled={currentFrameIndex === 0}
                    title="Previous Frame (Left Arrow)"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className={`px-8 py-2.5 rounded-2xl font-black uppercase tracking-widest text-sm flex items-center gap-3 transition-all active:scale-95 shadow-lg ${
                      isPlaying
                        ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20'
                        : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20'
                    }`}
                  >
                    {isPlaying ? (
                      <Pause className="w-5 h-5 fill-current" />
                    ) : (
                      <Play className="w-5 h-5 fill-current" />
                    )}
                    {isPlaying ? 'Pause' : 'Play'}
                  </button>

                  <div className="ml-2 text-xs text-gray-300">
                    {isPlaying
                      ? `Playing at ${playbackSpeed}x`
                      : isEndOfSession
                        ? 'End reached'
                        : 'Paused'}
                  </div>

                  <button
                    onClick={() => {
                      const nextFrame = findNextVisibleFrame(
                        currentFrameIndex + 1,
                        frames,
                        activeFrameTypes,
                        isFrameVisible
                      );
                      handleFrameChange(nextFrame);
                      setIsPlaying(false);
                    }}
                    className="p-2.5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-xl border border-white/5 transition-all disabled:opacity-20 active:scale-95"
                    disabled={currentFrameIndex >= frames.length - 1}
                    title="Next Frame (Right Arrow)"
                  >
                    <div className="rotate-180">
                      <ChevronLeft className="w-5 h-5" />
                    </div>
                  </button>
                </div>

                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-3 cursor-pointer group select-none">
                    <div
                      className={`w-10 h-6 rounded-full p-1 transition-all duration-300 ${showCommentary ? 'bg-blue-600' : 'bg-gray-700'}`}
                    >
                      <div
                        className={`w-4 h-4 bg-white rounded-full transition-transform duration-300 ${showCommentary ? 'translate-x-4' : ''}`}
                      />
                    </div>
                    <input
                      type="checkbox"
                      checked={showCommentary}
                      onChange={(e) => setShowCommentary(e.target.checked)}
                      className="hidden"
                    />
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 group-hover:text-white transition-colors">
                      Commentary
                    </span>
                  </label>

                  <div className="flex items-center gap-2 bg-gray-800/80 rounded-2xl p-1.5 border border-white/5">
                    <button
                      onClick={() => setCompressionEnabled(!compressionEnabled)}
                      className={`p-2 rounded-xl transition-all ${
                        compressionEnabled
                          ? 'bg-amber-500/10 text-amber-500'
                          : 'text-gray-500 hover:text-gray-300'
                      }`}
                      title={
                        compressionEnabled
                          ? 'Disable dead air compression'
                          : 'Enable dead air compression'
                      }
                    >
                      <Zap className={`w-4 h-4 ${compressionEnabled ? 'fill-current' : ''}`} />
                    </button>

                    <div className="w-[1px] h-4 bg-gray-700 mx-1" />

                    <div className="flex items-center gap-1">
                      {[0.5, 1, 2, 5].map((speed) => (
                        <button
                          key={speed}
                          onClick={() => setPlaybackSpeed(speed)}
                          className={`px-2.5 py-1 text-[10px] font-black rounded-lg transition-all ${
                            playbackSpeed === speed
                              ? 'bg-blue-600 text-white'
                              : 'text-gray-500 hover:text-gray-300'
                          }`}
                        >
                          {speed}x
                        </button>
                      ))}
                    </div>

                    <div className="w-[1px] h-4 bg-gray-700 mx-1" />

                    <button
                      onClick={() => setShowHelp(true)}
                      className="p-2 text-gray-500 hover:text-gray-300 rounded-xl transition-all"
                      title="Keyboard shortcuts (?)"
                    >
                      <Info className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Overlays */}
      {selectedCommentary && (
        <CommentaryCard
          commentary={selectedCommentary}
          onClose={() => setSelectedCommentary(null)}
        />
      )}
      {showHelp && <HelpPanel onClose={() => setShowHelp(false)} />}
      {showStats && <StatsPanel stats={stats} onClose={() => setShowStats(false)} />}
      {showClaudeMd && (
        <ClaudeMdPanel
          claudeMdFiles={sessionDetails?.metadata?.claudeMdFiles || []}
          onClose={() => setShowClaudeMd(false)}
        />
      )}
      {showArtifacts && (
        <ArtifactsPanel
          frames={frames}
          currentFrameIndex={currentFrameIndex}
          viewMode={artifactViewMode}
          onViewModeChange={setArtifactViewMode}
          onClose={() => setShowArtifacts(false)}
          onNavigateToFrame={(index) => {
            handleFrameChange(index);
            setShowArtifacts(false);
          }}
        />
      )}
    </div>
  );
};

const ToolOutputBlock: React.FC<{
  tool: string;
  output: string;
  isError: boolean;
}> = ({ tool, output, isError }) => {
  const [isFormatted, setIsFormatted] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  if (!output || output.trim() === '') {
    return (
      <div className="bg-gray-950 rounded p-4 font-mono text-sm border border-gray-800">
        <div className="text-gray-500 italic text-center">(no output)</div>
      </div>
    );
  }

  const truncationMatch = output.match(/\[Truncated\. Full output: (.+)\]/);
  const truncatedFilePath = truncationMatch ? truncationMatch[1] : null;

  const tryBeautifyJson = (content: string) => {
    try {
      return { success: true, formatted: JSON.stringify(JSON.parse(content), null, 2) };
    } catch {
      return { success: false, formatted: content };
    }
  };

  const shouldHighlight = (toolName: string, content: string) => {
    const codeTools = ['Read', 'Write', 'Edit', 'Grep', 'NotebookEdit'];
    if (codeTools.includes(toolName)) return true;
    return (
      /^(function|class|const|let|var|import|export|def|public|private)/m.test(content) ||
      /^\s*[{\[]/.test(content.trim())
    );
  };

  const detectLanguage = (toolName: string, content: string) => {
    if (toolName !== 'Bash')
      return ['Read', 'Write', 'Edit'].includes(toolName) ? 'javascript' : 'plaintext';
    if (content.includes('.json')) return 'json';
    if (content.includes('.py')) return 'python';
    if (content.includes('.js') || content.includes('.ts')) return 'javascript';
    if (/^\s*[{\[]/.test(content.trim())) {
      try {
        JSON.parse(content);
        return 'json';
      } catch {}
    }
    return 'bash';
  };

  const language = detectLanguage(tool, output);
  const isJson = language === 'json' || /^\s*[{\[]/.test(output.trim());
  const beautifyResult =
    isJson && isFormatted && !isError
      ? tryBeautifyJson(output)
      : { success: false, formatted: output };
  const processedOutput = beautifyResult.success ? beautifyResult.formatted : output;

  const SOFT_LIMIT = 50;
  const outputLines = processedOutput.split('\n');
  const needsTruncation = outputLines.length > SOFT_LIMIT && !isExpanded;
  const displayOutput = needsTruncation
    ? outputLines.slice(0, SOFT_LIMIT).join('\n')
    : processedOutput;

  return (
    <div>
      <div className="flex justify-end gap-2 mb-2">
        {outputLines.length > SOFT_LIMIT && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="px-3 py-1 text-xs bg-blue-900/40 hover:bg-blue-800/60 text-blue-300 rounded border border-blue-700/50 transition-colors"
          >
            {isExpanded ? 'Collapse' : `Show All (${outputLines.length} lines)`}
          </button>
        )}
        {isJson && !isError && (
          <button
            onClick={() => setIsFormatted(!isFormatted)}
            className="px-3 py-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded border border-gray-700 transition-colors"
          >
            {isFormatted ? 'Raw' : 'Format'}
          </button>
        )}
      </div>
      {shouldHighlight(tool, output) && !isError ? (
        <CodeBlock
          code={displayOutput}
          language={language}
          showLineNumbers={true}
          maxHeight={isExpanded ? 'none' : '500px'}
        />
      ) : (
        <div
          className={`bg-gray-950 rounded p-4 font-mono text-sm overflow-x-auto border ${isError ? 'border-red-800' : 'border-gray-800'}`}
          style={{ maxHeight: isExpanded ? 'none' : '500px' }}
        >
          <pre className={`whitespace-pre-wrap ${isError ? 'text-red-400' : 'text-gray-300'}`}>
            {displayOutput}
          </pre>
        </div>
      )}
      {(needsTruncation || truncatedFilePath) && (
        <div className="mt-2 px-3 py-2 bg-gray-900 border border-gray-800 rounded text-xs">
          {truncatedFilePath ? (
            <div className="text-gray-400">
              <span className="text-yellow-500 font-bold">
                ⚠ Session data truncated by AI safely.
              </span>{' '}
              Full output at:
              <code className="ml-2 text-gray-300">{truncatedFilePath}</code>
            </div>
          ) : (
            <div className="text-gray-500 text-center">
              Showing first {SOFT_LIMIT} lines of {outputLines.length}.{' '}
              <button
                onClick={() => setIsExpanded(true)}
                className="text-blue-500 hover:underline font-bold"
              >
                Expand
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const FrameRenderer: React.FC<{ frame: PlaybackFrame; searchQuery?: string }> = ({
  frame,
  searchQuery = '',
}) => {
  const frameTypeColors = {
    user_message: 'bg-blue-950/40 border-blue-500/20 shadow-[0_0_20px_rgba(59,130,246,0.1)]',
    claude_thinking: 'bg-purple-950/40 border-purple-500/20 shadow-[0_0_20px_rgba(168,85,247,0.1)]',
    claude_response: 'bg-green-950/40 border-green-500/20 shadow-[0_0_20px_rgba(34,197,94,0.1)]',
    tool_execution: 'bg-orange-950/40 border-orange-500/20 shadow-[0_0_20px_rgba(249,115,22,0.1)]',
  };

  const agentName = frame.agent ? frame.agent.charAt(0).toUpperCase() + frame.agent.slice(1) : 'AI';

  const frameTypeIcons = {
    user_message: <Hash className="w-4 h-4 text-blue-400" />,
    claude_thinking: <Zap className="w-4 h-4 text-purple-400" />,
    claude_response: <Zap className="w-4 h-4 text-green-400" />,
    tool_execution: <Settings className="w-4 h-4 text-orange-400" />,
  };

  const frameTypeLabels = {
    user_message: 'User Message',
    claude_thinking: `${agentName} Thinking`,
    claude_response: agentName,
    tool_execution: 'Tool Execution',
  };

  return (
    <div
      className={`border rounded-2xl p-8 mb-6 transition-all duration-500 ${frameTypeColors[frame.type] || 'bg-gray-900 border-white/5'}`}
    >
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/5 rounded-lg border border-white/10">
            {frameTypeIcons[frame.type]}
          </div>
          <div>
            <span className="text-xs font-black uppercase tracking-widest text-gray-500 block mb-0.5">
              Event Type
            </span>
            <span className="text-sm font-bold text-white">{frameTypeLabels[frame.type]}</span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-xs font-black uppercase tracking-widest text-gray-500 block mb-0.5">
            Timestamp
          </span>
          <span className="text-sm font-mono text-gray-400">
            {new Date(frame.timestamp).toLocaleTimeString()}
          </span>
        </div>
      </div>

      {frame.userMessage && (
        <div className="bg-gray-900/50 rounded-xl p-6 border border-white/5 prose prose-invert prose-blue max-w-none">
          <ReactMarkdown>{frame.userMessage.text}</ReactMarkdown>
        </div>
      )}

      {frame.thinking && (
        <div className="bg-gray-900/50 rounded-xl p-6 border border-white/5 border-l-purple-500/50 border-l-4 prose prose-invert prose-purple max-w-none">
          <div className="text-sm leading-relaxed text-gray-400 italic font-mono">
            <ReactMarkdown>{frame.thinking.text}</ReactMarkdown>
          </div>
        </div>
      )}

      {frame.claudeResponse && (
        <div className="bg-gray-900/50 rounded-xl p-6 border border-white/5 border-l-green-500/50 border-l-4 prose prose-invert prose-green max-w-none">
          <ReactMarkdown>{frame.claudeResponse.text}</ReactMarkdown>
        </div>
      )}

      {frame.toolExecution && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="px-3 py-1 bg-orange-500/10 text-orange-400 text-xs font-black uppercase tracking-widest rounded-lg border border-orange-500/20">
              Tool: {frame.toolExecution.tool}
            </div>
            {frame.toolExecution.output.isError && (
              <div className="px-3 py-1 bg-red-500/10 text-red-400 text-xs font-black uppercase tracking-widest rounded-lg border border-red-500/20">
                Failed
              </div>
            )}
          </div>

          {frame.toolExecution.input && (
            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                Input Parameters
              </span>
              <CodeBlock
                code={JSON.stringify(frame.toolExecution.input, null, 2)}
                language="json"
                showLineNumbers={false}
              />
            </div>
          )}

          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">
              Output Result
            </span>
            <ToolOutputBlock
              tool={frame.toolExecution.tool}
              output={frame.toolExecution.output.content}
              isError={frame.toolExecution.output.isError}
            />
          </div>
        </div>
      )}
    </div>
  );
};
