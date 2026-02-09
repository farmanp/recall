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
  availableToolNames?: string[];
  activeToolNames?: Set<string>;
  onToggleToolName?: (toolName: string) => void;
  onToggleAllTools?: (showAll: boolean) => void;
  toolFilterEnabled?: boolean;
  onToolFilterEnabledChange?: (enabled: boolean) => void;
  toolErrorsOnly?: boolean;
  onToolErrorsOnlyChange?: (enabled: boolean) => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  searchMatchCount?: number;
  currentMatchRank?: number; // 0-indexed rank of current match
  onNextMatch?: () => void;
  onPrevMatch?: () => void;
}

export const FrameTypeFilters: React.FC<FrameTypeFiltersProps> = ({
  frames,
  activeFrameTypes,
  onToggleFrameType,
  onToggleAll,
  availableToolNames = [],
  activeToolNames = new Set<string>(),
  onToggleToolName,
  onToggleAllTools,
  toolFilterEnabled = false,
  onToolFilterEnabledChange,
  toolErrorsOnly = false,
  onToolErrorsOnlyChange,
  searchQuery = '',
  onSearchChange,
  searchMatchCount = 0,
  currentMatchRank = -1,
  onNextMatch,
  onPrevMatch,
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
  const activeFilterCount = activeFrameTypes.size;
  const allToolsActive =
    availableToolNames.length > 0 && activeToolNames.size === availableToolNames.length;

  // Frame type metadata (agent-agnostic labels)
  const frameTypeMetadata: Record<FrameType, { label: string; icon: string; color: string }> = {
    user_message: {
      label: 'User Messages',
      icon: '👤',
      color: 'text-blue-400',
    },
    claude_response: {
      label: 'AI Responses',
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
    <div className="rounded-xl border border-white/10 bg-gray-900/75 p-3">
      <div>
        {/* Search Input */}
        {onSearchChange && (
          <div className="mb-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Search frames... (n/p to navigate)"
                  className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded text-sm text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => onSearchChange('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                    title="Clear search"
                  >
                    ×
                  </button>
                )}
              </div>
              {searchQuery && (
                <>
                  <span className="text-sm text-gray-300 whitespace-nowrap min-w-[110px] text-center">
                    {searchMatchCount > 0 ? (
                      <>
                        <span className="text-white font-bold">{currentMatchRank + 1}</span>
                        <span className="mx-1">/</span>
                        <span>{searchMatchCount} matches</span>
                      </>
                    ) : (
                      'No matches'
                    )}
                  </span>
                  {searchMatchCount > 0 && (
                    <div className="flex bg-gray-700 rounded overflow-hidden border border-gray-600">
                      <button
                        onClick={onPrevMatch}
                        className="px-3 py-1 hover:bg-gray-600 transition-colors border-r border-gray-600"
                        title="Previous match (p)"
                      >
                        ↑
                      </button>
                      <button
                        onClick={onNextMatch}
                        className="px-3 py-1 hover:bg-gray-600 transition-colors"
                        title="Next match (n)"
                      >
                        ↓
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Header with All Toggle */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold tracking-wide text-gray-200">FRAME TYPES</span>
            <span className="text-xs text-gray-300">{activeFilterCount}/4 active</span>
            {activeFilterCount < 4 && (
              <button
                onClick={() => onToggleAll(true)}
                className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-100"
                title="Reset frame filters"
              >
                Reset filters
              </button>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={allActive}
              onChange={(e) => onToggleAll(e.target.checked)}
              className="rounded"
            />
            <span className="text-gray-200">All</span>
          </label>
        </div>

        {/* Vertical Hierarchical Filters */}
        <div className="rounded-lg border border-gray-700 bg-gray-950/70 p-3">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold tracking-wide text-gray-200">HIERARCHY</h3>
            <span className="text-xs text-gray-400">Parent and child filters</span>
          </div>

          <div className="space-y-2">
            {(Object.keys(frameTypeMetadata) as FrameType[]).map((type) => {
              const metadata = frameTypeMetadata[type];
              const count = frameTypeCounts[type];
              const isActive = activeFrameTypes.has(type);
              const isToolType = type === 'tool_execution';

              return (
                <div key={type} className="rounded border border-gray-700 bg-gray-800/50 p-2.5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={() => onToggleFrameType(type)}
                      className="rounded"
                    />
                    <span className={`text-base ${metadata.color}`}>{metadata.icon}</span>
                    <span className="text-sm text-gray-100">{metadata.label}</span>
                    <span className="text-xs text-gray-400">({count})</span>
                  </label>

                  {isToolType && onToolFilterEnabledChange && onToolErrorsOnlyChange && (
                    <div className="mt-3 ml-4 border-l border-gray-700 pl-3 space-y-3">
                      <label
                        className={`flex items-center gap-2 text-sm cursor-pointer ${isActive ? 'text-gray-200' : 'text-gray-500'}`}
                      >
                        <input
                          type="checkbox"
                          checked={toolFilterEnabled}
                          onChange={(e) => onToolFilterEnabledChange(e.target.checked)}
                          className="rounded"
                          disabled={!isActive}
                        />
                        Child: Enable tool subfilters
                      </label>

                      <label
                        className={`flex items-center gap-2 text-sm cursor-pointer ${isActive && toolFilterEnabled ? 'text-gray-200' : 'text-gray-500'}`}
                      >
                        <input
                          type="checkbox"
                          checked={toolErrorsOnly}
                          onChange={(e) => onToolErrorsOnlyChange(e.target.checked)}
                          className="rounded"
                          disabled={!isActive || !toolFilterEnabled}
                        />
                        Grandchild: Errors only
                      </label>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-xs uppercase tracking-wide ${isActive && toolFilterEnabled ? 'text-gray-300' : 'text-gray-500'}`}
                          >
                            Grandchild: By tool name
                          </span>
                          {onToggleAllTools && (
                            <button
                              onClick={() => onToggleAllTools(!allToolsActive)}
                              className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-100 disabled:opacity-50"
                              title={allToolsActive ? 'Deselect all tools' : 'Select all tools'}
                              disabled={!isActive || !toolFilterEnabled}
                            >
                              {allToolsActive ? 'Deselect all' : 'Select all'}
                            </button>
                          )}
                        </div>

                        {availableToolNames.length > 0 ? (
                          <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                            {availableToolNames.map((toolName) => (
                              <label
                                key={toolName}
                                className={`flex items-center gap-2 text-sm cursor-pointer bg-gray-800/60 border border-gray-700 rounded px-2 py-1.5 ${
                                  isActive && toolFilterEnabled ? 'text-gray-200' : 'text-gray-500'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={activeToolNames.has(toolName)}
                                  onChange={() => onToggleToolName?.(toolName)}
                                  className="rounded"
                                  disabled={!isActive || !toolFilterEnabled}
                                />
                                <span className="font-mono text-xs">{toolName}</span>
                              </label>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500">
                            No tool executions in this session.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
