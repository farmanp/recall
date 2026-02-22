/**
 * SubagentDetailModal Component
 *
 * Modal overlay showing detailed view of a subagent's execution including:
 * - Task description header
 * - Metrics row (duration, tokens, frame count)
 * - Mini-transcript of the subagent's frames
 * - Nested subagent display for recursive hierarchies
 *
 * Forensic terminal aesthetic matching existing modal patterns.
 */

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  X,
  Clock,
  Zap,
  Layers,
  User,
  MessageSquare,
  Brain,
  Terminal,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  GitBranch,
} from 'lucide-react';
import type { PlaybackFrame, FrameType } from '../../types/transcript';
import { formatDuration } from '../../lib/formatters';

interface SubagentDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  frames: PlaybackFrame[];
  onNavigateToFrame?: (frameIndex: number) => void;
}

/**
 * Calculate aggregate statistics for a set of frames
 */
function calculateStats(frames: PlaybackFrame[]): {
  frameCount: number;
  duration: number;
  tokens: number;
  inputTokens: number;
  outputTokens: number;
} {
  let tokens = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let minTime = Infinity;
  let maxTime = -Infinity;

  frames.forEach((frame) => {
    if (frame.tokenUsage) {
      const inp = frame.tokenUsage.input_tokens ?? 0;
      const out = frame.tokenUsage.output_tokens ?? 0;
      tokens += inp + out;
      inputTokens += inp;
      outputTokens += out;
    }

    minTime = Math.min(minTime, frame.timestamp);
    maxTime = Math.max(maxTime, frame.timestamp + (frame.duration ?? 0));
  });

  return {
    frameCount: frames.length,
    duration: frames.length > 0 ? maxTime - minTime : 0,
    tokens,
    inputTokens,
    outputTokens,
  };
}

/**
 * Format token count for display
 */
function formatTokens(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return count.toString();
}

/**
 * Get icon for frame type
 */
function getFrameIcon(type: FrameType): React.ReactNode {
  switch (type) {
    case 'user_message':
      return <User className="w-3.5 h-3.5 text-accent-cyan" />;
    case 'claude_thinking':
      return <Brain className="w-3.5 h-3.5 text-accent-purple" />;
    case 'claude_response':
      return <MessageSquare className="w-3.5 h-3.5 text-accent-green" />;
    case 'tool_execution':
      return <Terminal className="w-3.5 h-3.5 text-accent-amber" />;
    case 'context_compaction':
      return <Layers className="w-3.5 h-3.5 text-accent-red" />;
    default:
      return <GitBranch className="w-3.5 h-3.5 text-forensic-text-muted" />;
  }
}

/**
 * Get label for frame type
 */
function getFrameLabel(frame: PlaybackFrame): string {
  switch (frame.type) {
    case 'user_message':
      return frame.userMessage?.text?.slice(0, 80) || 'User message';
    case 'claude_thinking':
      return frame.thinking?.text?.slice(0, 80) || 'Thinking...';
    case 'claude_response':
      return frame.claudeResponse?.text?.slice(0, 80) || 'Response';
    case 'tool_execution':
      return frame.toolExecution?.tool || 'Tool';
    case 'context_compaction':
      return 'Context compaction';
    default:
      return frame.type;
  }
}

/**
 * Get color class for frame type
 */
function getFrameTypeColor(type: FrameType): string {
  switch (type) {
    case 'user_message':
      return 'text-accent-cyan';
    case 'claude_thinking':
      return 'text-accent-purple';
    case 'claude_response':
      return 'text-accent-green';
    case 'tool_execution':
      return 'text-accent-amber';
    case 'context_compaction':
      return 'text-accent-red';
    default:
      return 'text-forensic-text-muted';
  }
}

/**
 * Get frame content preview
 */
function getFramePreview(frame: PlaybackFrame): string {
  switch (frame.type) {
    case 'user_message':
      return frame.userMessage?.text || '';
    case 'claude_thinking':
      return frame.thinking?.text || '';
    case 'claude_response':
      return frame.claudeResponse?.text || '';
    case 'tool_execution': {
      const tool = frame.toolExecution;
      if (!tool) return '';
      const output = tool.output?.content || '';
      const input = JSON.stringify(tool.input || {});
      return `${tool.tool}: ${input.slice(0, 100)}${output ? '\n' + output.slice(0, 200) : ''}`;
    }
    default:
      return '';
  }
}

interface MiniFrameRowProps {
  frame: PlaybackFrame;
  frameIndex: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onNavigate?: () => void;
  hasNestedSubagent: boolean;
  onOpenNestedSubagent?: () => void;
}

/**
 * Mini frame row for the transcript list
 */
