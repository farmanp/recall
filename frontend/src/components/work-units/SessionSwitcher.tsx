/**
 * SessionSwitcher Component
 *
 * Displays all sessions in a work unit as a horizontal bar with navigation.
 * Allows switching between sessions and shows model badges for each.
 */

import React from 'react';
import type { WorkUnitSession } from '../../types/work-unit';
import { AgentBadge } from '../AgentBadge';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';

interface SessionSwitcherProps {
  sessions: WorkUnitSession[];
  currentSessionId: string;
  onSessionChange: (sessionId: string) => void;
  currentFrameIndex?: number;
  totalFrames?: number;
}

function formatDuration(seconds?: number): string {
  if (!seconds) return '';
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

function formatTime(isoDate: string): string {
  return new Date(isoDate).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function SessionSwitcher({
  sessions,
  currentSessionId,
  onSessionChange,
  currentFrameIndex = 0,
  totalFrames = 0,
}: SessionSwitcherProps) {
  const currentIndex = sessions.findIndex((s) => s.sessionId === currentSessionId);
  const currentSession = sessions[currentIndex];

  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < sessions.length - 1;

  const handlePrev = () => {
    if (canGoPrev) {
      onSessionChange(sessions[currentIndex - 1].sessionId);
    }
  };

  const handleNext = () => {
    if (canGoNext) {
      onSessionChange(sessions[currentIndex + 1].sessionId);
    }
  };

  return (
    <div className="bg-gray-800 border-b border-gray-700">
      {/* Session navigation bar */}
      <div className="flex items-center gap-2 px-4 py-2">
        {/* Prev button */}
        <button
          onClick={handlePrev}
          disabled={!canGoPrev}
          className="p-1.5 rounded hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Previous session"
        >
          <ChevronLeft className="w-5 h-5 text-gray-300" />
        </button>

        {/* Session tabs */}
        <div className="flex-1 flex items-center gap-1 overflow-x-auto scrollbar-hide">
          {sessions.map((session, idx) => {
            const isActive = session.sessionId === currentSessionId;
            return (
              <button
                key={session.sessionId}
                onClick={() => onSessionChange(session.sessionId)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-gray-700 border border-gray-600'
                    : 'hover:bg-gray-750 border border-transparent'
                }`}
              >
                <span className="text-xs text-gray-500 font-mono">{idx + 1}</span>
                <AgentBadge agent={session.agent} size="sm" />
                {session.model && <span className="text-xs text-gray-400">{session.model}</span>}
                {session.duration && (
                  <span className="text-xs text-gray-500">{formatDuration(session.duration)}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Next button */}
        <button
          onClick={handleNext}
          disabled={!canGoNext}
          className="p-1.5 rounded hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Next session"
        >
          <ChevronRight className="w-5 h-5 text-gray-300" />
        </button>
      </div>

      {/* Current session info */}
      {currentSession && (
        <div className="flex items-center justify-between px-4 py-2 bg-gray-850 border-t border-gray-700">
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-500">
              Session {currentIndex + 1} of {sessions.length}
            </span>
            <span className="text-gray-400">Started at {formatTime(currentSession.startTime)}</span>
            {currentSession.firstUserMessage && (
              <span className="text-gray-400 truncate max-w-md">
                "{currentSession.firstUserMessage.slice(0, 50)}..."
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>
              Frame {currentFrameIndex + 1} / {totalFrames}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default SessionSwitcher;
