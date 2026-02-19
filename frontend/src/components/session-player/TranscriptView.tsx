/**
 * TranscriptView Component
 *
 * Displays the full session as a scrollable transcript with expandable tool cards.
 * Uses windowed rendering for performance - only renders frames near the viewport.
 */

import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
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

// How many frames to render above/below viewport
const OVERSCAN = 10;

export const TranscriptView: React.FC<TranscriptViewProps> = ({
  frames,
  currentFrameIndex,
  searchQuery = '',
  activeFrameTypes,
  isFrameVisible,
  onNavigateToFrame,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const frameRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [expandedFrames, setExpandedFrames] = useState<Set<string>>(new Set());
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const lastScrollTimeRef = useRef<number>(0);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 50 });

  // Filter frames based on visibility
  const visibleFrames = useMemo(() => {
    return frames
      .map((frame, originalIndex) => ({ frame, originalIndex }))
      .filter(({ frame }) => isFrameVisible(frame));
  }, [frames, isFrameVisible]);

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

  // Track which frames are in viewport using IntersectionObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateVisibleRange = () => {
      const scrollTop = container.scrollTop;
      const viewportHeight = container.clientHeight;

      // Estimate ~120px per frame on average
      const estimatedFrameHeight = 120;
      const startIndex = Math.max(0, Math.floor(scrollTop / estimatedFrameHeight) - OVERSCAN);
      const endIndex = Math.min(
        visibleFrames.length,
        Math.ceil((scrollTop + viewportHeight) / estimatedFrameHeight) + OVERSCAN
      );

      setVisibleRange({ start: startIndex, end: endIndex });
    };

    // Initial calculation
    updateVisibleRange();

    // Throttled scroll handler
    let ticking = false;
    const handleScroll = () => {
      const now = Date.now();
      if (now - lastScrollTimeRef.current > 100) {
        setAutoScrollEnabled(false);
      }

      if (!ticking) {
        requestAnimationFrame(() => {
          updateVisibleRange();
          ticking = false;
        });
        ticking = true;
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [visibleFrames.length]);

  // Re-enable auto-scroll when frame changes programmatically
  useEffect(() => {
    setAutoScrollEnabled(true);
  }, [currentFrameIndex]);

  // Auto-scroll to current frame during playback
  useEffect(() => {
    if (!autoScrollEnabled) return;

    const frameElement = frameRefs.current.get(currentFrameIndex);
    if (frameElement) {
      lastScrollTimeRef.current = Date.now();
      frameElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentFrameIndex, autoScrollEnabled]);

  // Store ref for each frame
  const setFrameRef = useCallback((originalIndex: number, element: HTMLDivElement | null) => {
    if (element) {
      frameRefs.current.set(originalIndex, element);
    } else {
      frameRefs.current.delete(originalIndex);
    }
  }, []);

  // Ensure current frame is always in the render window
  const renderStart = Math.min(visibleRange.start, Math.max(0, currentFrameIndex - OVERSCAN));
  const renderEnd = Math.max(
    visibleRange.end,
    Math.min(visibleFrames.length, currentFrameIndex + OVERSCAN)
  );

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto px-6 py-8 bg-forensic-bg-primary">
      <div className="max-w-4xl mx-auto">
        {/* Spacer for frames above render window */}
        {renderStart > 0 && (
          <div style={{ height: renderStart * 100 }} className="pointer-events-none" />
        )}

        {visibleFrames.slice(renderStart, renderEnd).map(({ frame, originalIndex }, idx) => {
          const isCurrent = originalIndex === currentFrameIndex;
          const isExpanded = expandedFrames.has(frame.id);

          return (
            <div key={frame.id} ref={(el) => setFrameRef(originalIndex, el)}>
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

        {/* Spacer for frames below render window */}
        {renderEnd < visibleFrames.length && (
          <div
            style={{ height: (visibleFrames.length - renderEnd) * 100 }}
            className="pointer-events-none"
          />
        )}

        {visibleFrames.length === 0 && (
          <div className="text-center py-24">
            <p className="font-mono text-sm text-forensic-text-muted">
              No frames match the current filter criteria.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
