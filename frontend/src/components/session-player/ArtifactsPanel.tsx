/**
 * ArtifactsPanel Component
 *
 * Modal overlay showing files created/modified/read during the session.
 * Provides AI code provenance tracking with cumulative or full session views.
 * Press 'a' to toggle, Escape to close.
 */

import React, { useEffect, useState, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { PlaybackFrame } from '../../types/transcript';
import type { ArtifactFilters, ArtifactSortOption, ExportFormat } from '../../types/artifacts';
import { useArtifacts, exportArtifacts } from '../../hooks/useArtifacts';
import { ArtifactSummaryBar } from './ArtifactSummaryBar';
import { ArtifactFileRow } from './ArtifactFileRow';
import { ArtifactToolbar } from './ArtifactToolbar';
import { FolderOpen } from 'lucide-react';

interface ArtifactsPanelProps {
  frames: PlaybackFrame[];
  currentFrameIndex: number;
  viewMode: 'cumulative' | 'full';
  onViewModeChange: (mode: 'cumulative' | 'full') => void;
  onClose: () => void;
  onNavigateToFrame: (frameIndex: number) => void;
}

export const ArtifactsPanel: React.FC<ArtifactsPanelProps> = ({
  frames,
  currentFrameIndex,
  viewMode,
  onViewModeChange,
  onClose,
  onNavigateToFrame,
}) => {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<ArtifactSortOption>('activity');
  const [filters, setFilters] = useState<ArtifactFilters>({
    showCreated: true,
    showModified: true,
    showReadOnly: true,
  });

  // Get artifacts from hook
  const { summary, sortedAndFiltered } = useArtifacts(frames, currentFrameIndex, viewMode);

  // Get filtered and sorted artifacts
  const displayArtifacts = useMemo(
    () => sortedAndFiltered(sortBy, filters, searchQuery),
    [sortedAndFiltered, sortBy, filters, searchQuery]
  );

  // Virtualized list container ref
  const parentRef = React.useRef<HTMLDivElement>(null);

  // Setup virtualizer for performance with large file lists
  // Dynamic row height based on expansion state
  const virtualizer = useVirtualizer({
    count: displayArtifacts.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      const artifact = displayArtifacts[index];
      if (expandedPaths.has(artifact.path)) {
        // Expanded: header (64px) + full path (48px) + operations (44px each) + summary footer (44px) + padding
        const operationsHeight = Math.max(artifact.operations.length, 1) * 44;
        return 72 + 48 + operationsHeight + 44 + 8;
      }
      return 72; // Collapsed row height with padding
    },
    overscan: 5,
  });

  // Re-measure all rows when expanded paths change
  useEffect(() => {
    virtualizer.measure();
  }, [expandedPaths]);

  // Close on Escape key (also handled in parent, but good for direct modal interactions)
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

  // Toggle file expansion
  const toggleExpand = (path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  // Handle export
  const handleExport = (format: ExportFormat) => {
    const content = exportArtifacts(displayArtifacts, format);
    const mimeTypes: Record<ExportFormat, string> = {
      json: 'application/json',
      markdown: 'text/markdown',
      csv: 'text/csv',
    };
    const extensions: Record<ExportFormat, string> = {
      json: 'json',
      markdown: 'md',
      csv: 'csv',
    };

    const blob = new Blob([content], { type: mimeTypes[format] });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `artifacts.${extensions[format]}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-gray-800 border-2 border-gray-600 rounded-lg max-w-3xl w-full max-h-[85vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <FolderOpen className="w-6 h-6 text-cyan-400" />
            <div>
              <h2 className="text-xl font-bold text-white">File Artifacts</h2>
              <p className="text-sm text-gray-400 mt-0.5">Files accessed during this session</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* View mode toggle */}
            <div className="flex bg-gray-700 rounded-lg p-1">
              <button
                onClick={() => onViewModeChange('cumulative')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  viewMode === 'cumulative'
                    ? 'bg-cyan-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Cumulative
              </button>
              <button
                onClick={() => onViewModeChange('full')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  viewMode === 'full' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                Full Session
              </button>
            </div>

            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl font-bold leading-none"
            >
              &times;
            </button>
          </div>
        </div>

        {/* Summary Bar */}
        <ArtifactSummaryBar
          summary={summary}
          currentFrameIndex={currentFrameIndex}
          totalFrames={frames.length}
          viewMode={viewMode}
        />

        {/* Toolbar */}
        <ArtifactToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          sortBy={sortBy}
          onSortChange={setSortBy}
          filters={filters}
          onFiltersChange={setFilters}
          onExport={handleExport}
        />

        {/* File List */}
        <div ref={parentRef} className="flex-1 overflow-auto p-4">
          {displayArtifacts.length === 0 ? (
            <div className="text-center py-12">
              <FolderOpen className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">
                {searchQuery ? 'No files match your search' : 'No file operations recorded yet'}
              </p>
              {viewMode === 'cumulative' && currentFrameIndex < frames.length - 1 && (
                <p className="text-gray-500 text-sm mt-2">
                  Try switching to "Full Session" to see all files
                </p>
              )}
            </div>
          ) : displayArtifacts.length <= 100 ? (
            // Simple rendering for smaller lists (no virtualization issues)
            <div className="space-y-2">
              {displayArtifacts.map((artifact) => (
                <ArtifactFileRow
                  key={artifact.path}
                  artifact={artifact}
                  isExpanded={expandedPaths.has(artifact.path)}
                  onToggleExpand={() => toggleExpand(artifact.path)}
                  onNavigateToFrame={onNavigateToFrame}
                />
              ))}
            </div>
          ) : (
            // Virtualized rendering for large lists
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const artifact = displayArtifacts[virtualRow.index];
                return (
                  <div
                    key={artifact.path}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`,
                      paddingBottom: '8px',
                    }}
                  >
                    <ArtifactFileRow
                      artifact={artifact}
                      isExpanded={expandedPaths.has(artifact.path)}
                      onToggleExpand={() => toggleExpand(artifact.path)}
                      onNavigateToFrame={onNavigateToFrame}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 flex items-center justify-between bg-gray-800/80">
          <div className="text-xs text-gray-500">
            Press <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-gray-300">a</kbd> to
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

export default ArtifactsPanel;
