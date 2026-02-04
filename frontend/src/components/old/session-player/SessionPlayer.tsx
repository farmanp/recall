/**
 * SessionPlayer Component
 *
 * Video player-style session replay with timeline, playback controls, and event feed
 * Redesigned for high-quality UX matching the video player vision
 */

import React, { useState, useEffect, useRef } from 'react';
import type { Session, SessionEvent } from '@/types';
import { TimelineVisualization } from '@/components/player/TimelineVisualization';
import { PlaybackControls } from '@/components/player/PlaybackControls';
import { EventCard } from '@/components/player/EventCard';
import { useVirtualizer } from '@tanstack/react-virtual';

export interface SessionPlayerProps {
  session: Session;
  events: SessionEvent[];
  totalEvents: number;
  onLoadMoreEvents: () => void;
}

export const SessionPlayer: React.FC<SessionPlayerProps> = ({
  session,
  events,
  totalEvents,
  onLoadMoreEvents,
}) => {
  const [currentEventIndex, setCurrentEventIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const parentRef = useRef<HTMLDivElement>(null);
  const playbackTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Virtualization for efficient event rendering
  const virtualizer = useVirtualizer({
    count: events.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 200, // Estimated event card height
    overscan: 5,
  });

  // Handle load more when scrolling near bottom
  useEffect(() => {
    const [lastItem] = [...virtualizer.getVirtualItems()].reverse();
    if (!lastItem) return;

    if (lastItem.index >= events.length - 1 && events.length < totalEvents) {
      onLoadMoreEvents();
    }
  }, [virtualizer.getVirtualItems(), events.length, totalEvents, onLoadMoreEvents]);

  // Auto-scroll to current event
  useEffect(() => {
    if (currentEventIndex < events.length) {
      virtualizer.scrollToIndex(currentEventIndex, {
        align: 'center',
        behavior: 'smooth',
      });
    }
  }, [currentEventIndex, virtualizer]);

  // Playback logic
  useEffect(() => {
    if (!isPlaying) {
      if (playbackTimerRef.current) {
        clearTimeout(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }
      return;
    }

    const currentEvent = events[currentEventIndex];
    if (!currentEvent) {
      setIsPlaying(false);
      return;
    }

    // Calculate delay based on event type
    const baseDelay = currentEvent.event_type === 'prompt' ? 3000 : 1500;
    const delay = baseDelay / speed;

    playbackTimerRef.current = setTimeout(() => {
      if (currentEventIndex < events.length - 1) {
        setCurrentEventIndex(currentEventIndex + 1);
      } else {
        setIsPlaying(false);
      }
    }, delay);

    return () => {
      if (playbackTimerRef.current) {
        clearTimeout(playbackTimerRef.current);
      }
    };
  }, [isPlaying, currentEventIndex, speed, events]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if not typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case ' ':
          e.preventDefault();
          setIsPlaying(!isPlaying);
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (currentEventIndex < events.length - 1) {
            setCurrentEventIndex(currentEventIndex + 1);
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (currentEventIndex > 0) {
            setCurrentEventIndex(currentEventIndex - 1);
          }
          break;
        case '0':
          e.preventDefault();
          setCurrentEventIndex(0);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, currentEventIndex, events.length]);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handlePrevious = () => {
    if (currentEventIndex > 0) {
      setCurrentEventIndex(currentEventIndex - 1);
      setIsPlaying(false);
    }
  };

  const handleNext = () => {
    if (currentEventIndex < events.length - 1) {
      setCurrentEventIndex(currentEventIndex + 1);
      setIsPlaying(false);
    }
  };

  const handleSpeedChange = (newSpeed: number) => {
    setSpeed(newSpeed);
  };

  const handleSeek = (index: number) => {
    setCurrentEventIndex(index);
    setIsPlaying(false);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Main Event Feed */}
      <div
        ref={parentRef}
        className="flex-1 overflow-auto px-4 py-6"
        style={{ height: 'calc(100vh - 280px)' }}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const event = events[virtualRow.index];
            if (!event) return null;

            const isActive = virtualRow.index === currentEventIndex;

            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                className="mb-3"
              >
                <EventCard event={event} isActive={isActive} number={virtualRow.index + 1} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Sticky Bottom Controls */}
      <div className="sticky bottom-0 bg-white border-t shadow-lg">
        {/* Timeline */}
        <div className="px-6 pt-4 pb-3">
          <TimelineVisualization
            events={events}
            currentIndex={currentEventIndex}
            onSeek={handleSeek}
          />
        </div>

        {/* Playback Controls */}
        <div className="px-6 pb-4">
          <PlaybackControls
            isPlaying={isPlaying}
            onPlayPause={handlePlayPause}
            onPrevious={handlePrevious}
            onNext={handleNext}
            onSpeedChange={handleSpeedChange}
            speed={speed}
            canGoPrevious={currentEventIndex > 0}
            canGoNext={currentEventIndex < events.length - 1}
          />
        </div>
      </div>
    </div>
  );
};
