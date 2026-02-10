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
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-forensic-bg-secondary border border-forensic-border max-w-xl w-full max-h-[85vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-forensic-border">
          <div className="flex items-center gap-3">
            <SlidersHorizontal className="w-6 h-6 text-accent-purple" />
            <div>
              <h2 className="text-xl font-mono font-bold text-forensic-text-primary uppercase tracking-wide">
                Frame Filters
              </h2>
              <p className="text-sm font-mono text-forensic-text-secondary mt-0.5">
                {activeFrameTypes.size}/4 frame types active
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-forensic-text-secondary hover:text-forensic-text-primary text-2xl font-bold leading-none"
          >
            &times;
          </button>
        </div>

        {/* Content - FrameTypeFilters */}
        <div className="flex-1 overflow-y-auto p-4 bg-forensic-bg-primary">
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
        <div className="p-4 border-t border-forensic-border flex items-center justify-between bg-forensic-bg-secondary">
          <div className="text-xs font-mono text-forensic-text-muted">
            Press{' '}
            <kbd className="px-1.5 py-0.5 bg-forensic-bg-tertiary border border-forensic-border text-forensic-text-secondary">
              f
            </kbd>{' '}
            to toggle,{' '}
            <kbd className="px-1.5 py-0.5 bg-forensic-bg-tertiary border border-forensic-border text-forensic-text-secondary">
              Esc
            </kbd>{' '}
            to close
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-forensic-bg-tertiary hover:bg-forensic-border border border-forensic-border text-forensic-text-primary font-mono uppercase tracking-wide text-sm transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default FiltersPanel;
