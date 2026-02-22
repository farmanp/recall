/**
 * SubagentTreeView Component
 *
 * Displays session frames as an expandable tree structure based on
 * parentFrameId relationships. Useful for visualizing subagent hierarchies
 * where Task tool invocations spawn child agents.
 *
 * Forensic terminal aesthetic with connector lines and collapsible nodes.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  User,
  MessageSquare,
  Brain,
  Terminal,
  ChevronRight,
  ChevronDown,
  Clock,
  Zap,
  GitBranch,
  Layers,
  ExternalLink,
} from 'lucide-react';
import type { PlaybackFrame, FrameType } from '../../types/transcript';
import { formatDuration } from '../../lib/formatters';
import { SubagentDetailModal } from './SubagentDetailModal';

interface SubagentTreeViewProps {
  frames: PlaybackFrame[];
  currentFrameIndex: number;
  onFrameSelect: (index: number) => void;
}

/**
 * Tree node representing a frame and its children
 */
interface TreeNode {
  frame: PlaybackFrame;
  frameIndex: number;
  children: TreeNode[];
  depth: number;
}

/**
 * Build tree structure from flat frames array using parentFrameId
 */
function buildTree(frames: PlaybackFrame[]): TreeNode[] {
  // Create index map for O(1) lookups
  const frameIndexMap = new Map<string, number>();
  frames.forEach((frame, index) => {
    frameIndexMap.set(frame.id, index);
  });

  // Create nodes for all frames
  const nodeMap = new Map<string, TreeNode>();
  frames.forEach((frame, index) => {
    nodeMap.set(frame.id, {
      frame,
      frameIndex: index,
      children: [],
      depth: 0,
    });
  });

  // Build parent-child relationships
  const rootNodes: TreeNode[] = [];

  frames.forEach((frame) => {
    const node = nodeMap.get(frame.id)!;

    if (frame.parentFrameId && nodeMap.has(frame.parentFrameId)) {
      const parentNode = nodeMap.get(frame.parentFrameId)!;
      node.depth = parentNode.depth + 1;
      parentNode.children.push(node);
    } else {
      rootNodes.push(node);
    }
  });

  // Sort children by timestamp
  const sortChildren = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => a.frame.timestamp - b.frame.timestamp);
    nodes.forEach((node) => sortChildren(node.children));
  };
  sortChildren(rootNodes);

  return rootNodes;
}

/**
 * Calculate aggregate statistics for a subtree
 */
function calculateSubtreeStats(node: TreeNode): {
  frameCount: number;
  duration: number;
  tokens: number;
} {
  let frameCount = 1;
  let tokens = 0;

  // Calculate token usage for this frame
  if (node.frame.tokenUsage) {
    tokens +=
      (node.frame.tokenUsage.input_tokens ?? 0) + (node.frame.tokenUsage.output_tokens ?? 0);
  }

  // Calculate duration from first to last frame in subtree
  let minTime = node.frame.timestamp;
  let maxTime = node.frame.timestamp + (node.frame.duration ?? 0);

  // Recursively aggregate children
  for (const child of node.children) {
    const childStats = calculateSubtreeStats(child);
    frameCount += childStats.frameCount;
    tokens += childStats.tokens;

    // Expand time range
    minTime = Math.min(minTime, child.frame.timestamp);
    maxTime = Math.max(maxTime, child.frame.timestamp + (child.frame.duration ?? 0));
  }

  return {
    frameCount,
    duration: maxTime - minTime,
    tokens,
  };
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
      return frame.userMessage?.text?.slice(0, 60) || 'User message';
    case 'claude_thinking':
      return 'Thinking...';
    case 'claude_response':
      return frame.claudeResponse?.text?.slice(0, 60) || 'Response';
    case 'tool_execution':
      return frame.toolExecution?.tool || 'Tool';
    case 'context_compaction':
      return 'Context compaction';
    default:
      return frame.type;
  }
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

interface TreeNodeComponentProps {
  node: TreeNode;
  currentFrameIndex: number;
  onFrameSelect: (index: number) => void;
  expandedNodes: Set<string>;
  onToggleExpand: (nodeId: string) => void;
  isLastChild: boolean;
  ancestorLines: boolean[];
  onSubagentClick?: (agentId: string) => void;
}

/**
 * Single tree node with connector lines
 */
