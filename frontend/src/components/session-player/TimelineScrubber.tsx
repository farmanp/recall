/**
 * TimelineScrubber Component
 *
 * Interactive timeline with click-to-seek, hover preview, and frame type markers
 */

import React, { useState, useRef, useMemo } from 'react';
import type { PlaybackFrame, CommentaryData } from '../../types/transcript';
import { CommentaryTimeline } from '../CommentaryBubble';
import { Hash } from 'lucide-react';

const FRAME_TYPE_COLOR_MAP: Record<string, string> = {
  user_message: 'bg-blue-500',
  claude_thinking: 'bg-purple-500',
  claude_response: 'bg-green-500',
  tool_execution: 'bg-orange-500',
};

const FRAME_TYPE_LABELS: Record<string, string> = {
  user_message: '👤 User',
  claude_thinking: '🧠 Thinking',
  claude_response: '🤖 Claude',
  tool_execution: '🛠️ Tool',
};

interface TimelineScrubberProps {
  frames: PlaybackFrame[];
  currentFrameIndex: number;
  onSeek: (frameIndex: number) => void;
  showCommentary: boolean;
  commentary?: CommentaryData[];
  activeFrameTypes: Set<string>;
}

export const TimelineScrubber: React.FC<TimelineScrubberProps> = ({
  frames,
  currentFrameIndex,
  onSeek,
  showCommentary,
  commentary,
  activeFrameTypes,
}) => {
  const [hoverInfo, setHoverInfo] = useState<{ frameIndex: number; x: number } | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Calculate progress percentage
  const progress = frames.length > 0 ? ((currentFrameIndex + 1) / frames.length) * 100 : 0;

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
    const targetFrame = Math.floor(percentage * frames.length);
    const clampedFrame = Math.max(0, Math.min(targetFrame, frames.length - 1));

    onSeek(clampedFrame);
  };

  // Handle mouse move for hover preview
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const frameIndex = Math.floor(percentage * frames.length);
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
        const position = (idx / frames.length) * 100;
        const color = FRAME_TYPE_COLOR_MAP[frame.type] || 'bg-gray-500';

        return (
          <div
            key={frame.id}
            className={`absolute w-0.5 h-8 ${color} opacity-40`}
            style={{
              left: `${position}%`,
              top: '-4px',
            }}
          />
        );
      }),
    [frames, activeFrameTypes]
  );

  return (
    <div className="bg-gray-900/40 backdrop-blur-xl border-t border-white/5 px-6 py-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
          <div className="flex items-center gap-4">
            <span className="text-blue-400">{formatTimestamp(currentTimestampMs)}</span>
            <span className="text-gray-700">/</span>
            <span>{formatTimestamp(totalDurationMs)}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-gray-800/50 px-2 py-1 rounded border border-white/5">
            <Hash className="w-3 h-3" />
            <span>
              Frame {currentFrameIndex + 1} of {frames.length}
            </span>
          </div>
        </div>

        {/* Timeline Container */}
        <div className="relative group">
          {/* Timeline Track */}
          <div
            ref={timelineRef}
            role="slider"
            aria-label="Playback timeline"
            aria-valuemin={0}
            aria-valuemax={frames.length - 1}
            aria-valuenow={currentFrameIndex}
            aria-valuetext={`Frame ${currentFrameIndex + 1} of ${frames.length}`}
            tabIndex={0}
            className="relative h-2 bg-gray-800/80 rounded-full cursor-pointer overflow-hidden backdrop-blur-sm border border-white/5"
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
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-600 to-blue-500 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />

            {/* Frame Type Markers */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
              {frameMarkers}
            </div>

            {/* Current Position Handle */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full border-2 border-blue-600 shadow-lg transition-all"
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
              className="absolute bg-gray-900 px-3 py-2 rounded shadow-lg text-xs z-10 pointer-events-none"
              style={{
                left: `${hoverInfo.x}px`,
                top: '-3rem',
                transform: 'translateX(-50%)',
              }}
            >
              <div className="text-white font-bold mb-1 border-b border-gray-700 pb-1">
                Frame {hoverInfo.frameIndex + 1}
              </div>
              <div className="flex items-center gap-1.5 mb-2 truncate">
                <span className="text-lg">
                  {FRAME_TYPE_LABELS[frames[hoverInfo.frameIndex]?.type]?.split(' ')[0] || '❓'}
                </span>
                <span className="text-gray-300 font-medium">
                  {FRAME_TYPE_LABELS[frames[hoverInfo.frameIndex]?.type]?.split(' ')[1] ||
                    'Unknown'}
                </span>
              </div>
              <div className="text-[10px] text-gray-400 bg-gray-950/50 p-1.5 rounded leading-tight max-w-[200px] line-clamp-3 italic">
                {frames[hoverInfo.frameIndex]?.userMessage?.text ||
                  frames[hoverInfo.frameIndex]?.claudeResponse?.text ||
                  frames[hoverInfo.frameIndex]?.thinking?.text ||
                  (frames[hoverInfo.frameIndex]?.toolExecution
                    ? `Tool: ${frames[hoverInfo.frameIndex]?.toolExecution?.tool}`
                    : 'No preview available')}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
