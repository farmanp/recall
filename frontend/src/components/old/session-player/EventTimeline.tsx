/**
 * EventTimeline Component
 *
 * Virtualized list of session events
 * Handles 900+ events efficiently with dynamic heights
 */

import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { SessionEvent } from '@/types';
import { EventDisplay } from './EventDisplay';

export interface EventTimelineProps {
  events: SessionEvent[];
  totalEvents: number;
  currentEventIndex?: number; // Phase 2
  onLoadMore: () => void;
  onEventClick?: (eventIndex: number) => void; // Phase 2
}

export const EventTimeline: React.FC<EventTimelineProps> = ({
  events,
  totalEvents,
  currentEventIndex,
  onLoadMore,
  onEventClick,
}) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const [expandedEvents, setExpandedEvents] = React.useState<Set<number>>(new Set());

  const virtualizer = useVirtualizer({
    count: totalEvents,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      // Dynamic sizing based on expansion state
      return expandedEvents.has(index) ? 400 : 80;
    },
    overscan: 10, // More overscan for smoother scrolling
  });

  // Handle load more when scrolling near bottom
  React.useEffect(() => {
    const [lastItem] = [...virtualizer.getVirtualItems()].reverse();

    if (!lastItem) return;

    if (lastItem.index >= events.length - 1 && events.length < totalEvents) {
      onLoadMore();
    }
  }, [virtualizer.getVirtualItems(), events.length, totalEvents, onLoadMore]);

  // Phase 2: Auto-scroll to current event
  React.useEffect(() => {
    if (currentEventIndex !== undefined) {
      virtualizer.scrollToIndex(currentEventIndex, {
        align: 'center',
        behavior: 'smooth',
      });
    }
  }, [currentEventIndex, virtualizer]);

  const toggleExpand = (index: number) => {
    setExpandedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  return (
    <div
      ref={parentRef}
      className="h-full overflow-auto bg-gray-50 p-4"
      aria-label="Event timeline"
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

          if (!event) {
            // Loading placeholder
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
                <div className="animate-pulse bg-white rounded-lg p-4 h-20">
                  <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-gray-300 rounded w-1/2"></div>
                </div>
              </div>
            );
          }

          const isExpanded = expandedEvents.has(virtualRow.index);
          const isCurrent = currentEventIndex === virtualRow.index;

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
              <EventDisplay
                event={event}
                index={virtualRow.index}
                expanded={isExpanded}
                isCurrent={isCurrent}
                onToggleExpand={() => toggleExpand(virtualRow.index)}
                onClick={onEventClick ? () => onEventClick(virtualRow.index) : undefined}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
