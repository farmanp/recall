/**
 * FrameTypeFilters Component
 *
 * Checkboxes to show/hide specific frame types with playback-aware navigation
 */

import React, { useMemo } from 'react';
import type { PlaybackFrame } from '../../types/transcript';

type FrameType = 'user_message' | 'claude_thinking' | 'claude_response' | 'tool_execution';

interface FrameTypeFiltersProps {
  frames: PlaybackFrame[];
  activeFrameTypes: Set<FrameType>;
  onToggleFrameType: (type: FrameType) => void;
  onToggleAll: (showAll: boolean) => void;
}

export const FrameTypeFilters: React.FC<FrameTypeFiltersProps> = ({
  frames,
  activeFrameTypes,
  onToggleFrameType,
  onToggleAll,
}) => {
  // Calculate frame type counts
  const frameTypeCounts = useMemo(() => {
    const counts: Record<FrameType, number> = {
      user_message: 0,
      claude_response: 0,
      tool_execution: 0,
      claude_thinking: 0,
    };

    frames.forEach((f) => {
      const type = f.type as FrameType;
      if (type in counts) {
        counts[type]++;
      }
    });

    return counts;
  }, [frames]);

  // Check if all types are active
  const allActive = activeFrameTypes.size === 4;

  // Frame type metadata
  const frameTypeMetadata: Record<
    FrameType,
    { label: string; icon: string; color: string }
  > = {
    user_message: {
      label: 'User Messages',
      icon: '👤',
      color: 'text-blue-400',
    },
    claude_response: {
      label: 'Claude Responses',
      icon: '🤖',
      color: 'text-green-400',
    },
    tool_execution: {
      label: 'Tool Executions',
      icon: '🛠️',
      color: 'text-orange-400',
    },
    claude_thinking: {
      label: 'Thinking',
      icon: '🧠',
      color: 'text-purple-400',
    },
  };

  return (
    <div className="bg-gray-800 border-b border-gray-700 px-6 py-3">
      <div className="max-w-4xl mx-auto">
        {/* Header with All Toggle */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-gray-300">FRAME TYPES</span>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={allActive}
              onChange={(e) => onToggleAll(e.target.checked)}
              className="rounded"
            />
            <span className="text-gray-300">All</span>
          </label>
        </div>

        {/* Filter Checkboxes Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(Object.keys(frameTypeMetadata) as FrameType[]).map((type) => {
            const metadata = frameTypeMetadata[type];
            const count = frameTypeCounts[type];
            const isActive = activeFrameTypes.has(type);

            return (
              <label
                key={type}
                className={`flex items-center gap-2 px-3 py-2 rounded border transition-all cursor-pointer ${
                  isActive
                    ? 'bg-gray-700 border-gray-600'
                    : 'bg-gray-900 border-gray-800 opacity-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={() => onToggleFrameType(type)}
                  className="rounded"
                />
                <span className={`text-lg ${metadata.color}`}>{metadata.icon}</span>
                <div className="flex-1">
                  <div className="text-xs text-gray-300">{metadata.label}</div>
                  <div className="text-xs text-gray-500">({count})</div>
                </div>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/**
 * Helper: Find next visible frame index
 * Used by SessionPlayerPage for Prev/Next navigation
 */
export function findNextVisibleFrame(
  startIndex: number,
  frames: PlaybackFrame[],
  activeTypes: Set<string>
): number {
  for (let i = startIndex; i < frames.length; i++) {
    if (activeTypes.has(frames[i].type)) {
      return i;
    }
  }
  // If no visible frame found, return last frame
  return frames.length - 1;
}

/**
 * Helper: Find previous visible frame index
 * Used by SessionPlayerPage for Prev/Next navigation
 */
export function findPrevVisibleFrame(
  startIndex: number,
  frames: PlaybackFrame[],
  activeTypes: Set<string>
): number {
  for (let i = startIndex; i >= 0; i--) {
    if (activeTypes.has(frames[i].type)) {
      return i;
    }
  }
  // If no visible frame found, return first frame
  return 0;
}
