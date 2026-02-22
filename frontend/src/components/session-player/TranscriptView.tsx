/**
 * TranscriptView Component
 *
 * Displays the full session as a scrollable transcript with expandable tool cards.
 * Uses windowed rendering for performance - only renders frames near the viewport.
 */

import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import type { PlaybackFrame } from '../../types/transcript';
import { TranscriptFrame } from './transcript/TranscriptFrame';
import { CompactionBoundary } from './transcript/CompactionBoundary';

interface TranscriptViewProps {
  frames: PlaybackFrame[];
  currentFrameIndex: number;
  searchQuery?: string;
  activeFrameTypes: Set<string>;
  isFrameVisible: (frame: PlaybackFrame) => boolean;
  onNavigateToFrame: (index: number) => void;
}

// How many frames to render above/below viewport
const OVERSCAN = 20; // Increased for smoother scrolling

/**
 * Heuristics for auto-collapsing frames
 * Returns true if frame should be collapsed by default
 */
function shouldAutoCollapse(frame: PlaybackFrame): boolean {
  // Long user messages (context continuations, etc.) - collapse
  if (frame.type === 'user_message' && frame.userMessage) {
    const length = frame.userMessage.text?.length ?? 0;
    return length > 800; // Higher threshold for user messages
  }

  // Always collapse thinking blocks
  if (frame.type === 'claude_thinking') return true;

  // Tool executions - context dependent
  if (frame.type === 'tool_execution' && frame.toolExecution) {
    const tool = frame.toolExecution.tool;
    const output = frame.toolExecution.output;

    // Expand errors - they need attention
    if (output?.isError) return false;

    // Expand write/edit operations - important to see the diff
    if (['Write', 'Edit', 'NotebookEdit'].includes(tool)) return false;

    // Collapse large read/grep outputs (> 10 lines)
    const lineCount = output?.content?.split('\n').length ?? 0;
    if (lineCount > 10) return true;

    // Collapse Bash commands with large output
    if (tool === 'Bash' && lineCount > 15) return true;

    // Default: collapse tool executions
    return true;
  }

  // Long AI responses (> 500 chars) - collapse
  if (frame.type === 'claude_response' && frame.claudeResponse) {
    const length = frame.claudeResponse.text?.length ?? 0;
    return length > 500;
  }

  return false;
}

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
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const lastScrollTimeRef = useRef<number>(0);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 50 });
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Initialize expanded frames based on auto-collapse heuristics
  // Frames that should NOT be auto-collapsed start expanded
  const [expandedFrames, setExpandedFrames] = useState<Set<string>>(() => {
    const expanded = new Set<string>();
    frames.forEach((frame) => {
      if (!shouldAutoCollapse(frame)) {
        expanded.add(frame.id);
      }
    });
    return expanded;
  });

  // Track if user has manually toggled any frame (disables auto-collapse for new frames)
  const [userHasToggled, setUserHasToggled] = useState(false);

  // Filter frames based on visibility
  const visibleFrames = useMemo(() => {
    return frames
      .map((frame, originalIndex) => ({ frame, originalIndex }))
      .filter(({ frame }) => isFrameVisible(frame));
  }, [frames, isFrameVisible]);

  // Toggle frame expansion
  const toggleFrameExpanded = useCallback((frameId: string) => {
    setUserHasToggled(true);
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

  // Expand all frames
  const expandAll = useCallback(() => {
    setExpandedFrames(new Set(frames.map((f) => f.id)));
  }, [frames]);

  // Collapse all frames (except short user messages)
  const collapseAll = useCallback(() => {
    const expanded = new Set<string>();
    frames.forEach((frame) => {
      // Keep short user messages expanded
      if (frame.type === 'user_message' && frame.userMessage) {
        const length = frame.userMessage.text?.length ?? 0;
        if (length <= 800) {
          expanded.add(frame.id);
        }
      }
    });
    setExpandedFrames(expanded);
  }, [frames]);

  // Count expanded vs total collapsible frames (includes long user messages now)
  const collapsibleFrames = useMemo(() => {
    return frames.filter((f) => {
      if (f.type === 'user_message' && f.userMessage) {
        return (f.userMessage.text?.length ?? 0) > 800;
      }
      return f.type !== 'user_message';
    });
  }, [frames]);

  const expandedCount = useMemo(() => {
    return collapsibleFrames.filter((f) => expandedFrames.has(f.id)).length;
  }, [collapsibleFrames, expandedFrames]);

  const allExpanded = expandedCount === collapsibleFrames.length;
  const allCollapsed = expandedCount === 0;

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

    // Throttled scroll handler with loading state
    let ticking = false;
    const handleScroll = () => {
      const now = Date.now();
      if (now - lastScrollTimeRef.current > 100) {
        setAutoScrollEnabled(false);
      }

      // Show scrolling indicator
      setIsScrolling(true);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      scrollTimeoutRef.current = setTimeout(() => {
        setIsScrolling(false);
      }, 150);

      if (!ticking) {
        requestAnimationFrame(() => {
          updateVisibleRange();
          ticking = false;
        });
        ticking = true;
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
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
    <div ref={containerRef} className="flex-1 overflow-y-auto bg-forensic-bg-primary">
      {/* Sticky header with expand/collapse controls */}
      <div className="sticky top-0 z-20 bg-forensic-bg-primary/95 backdrop-blur border-b border-forensic-border">
        <div className="max-w-4xl mx-auto px-6 py-2 flex items-center justify-between">
          <div className="font-mono text-xs text-forensic-text-muted">
            {visibleFrames.length} messages
            {expandedCount > 0 && (
              <span className="ml-2 text-accent-cyan">
                ({expandedCount}/{collapsibleFrames.length} expanded)
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={collapseAll}
              disabled={allCollapsed}
              className="flex items-center gap-1 px-2 py-1 font-mono text-xs text-forensic-text-muted hover:text-forensic-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Collapse all"
            >
              <ChevronUp className="w-3 h-3" />
              Collapse
            </button>
            <div className="w-px h-4 bg-forensic-border" />
            <button
              onClick={expandAll}
              disabled={allExpanded}
              className="flex items-center gap-1 px-2 py-1 font-mono text-xs text-forensic-text-muted hover:text-forensic-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Expand all"
            >
              <ChevronDown className="w-3 h-3" />
              Expand
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Spacer for frames above render window with loading indicator */}
        {renderStart > 0 && (
          <div style={{ height: renderStart * 100 }} className="pointer-events-none relative">
            {isScrolling && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 bg-forensic-bg-secondary border border-forensic-border rounded">
                <Loader2 className="w-3 h-3 animate-spin text-accent-cyan" />
                <span className="font-mono text-xs text-forensic-text-muted">
                  Loading {renderStart} earlier messages...
                </span>
              </div>
            )}
          </div>
        )}

        {visibleFrames.slice(renderStart, renderEnd).map(({ frame, originalIndex }) => {
          const isCurrent = originalIndex === currentFrameIndex;
          const isExpanded = expandedFrames.has(frame.id);

          // Render CompactionBoundary for context_compaction frames
          if (frame.type === 'context_compaction' && frame.compaction) {
            return (
              <div key={frame.id} ref={(el) => setFrameRef(originalIndex, el)}>
                <CompactionBoundary compaction={frame.compaction} />
              </div>
            );
          }

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

        {/* Spacer for frames below render window with loading indicator */}
        {renderEnd < visibleFrames.length && (
          <div
            style={{ height: (visibleFrames.length - renderEnd) * 100 }}
            className="pointer-events-none relative"
          >
            {isScrolling && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 bg-forensic-bg-secondary border border-forensic-border rounded">
                <Loader2 className="w-3 h-3 animate-spin text-accent-cyan" />
                <span className="font-mono text-xs text-forensic-text-muted">
                  Loading {visibleFrames.length - renderEnd} more messages...
                </span>
              </div>
            )}
          </div>
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
