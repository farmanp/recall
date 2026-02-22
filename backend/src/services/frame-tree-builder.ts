/**
 * Frame Tree Builder Service
 *
 * Builds hierarchical tree structures from flat arrays of PlaybackFrames.
 * Used to represent subagent spawning relationships where frames can have
 * parent-child relationships via parentFrameId.
 */

import { PlaybackFrame } from '../types/transcript';

/**
 * A node in the frame tree, containing a frame and its children
 */
export interface FrameTreeNode {
  frame: PlaybackFrame;
  children: FrameTreeNode[];
}

/**
 * Summary information about a subagent
 */
export interface SubagentSummary {
  agentId: string;
  description: string;
  duration: number; // ms
  tokenCount: number;
  frameCount: number;
}

/**
 * Builds a hierarchical tree structure from a flat array of PlaybackFrames.
 *
 * Frames without parentFrameId become root nodes.
 * Frames with parentFrameId become children of the referenced frame.
 *
 * @param frames - Flat array of PlaybackFrames (some may have parentFrameId set)
 * @returns Array of root FrameTreeNodes
 */
export function buildFrameTree(frames: PlaybackFrame[]): FrameTreeNode[] {
  if (!frames || frames.length === 0) {
    return [];
  }

  // Create a map of frame ID to FrameTreeNode for quick lookup
  const nodeMap = new Map<string, FrameTreeNode>();

  // First pass: create all nodes
  for (const frame of frames) {
    nodeMap.set(frame.id, {
      frame,
      children: [],
    });
  }

  // Track root nodes (frames without parentFrameId or with invalid parentFrameId)
  const rootNodes: FrameTreeNode[] = [];

  // Second pass: build parent-child relationships
  for (const frame of frames) {
    const node = nodeMap.get(frame.id);
    if (!node) continue;

    if (frame.parentFrameId) {
      const parentNode = nodeMap.get(frame.parentFrameId);
      if (parentNode) {
        // Add as child of parent
        parentNode.children.push(node);
      } else {
        // Parent not found, treat as root
        rootNodes.push(node);
      }
    } else {
      // No parent, this is a root node
      rootNodes.push(node);
    }
  }

  // Sort children by timestamp to maintain chronological order
  const sortChildrenByTimestamp = (node: FrameTreeNode): void => {
    node.children.sort((a, b) => a.frame.timestamp - b.frame.timestamp);
    for (const child of node.children) {
      sortChildrenByTimestamp(child);
    }
  };

  // Sort root nodes and all children
  rootNodes.sort((a, b) => a.frame.timestamp - b.frame.timestamp);
  for (const root of rootNodes) {
    sortChildrenByTimestamp(root);
  }

  return rootNodes;
}

/**
 * Flattens a frame tree back to a flat array using depth-first traversal.
 * Useful for sequential playback where frames need to be processed in order.
 *
 * @param tree - Array of root FrameTreeNodes
 * @returns Flat array of PlaybackFrames in depth-first order
 */
export function flattenFrameTree(tree: FrameTreeNode[]): PlaybackFrame[] {
  const result: PlaybackFrame[] = [];

  const traverse = (node: FrameTreeNode): void => {
    result.push(node.frame);
    for (const child of node.children) {
      traverse(child);
    }
  };

  for (const root of tree) {
    traverse(root);
  }

  return result;
}

/**
 * Generates summary information for each unique subagent in the tree.
 *
 * @param tree - Array of root FrameTreeNodes
 * @returns Array of SubagentSummary objects
 */
