/**
 * WorkUnitPlayerPage Component
 *
 * Video player-style interface for replaying work units across multiple sessions.
 * Automatically advances to next session when current one ends.
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
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading work unit...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/work-units')}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-500" />
            <h1 className="font-bold text-lg truncate max-w-md">{workUnit.name}</h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Playback controls */}
          <div className="flex items-center gap-2 bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => {
                const idx = sessions.findIndex((s) => s.sessionId === currentSessionId);
                if (idx > 0) {
                  handleSessionChange(sessions[idx - 1].sessionId);
                }
              }}
              disabled={sessions.findIndex((s) => s.sessionId === currentSessionId) === 0}
              className="p-2 hover:bg-gray-600 rounded disabled:opacity-30"
              title="Previous session (P)"
            >
              <SkipBack className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-2 hover:bg-gray-600 rounded"
              title="Play/Pause (Space)"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
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
              className="p-2 hover:bg-gray-600 rounded disabled:opacity-30"
              title="Next session (N)"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          </div>

          {/* Speed control */}
          <div className="flex items-center gap-2">
            <FastForward className="w-4 h-4 text-gray-400" />
            <select
              value={playbackSpeed}
              onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
              className="bg-gray-700 rounded px-2 py-1 text-sm"
            >
              <option value={0.5}>0.5x</option>
              <option value={1}>1x</option>
              <option value={2}>2x</option>
              <option value={5}>5x</option>
            </select>
          </div>

          {/* Auto-advance toggle */}
          <label className="flex items-center gap-2 text-sm text-gray-400">
            <input
              type="checkbox"
              checked={autoAdvance}
              onChange={(e) => setAutoAdvance(e.target.checked)}
              className="rounded"
            />
            Auto-advance
          </label>
        </div>
      </div>

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
      <div className="flex-1 overflow-auto p-6">
        {loadingFrames ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : currentFrame ? (
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Frame header */}
            <div className="flex items-center gap-4">
              <AgentBadge agent={currentFrame.agent} size="md" />
              <span className="text-sm text-gray-500">
                {new Date(currentFrame.timestamp).toLocaleTimeString()}
              </span>
              <span
                className={`px-2 py-0.5 rounded text-xs ${
                  currentFrame.type === 'user_message'
                    ? 'bg-blue-600 text-blue-100'
                    : currentFrame.type === 'claude_thinking'
                      ? 'bg-purple-600 text-purple-100'
                      : currentFrame.type === 'claude_response'
                        ? 'bg-green-600 text-green-100'
                        : 'bg-yellow-600 text-yellow-100'
                }`}
              >
                {currentFrame.type.replace('_', ' ')}
              </span>
            </div>

            {/* Frame content */}
            <div className="bg-gray-800 rounded-lg p-6">
              {currentFrame.type === 'user_message' && currentFrame.userMessage && (
                <div className="prose prose-invert prose-blue max-w-none">
                  <ReactMarkdown>{currentFrame.userMessage.text}</ReactMarkdown>
                </div>
              )}

              {currentFrame.type === 'claude_thinking' && currentFrame.thinking && (
                <div className="prose prose-invert prose-purple max-w-none">
                  <div className="text-purple-300 italic">
                    <ReactMarkdown>{currentFrame.thinking.text}</ReactMarkdown>
                  </div>
                </div>
              )}

              {currentFrame.type === 'claude_response' && currentFrame.claudeResponse && (
                <div className="prose prose-invert prose-green max-w-none">
                  <ReactMarkdown>{currentFrame.claudeResponse.text}</ReactMarkdown>
                </div>
              )}

              {currentFrame.type === 'tool_execution' && currentFrame.toolExecution && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="text-yellow-400 font-mono font-bold">
                      {currentFrame.toolExecution.tool}
                    </span>
                    {currentFrame.toolExecution.output.isError && (
                      <span className="text-red-500 text-sm">Error</span>
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
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
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
