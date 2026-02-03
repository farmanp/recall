/**
 * TimelineScrubber Component
 *
 * Interactive timeline with click-to-seek, hover preview, and frame type markers
 */

import React, { useState, useRef } from 'react';
import type { PlaybackFrame, CommentaryData } from '../../types/transcript';
import { CommentaryTimeline } from '../CommentaryBubble';

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
  const totalDurationMs = frames.length > 0 ? frames[frames.length - 1].timestamp - frames[0].timestamp : 0;
  const currentTimestampMs = frames[currentFrameIndex]?.timestamp - (frames[0]?.timestamp || 0) || 0;

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

  // Frame type color mapping
  const frameTypeColorMap: Record<string, string> = {
    user_message: 'bg-blue-500',
    claude_thinking: 'bg-purple-500',
    claude_response: 'bg-green-500',
    tool_execution: 'bg-orange-500',
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

  // Frame type labels for tooltip
  const frameTypeLabels: Record<string, string> = {
    user_message: '👤 User',
    claude_thinking: '🧠 Thinking',
    claude_response: '🤖 Claude',
    tool_execution: '🛠️ Tool',
  };

  return (
    <div className="bg-gray-800 border-t border-gray-700 px-6 py-2">
      <div className="max-w-4xl mx-auto">
        {/* Header: Frame Counter + Duration */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-400">
            Frame {currentFrameIndex + 1} / {frames.length}
          </span>
          <span className="text-xs text-gray-400">
            {formatTimestamp(currentTimestampMs)} / {formatTimestamp(totalDurationMs)}
          </span>
        </div>

        {/* Timeline Container */}
        <div className="relative">
          {/* Timeline Track */}
          <div
            ref={timelineRef}
            className="relative h-6 bg-gray-700 rounded-full overflow-visible cursor-pointer"
            onClick={handleTimelineClick}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            {/* Progress Fill */}
            <div
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-600 to-blue-500 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />

            {/* Frame Type Markers */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
              {frames
                .filter((f) => activeFrameTypes.has(f.type))
                .map((frame, idx) => {
                  const position = (idx / frames.length) * 100;
                  const color = frameTypeColorMap[frame.type] || 'bg-gray-500';

                  return (
                    <div
                      key={frame.id}
                      className={`absolute w-0.5 h-8 ${color} opacity-70`}
                      style={{
                        left: `${position}%`,
                        top: '-4px',
                      }}
                    />
                  );
                })}
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
              <div className="text-white">
                Frame {hoverInfo.frameIndex + 1}
              </div>
              <div className="text-gray-400">
                {frameTypeLabels[frames[hoverInfo.frameIndex]?.type] || 'Unknown'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
