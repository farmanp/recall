/**
 * SessionList Component
 *
 * Virtualized list of sessions using @tanstack/react-virtual
 * Handles 127+ sessions efficiently
 */

import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Session } from '@/types';
import { SessionCard } from './SessionCard.redesign';

export interface SessionListProps {
  sessions: Session[];
  total: number;
  onLoadMore: () => void;
  loading?: boolean;
}

export const SessionList: React.FC<SessionListProps> = ({
  sessions,
  total,
  onLoadMore,
  loading = false,
}) => {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: total,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120, // Estimated row height in pixels
    overscan: 5, // Render 5 extra rows above/below viewport
  });

  const virtualItems = React.useMemo(() => virtualizer.getVirtualItems(), [virtualizer]);

  // Handle load more when scrolling near bottom
  React.useEffect(() => {
    const [lastItem] = [...virtualItems].reverse();

    if (!lastItem) return;

    if (lastItem.index >= sessions.length - 1 && sessions.length < total && !loading) {
      onLoadMore();
    }
  }, [virtualItems, sessions.length, total, loading, onLoadMore]);

  return (
    <div
      ref={parentRef}
      className="h-screen overflow-auto bg-gray-50 p-4"
      aria-label="Session list"
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualRow) => {
          const session = sessions[virtualRow.index];

          if (!session) {
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
                className="p-2"
              >
                <div className="animate-pulse bg-white rounded-lg p-4 h-28">
                  <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-gray-300 rounded w-1/2"></div>
                </div>
              </div>
            );
          }

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
              className="p-2"
            >
              <SessionCard session={session} />
            </div>
          );
        })}
      </div>

      {loading && sessions.length < total && (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}
    </div>
  );
};
