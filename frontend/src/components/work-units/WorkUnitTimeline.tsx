/**
 * WorkUnitTimeline Component
 *
 * A unified timeline scrubber that spans multiple sessions in a work unit.
 * Shows session boundaries and allows navigation across all frames.
 * Forensic/terminal aesthetic design.
 */

import React, { useMemo } from 'react';
import type { WorkUnitSession } from '../../types/work-unit';

interface SessionSegment {
  sessionId: string;
  agent: string;
  startFrame: number;
  endFrame: number;
  frameCount: number;
  widthPercent: number;
}

interface WorkUnitTimelineProps {
  sessions: WorkUnitSession[];
  frameCounts: Record<string, number>; // sessionId -> frameCount
  currentSessionId: string;
  currentFrameIndex: number;
  onSeek: (sessionId: string, frameIndex: number) => void;
}

const agentColors: Record<string, string> = {
  claude: 'bg-agent-claude',
  codex: 'bg-agent-codex',
  gemini: 'bg-agent-gemini',
  unknown: 'bg-forensic-text-muted',
};

export function WorkUnitTimeline({
  sessions,
  frameCounts,
  currentSessionId,
  currentFrameIndex,
  onSeek,
}: WorkUnitTimelineProps) {
  // Build timeline segments
  const { segments, totalFrames } = useMemo(() => {
    let runningTotal = 0;
    const segs: SessionSegment[] = [];

    for (const session of sessions) {
      const frameCount = frameCounts[session.sessionId] || session.frameCount || 0;
      segs.push({
        sessionId: session.sessionId,
        agent: session.agent,
        startFrame: runningTotal,
        endFrame: runningTotal + frameCount - 1,
        frameCount,
        widthPercent: 0, // Will calculate after
      });
      runningTotal += frameCount;
    }

    // Calculate width percentages
    for (const seg of segs) {
      seg.widthPercent = runningTotal > 0 ? (seg.frameCount / runningTotal) * 100 : 0;
    }

    return { segments: segs, totalFrames: runningTotal };
  }, [sessions, frameCounts]);

  // Calculate current position
  const currentGlobalFrame = useMemo(() => {
    let position = 0;
    for (const seg of segments) {
      if (seg.sessionId === currentSessionId) {
        return position + currentFrameIndex;
      }
      position += seg.frameCount;
    }
    return 0;
  }, [segments, currentSessionId, currentFrameIndex]);

  const progressPercent = totalFrames > 0 ? (currentGlobalFrame / totalFrames) * 100 : 0;

  // Handle click on timeline
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickPercent = clickX / rect.width;
    const targetFrame = Math.floor(clickPercent * totalFrames);

    // Find which session this frame belongs to
    let runningTotal = 0;
    for (const seg of segments) {
      if (targetFrame >= runningTotal && targetFrame < runningTotal + seg.frameCount) {
        const localFrame = targetFrame - runningTotal;
        onSeek(seg.sessionId, localFrame);
        return;
      }
      runningTotal += seg.frameCount;
    }
  };

  return (
    <div className="px-4 py-3 bg-forensic-bg-tertiary border-t border-forensic-border">
      {/* Timeline bar */}
      <div
        className="relative h-8 bg-forensic-bg-primary border border-forensic-border overflow-hidden cursor-pointer"
        onClick={handleClick}
      >
        {/* Session segments */}
        <div className="absolute inset-0 flex">
          {segments.map((seg, idx) => (
            <div
              key={seg.sessionId}
              className={`relative ${agentColors[seg.agent]} opacity-60 hover:opacity-80 transition-opacity ${
                seg.sessionId === currentSessionId ? 'ring-2 ring-accent-green ring-inset' : ''
              }`}
              style={{ width: `${seg.widthPercent}%` }}
              title={`Session ${idx + 1} (${seg.agent}) - ${seg.frameCount} frames`}
            >
              {/* Session divider */}
              {idx > 0 && (
                <div className="absolute left-0 top-0 bottom-0 w-px bg-forensic-bg-primary" />
              )}
              {/* Session label */}
              {seg.widthPercent > 5 && (
                <span className="absolute inset-0 flex items-center justify-center font-mono text-xs text-forensic-bg-primary font-medium">
                  {idx + 1}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Progress indicator */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-accent-green shadow-[0_0_8px_rgba(34,197,94,0.5)]"
          style={{ left: `${progressPercent}%`, transform: 'translateX(-50%)' }}
        />
      </div>

      {/* Frame counter */}
      <div className="flex items-center justify-between mt-2 font-mono text-xs">
        <span className="text-forensic-text-muted uppercase tracking-wide">
          Frame <span className="text-accent-green">{currentGlobalFrame + 1}</span> of {totalFrames}
        </span>
        <span className="text-forensic-text-muted uppercase tracking-wide">
          {sessions.length} session{sessions.length !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
}

export default WorkUnitTimeline;