const MiniFrameRow: React.FC<MiniFrameRowProps> = ({
  frame,
  frameIndex,
  isExpanded,
  onToggleExpand,
  onNavigate,
  hasNestedSubagent,
  onOpenNestedSubagent,
}) => {
  const timestamp = new Date(frame.timestamp).toLocaleTimeString();
  const preview = getFramePreview(frame);
  const hasContent = preview.length > 100;

  return (
    <div className="border-b border-forensic-border/50 last:border-b-0">
      {/* Row header */}
      <div
        onClick={hasContent ? onToggleExpand : undefined}
        className={`
          flex items-center gap-2 px-3 py-2 font-mono text-xs
          ${hasContent ? 'cursor-pointer hover:bg-forensic-bg-tertiary' : ''}
          ${isExpanded ? 'bg-forensic-bg-tertiary' : ''}
        `}
      >
        {/* Expand toggle */}
        {hasContent ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            className="w-4 h-4 flex items-center justify-center text-forensic-text-muted hover:text-forensic-text-primary flex-shrink-0"
          >
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </button>
        ) : (
          <span className="w-4 flex-shrink-0" />
        )}

        {/* Frame icon */}
        <span className="flex-shrink-0">{getFrameIcon(frame.type)}</span>

        {/* Frame label */}
        <span className={`flex-1 truncate ${getFrameTypeColor(frame.type)}`}>
          {getFrameLabel(frame)}
        </span>

        {/* Nested subagent indicator */}
        {hasNestedSubagent && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenNestedSubagent?.();
            }}
            className="flex items-center gap-1 px-1.5 py-0.5 bg-accent-purple/20 text-accent-purple rounded text-[10px] uppercase tracking-wide hover:bg-accent-purple/30 transition-colors"
            title="View nested subagent"
          >
            <GitBranch className="w-3 h-3" />
            Subagent
          </button>
        )}

        {/* Timestamp */}
        <span className="text-forensic-text-muted flex-shrink-0 text-[10px]">{timestamp}</span>

        {/* Frame index */}
        <span className="text-forensic-text-muted flex-shrink-0">#{frameIndex}</span>

        {/* Navigate button */}
        {onNavigate && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNavigate();
            }}
            className="p-1 text-forensic-text-muted hover:text-accent-cyan transition-colors"
            title="Go to frame in main view"
          >
            <ExternalLink className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Expanded content */}
      {isExpanded && hasContent && (
        <div className="px-3 py-2 bg-forensic-bg-tertiary/50 border-t border-forensic-border/30">
          <pre className="font-mono text-xs text-forensic-text-secondary whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
            {preview}
          </pre>
        </div>
      )}
    </div>
  );
};

/**
 * Main SubagentDetailModal component
 */