export function getSubagentSummary(tree: FrameTreeNode[]): SubagentSummary[] {
  // Map to collect frames by agentId
  const agentFrames = new Map<
    string,
    {
      frames: PlaybackFrame[];
      description: string;
    }
  >();

  const collectFrames = (node: FrameTreeNode): void => {
    const frame = node.frame;

    if (frame.isSubagent && frame.agentId) {
      const existing = agentFrames.get(frame.agentId);
      if (existing) {
        existing.frames.push(frame);
      } else {
        agentFrames.set(frame.agentId, {
          frames: [frame],
          description: frame.taskDescription || 'Unknown task',
        });
      }
    }

    for (const child of node.children) {
      collectFrames(child);
    }
  };

  // Collect all frames from the tree
  for (const root of tree) {
    collectFrames(root);
  }

  // Build summaries for each agent
  const summaries: SubagentSummary[] = [];

  for (const [agentId, data] of agentFrames) {
    const { frames, description } = data;

    // Calculate duration (from first to last frame)
    let duration = 0;
    if (frames.length > 0) {
      const sortedFrames = [...frames].sort((a, b) => a.timestamp - b.timestamp);
      const firstFrame = sortedFrames[0];
      const lastFrame = sortedFrames[sortedFrames.length - 1];
      if (firstFrame && lastFrame) {
        const firstTimestamp = firstFrame.timestamp;
        const lastTimestamp = lastFrame.timestamp + (lastFrame.duration || 0);
        duration = lastTimestamp - firstTimestamp;
      }
    }

    // Calculate total token count
    let tokenCount = 0;
    for (const frame of frames) {
      if (frame.tokenUsage) {
        tokenCount += (frame.tokenUsage.input_tokens || 0) + (frame.tokenUsage.output_tokens || 0);
      }
    }

    summaries.push({
      agentId,
      description,
      duration,
      tokenCount,
      frameCount: frames.length,
    });
  }

  // Sort by first appearance (using minimum timestamp)
  summaries.sort((a, b) => {
    const aFrames = agentFrames.get(a.agentId)?.frames || [];
    const bFrames = agentFrames.get(b.agentId)?.frames || [];
    const aMin = aFrames.length > 0 ? Math.min(...aFrames.map((f) => f.timestamp)) : 0;
    const bMin = bFrames.length > 0 ? Math.min(...bFrames.map((f) => f.timestamp)) : 0;
    return aMin - bMin;
  });

  return summaries;
}

/**
 * Finds a specific frame node in the tree by frame ID.
 *
 * @param tree - Array of root FrameTreeNodes
 * @param frameId - The ID of the frame to find
 * @returns The FrameTreeNode if found, undefined otherwise
 */
export function findFrameInTree(tree: FrameTreeNode[], frameId: string): FrameTreeNode | undefined {
  const search = (node: FrameTreeNode): FrameTreeNode | undefined => {
    if (node.frame.id === frameId) {
      return node;
    }
    for (const child of node.children) {
      const found = search(child);
      if (found) return found;
    }
    return undefined;
  };

  for (const root of tree) {
    const found = search(root);
    if (found) return found;
  }

  return undefined;
}

/**
 * Gets the depth of a frame in the tree (0 for root frames).
 *
 * @param tree - Array of root FrameTreeNodes
 * @param frameId - The ID of the frame to find depth for
 * @returns The depth level, or -1 if frame not found
 */
export function getFrameDepth(tree: FrameTreeNode[], frameId: string): number {
  const search = (node: FrameTreeNode, depth: number): number => {
    if (node.frame.id === frameId) {
      return depth;
    }
    for (const child of node.children) {
      const found = search(child, depth + 1);
      if (found >= 0) return found;
    }
    return -1;
  };

  for (const root of tree) {
    const depth = search(root, 0);
    if (depth >= 0) return depth;
  }

  return -1;
}

/**
 * Gets all ancestors of a frame (from immediate parent to root).
 *
 * @param tree - Array of root FrameTreeNodes
 * @param frameId - The ID of the frame to find ancestors for
 * @returns Array of ancestor frames, from immediate parent to root
 */
export function getAncestors(tree: FrameTreeNode[], frameId: string): PlaybackFrame[] {
  const ancestors: PlaybackFrame[] = [];

  const search = (node: FrameTreeNode, path: PlaybackFrame[]): PlaybackFrame[] | null => {
    if (node.frame.id === frameId) {
      return path;
    }
    for (const child of node.children) {
      const result = search(child, [...path, node.frame]);
      if (result) return result;
    }
    return null;
  };

  for (const root of tree) {
    const path = search(root, []);
    if (path) {
      // Return in reverse order (immediate parent first)
      return path.reverse();
    }
  }

  return ancestors;
}
