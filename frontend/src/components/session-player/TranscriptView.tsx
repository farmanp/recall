/**
 * TranscriptView Component
 *
 * Displays the full session as a scrollable transcript with expandable tool cards.
 * Unlike ChatView which animates frames up to currentFrameIndex, this shows ALL frames
 * with the current frame highlighted during playback.
 */

import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { PlaybackFrame } from '../../types/transcript';
import { TranscriptFrame } from './transcript/TranscriptFrame';

interface TranscriptViewProps {
  frames: PlaybackFrame[];
  currentFrameIndex: number;
  searchQuery?: string;
  activeFrameTypes: Set<string>;
  isFrameVisible: (frame: PlaybackFrame) => boolean;
  onNavigateToFrame: (index: number) => void;
}

export const TranscriptView: React.FC<TranscriptViewProps> = ({
  frames,
  currentFrameIndex,
  searchQuery = '',
  activeFrameTypes,
  isFrameVisible,
  onNavigateToFrame,
}) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const [expandedFrames, setExpandedFrames] = useState<Set<string>>(new Set());
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const lastScrollTimeRef = useRef<number>(0);

  // Filter frames based on visibility
  const visibleFrames = useMemo(() => {
    return frames
      .map((frame, originalIndex) => ({ frame, originalIndex }))
      .filter(({ frame }) => isFrameVisible(frame));
  }, [frames, isFrameVisible]);

  // Find the visible index of the current frame
  const currentVisibleIndex = useMemo(() => {
    return visibleFrames.findIndex(({ originalIndex }) => originalIndex === currentFrameIndex);
  }, [visibleFrames, currentFrameIndex]);

  // Virtual list for performance
  const virtualizer = useVirtualizer({
    count: visibleFrames.length,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback(
      (index: number) => {
        const { frame } = visibleFrames[index];
        const frameId = frame.id;
        const isExpanded = expandedFrames.has(frameId);

        // Base height varies by frame type
        let baseHeight = 120; // Default for messages

        if (frame.type === 'tool_execution') {
          baseHeight = isExpanded ? 400 : 80; // Tool cards are taller when expanded
        } else if (frame.type === 'claude_thinking') {
          baseHeight = isExpanded ? 300 : 100;
        }

        return baseHeight;
      },
      [visibleFrames, expandedFrames]
    ),
    overscan: 5,
  });

  // Toggle frame expansion
  const toggleFrameExpanded = useCallback((frameId: string) => {
    setExpandedFrames((prev) => {
      const next = new Set(prev);
      if (next.has(frameId)) {
        next.delete(frameId);
      } else {
        next.add(frameId);
      }
      return next;
    });
  }, []);

  // Detect manual scrolling to disable auto-scroll
  useEffect(() => {
    const container = parentRef.current;
    if (!container) return;

    const handleScroll = () => {
      const now = Date.now();
      // If user scrolls manually, disable auto-scroll temporarily
      if (now - lastScrollTimeRef.current > 100) {
        setAutoScrollEnabled(false);
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Re-enable auto-scroll when frame changes programmatically
  useEffect(() => {
    setAutoScrollEnabled(true);
  }, [currentFrameIndex]);

  // Auto-scroll to current frame during playback
  useEffect(() => {
    if (currentVisibleIndex >= 0 && autoScrollEnabled) {
      lastScrollTimeRef.current = Date.now();
      virtualizer.scrollToIndex(currentVisibleIndex, {
        align: 'center',
        behavior: 'smooth',
      });
    }
  }, [currentVisibleIndex, virtualizer, autoScrollEnabled]);

  // Re-measure when expansion state changes
  useEffect(() => {
    virtualizer.measure();
  }, [expandedFrames, virtualizer]);

  return (
    <div ref={parentRef} className="flex-1 overflow-y-auto px-6 py-8 bg-forensic-bg-primary">
      <div
        className="max-w-4xl mx-auto relative"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const { frame, originalIndex } = visibleFrames[virtualRow.index];
          const isCurrent = originalIndex === currentFrameIndex;
          const isExpanded = expandedFrames.has(frame.id);

          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              className="absolute top-0 left-0 w-full"
              style={{
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <TranscriptFrame
                frame={frame}
                frameIndex={originalIndex}
                isCurrent={isCurrent}
                isExpanded={isExpanded}
                onToggleExpand={() => toggleFrameExpanded(frame.id)}
                onNavigateToFrame={onNavigateToFrame}
                searchQuery={searchQuery}
              />
            </div>
          );
        })}
      </div>

      {visibleFrames.length === 0 && (
        <div className="text-center py-24">
          <p className="font-mono text-sm text-forensic-text-muted">
            No frames match the current filter criteria.
          </p>
        </div>
      )}
    </div>
  );
};
