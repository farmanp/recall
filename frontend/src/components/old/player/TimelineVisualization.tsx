/**
 * TimelineVisualization
 *
 * Video player-style timeline showing events chronologically
 * Color-coded by observation type with chapter markers
 */

import React, { useRef, useState, useEffect } from 'react';
import type { SessionEvent } from '@/types';
import { colors } from '@/styles/design-tokens';

export interface TimelineVisualizationProps {
  events: SessionEvent[];
  currentIndex: number;
  onSeek: (index: number) => void;
  className?: string;
}

export const TimelineVisualization: React.FC<TimelineVisualizationProps> = ({
  events,
  currentIndex,
  onSeek,
  className = '',
}) => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const getEventColor = (event: SessionEvent): string => {
    if (event.event_type === 'prompt') {
      return colors.prompt.primary;
    }

    const typeColors = {
      feature: colors.observation.feature.primary,
      bugfix: colors.observation.bugfix.primary,
      decision: colors.observation.decision.primary,
      discovery: colors.observation.discovery.primary,
      refactor: colors.observation.refactor.primary,
      change: colors.observation.change.primary,
    };

    return typeColors[event.obs_type || 'change'] || colors.ui.text.tertiary;
  };

  const isChapterMarker = (event: SessionEvent): boolean => {
    return (
      event.event_type === 'observation' &&
      (event.obs_type === 'feature' || event.obs_type === 'decision' || event.obs_type === 'bugfix')
    );
  };

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className={`relative ${className}`}>
      {/* Timeline Header */}
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-xs font-medium text-gray-500">
          Event {currentIndex + 1} of {events.length}
        </span>
        {hoveredIndex !== null && events[hoveredIndex] && (
          <span className="text-xs text-gray-600">{formatTime(events[hoveredIndex].ts)}</span>
        )}
      </div>

      {/* Timeline Track */}
      <div
        ref={timelineRef}
        className="relative h-3 bg-gray-100 rounded-full overflow-hidden cursor-pointer group"
        onClick={(e) => {
          if (!timelineRef.current) return;
          const rect = timelineRef.current.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const percentage = x / rect.width;
          const index = Math.floor(percentage * events.length);
          onSeek(Math.max(0, Math.min(index, events.length - 1)));
        }}
        onMouseMove={(e) => {
          if (!timelineRef.current) return;
          const rect = timelineRef.current.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const percentage = x / rect.width;
          const index = Math.floor(percentage * events.length);
          setHoveredIndex(Math.max(0, Math.min(index, events.length - 1)));
        }}
        onMouseLeave={() => setHoveredIndex(null)}
      >
        {/* Progress fill */}
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-200"
          style={{ width: `${((currentIndex + 1) / events.length) * 100}%` }}
        />

        {/* Event markers */}
        <div className="absolute inset-0">
          {events.map((event, index) => {
            const position = (index / events.length) * 100;
            const isChapter = isChapterMarker(event);
            const isCurrent = index === currentIndex;
            const color = getEventColor(event);

            return (
              <div
                key={`${event.event_type}-${event.row_id}`}
                className={`absolute top-0 ${isChapter ? 'h-full' : 'top-1/4 h-1/2'} w-px transition-opacity ${
                  isCurrent ? 'opacity-100' : 'opacity-60 group-hover:opacity-100'
                }`}
                style={{
                  left: `${position}%`,
                  backgroundColor: color,
                  width: isChapter ? '2px' : '1px',
                }}
                title={event.text?.substring(0, 50)}
              />
            );
          })}
        </div>

        {/* Current position indicator */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg border-2 border-indigo-600 transition-all duration-200"
          style={{ left: `${((currentIndex + 0.5) / events.length) * 100}%`, marginLeft: '-8px' }}
        />

        {/* Hover indicator */}
        {hoveredIndex !== null && hoveredIndex !== currentIndex && (
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white/80 rounded-full border border-gray-400"
            style={{ left: `${((hoveredIndex + 0.5) / events.length) * 100}%`, marginLeft: '-6px' }}
          />
        )}
      </div>

      {/* Chapter markers labels (for major events) */}
      <div className="relative mt-2 h-4">
        {events.filter(isChapterMarker).map((event, idx) => {
          const index = events.indexOf(event);
          const position = (index / events.length) * 100;

          // Only show every nth marker to avoid crowding
          if (idx % Math.ceil(events.filter(isChapterMarker).length / 8) !== 0) return null;

          return (
            <div
              key={`marker-${event.row_id}`}
              className="absolute top-0 text-xs text-gray-500 transform -translate-x-1/2 whitespace-nowrap"
              style={{ left: `${position}%` }}
            >
              <span className="inline-block w-0.5 h-2 bg-gray-400 mb-1" />
              <div className="text-[10px] font-medium">{event.obs_type}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
