/**
 * TimelineScrubber Component
 *
 * Interactive timeline with click-to-seek, hover preview, and frame type markers
 * Forensic theme styling
 */

import React, { useState, useRef, useMemo } from 'react';
import type { PlaybackFrame, CommentaryData } from '../../types/transcript';
import { CommentaryTimeline } from '../CommentaryBubble';
import { Hash } from 'lucide-react';

const FRAME_TYPE_COLOR_MAP: Record<string, string> = {
  user_message: 'bg-accent-cyan',
  claude_thinking: 'bg-accent-purple',
  claude_response: 'bg-accent-green',
  tool_execution: 'bg-accent-amber',
};

const FRAME_TYPE_LABELS: Record<string, string> = {
  user_message: 'USER',
  claude_thinking: 'THINKING',
  claude_response: 'RESPONSE',
  tool_execution: 'TOOL',
};

interface TimelineScrubberProps {
  frames: PlaybackFrame[];
  currentFrameIndex: number;
  onSeek: (frameIndex: number) => void;
  showCommentary: boolean;
  commentary?: CommentaryData[];
  activeFrameTypes: Set<string>;
  isFrameVisible?: (frame: PlaybackFrame) => boolean;
}

export const TimelineScrubber: React.FC<TimelineScrubberProps> = ({
  frames,
  currentFrameIndex,
  onSeek,
  showCommentary,
  commentary,
  activeFrameTypes,
  isFrameVisible,
}) => {
  const [hoverInfo, setHoverInfo] = useState<{ frameIndex: number; x: number } | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Calculate progress percentage (frame 0 = 0%, last frame = 100%)
  const progress = frames.length > 1 ? (currentFrameIndex / (frames.length - 1)) * 100 : 0;

  // Calculate total duration for timestamp display
  const totalDurationMs =
    frames.length > 0 ? frames[frames.length - 1].timestamp - frames[0].timestamp : 0;
  const currentTimestampMs =
    frames[currentFrameIndex]?.timestamp - (frames[0]?.timestamp || 0) || 0;

  // Format timestamp as HH:MM:SS or MM:SS
  const formatTimestamp = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Handle timeline click for seek
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const targetFrame = Math.round(percentage * (frames.length - 1));
    const clampedFrame = Math.max(0, Math.min(targetFrame, frames.length - 1));

    onSeek(clampedFrame);
  };

  // Handle mouse move for hover preview
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const frameIndex = Math.round(percentage * (frames.length - 1));
    const clampedFrameIndex = Math.max(0, Math.min(frameIndex, frames.length - 1));

    setHoverInfo({ frameIndex: clampedFrameIndex, x });
  };

  // Handle mouse leave
  const handleMouseLeave = () => {
    setHoverInfo(null);
  };

  const frameMarkers = useMemo(
    () =>
      frames.map((frame, idx) => {
        if (!activeFrameTypes.has(frame.type)) return null;
        if (isFrameVisible && !isFrameVisible(frame)) return null;
        const position = frames.length > 1 ? (idx / (frames.length - 1)) * 100 : 0;
        const color = FRAME_TYPE_COLOR_MAP[frame.type] || 'bg-forensic-text-muted';

        return (
          <div
            key={frame.id}
            className={`absolute w-0.5 h-6 ${color} opacity-40`}
            style={{
              left: `${position}%`,
              top: '-2px',
            }}
          />
        );
      }),
    [frames, activeFrameTypes, isFrameVisible]
  );

  return (
    <div className="bg-forensic-bg-secondary border-t border-forensic-border px-6 py-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-3 font-mono text-xs uppercase tracking-wide">
          <div className="flex items-center gap-3">
            <span className="text-accent-green">{formatTimestamp(currentTimestampMs)}</span>
            <span className="text-forensic-text-muted">/</span>
            <span className="text-forensic-text-secondary">{formatTimestamp(totalDurationMs)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-forensic-text-muted">
            <Hash className="w-3 h-3" />
            <span>
              {currentFrameIndex + 1} / {frames.length}
            </span>
          </div>
        </div>

        {/* Timeline Container */}
        <div className="relative group">
          {/* Timeline Track */}
          <div
            ref={timelineRef}
            role="slider"
            aria-label="Playback timeline scrubber"
            aria-valuemin={0}
            aria-valuemax={frames.length - 1}
            aria-valuenow={currentFrameIndex}
            aria-valuetext={`Frame ${currentFrameIndex + 1} of ${frames.length}`}
            tabIndex={0}
            className="relative h-3 bg-forensic-bg-tertiary cursor-pointer overflow-hidden border border-forensic-border"
            onClick={handleTimelineClick}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight')
                onSeek(Math.min(frames.length - 1, currentFrameIndex + 1));
              if (e.key === 'ArrowLeft') onSeek(Math.max(0, currentFrameIndex - 1));
            }}
          >
            {/* Progress Fill */}
            <div
              className="absolute top-0 left-0 h-full bg-accent-green transition-all"
              style={{ width: `${progress}%` }}
            />

            {/* Frame Type Markers */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
              {frameMarkers}
            </div>

            {/* Current Position Handle */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-accent-green border-2 border-forensic-bg-primary shadow-lg transition-all"
              style={{
                left: `${progress}%`,
                transform: 'translate(-50%, -50%)',
              }}
            />

            {/* Commentary Bubbles Overlay */}
            {showCommentary && commentary && commentary.length > 0 && (
              <CommentaryTimeline
                commentary={commentary}
                totalFrames={frames.length}
                frames={frames}
                onBubbleClick={() => {}}
              />
            )}
          </div>

          {/* Hover Preview Tooltip */}
          {hoverInfo && timelineRef.current && (
            <div
              className="absolute bg-forensic-bg-secondary border border-forensic-border px-3 py-2 z-10 pointer-events-none font-mono"
              style={{
                left: `${hoverInfo.x}px`,
                top: '-5rem',
                transform: 'translateX(-50%)',
              }}
            >
              <div className="text-accent-green text-xs mb-1 border-b border-forensic-border pb-1">
                Frame {hoverInfo.frameIndex + 1}
              </div>
              <div className="text-[10px] text-forensic-text-secondary uppercase tracking-wide mb-2">
                {FRAME_TYPE_LABELS[frames[hoverInfo.frameIndex]?.type] || 'Unknown'}
              </div>
              <div className="text-[10px] text-forensic-text-muted max-w-[200px] line-clamp-2 leading-tight">
                {frames[hoverInfo.frameIndex]?.userMessage?.text ||
                  frames[hoverInfo.frameIndex]?.claudeResponse?.text ||
                  frames[hoverInfo.frameIndex]?.thinking?.text ||
                  (frames[hoverInfo.frameIndex]?.toolExecution
                    ? `Tool: ${frames[hoverInfo.frameIndex]?.toolExecution?.tool}`
                    : 'No preview')}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
