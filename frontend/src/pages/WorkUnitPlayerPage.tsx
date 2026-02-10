/**
 * WorkUnitPlayerPage Component
 *
 * Video player-style interface for replaying work units across multiple sessions.
 * Automatically advances to next session when current one ends.
 * Forensic/terminal aesthetic design.
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWorkUnit } from '../hooks/useWorkUnits';
import { useSessionFrames } from '../hooks/useTranscriptApi';
import type { PlaybackFrame } from '../types/transcript';
import type { WorkUnitSession } from '../types/work-unit';
import ReactMarkdown from 'react-markdown';
import { CodeBlock } from '../components/CodeBlock';
import { DiffViewer } from '../components/DiffViewer';
import { AgentBadge } from '../components/AgentBadge';
import { SessionSwitcher } from '../components/work-units/SessionSwitcher';
import { WorkUnitTimeline } from '../components/work-units/WorkUnitTimeline';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { ChevronLeft, Play, Pause, FastForward, SkipForward, SkipBack, Layers } from 'lucide-react';

export const WorkUnitPlayerPage: React.FC = () => {
  const { workUnitId } = useParams<{ workUnitId: string }>();
  const navigate = useNavigate();

  // Work unit data
  const { data: workUnitData, isLoading: loadingWorkUnit } = useWorkUnit(workUnitId);
  const workUnit = workUnitData?.workUnit;
  const sessions = useMemo(() => workUnit?.sessions ?? [], [workUnit?.sessions]);

  // Current session state
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [autoAdvance, setAutoAdvance] = useState(true);

  // Frame data for current session
  const { data: framesData, isLoading: loadingFrames } = useSessionFrames(
    currentSessionId || undefined,
    { offset: 0, limit: 1000 }
  );
  const frames = framesData?.frames || [];
  const currentFrame = frames[currentFrameIndex];

  // Frame counts for timeline
  const [frameCounts, setFrameCounts] = useState<Record<string, number>>({});

  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Initialize to first session when work unit loads
  useEffect(() => {
    if (sessions.length > 0 && !currentSessionId) {
      setCurrentSessionId(sessions[0].sessionId);
    }
  }, [sessions, currentSessionId]);

  // Update frame counts when we get frame data
  useEffect(() => {
    if (currentSessionId && framesData?.total) {
      setFrameCounts((prev) => ({
        ...prev,
        [currentSessionId]: framesData.total,
      }));
    }
  }, [currentSessionId, framesData?.total]);

  // Auto-advance logic
  useEffect(() => {
    if (!isPlaying || !currentFrame || currentFrameIndex >= frames.length - 1) {
      // Check if we should advance to next session
      if (isPlaying && autoAdvance && currentFrameIndex >= frames.length - 1 && frames.length > 0) {
        const currentIdx = sessions.findIndex((s) => s.sessionId === currentSessionId);
        if (currentIdx < sessions.length - 1) {
          // Move to next session
          setCurrentSessionId(sessions[currentIdx + 1].sessionId);
          setCurrentFrameIndex(0);
          return;
        } else {
          // End of work unit
          setIsPlaying(false);
        }
      }
      return;
    }

    const baseDuration = currentFrame.duration || 2000;
    const duration = baseDuration / playbackSpeed;

    timeoutRef.current = setTimeout(() => {
      setCurrentFrameIndex((prev) => prev + 1);
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
    sessions,
    currentSessionId,
    autoAdvance,
  ]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case ' ':
          e.preventDefault();
          setIsPlaying((prev) => !prev);
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (currentFrameIndex < frames.length - 1) {
            setCurrentFrameIndex((prev) => prev + 1);
          }
          setIsPlaying(false);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (currentFrameIndex > 0) {
            setCurrentFrameIndex((prev) => prev - 1);
          }
          setIsPlaying(false);
          break;
        case 'n':
        case 'N':
          e.preventDefault();
          // Next session
          const currentIdx = sessions.findIndex((s) => s.sessionId === currentSessionId);
          if (currentIdx < sessions.length - 1) {
            setCurrentSessionId(sessions[currentIdx + 1].sessionId);
            setCurrentFrameIndex(0);
          }
          break;
        case 'p':
        case 'P':
          e.preventDefault();
          // Previous session
          const prevIdx = sessions.findIndex((s) => s.sessionId === currentSessionId);
          if (prevIdx > 0) {
            setCurrentSessionId(sessions[prevIdx - 1].sessionId);
            setCurrentFrameIndex(0);
          }
          break;
        case 'Escape':
          navigate('/work-units');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentFrameIndex, frames.length, sessions, currentSessionId, navigate]);

  // Handle session change
  const handleSessionChange = useCallback((sessionId: string) => {
    setCurrentSessionId(sessionId);
    setCurrentFrameIndex(0);
    setIsPlaying(false);
  }, []);

  // Handle timeline seek
  const handleTimelineSeek = useCallback((sessionId: string, frameIndex: number) => {
    setCurrentSessionId(sessionId);
    setCurrentFrameIndex(frameIndex);
    setIsPlaying(false);
  }, []);

  if (loadingWorkUnit || !workUnit) {
    return (
      <div className="flex items-center justify-center h-screen bg-forensic-bg-primary">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 font-mono text-sm text-forensic-text-secondary">
            Loading work unit...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-forensic-bg-primary text-forensic-text-primary overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-forensic-bg-secondary border-b border-forensic-border">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/work-units')}
            className="p-2 hover:bg-forensic-bg-tertiary border border-transparent hover:border-forensic-border transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-forensic-text-secondary" />
          </button>
          <div className="flex items-center gap-3">
            <Layers className="w-5 h-5 text-accent-purple" />
            <h1 className="font-mono font-bold text-lg text-forensic-text-primary truncate max-w-md">
              {workUnit.name}
            </h1>
            <span className="font-mono text-xs text-accent-amber bg-accent-amber/10 border border-accent-amber/30 px-2 py-0.5">
              WU-{workUnit.id.slice(0, 6).toUpperCase()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Playback controls */}
          <div className="flex items-center gap-1 bg-forensic-bg-tertiary border border-forensic-border p-1">
            <button
              onClick={() => {
                const idx = sessions.findIndex((s) => s.sessionId === currentSessionId);
                if (idx > 0) {
                  handleSessionChange(sessions[idx - 1].sessionId);
                }
              }}
              disabled={sessions.findIndex((s) => s.sessionId === currentSessionId) === 0}
              className="p-2 hover:bg-forensic-bg-secondary disabled:opacity-30 transition-colors"
              title="Previous session (P)"
            >
              <SkipBack className="w-4 h-4 text-forensic-text-secondary" />
            </button>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-2 hover:bg-forensic-bg-secondary transition-colors"
              title="Play/Pause (Space)"
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 text-accent-green" />
              ) : (
                <Play className="w-4 h-4 text-accent-green" />
              )}
            </button>
            <button
              onClick={() => {
                const idx = sessions.findIndex((s) => s.sessionId === currentSessionId);
                if (idx < sessions.length - 1) {
                  handleSessionChange(sessions[idx + 1].sessionId);
                }
              }}
              disabled={
                sessions.findIndex((s) => s.sessionId === currentSessionId) === sessions.length - 1
              }
              className="p-2 hover:bg-forensic-bg-secondary disabled:opacity-30 transition-colors"
              title="Next session (N)"
            >
              <SkipForward className="w-4 h-4 text-forensic-text-secondary" />
            </button>
          </div>

          {/* Speed control */}
          <div className="flex items-center gap-2">
            <FastForward className="w-4 h-4 text-forensic-text-muted" />
            <select
              value={playbackSpeed}
              onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
              className="bg-forensic-bg-tertiary border border-forensic-border px-2 py-1 font-mono text-xs text-forensic-text-secondary focus:outline-none focus:border-accent-green"
            >
              <option value={0.5}>0.5x</option>
              <option value={1}>1x</option>
              <option value={2}>2x</option>
              <option value={5}>5x</option>
            </select>
          </div>

          {/* Auto-advance toggle */}
          <label className="flex items-center gap-2 font-mono text-xs text-forensic-text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={autoAdvance}
              onChange={(e) => setAutoAdvance(e.target.checked)}
              className="accent-accent-green"
            />
            <span className="uppercase tracking-wide">Auto-advance</span>
          </label>
        </div>
      </header>

      {/* Session switcher */}
      {currentSessionId && (
        <SessionSwitcher
          sessions={sessions}
          currentSessionId={currentSessionId}
          onSessionChange={handleSessionChange}
          currentFrameIndex={currentFrameIndex}
          totalFrames={frames.length}
        />
      )}

      {/* Main content area */}
      <div className="flex-1 overflow-auto p-6 bg-forensic-bg-primary">
        {loadingFrames ? (
          <div className="flex items-center justify-center h-full">
            <LoadingSpinner size="md" />
          </div>
        ) : currentFrame ? (
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Frame header */}
            <div className="flex items-center gap-4">
              <AgentBadge agent={currentFrame.agent} size="md" />
              <span className="font-mono text-xs text-forensic-text-muted">
                {new Date(currentFrame.timestamp).toLocaleTimeString()}
              </span>
              <span
                className={`px-2 py-0.5 font-mono text-xs uppercase tracking-wide ${
                  currentFrame.type === 'user_message'
                    ? 'bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/30'
                    : currentFrame.type === 'claude_thinking'
                      ? 'bg-accent-purple/10 text-accent-purple border border-accent-purple/30'
                      : currentFrame.type === 'claude_response'
                        ? 'bg-accent-green/10 text-accent-green border border-accent-green/30'
                        : 'bg-accent-amber/10 text-accent-amber border border-accent-amber/30'
                }`}
              >
                {currentFrame.type.replace('_', ' ')}
              </span>
            </div>

            {/* Frame content */}
            <div className="bg-forensic-bg-secondary border border-forensic-border">
              {/* Terminal header */}
              <div className="flex items-center gap-2 px-4 py-2 bg-forensic-bg-tertiary border-b border-forensic-border">
                <div className="w-3 h-3 rounded-full bg-accent-red"></div>
                <div className="w-3 h-3 rounded-full bg-accent-amber"></div>
                <div className="w-3 h-3 rounded-full bg-accent-green"></div>
                <span className="ml-auto font-mono text-xs text-forensic-text-muted">
                  frame {currentFrameIndex + 1} of {frames.length}
                </span>
              </div>

              <div className="p-6">
                {currentFrame.type === 'user_message' && currentFrame.userMessage && (
                  <div className="prose prose-invert prose-green max-w-none font-mono">
                    <div className="flex items-start gap-2">
                      <span className="text-accent-green shrink-0">$</span>
                      <ReactMarkdown>{currentFrame.userMessage.text}</ReactMarkdown>
                    </div>
                  </div>
                )}

                {currentFrame.type === 'claude_thinking' && currentFrame.thinking && (
                  <div className="prose prose-invert prose-purple max-w-none font-mono">
                    <div className="text-accent-purple/80 italic">
                      <ReactMarkdown>{currentFrame.thinking.text}</ReactMarkdown>
                    </div>
                  </div>
                )}

                {currentFrame.type === 'claude_response' && currentFrame.claudeResponse && (
                  <div className="prose prose-invert prose-green max-w-none font-mono text-forensic-text-primary">
                    <ReactMarkdown>{currentFrame.claudeResponse.text}</ReactMarkdown>
                  </div>
                )}

                {currentFrame.type === 'tool_execution' && currentFrame.toolExecution && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-accent-amber font-bold">
                        {currentFrame.toolExecution.tool}
                      </span>
                      {currentFrame.toolExecution.output.isError && (
                        <span className="font-mono text-xs text-accent-red uppercase tracking-wide">
                          Error
                        </span>
                      )}
                    </div>

                    {currentFrame.toolExecution.fileDiff ? (
                      <DiffViewer
                        oldContent={currentFrame.toolExecution.fileDiff.oldContent}
                        newContent={currentFrame.toolExecution.fileDiff.newContent}
                        language={currentFrame.toolExecution.fileDiff.language}
                        filePath={currentFrame.toolExecution.fileDiff.filePath}
                      />
                    ) : (
                      <CodeBlock code={currentFrame.toolExecution.output.content} language="text" />
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full font-mono text-sm text-forensic-text-muted">
            No frames in this session
          </div>
        )}
      </div>

      {/* Timeline */}
      {currentSessionId && (
        <WorkUnitTimeline
          sessions={sessions}
          frameCounts={frameCounts}
          currentSessionId={currentSessionId}
          currentFrameIndex={currentFrameIndex}
          onSeek={handleTimelineSeek}
        />
      )}
    </div>
  );
};

export default WorkUnitPlayerPage;
