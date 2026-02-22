/**
 * FrameTypeFilters Component
 *
 * Checkboxes to show/hide specific frame types with playback-aware navigation
 */

import React, { useMemo } from 'react';
import type { PlaybackFrame, FrameType } from '../../types/transcript';

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
      context_compaction: 0,
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
  const allActive = activeFrameTypes.size === 5;
  const activeFilterCount = activeFrameTypes.size;
  const allToolsActive =
    availableToolNames.length > 0 && activeToolNames.size === availableToolNames.length;

  // Frame type metadata (agent-agnostic labels)
  const frameTypeMetadata: Record<FrameType, { label: string; icon: string; color: string }> = {
    user_message: {
      label: 'User Messages',
      icon: '👤',
      color: 'text-accent-cyan',
    },
    claude_response: {
      label: 'AI Responses',
      icon: '🤖',
      color: 'text-accent-green',
    },
    tool_execution: {
      label: 'Tool Executions',
      icon: '🛠️',
      color: 'text-accent-amber',
    },
    claude_thinking: {
      label: 'Thinking',
      icon: '🧠',
      color: 'text-accent-purple',
    },
    context_compaction: {
      label: 'Context Compaction',
      icon: '📦',
      color: 'text-accent-amber',
    },
  };

  return (
    <div className="border border-forensic-border bg-forensic-bg-secondary p-3">
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
                  className="w-full px-3 py-2 bg-forensic-bg-primary border border-forensic-border text-sm text-forensic-text-primary font-mono placeholder-forensic-text-muted focus:outline-none focus:border-accent-green"
                />
                {searchQuery && (
                  <button
                    onClick={() => onSearchChange('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-forensic-text-muted hover:text-forensic-text-primary"
                    title="Clear search"
                  >
                    ×
                  </button>
                )}
              </div>
              {searchQuery && (
                <>
                  <span className="text-sm text-forensic-text-secondary font-mono whitespace-nowrap min-w-[110px] text-center">
                    {searchMatchCount > 0 ? (
                      <>
                        <span className="text-accent-green font-bold">{currentMatchRank + 1}</span>
                        <span className="mx-1 text-forensic-text-muted">/</span>
                        <span>{searchMatchCount} matches</span>
                      </>
                    ) : (
                      'No matches'
                    )}
                  </span>
                  {searchMatchCount > 0 && (
                    <div className="flex bg-forensic-bg-tertiary overflow-hidden border border-forensic-border">
                      <button
                        onClick={onPrevMatch}
                        className="px-3 py-1 hover:bg-forensic-border transition-colors border-r border-forensic-border text-forensic-text-secondary"
                        title="Previous match (p)"
                      >
                        ↑
                      </button>
                      <button
                        onClick={onNextMatch}
                        className="px-3 py-1 hover:bg-forensic-border transition-colors text-forensic-text-secondary"
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
            <span className="text-sm font-mono font-semibold uppercase tracking-wide text-forensic-text-primary">
              Frame Types
            </span>
            <span className="text-xs font-mono text-forensic-text-secondary">
              {activeFilterCount}/4 active
            </span>
            {activeFilterCount < 4 && (
              <button
                onClick={() => onToggleAll(true)}
                className="text-xs px-2 py-1 bg-forensic-bg-tertiary hover:bg-forensic-border border border-forensic-border text-forensic-text-secondary font-mono"
                title="Reset frame filters"
              >
                Reset filters
              </button>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm font-mono cursor-pointer">
            <input
              type="checkbox"
              checked={allActive}
              onChange={(e) => onToggleAll(e.target.checked)}
              className="accent-accent-green"
            />
            <span className="text-forensic-text-secondary">All</span>
          </label>
        </div>

        {/* Vertical Hierarchical Filters */}
        <div className="border border-forensic-border bg-forensic-bg-primary p-3">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-mono font-semibold uppercase tracking-wide text-forensic-text-primary">
              Hierarchy
            </h3>
            <span className="text-xs font-mono text-forensic-text-muted">
              Parent and child filters
            </span>
          </div>

          <div className="space-y-2">
            {(Object.keys(frameTypeMetadata) as FrameType[]).map((type) => {
              const metadata = frameTypeMetadata[type];
              const count = frameTypeCounts[type];
              const isActive = activeFrameTypes.has(type);
              const isToolType = type === 'tool_execution';

              return (
                <div
                  key={type}
                  className="border border-forensic-border bg-forensic-bg-tertiary p-2.5"
                >
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={() => onToggleFrameType(type)}
                      className="accent-accent-green"
                    />
                    <span className={`text-base ${metadata.color}`}>{metadata.icon}</span>
                    <span className="text-sm font-mono text-forensic-text-primary">
                      {metadata.label}
                    </span>
                    <span className="text-xs font-mono text-forensic-text-muted">({count})</span>
                  </label>

                  {isToolType && onToolFilterEnabledChange && onToolErrorsOnlyChange && (
                    <div className="mt-3 ml-4 border-l border-forensic-border pl-3 space-y-3">
                      <label
                        className={`flex items-center gap-2 text-sm font-mono cursor-pointer ${isActive ? 'text-forensic-text-secondary' : 'text-forensic-text-muted'}`}
                      >
                        <input
                          type="checkbox"
                          checked={toolFilterEnabled}
                          onChange={(e) => onToolFilterEnabledChange(e.target.checked)}
                          className="accent-accent-green"
                          disabled={!isActive}
                        />
                        Child: Enable tool subfilters
                      </label>

                      <label
                        className={`flex items-center gap-2 text-sm font-mono cursor-pointer ${isActive && toolFilterEnabled ? 'text-forensic-text-secondary' : 'text-forensic-text-muted'}`}
                      >
                        <input
                          type="checkbox"
                          checked={toolErrorsOnly}
                          onChange={(e) => onToolErrorsOnlyChange(e.target.checked)}
                          className="accent-accent-green"
                          disabled={!isActive || !toolFilterEnabled}
                        />
                        Grandchild: Errors only
                      </label>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-xs font-mono uppercase tracking-wide ${isActive && toolFilterEnabled ? 'text-forensic-text-secondary' : 'text-forensic-text-muted'}`}
                          >
                            Grandchild: By tool name
                          </span>
                          {onToggleAllTools && (
                            <button
                              onClick={() => onToggleAllTools(!allToolsActive)}
                              className="text-xs px-2 py-1 bg-forensic-bg-secondary hover:bg-forensic-border border border-forensic-border text-forensic-text-secondary font-mono disabled:opacity-50"
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
                                className={`flex items-center gap-2 text-sm cursor-pointer bg-forensic-bg-secondary border border-forensic-border px-2 py-1.5 ${
                                  isActive && toolFilterEnabled
                                    ? 'text-forensic-text-secondary'
                                    : 'text-forensic-text-muted'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={activeToolNames.has(toolName)}
                                  onChange={() => onToggleToolName?.(toolName)}
                                  className="accent-accent-green"
                                  disabled={!isActive || !toolFilterEnabled}
                                />
                                <span className="font-mono text-xs">{toolName}</span>
                              </label>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs font-mono text-forensic-text-muted">
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
