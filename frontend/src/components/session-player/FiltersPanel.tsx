/**
 * FiltersPanel Component
 *
 * Modal overlay for frame type filters.
 * Press 'f' to toggle, Escape to close.
 */

import React, { useEffect } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import type { PlaybackFrame } from '../../types/transcript';
import { FrameTypeFilters } from './FrameTypeFilters';

type FrameType = 'user_message' | 'claude_thinking' | 'claude_response' | 'tool_execution';

interface FiltersPanelProps {
  frames: PlaybackFrame[];
  activeFrameTypes: Set<FrameType>;
  onToggleFrameType: (type: FrameType) => void;
  onToggleAll: (showAll: boolean) => void;
  availableToolNames: string[];
  activeToolNames: Set<string>;
  onToggleToolName: (toolName: string) => void;
  onToggleAllTools: (showAll: boolean) => void;
  toolFilterEnabled: boolean;
  onToolFilterEnabledChange: (enabled: boolean) => void;
  toolErrorsOnly: boolean;
  onToolErrorsOnlyChange: (enabled: boolean) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchMatchCount: number;
  currentMatchRank: number;
  onNextMatch: () => void;
  onPrevMatch: () => void;
  onClose: () => void;
}

export const FiltersPanel: React.FC<FiltersPanelProps> = ({
  frames,
  activeFrameTypes,
  onToggleFrameType,
  onToggleAll,
  availableToolNames,
  activeToolNames,
  onToggleToolName,
  onToggleAllTools,
  toolFilterEnabled,
  onToolFilterEnabledChange,
  toolErrorsOnly,
  onToolErrorsOnlyChange,
  searchQuery,
  onSearchChange,
  searchMatchCount,
  currentMatchRank,
  onNextMatch,
  onPrevMatch,
  onClose,
}) => {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-gray-800 border-2 border-gray-600 rounded-lg max-w-xl w-full max-h-[85vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <SlidersHorizontal className="w-6 h-6 text-blue-400" />
            <div>
              <h2 className="text-xl font-bold text-white">Frame Filters</h2>
              <p className="text-sm text-gray-400 mt-0.5">
                {activeFrameTypes.size}/4 frame types active
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl font-bold leading-none"
          >
            &times;
          </button>
        </div>

        {/* Content - FrameTypeFilters */}
        <div className="flex-1 overflow-y-auto p-4">
          <FrameTypeFilters
            frames={frames}
            activeFrameTypes={activeFrameTypes}
            onToggleFrameType={onToggleFrameType}
            onToggleAll={onToggleAll}
            availableToolNames={availableToolNames}
            activeToolNames={activeToolNames}
            onToggleToolName={onToggleToolName}
            onToggleAllTools={onToggleAllTools}
            toolFilterEnabled={toolFilterEnabled}
            onToolFilterEnabledChange={onToolFilterEnabledChange}
            toolErrorsOnly={toolErrorsOnly}
            onToolErrorsOnlyChange={onToolErrorsOnlyChange}
            searchQuery={searchQuery}
            onSearchChange={onSearchChange}
            searchMatchCount={searchMatchCount}
            currentMatchRank={currentMatchRank}
            onNextMatch={onNextMatch}
            onPrevMatch={onPrevMatch}
          />
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 flex items-center justify-between bg-gray-800/80">
          <div className="text-xs text-gray-500">
            Press <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-gray-300">f</kbd> to
            toggle, <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-gray-300">Esc</kbd> to
            close
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default FiltersPanel;
