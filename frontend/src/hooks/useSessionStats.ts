/**
 * Hook for computing session statistics from PlaybackFrame array
 */

import { useMemo } from 'react';
import type { PlaybackFrame, FrameType } from '../types/transcript';

/**
 * Tool usage statistics
 */
export interface ToolUsageStat {
  tool: string;
  count: number;
  errors: number;
}

/**
 * Compression statistics
 */
export interface CompressionStats {
  totalOriginalDuration: number;
  totalCompressedDuration: number;
  timeSaved: number;
  compressedFrameCount: number;
}

/**
 * Session statistics return type
 */
export interface SessionStats {
  frameCounts: Record<FrameType, number>;
  durationByType: Record<FrameType, number>;
  toolUsage: ToolUsageStat[];
  compressionStats: CompressionStats;
  totalDuration: number;
}

/**
 * Compute session statistics from PlaybackFrame array
 *
 * @param frames - Array of playback frames
 * @returns SessionStats with counts, durations, tool usage, and compression stats
 */
export function useSessionStats(frames: PlaybackFrame[]): SessionStats {
  const frameCounts = useMemo(() => {
    const counts: Record<FrameType, number> = {
      user_message: 0,
      claude_thinking: 0,
      claude_response: 0,
      tool_execution: 0,
    };

    for (const frame of frames) {
      counts[frame.type]++;
    }

    return counts;
  }, [frames]);

  const durationByType = useMemo(() => {
    const durations: Record<FrameType, number> = {
      user_message: 0,
      claude_thinking: 0,
      claude_response: 0,
      tool_execution: 0,
    };

    for (const frame of frames) {
      if (frame.duration !== undefined) {
        durations[frame.type] += frame.duration;
      }
    }

    return durations;
  }, [frames]);

  const toolUsage = useMemo(() => {
    const toolMap = new Map<string, { count: number; errors: number }>();

    for (const frame of frames) {
      if (frame.type === 'tool_execution' && frame.toolExecution) {
        const toolName = frame.toolExecution.tool;
        const existing = toolMap.get(toolName) || { count: 0, errors: 0 };
        existing.count++;
        if (frame.toolExecution.output.isError) {
          existing.errors++;
        }
        toolMap.set(toolName, existing);
      }
    }

    // Convert to array and sort by count descending
    const result: ToolUsageStat[] = [];
    for (const [tool, stats] of toolMap) {
      result.push({ tool, count: stats.count, errors: stats.errors });
    }
    result.sort((a, b) => b.count - a.count);

    return result;
  }, [frames]);

  const compressionStats = useMemo(() => {
    let totalOriginalDuration = 0;
    let totalCompressedDuration = 0;
    let compressedFrameCount = 0;

    for (const frame of frames) {
      const duration = frame.duration ?? 0;
      const originalDuration = frame.originalDuration ?? duration;

      totalCompressedDuration += duration;
      totalOriginalDuration += originalDuration;

      if (frame.isCompressed) {
        compressedFrameCount++;
      }
    }

    return {
      totalOriginalDuration,
      totalCompressedDuration,
      timeSaved: totalOriginalDuration - totalCompressedDuration,
      compressedFrameCount,
    };
  }, [frames]);

  const totalDuration = useMemo(() => {
    if (frames.length === 0) {
      return 0;
    }

    const firstTimestamp = frames[0].timestamp;
    const lastTimestamp = frames[frames.length - 1].timestamp;

    return lastTimestamp - firstTimestamp;
  }, [frames]);

  return {
    frameCounts,
    durationByType,
    toolUsage,
    compressionStats,
    totalDuration,
  };
}
