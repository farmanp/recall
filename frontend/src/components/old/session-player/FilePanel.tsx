/**
 * FilePanel Component (Phase 2)
 *
 * Shows files touched during session with aggregated counts
 * Updates as playback progresses
 */

import React from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { SessionEvent, FileTouchSummary } from '@/types';
import { aggregateFilesTouched } from '@/lib/eventHelpers';

export interface FilePanelProps {
  events: SessionEvent[];
  currentEventIndex?: number; // Filter files up to this point
}

export const FilePanel: React.FC<FilePanelProps> = ({
  events,
  currentEventIndex,
}) => {
  const parentRef = React.useRef<HTMLDivElement>(null);

  const fileSummary = React.useMemo(() => {
    return aggregateFilesTouched(events, currentEventIndex);
  }, [events, currentEventIndex]);

  const virtualizer = useVirtualizer({
    count: fileSummary.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 10,
  });

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b">
        <h3 className="text-lg font-semibold text-gray-900">
          Files Touched ({fileSummary.length})
        </h3>
        {currentEventIndex !== undefined && (
          <p className="text-xs text-gray-500 mt-1">
            Up to event {currentEventIndex + 1}
          </p>
        )}
      </div>

      {/* Virtualized File List */}
      <div ref={parentRef} className="flex-1 overflow-auto">
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const file = fileSummary[virtualRow.index];

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
                className="px-4 py-2 border-b hover:bg-gray-50 cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-mono text-gray-700 truncate flex-1">
                    {file.path}
                  </span>
                  <div className="flex items-center gap-2 text-xs text-gray-500 ml-2">
                    {file.modifies > 0 && (
                      <span
                        className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded"
                        title="Modified"
                      >
                        M {file.modifies}
                      </span>
                    )}
                    {file.reads > 0 && (
                      <span
                        className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded"
                        title="Read"
                      >
                        R {file.reads}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats Footer */}
      <div className="p-4 border-t bg-gray-50">
        <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
          <div>
            <span className="font-semibold">Total Reads:</span>{' '}
            {fileSummary.reduce((sum, f) => sum + f.reads, 0)}
          </div>
          <div>
            <span className="font-semibold">Total Modifies:</span>{' '}
            {fileSummary.reduce((sum, f) => sum + f.modifies, 0)}
          </div>
        </div>
      </div>
    </div>
  );
};
