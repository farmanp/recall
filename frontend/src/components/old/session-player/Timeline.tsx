/**
 * Timeline Component (Phase 2)
 *
 * Visual timeline scrubber with event markers and chapter indicators
 * Click to seek, hover for preview
 */

import React from 'react';
import type { SessionEvent, ObservationType } from '@/types';

export interface TimelineProps {
  events: SessionEvent[];
  currentEventIndex: number;
  onSeek: (eventIndex: number) => void;
}

const chapterTypes: ObservationType[] = ['feature', 'decision', 'bugfix'];

export const Timeline: React.FC<TimelineProps> = ({ events, currentEventIndex, onSeek }) => {
  const [hoverIndex, setHoverIndex] = React.useState<number | null>(null);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const index = Math.floor(percentage * events.length);
    onSeek(Math.max(0, Math.min(events.length - 1, index)));
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const index = Math.floor(percentage * events.length);
    setHoverIndex(Math.max(0, Math.min(events.length - 1, index)));
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
  };

  const progressPercentage = (currentEventIndex / (events.length - 1)) * 100;

  return (
    <div className="relative">
      <div
        className="h-12 bg-gray-100 cursor-pointer relative"
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        role="slider"
        aria-label="Timeline scrubber"
        aria-valuemin={0}
        aria-valuemax={events.length - 1}
        aria-valuenow={currentEventIndex}
      >
        {/* Progress Bar */}
        <div
          className="absolute top-0 left-0 h-full bg-blue-200 transition-all"
          style={{ width: `${progressPercentage}%` }}
        />

        {/* Chapter Markers */}
        {events.map((event, index) => {
          if (
            event.event_type === 'observation' &&
            event.obs_type &&
            chapterTypes.includes(event.obs_type)
          ) {
            const position = (index / (events.length - 1)) * 100;
            const markerColor =
              {
                feature: 'bg-purple-500',
                decision: 'bg-yellow-500',
                bugfix: 'bg-red-500',
              }[event.obs_type] || 'bg-gray-500';

            return (
              <div
                key={index}
                className={`absolute top-0 w-1 h-full ${markerColor} opacity-50`}
                style={{ left: `${position}%` }}
                title={event.title || event.obs_type}
              />
            );
          }
          return null;
        })}

        {/* Current Position Indicator */}
        <div
          className="absolute top-0 w-1 h-full bg-blue-600 shadow-lg"
          style={{ left: `${progressPercentage}%` }}
        />

        {/* Hover Preview */}
        {hoverIndex !== null && hoverIndex !== currentEventIndex && (
          <div
            className="absolute top-0 w-1 h-full bg-gray-400 opacity-50"
            style={{ left: `${(hoverIndex / (events.length - 1)) * 100}%` }}
          />
        )}
      </div>

      {/* Hover Tooltip */}
      {hoverIndex !== null && (
        <div className="absolute top-14 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
          Event {hoverIndex + 1}: {events[hoverIndex]?.event_type}
        </div>
      )}
    </div>
  );
};