const TreeNodeComponent: React.FC<TreeNodeComponentProps> = ({
  node,
  currentFrameIndex,
  onFrameSelect,
  expandedNodes,
  onToggleExpand,
  isLastChild,
  ancestorLines,
  onSubagentClick,
}) => {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedNodes.has(node.frame.id);
  const isCurrent = node.frameIndex === currentFrameIndex;
  const isSubagent = node.frame.isSubagent || hasChildren;

  // Calculate stats for nodes with children (subagents)
  const stats = useMemo(() => {
    if (!hasChildren) return null;
    return calculateSubtreeStats(node);
  }, [node, hasChildren]);

  const handleClick = () => {
    onFrameSelect(node.frameIndex);
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleExpand(node.frame.id);
  };

  return (
    <div className="select-none">
      {/* Node row */}
      <div
        onClick={handleClick}
        className={`
          group flex items-center gap-1 py-1.5 px-2 cursor-pointer
          font-mono text-xs transition-colors rounded
          ${isCurrent ? 'bg-accent-green/10 border-l-2 border-l-accent-green' : 'hover:bg-forensic-bg-tertiary'}
        `}
      >
        {/* Ancestor connector lines */}
        {ancestorLines.map((showLine, index) => (
          <span key={index} className="w-4 h-full flex-shrink-0 flex items-center justify-center">
            {showLine && <span className="w-px h-full bg-forensic-border" />}
          </span>
        ))}

        {/* Branch connector */}
        {node.depth > 0 && (
          <span className="w-4 h-full flex-shrink-0 flex items-center">
            <span
              className={`w-3 h-px ${isLastChild ? 'bg-forensic-border' : 'bg-forensic-border'}`}
            />
            {!isLastChild && (
              <span className="absolute w-px h-full bg-forensic-border" style={{ left: '7px' }} />
            )}
          </span>
        )}

        {/* Expand/collapse toggle */}
        {hasChildren ? (
          <button
            onClick={handleToggle}
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
        <span className="flex-shrink-0">{getFrameIcon(node.frame.type)}</span>

        {/* Frame label */}
        <span
          className={`
            flex-1 truncate ml-1.5
            ${isCurrent ? 'text-accent-green' : 'text-forensic-text-secondary group-hover:text-forensic-text-primary'}
          `}
        >
          {getFrameLabel(node.frame)}
        </span>

        {/* Subagent badge with details button */}
        {isSubagent && node.frame.taskDescription && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <span className="px-1.5 py-0.5 bg-accent-purple/20 text-accent-purple rounded text-[10px] uppercase tracking-wide">
              Task
            </span>
            {hasChildren && onSubagentClick && node.frame.agentId && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSubagentClick(node.frame.agentId!);
                }}
                className="p-0.5 text-accent-purple/60 hover:text-accent-purple transition-colors"
                title="View subagent details"
              >
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </div>
        )}

        {/* Frame index */}
        <span className="text-forensic-text-muted flex-shrink-0">#{node.frameIndex}</span>
      </div>

      {/* Subagent summary bar (when collapsed with children) */}
      {hasChildren && !isExpanded && stats && (
        <div className="ml-8 mb-1 flex items-center gap-3 py-1 px-2 bg-forensic-bg-tertiary/50 border-l border-forensic-border text-[10px] font-mono text-forensic-text-muted">
          <span className="flex items-center gap-1">
            <Layers className="w-3 h-3" />
            {stats.frameCount} frames
          </span>
          {stats.duration > 0 && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDuration(stats.duration)}
            </span>
          )}
          {stats.tokens > 0 && (
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3" />
              {formatTokens(stats.tokens)} tokens
            </span>
          )}
          {node.frame.taskDescription && (
            <span className="flex-1 truncate text-accent-purple/80 italic">
              {node.frame.taskDescription.slice(0, 80)}
            </span>
          )}
        </div>
      )}

      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="relative">
          {node.children.map((child, index) => (
            <TreeNodeComponent
              key={child.frame.id}
              node={child}
              currentFrameIndex={currentFrameIndex}
              onFrameSelect={onFrameSelect}
              expandedNodes={expandedNodes}
              onToggleExpand={onToggleExpand}
              isLastChild={index === node.children.length - 1}
              ancestorLines={[...ancestorLines, !isLastChild]}
              onSubagentClick={onSubagentClick}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Main SubagentTreeView component
 */
export const SubagentTreeView: React.FC<SubagentTreeViewProps> = ({
  frames,
  currentFrameIndex,
  onFrameSelect,
}) => {
  // Build tree structure
  const tree = useMemo(() => buildTree(frames), [frames]);

  // State for subagent detail modal
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  // Track expanded nodes - default to expanding first two levels
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(() => {
    const expanded = new Set<string>();
    // Expand root nodes and their immediate children by default
    tree.forEach((node) => {
      expanded.add(node.frame.id);
      node.children.forEach((child) => {
        expanded.add(child.frame.id);
      });
    });
    return expanded;
  });

  const handleToggleExpand = useCallback((nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  // Expand all nodes
  const expandAll = useCallback(() => {
    const allIds = new Set<string>();
    const collectIds = (nodes: TreeNode[]) => {
      nodes.forEach((node) => {
        allIds.add(node.frame.id);
        collectIds(node.children);
      });
    };
    collectIds(tree);
    setExpandedNodes(allIds);
  }, [tree]);

  // Collapse all nodes
  const collapseAll = useCallback(() => {
    setExpandedNodes(new Set());
  }, []);

  // Handle subagent click to open detail modal
  const handleSubagentClick = useCallback((agentId: string) => {
    setSelectedAgentId(agentId);
  }, []);

  // Count subagent frames
  const subagentCount = useMemo(() => {
    return frames.filter((f) => f.isSubagent || f.parentFrameId).length;
  }, [frames]);

  // Check if tree has any hierarchy
  const hasHierarchy = useMemo(() => {
    return tree.some((node) => node.children.length > 0);
  }, [tree]);

  return (
    <div className="flex-1 overflow-hidden flex flex-col bg-forensic-bg-primary">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-forensic-bg-primary/95 backdrop-blur border-b border-forensic-border">
        <div className="px-4 py-2 flex items-center justify-between">
          <div className="font-mono text-xs text-forensic-text-muted flex items-center gap-2">
            <GitBranch className="w-3.5 h-3.5 text-accent-purple" />
            <span>
              {frames.length} frames
              {subagentCount > 0 && (
                <span className="ml-1 text-accent-purple">({subagentCount} in subagents)</span>
              )}
            </span>
          </div>
          {hasHierarchy && (
            <div className="flex items-center gap-2">
              <button
                onClick={collapseAll}
                className="px-2 py-1 font-mono text-xs text-forensic-text-muted hover:text-forensic-text-primary transition-colors"
              >
                Collapse All
              </button>
              <div className="w-px h-4 bg-forensic-border" />
              <button
                onClick={expandAll}
                className="px-2 py-1 font-mono text-xs text-forensic-text-muted hover:text-forensic-text-primary transition-colors"
              >
                Expand All
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tree content */}
      <div className="flex-1 overflow-y-auto p-2">
        {tree.length === 0 ? (
          <div className="text-center py-12">
            <p className="font-mono text-sm text-forensic-text-muted">// No frames to display</p>
          </div>
        ) : !hasHierarchy ? (
          <div className="mb-4 px-2 py-2 bg-forensic-bg-secondary border border-forensic-border rounded">
            <p className="font-mono text-xs text-forensic-text-muted">
              // No subagent hierarchy detected. All frames are at the root level.
            </p>
          </div>
        ) : null}

        {tree.map((node, index) => (
          <TreeNodeComponent
            key={node.frame.id}
            node={node}
            currentFrameIndex={currentFrameIndex}
            onFrameSelect={onFrameSelect}
            expandedNodes={expandedNodes}
            onToggleExpand={handleToggleExpand}
            isLastChild={index === tree.length - 1}
            ancestorLines={[]}
            onSubagentClick={handleSubagentClick}
          />
        ))}
      </div>

      {/* Subagent Detail Modal */}
      {selectedAgentId && (
        <SubagentDetailModal
          isOpen={!!selectedAgentId}
          onClose={() => setSelectedAgentId(null)}
          agentId={selectedAgentId}
          frames={frames}
          onNavigateToFrame={(frameIndex) => {
            onFrameSelect(frameIndex);
            setSelectedAgentId(null);
          }}
        />
      )}
    </div>
  );
};