export const SubagentDetailModal: React.FC<SubagentDetailModalProps> = ({
  isOpen,
  onClose,
  agentId,
  frames,
  onNavigateToFrame,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [expandedFrames, setExpandedFrames] = useState<Set<string>>(new Set());
  const [nestedAgentId, setNestedAgentId] = useState<string | null>(null);

  // Filter frames to only those with matching agentId
  const agentFrames = useMemo(() => {
    return frames.filter((frame) => frame.agentId === agentId);
  }, [frames, agentId]);

  // Get frame index in the original frames array
  const getOriginalFrameIndex = useCallback(
    (frame: PlaybackFrame): number => {
      return frames.findIndex((f) => f.id === frame.id);
    },
    [frames]
  );

  // Find the task description (from the first frame or parent)
  const taskDescription = useMemo(() => {
    // Look for taskDescription in our frames
    const frameWithTask = agentFrames.find((f) => f.taskDescription);
    if (frameWithTask?.taskDescription) return frameWithTask.taskDescription;

    // Fall back to finding the Task tool execution that spawned this subagent
    const spawnerFrame = frames.find(
      (f) =>
        f.type === 'tool_execution' &&
        f.toolExecution?.tool === 'Task' &&
        f.id === agentFrames[0]?.parentFrameId
    );
    if (spawnerFrame?.toolExecution?.input?.description) {
      return spawnerFrame.toolExecution.input.description as string;
    }

    return `Subagent ${agentId}`;
  }, [agentFrames, frames, agentId]);

  // Calculate stats
  const stats = useMemo(() => calculateStats(agentFrames), [agentFrames]);

  // Find nested subagent IDs (frames within this agent that have children with different agentIds)
  const nestedAgentIds = useMemo(() => {
    const nested = new Set<string>();
    const agentFrameIds = new Set(agentFrames.map((f) => f.id));

    frames.forEach((frame) => {
      if (
        frame.parentFrameId &&
        agentFrameIds.has(frame.parentFrameId) &&
        frame.agentId &&
        frame.agentId !== agentId
      ) {
        nested.add(frame.agentId);
      }
    });

    return nested;
  }, [frames, agentFrames, agentId]);

  // Check if a frame has nested subagents
  const frameHasNestedSubagent = useCallback(
    (frame: PlaybackFrame): string | null => {
      // Find any frame that is a direct child of this frame with a different agentId
      const child = frames.find(
        (f) => f.parentFrameId === frame.id && f.agentId && f.agentId !== agentId
      );
      return child?.agentId || null;
    },
    [frames, agentId]
  );

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

  // Handle navigation to frame
  const handleNavigateToFrame = useCallback(
    (frameIndex: number) => {
      onNavigateToFrame?.(frameIndex);
      onClose();
    },
    [onNavigateToFrame, onClose]
  );

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (nestedAgentId) {
          setNestedAgentId(null);
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, nestedAgentId]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setExpandedFrames(new Set());
      setNestedAgentId(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // If viewing a nested subagent, render recursively
  if (nestedAgentId) {
    return (
      <SubagentDetailModal
        isOpen={true}
        onClose={() => setNestedAgentId(null)}
        agentId={nestedAgentId}
        frames={frames}
        onNavigateToFrame={onNavigateToFrame}
      />
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="subagent-modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        data-testid="subagent-modal-backdrop"
      />

      {/* Modal */}
      <div className="relative w-full max-w-3xl mx-4 max-h-[85vh] bg-forensic-bg-secondary border border-forensic-border shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-forensic-border flex-shrink-0">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="p-2 bg-accent-purple/10 rounded-lg flex-shrink-0">
              <GitBranch className="w-5 h-5 text-accent-purple" />
            </div>
            <div className="flex-1 min-w-0">
              <h2
                id="subagent-modal-title"
                className="font-mono text-sm font-bold text-forensic-text-primary uppercase tracking-wide mb-1"
              >
                Subagent Details
              </h2>
              <p className="font-mono text-xs text-forensic-text-secondary line-clamp-2">
                {taskDescription}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-forensic-text-secondary hover:text-forensic-text-primary transition-colors flex-shrink-0"
            aria-label="Close subagent detail modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Metrics row */}
        <div className="flex items-center gap-6 px-4 py-3 bg-forensic-bg-tertiary/50 border-b border-forensic-border flex-shrink-0">
          <div className="flex items-center gap-2 font-mono text-xs">
            <Layers className="w-4 h-4 text-accent-cyan" />
            <span className="text-forensic-text-muted">Frames:</span>
            <span className="text-forensic-text-primary font-medium">{stats.frameCount}</span>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs">
            <Clock className="w-4 h-4 text-accent-green" />
            <span className="text-forensic-text-muted">Duration:</span>
            <span className="text-forensic-text-primary font-medium">
              {formatDuration(stats.duration)}
            </span>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs">
            <Zap className="w-4 h-4 text-accent-amber" />
            <span className="text-forensic-text-muted">Tokens:</span>
            <span className="text-forensic-text-primary font-medium">
              {formatTokens(stats.tokens)}
            </span>
            {stats.tokens > 0 && (
              <span className="text-forensic-text-muted">
                ({formatTokens(stats.inputTokens)} in / {formatTokens(stats.outputTokens)} out)
              </span>
            )}
          </div>

          {nestedAgentIds.size > 0 && (
            <div className="flex items-center gap-2 font-mono text-xs">
              <GitBranch className="w-4 h-4 text-accent-purple" />
              <span className="text-forensic-text-muted">Nested:</span>
              <span className="text-accent-purple font-medium">{nestedAgentIds.size}</span>
            </div>
          )}
        </div>

        {/* Mini-transcript */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto bg-forensic-bg-primary">
          {agentFrames.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <p className="font-mono text-sm text-forensic-text-muted">
                // No frames found for this subagent
              </p>
            </div>
          ) : (
            <div className="divide-y divide-forensic-border/30">
              {agentFrames.map((frame) => {
                const originalIndex = getOriginalFrameIndex(frame);
                const nestedSubagentId = frameHasNestedSubagent(frame);

                return (
                  <MiniFrameRow
                    key={frame.id}
                    frame={frame}
                    frameIndex={originalIndex}
                    isExpanded={expandedFrames.has(frame.id)}
                    onToggleExpand={() => toggleFrameExpanded(frame.id)}
                    onNavigate={
                      onNavigateToFrame ? () => handleNavigateToFrame(originalIndex) : undefined
                    }
                    hasNestedSubagent={!!nestedSubagentId}
                    onOpenNestedSubagent={
                      nestedSubagentId ? () => setNestedAgentId(nestedSubagentId) : undefined
                    }
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-forensic-border bg-forensic-bg-secondary flex-shrink-0">
          <div className="font-mono text-xs text-forensic-text-muted">
            Agent ID: <span className="text-forensic-text-secondary">{agentId}</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-forensic-bg-tertiary border border-forensic-border text-forensic-text-secondary font-mono text-sm hover:text-forensic-text-primary transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubagentDetailModal;
