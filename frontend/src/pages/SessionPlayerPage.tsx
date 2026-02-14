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
  useSessionGit,
  useCheckpoints,
  useCreateCheckpoint,
  useDeleteCheckpoint,
  useSessionSummary,
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
  SlidersHorizontal,
  GitBranch,
  Bookmark,
  RotateCcw,
  AlignLeft,
} from 'lucide-react';
import { CommentaryTimeline, CommentaryCard } from '../components/CommentaryBubble';
import { TimelineScrubber } from '../components/session-player/TimelineScrubber';
import { TranscriptView } from '../components/session-player/TranscriptView';
import {
  findNextVisibleFrame,
  findPrevVisibleFrame,
} from '../components/session-player/frameTypeFiltersUtils';
import { HelpPanel } from '../components/session-player/HelpPanel';
import { StatsPanel } from '../components/session-player/StatsPanel';
import { ClaudeMdPanel } from '../components/session-player/ClaudeMdPanel';
import { ArtifactsSidebar } from '../components/session-player/ArtifactsSidebar';
import { FiltersPanel } from '../components/session-player/FiltersPanel';
import { ExportModal } from '../components/session-player/ExportModal';
import { ShareModal } from '../components/session-player/ShareModal';
import { GitPanel } from '../components/session-player/GitPanel';
import { GitBadge } from '../components/GitBadge';
import { CheckpointPanel } from '../components/session-player/CheckpointPanel';
import { CheckpointMarkers } from '../components/session-player/CheckpointMarker';
import { CreateCheckpointDialog } from '../components/session-player/CreateCheckpointDialog';
import { RewindPanel } from '../components/session-player/RewindPanel';
import { SummaryCard } from '../components/session-player/SummaryCard';
import { useSessionStats } from '../hooks/useSessionStats';
import {
  findMatchingFrameIndices,
  findNextMatchIndex,
  findPrevMatchIndex,
  highlightText,
} from '../lib/frameSearch';
import {
  sessionToMarkdown,
  sessionToHTML,
  frameToMarkdown,
  frameToHTML,
  downloadFile,
} from '../lib/exportSession';

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
  const [viewMode, setViewMode] = useState<'timeline' | 'transcript'>('timeline');
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showGitPanel, setShowGitPanel] = useState(false);
  const [showCheckpoints, setShowCheckpoints] = useState(false);
  const [showCreateCheckpointDialog, setShowCreateCheckpointDialog] = useState(false);
  const [showRewind, setShowRewind] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  // Fetch session details and all frames
  const { data: sessionDetails, isLoading: loadingDetails } = useSessionDetails(sessionId);
  const { data: framesData, isLoading: loadingFrames } = useSessionFrames(sessionId, {
    offset: 0,
    limit: 1000, // Load all frames for now
  });

  // Fetch commentary observations from claude-mem
  const { data: commentaryData } = useSessionCommentary(sessionId);

  // Fetch git context for the session
  const { data: gitData } = useSessionGit(sessionId);

  // Fetch checkpoints for the session
  const { data: checkpointsData } = useCheckpoints(sessionId);

  // Checkpoint mutations
  const createCheckpointMutation = useCreateCheckpoint(sessionId || '');
  const deleteCheckpointMutation = useDeleteCheckpoint(sessionId || '');

  // Fetch session summary
  const { data: summaryData } = useSessionSummary(sessionId);

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
        case 'f':
        case 'F':
          e.preventDefault();
          setShowFiltersPanel((prev) => !prev);
          break;
        case 'd':
        case 'D':
          e.preventDefault();
          setShowClaudeMd((prev) => !prev);
          break;
        case 'g':
        case 'G':
          e.preventDefault();
          setShowGitPanel((prev) => !prev);
          break;
        case 'k':
        case 'K':
          e.preventDefault();
          setShowCheckpoints((prev) => !prev);
          break;
        case 'w':
        case 'W':
          e.preventDefault();
          setShowRewind((prev) => !prev);
          break;
        case 'y':
        case 'Y':
          e.preventDefault();
          setShowSummary((prev) => !prev);
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
          if (showShareModal) {
            setShowShareModal(false);
          } else if (showHelp) {
            setShowHelp(false);
          } else if (showStats) {
            setShowStats(false);
          } else if (showClaudeMd) {
            setShowClaudeMd(false);
          } else if (showArtifacts) {
            setShowArtifacts(false);
          } else if (showFiltersPanel) {
            setShowFiltersPanel(false);
          } else if (showGitPanel) {
            setShowGitPanel(false);
          } else if (showCheckpoints) {
            setShowCheckpoints(false);
          } else if (showRewind) {
            setShowRewind(false);
          } else if (showSummary) {
            setShowSummary(false);
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
    showFiltersPanel,
    showShareModal,
    showGitPanel,
    showCheckpoints,
    showRewind,
    showSummary,
    isFrameVisible,
  ]);

  if (loadingDetails || loadingFrames) {
    return (
      <div className="flex items-center justify-center h-screen bg-forensic-bg-primary">
        <div className="terminal max-w-md w-full mx-4">
          <div className="terminal-header">
            <div className="terminal-dot terminal-dot-red"></div>
            <div className="terminal-dot terminal-dot-amber"></div>
            <div className="terminal-dot terminal-dot-green"></div>
          </div>
          <div className="terminal-body">
            <div className="flex items-center gap-3 font-mono text-sm">
              <span className="text-accent-green">$</span>
              <span className="text-forensic-text-primary">recall --session</span>
              <div className="cursor-blink"></div>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-accent-green border-t-transparent"></div>
              <span className="text-forensic-text-secondary font-mono text-sm">
                Loading session data...
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!sessionDetails || frames.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-forensic-bg-primary">
        <div className="evidence-card max-w-md text-center" data-id="ERR-404">
          <p className="font-mono text-xl text-accent-red mb-4">Session not found</p>
          <p className="font-mono text-sm text-forensic-text-secondary mb-6">
            The requested session could not be located in the database.
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-accent-green text-forensic-bg-primary font-mono text-sm font-semibold uppercase tracking-wider hover:bg-green-600 transition-colors"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-forensic-bg-primary text-forensic-text-primary overflow-hidden">
      {/* Header */}
      <div className="bg-forensic-bg-secondary border-b border-forensic-border px-6 py-4 flex items-center justify-between relative z-20">
        <div className="flex items-center gap-6">
          <button
            onClick={() => navigate('/')}
            className="p-2.5 hover:bg-forensic-bg-tertiary border border-forensic-border transition-all text-forensic-text-muted hover:text-accent-green group"
            title="Back to Dashboard"
          >
            <ChevronLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
          </button>

          <div className="flex flex-col">
            <div className="flex items-center gap-4">
              <h1 className="font-mono text-xl font-bold text-forensic-text-primary line-clamp-1">
                {sessionDetails?.slug || 'Loading session...'}
              </h1>
              {sessionDetails && (
                <div className="badge badge-green flex items-center gap-2 ml-1 -mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" />
                  Replay
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-forensic-text-secondary font-mono">
              <Folder className="w-3 h-3 text-accent-amber" />
              <span>{sessionDetails?.project.split('/').pop()}</span>
              <span className="text-forensic-text-muted">//</span>
              <Calendar className="w-3 h-3" />
              <span>
                {sessionDetails && new Date(sessionDetails.startedAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 mr-4 px-4 py-2 bg-forensic-bg-tertiary border border-forensic-border">
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-mono text-forensic-text-muted uppercase tracking-wide">
                Events
              </span>
              <span className="text-sm font-mono font-bold text-accent-green">{frames.length}</span>
            </div>
            <div className="w-[1px] h-6 bg-forensic-border" />
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-mono text-forensic-text-muted uppercase tracking-wide">
                Agent
              </span>
              <div className="mt-0.5 flex items-center gap-2">
                <AgentBadge agent={sessionDetails?.agent} />
                <ModelBadge model={sessionDetails?.metadata?.agentVersion} />
                {/* Show GitBadge from API data or fall back to metadata.gitBranch */}
                {gitData ? (
                  <GitBadge
                    branch={gitData.branch}
                    commit={gitData.headCommit}
                    isDirty={gitData.isDirty}
                    onClick={() => setShowGitPanel(true)}
                    size="sm"
                  />
                ) : sessionDetails?.metadata?.gitBranch ? (
                  <GitBadge branch={sessionDetails.metadata.gitBranch} size="sm" />
                ) : null}
              </div>
            </div>
          </div>

          {/* Share Button - Hidden until relay service is implemented (paid tier) */}
          {/* TODO: Enable when RECALL_RELAY_URL is configured */}

          {/* Export Button */}
          <button
            onClick={() => setShowExportModal(true)}
            className="inline-flex items-center justify-center w-9 h-9 bg-forensic-bg-tertiary hover:bg-forensic-border text-forensic-text-secondary hover:text-forensic-text-primary border border-forensic-border transition-all"
            title="Export session or frame"
            aria-label="Export"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            onClick={() => setViewMode(viewMode === 'timeline' ? 'transcript' : 'timeline')}
            className={`inline-flex items-center justify-center w-9 h-9 transition-all border ${
              viewMode === 'transcript'
                ? 'bg-accent-purple/20 border-accent-purple/50 text-accent-purple'
                : 'bg-forensic-bg-tertiary border-forensic-border text-forensic-text-secondary hover:text-forensic-text-primary'
            }`}
            title={`Switch to ${viewMode === 'timeline' ? 'Transcript' : 'Timeline'} View`}
          >
            {viewMode === 'timeline' ? (
              <FileText className="w-4 h-4" />
            ) : (
              <Layout className="w-4 h-4" />
            )}
          </button>

          {/* TODO: Bring back Docs button when CLAUDE.md panel feature is ready
          <button
            onClick={() => setShowClaudeMd(!showClaudeMd)}
            className={`inline-flex items-center gap-2 px-3 py-2 font-mono text-xs uppercase tracking-wide transition-all border ${
              showClaudeMd
                ? 'bg-accent-cyan/20 border-accent-cyan/50 text-accent-cyan'
                : sessionDetails?.metadata?.claudeMdFiles?.length
                  ? 'bg-forensic-bg-tertiary border-forensic-border text-forensic-text-secondary hover:text-forensic-text-primary'
                  : 'bg-forensic-bg-tertiary border-forensic-border text-forensic-text-muted cursor-not-allowed'
            }`}
            title={`Project instructions (d) - ${sessionDetails?.metadata?.claudeMdFiles?.length || 0} CLAUDE.md files`}
            disabled={!sessionDetails?.metadata?.claudeMdFiles?.length}
          >
            <FileText className="w-4 h-4" />
            <span className="hidden xl:inline">Docs</span>
          </button>
          */}

          <button
            onClick={() => setShowArtifacts(!showArtifacts)}
            className={`inline-flex items-center justify-center w-9 h-9 transition-all border ${
              showArtifacts
                ? 'bg-accent-amber/20 border-accent-amber/50 text-accent-amber'
                : 'bg-forensic-bg-tertiary border-forensic-border text-forensic-text-secondary hover:text-forensic-text-primary'
            }`}
            title="File Artifacts (a)"
          >
            <FolderOpen className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowFiltersPanel(!showFiltersPanel)}
            className={`inline-flex items-center justify-center w-9 h-9 transition-all border ${
              showFiltersPanel
                ? 'bg-accent-green/20 border-accent-green/50 text-accent-green'
                : activeFrameCount < 4
                  ? 'bg-accent-green/10 border-accent-green/30 text-accent-green'
                  : 'bg-forensic-bg-tertiary border-forensic-border text-forensic-text-secondary hover:text-forensic-text-primary'
            }`}
            title={`Frame filters (f)${activeFrameCount < 4 ? ` - ${activeFrameCount}/4 active` : ''}`}
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowStats(!showStats)}
            className={`inline-flex items-center justify-center w-9 h-9 transition-all border ${
              showStats
                ? 'bg-accent-cyan/20 border-accent-cyan/50 text-accent-cyan'
                : 'bg-forensic-bg-tertiary border-forensic-border text-forensic-text-secondary hover:text-forensic-text-primary'
            }`}
            title="Toggle statistics panel (s)"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Git Context Button */}
          {gitData && (
            <button
              onClick={() => setShowGitPanel(!showGitPanel)}
              className={`inline-flex items-center justify-center w-9 h-9 transition-all border ${
                showGitPanel
                  ? 'bg-accent-purple/20 border-accent-purple/50 text-accent-purple'
                  : 'bg-forensic-bg-tertiary border-forensic-border text-forensic-text-secondary hover:text-forensic-text-primary'
              }`}
              title="Git context (g)"
            >
              <GitBranch className="w-4 h-4" />
            </button>
          )}

          {/* Checkpoints Button */}
          <button
            onClick={() => setShowCheckpoints(!showCheckpoints)}
            className={`relative inline-flex items-center justify-center w-9 h-9 transition-all border ${
              showCheckpoints
                ? 'bg-accent-amber/20 border-accent-amber/50 text-accent-amber'
                : checkpointsData && checkpointsData.length > 0
                  ? 'bg-accent-amber/10 border-accent-amber/30 text-accent-amber'
                  : 'bg-forensic-bg-tertiary border-forensic-border text-forensic-text-secondary hover:text-forensic-text-primary'
            }`}
            title={`Checkpoints (c) - ${checkpointsData?.length || 0} saved`}
          >
            <Bookmark className="w-4 h-4" />
            {checkpointsData && checkpointsData.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-accent-amber text-forensic-bg-primary text-[10px] font-bold flex items-center justify-center rounded-full">
                {checkpointsData.length}
              </span>
            )}
          </button>

          {/* Summary Button */}
          {summaryData && (
            <button
              onClick={() => setShowSummary(!showSummary)}
              className={`inline-flex items-center justify-center w-9 h-9 transition-all border ${
                showSummary
                  ? 'bg-accent-green/20 border-accent-green/50 text-accent-green'
                  : 'bg-forensic-bg-tertiary border-forensic-border text-forensic-text-secondary hover:text-forensic-text-primary'
              }`}
              title="Session summary (y)"
            >
              <AlignLeft className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area with optional sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {/* Content */}
        {viewMode === 'transcript' ? (
          <TranscriptView
            frames={frames}
            currentFrameIndex={currentFrameIndex}
            searchQuery={searchQuery}
            activeFrameTypes={activeFrameTypes}
            isFrameVisible={isFrameVisible}
            onNavigateToFrame={handleFrameChange}
          />
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-8">
            <div
              className={`mx-auto transition-all duration-200 ${showArtifacts ? 'max-w-3xl' : 'max-w-4xl'}`}
            >
              {/* Dead air compression indicator */}
              {currentFrame?.isCompressed && compressionEnabled && (
                <div className="mb-4 px-4 py-2 bg-accent-amber/10 border border-accent-amber/30 flex items-center gap-2 text-accent-amber font-mono text-sm">
                  <Zap className="w-4 h-4 fill-current" />
                  <span>
                    Compressed: {Math.round((currentFrame.originalDuration || 0) / 1000)}s
                  </span>
                  <span className="text-forensic-text-muted">&gt;</span>
                  <span>{Math.round((currentFrame.duration || 0) / 1000)}s</span>
                </div>
              )}

              {currentFrame && isFrameVisible(currentFrame) ? (
                <FrameRenderer
                  frame={currentFrame}
                  searchQuery={searchQuery}
                  sessionMeta={sessionDetails}
                />
              ) : (
                currentFrame && (
                  <div className="text-center py-24">
                    <div className="w-16 h-16 bg-forensic-bg-secondary flex items-center justify-center mx-auto mb-4 border border-forensic-border">
                      <SearchIcon className="w-8 h-8 text-forensic-text-muted" />
                    </div>
                    <p className="font-mono uppercase tracking-wide text-xs text-forensic-text-muted">
                      Frame Filtered
                    </p>
                    <p className="font-mono text-sm mt-2 text-forensic-text-secondary">
                      Enable "{currentFrame.type.replace('_', ' ')}" to view this frame.
                    </p>
                  </div>
                )
              )}
            </div>
          </div>
        )}

        {/* Artifacts Sidebar */}
        {showArtifacts && (
          <ArtifactsSidebar
            frames={frames}
            currentFrameIndex={currentFrameIndex}
            viewMode={artifactViewMode}
            onViewModeChange={setArtifactViewMode}
            onClose={() => setShowArtifacts(false)}
            onNavigateToFrame={handleFrameChange}
            onExpandToFullPage={() => {
              navigate(`/session/${sessionId}/artifacts`);
            }}
          />
        )}
      </div>

      {/* Footer Area: Scrubber + Controls */}
      <div className="relative z-30 border-t border-forensic-border bg-forensic-bg-secondary px-6 py-4">
        <div className="mx-auto max-w-6xl">
          <div className="min-w-0">
            <div className="mb-2 flex items-center justify-between font-mono text-xs text-forensic-text-secondary">
              <span>
                {searchQuery.trim().length > 0
                  ? searchMatches.length > 0
                    ? `// Search: ${searchMatches.length} matches`
                    : '// Search: no matches'
                  : '// Search: off'}
              </span>
              <span>// Filters: {activeFrameCount}/4 active</span>
            </div>

            <div className="relative">
              <TimelineScrubber
                frames={frames}
                currentFrameIndex={currentFrameIndex}
                onSeek={handleFrameChange}
                showCommentary={showCommentary}
                commentary={commentaryData?.commentary}
                activeFrameTypes={activeFrameTypes}
                isFrameVisible={isFrameVisible}
              />
              {checkpointsData && checkpointsData.length > 0 && (
                <CheckpointMarkers
                  checkpoints={checkpointsData}
                  totalFrames={frames.length}
                  onNavigateToFrame={handleFrameChange}
                />
              )}
            </div>

            {/* Playback Controls Bar */}
            <div className="bg-forensic-bg-tertiary border-t border-forensic-border px-6 py-5 transition-all duration-300">
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
                    className="p-2.5 bg-forensic-bg-secondary hover:bg-forensic-border text-forensic-text-muted hover:text-forensic-text-primary border border-forensic-border transition-all disabled:opacity-20"
                    disabled={currentFrameIndex === 0}
                    title="Previous Frame (Left Arrow)"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className={`px-6 py-2.5 font-mono font-semibold uppercase tracking-wider text-sm flex items-center gap-3 transition-all ${
                      isPlaying
                        ? 'bg-accent-amber text-forensic-bg-primary hover:bg-amber-600'
                        : 'bg-accent-green text-forensic-bg-primary hover:bg-green-600'
                    }`}
                  >
                    {isPlaying ? (
                      <Pause className="w-5 h-5 fill-current" />
                    ) : (
                      <Play className="w-5 h-5 fill-current" />
                    )}
                    {isPlaying ? 'Pause' : 'Play'}
                  </button>

                  <div className="ml-2 font-mono text-xs text-forensic-text-secondary">
                    {isPlaying ? `// ${playbackSpeed}x` : isEndOfSession ? '// End' : '// Paused'}
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
                    className="p-2.5 bg-forensic-bg-secondary hover:bg-forensic-border text-forensic-text-muted hover:text-forensic-text-primary border border-forensic-border transition-all disabled:opacity-20"
                    disabled={currentFrameIndex >= frames.length - 1}
                    title="Next Frame (Right Arrow)"
                  >
                    <div className="rotate-180">
                      <ChevronLeft className="w-5 h-5" />
                    </div>
                  </button>
                </div>

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-3 cursor-pointer group select-none">
                    <div
                      className={`w-10 h-5 p-0.5 transition-all duration-300 border ${showCommentary ? 'bg-accent-green/20 border-accent-green' : 'bg-forensic-bg-secondary border-forensic-border'}`}
                    >
                      <div
                        className={`w-4 h-4 transition-transform duration-300 ${showCommentary ? 'translate-x-5 bg-accent-green' : 'bg-forensic-text-muted'}`}
                      />
                    </div>
                    <input
                      type="checkbox"
                      checked={showCommentary}
                      onChange={(e) => setShowCommentary(e.target.checked)}
                      className="hidden"
                    />
                    <span className="font-mono text-[10px] uppercase tracking-wide text-forensic-text-muted group-hover:text-forensic-text-primary transition-colors">
                      Commentary
                    </span>
                  </label>

                  <div className="flex items-center gap-1 bg-forensic-bg-secondary p-1 border border-forensic-border">
                    <button
                      onClick={() => setCompressionEnabled(!compressionEnabled)}
                      className={`p-2 transition-all ${
                        compressionEnabled
                          ? 'bg-accent-amber/20 text-accent-amber'
                          : 'text-forensic-text-muted hover:text-forensic-text-secondary'
                      }`}
                      title={
                        compressionEnabled
                          ? 'Disable dead air compression'
                          : 'Enable dead air compression'
                      }
                    >
                      <Zap className={`w-4 h-4 ${compressionEnabled ? 'fill-current' : ''}`} />
                    </button>

                    <div className="w-[1px] h-4 bg-forensic-border mx-1" />

                    <div className="flex items-center">
                      {[0.5, 1, 2, 5].map((speed) => (
                        <button
                          key={speed}
                          onClick={() => setPlaybackSpeed(speed)}
                          className={`px-2 py-1 font-mono text-[10px] transition-all ${
                            playbackSpeed === speed
                              ? 'bg-accent-green text-forensic-bg-primary font-semibold'
                              : 'text-forensic-text-muted hover:text-forensic-text-secondary'
                          }`}
                        >
                          {speed}x
                        </button>
                      ))}
                    </div>

                    <div className="w-[1px] h-4 bg-forensic-border mx-1" />

                    <button
                      onClick={() => setShowHelp(true)}
                      className="p-2 text-forensic-text-muted hover:text-accent-green transition-all"
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
      {showFiltersPanel && (
        <FiltersPanel
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
                new Set(['user_message', 'claude_response', 'tool_execution', 'claude_thinking'])
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
          onClose={() => setShowFiltersPanel(false)}
        />
      )}

      {/* Export Modal */}
      {showExportModal && sessionDetails && (
        <ExportModal
          currentFrame={currentFrame}
          currentFrameIndex={currentFrameIndex}
          sessionDetails={sessionDetails}
          frames={frames}
          onClose={() => setShowExportModal(false)}
        />
      )}

      {showGitPanel && gitData && (
        <GitPanel gitContext={gitData} onClose={() => setShowGitPanel(false)} />
      )}
      {showCheckpoints && sessionId && (
        <CheckpointPanel
          checkpoints={checkpointsData || []}
          currentFrameIndex={currentFrameIndex}
          totalFrames={frames.length}
          onNavigateToFrame={handleFrameChange}
          onCreate={() => {
            setShowCreateCheckpointDialog(true);
          }}
          onDelete={(checkpointId: string) => {
            if (confirm('Are you sure you want to delete this checkpoint?')) {
              deleteCheckpointMutation.mutate(checkpointId);
            }
          }}
          onClose={() => setShowCheckpoints(false)}
        />
      )}
      {/* Create Checkpoint Dialog */}
      <CreateCheckpointDialog
        isOpen={showCreateCheckpointDialog}
        currentFrameIndex={currentFrameIndex}
        totalFrames={frames.length}
        isCreating={createCheckpointMutation.isPending}
        error={createCheckpointMutation.error?.message || null}
        onClose={() => setShowCreateCheckpointDialog(false)}
        onCreate={(name, notes) => {
          createCheckpointMutation.mutate(
            { name, frameIndex: currentFrameIndex, notes },
            {
              onSuccess: () => {
                setShowCreateCheckpointDialog(false);
              },
            }
          );
        }}
      />
      {showRewind && sessionId && (
        <RewindPanel
          sessionId={sessionId}
          targetFrameIndex={currentFrameIndex}
          currentFrameIndex={currentFrameIndex}
          plan={null}
          onClose={() => setShowRewind(false)}
          onPreview={() => {
            // TODO: Implement rewind preview
            console.log('Preview rewind to frame', currentFrameIndex);
          }}
          onExecute={(options) => {
            // TODO: Implement rewind execution
            console.log('Execute rewind with options', options);
          }}
        />
      )}
      {/* ShareModal - Hidden until relay service is implemented (paid tier) */}
      {/* <ShareModal
        isOpen={showShareModal}
        sessionId={sessionId || ''}
        sessionName={sessionDetails?.slug || 'Session'}
        onClose={() => setShowShareModal(false)}
      /> */}

      {showSummary && summaryData && (
        <SummaryCard
          summary={summaryData}
          onRegenerate={() => {
            // TODO: Implement summary regeneration
            console.log('Regenerate summary for session', sessionId);
          }}
          onClose={() => setShowSummary(false)}
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
      <div className="bg-forensic-bg-primary p-4 font-mono text-sm border border-forensic-border">
        <div className="text-forensic-text-muted italic text-center">// no output</div>
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
            className="px-3 py-1 font-mono text-xs bg-accent-cyan/10 hover:bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/30 transition-colors"
          >
            {isExpanded ? 'Collapse' : `Expand (${outputLines.length} lines)`}
          </button>
        )}
        {isJson && !isError && (
          <button
            onClick={() => setIsFormatted(!isFormatted)}
            className="px-3 py-1 font-mono text-xs bg-forensic-bg-tertiary hover:bg-forensic-border text-forensic-text-secondary border border-forensic-border transition-colors"
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
          className={`bg-forensic-bg-primary p-4 font-mono text-sm overflow-x-auto border ${isError ? 'border-accent-red/50' : 'border-forensic-border'}`}
          style={{ maxHeight: isExpanded ? 'none' : '500px' }}
        >
          <pre
            className={`whitespace-pre-wrap ${isError ? 'text-accent-red' : 'text-forensic-text-secondary'}`}
          >
            {displayOutput}
          </pre>
        </div>
      )}
      {(needsTruncation || truncatedFilePath) && (
        <div className="mt-2 px-3 py-2 bg-forensic-bg-tertiary border border-forensic-border font-mono text-xs">
          {truncatedFilePath ? (
            <div className="text-forensic-text-secondary">
              <span className="text-accent-amber">// Truncated by agent</span> Full output:
              <code className="ml-2 text-accent-green">{truncatedFilePath}</code>
            </div>
          ) : (
            <div className="text-forensic-text-muted text-center">
              Showing {SOFT_LIMIT} / {outputLines.length} lines{' '}
              <button
                onClick={() => setIsExpanded(true)}
                className="text-accent-green hover:underline"
              >
                [expand]
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const FrameRenderer: React.FC<{
  frame: PlaybackFrame;
  searchQuery?: string;
  sessionMeta?: Partial<SessionTimeline>;
}> = ({ frame, searchQuery = '', sessionMeta }) => {
  const frameTypeColors = {
    user_message: 'bg-accent-cyan/5 border-accent-cyan/30',
    claude_thinking: 'bg-accent-purple/5 border-accent-purple/30',
    claude_response: 'bg-accent-green/5 border-accent-green/30',
    tool_execution: 'bg-accent-amber/5 border-accent-amber/30',
  };

  const agentName = frame.agent ? frame.agent.charAt(0).toUpperCase() + frame.agent.slice(1) : 'AI';

  const frameTypeIcons = {
    user_message: <Hash className="w-4 h-4 text-accent-cyan" />,
    claude_thinking: <Zap className="w-4 h-4 text-accent-purple" />,
    claude_response: <Zap className="w-4 h-4 text-accent-green" />,
    tool_execution: <Settings className="w-4 h-4 text-accent-amber" />,
  };

  const frameTypeLabels = {
    user_message: 'USER MESSAGE',
    claude_thinking: `${agentName.toUpperCase()} THINKING`,
    claude_response: `${agentName.toUpperCase()} RESPONSE`,
    tool_execution: 'TOOL EXECUTION',
  };

  const frameTypeAccent = {
    user_message: 'text-accent-cyan',
    claude_thinking: 'text-accent-purple',
    claude_response: 'text-accent-green',
    tool_execution: 'text-accent-amber',
  };

  return (
    <div
      className={`group relative border p-6 mb-6 transition-all duration-300 ${frameTypeColors[frame.type] || 'bg-forensic-bg-secondary border-forensic-border'}`}
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-forensic-bg-tertiary border border-forensic-border">
            {frameTypeIcons[frame.type]}
          </div>
          <div>
            <span className="font-mono text-[10px] uppercase tracking-wide text-forensic-text-muted block mb-0.5">
              Event Type
            </span>
            <span className={`font-mono text-sm font-semibold ${frameTypeAccent[frame.type]}`}>
              {frameTypeLabels[frame.type]}
            </span>
          </div>
        </div>
        <div className="text-right">
          <span className="font-mono text-[10px] uppercase tracking-wide text-forensic-text-muted block mb-0.5">
            Timestamp
          </span>
          <span className="font-mono text-sm text-forensic-text-secondary">
            {new Date(frame.timestamp).toLocaleTimeString()}
          </span>
        </div>
      </div>

      {frame.userMessage && (
        <div className="bg-forensic-bg-primary p-5 border border-forensic-border border-l-4 border-l-accent-cyan prose prose-invert prose-sm max-w-none">
          <ReactMarkdown>{frame.userMessage.text}</ReactMarkdown>
        </div>
      )}

      {frame.thinking && (
        <div className="bg-forensic-bg-primary p-5 border border-forensic-border border-l-4 border-l-accent-purple prose prose-invert prose-sm max-w-none">
          <div className="text-sm leading-relaxed text-forensic-text-secondary italic font-mono">
            <ReactMarkdown>{frame.thinking.text}</ReactMarkdown>
          </div>
        </div>
      )}

      {frame.claudeResponse && (
        <div className="bg-forensic-bg-primary p-5 border border-forensic-border border-l-4 border-l-accent-green prose prose-invert prose-sm max-w-none">
          <ReactMarkdown>{frame.claudeResponse.text}</ReactMarkdown>
        </div>
      )}

      {frame.toolExecution && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="px-3 py-1 bg-accent-amber/10 text-accent-amber font-mono text-xs uppercase tracking-wide border border-accent-amber/30">
              Tool: {frame.toolExecution.tool}
            </div>
            {frame.toolExecution.output.isError && (
              <div className="px-3 py-1 bg-accent-red/10 text-accent-red font-mono text-xs uppercase tracking-wide border border-accent-red/30">
                Failed
              </div>
            )}
          </div>

          {frame.toolExecution.input && (
            <div className="space-y-2">
              <span className="font-mono text-[10px] uppercase tracking-wide text-forensic-text-muted">
                // Input Parameters
              </span>
              <CodeBlock
                code={JSON.stringify(frame.toolExecution.input, null, 2)}
                language="json"
                showLineNumbers={false}
              />
            </div>
          )}

          <div className="space-y-2">
            <span className="font-mono text-[10px] uppercase tracking-wide text-forensic-text-muted">
              // Output Result
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
