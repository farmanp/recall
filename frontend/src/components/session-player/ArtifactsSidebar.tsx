/**
 * ArtifactsSidebar Component
 *
 * Split-pane sidebar version of the artifacts panel.
 * Integrates directly into SessionPlayerPage layout for side-by-side viewing.
 * Press 'a' to toggle, includes "Expand" button for full-page view.
 */

import React, { useEffect, useState, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { PlaybackFrame } from '../../types/transcript';
import type { ArtifactFilters, ArtifactSortOption, ExportFormat } from '../../types/artifacts';
import { useArtifacts, exportArtifacts } from '../../hooks/useArtifacts';
import { ArtifactSummaryBar } from './ArtifactSummaryBar';
import { ArtifactFileRow } from './ArtifactFileRow';
import { ArtifactToolbar } from './ArtifactToolbar';
import { FolderOpen, X, Maximize2 } from 'lucide-react';

interface ArtifactsSidebarProps {
  frames: PlaybackFrame[];
  currentFrameIndex: number;
  viewMode: 'cumulative' | 'full';
  onViewModeChange: (mode: 'cumulative' | 'full') => void;
  onClose: () => void;
  onNavigateToFrame: (frameIndex: number) => void;
  onExpandToFullPage: () => void;
}

export const ArtifactsSidebar: React.FC<ArtifactsSidebarProps> = ({
  frames,
  currentFrameIndex,
  viewMode,
  onViewModeChange,
  onClose,
  onNavigateToFrame,
  onExpandToFullPage,
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
  const virtualizer = useVirtualizer({
    count: displayArtifacts.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      const artifact = displayArtifacts[index];
      if (expandedPaths.has(artifact.path)) {
        const operationsHeight = Math.max(artifact.operations.length, 1) * 44;
        return 72 + 48 + operationsHeight + 44 + 8;
      }
      return 72;
    },
    overscan: 5,
  });

  // Re-measure all rows when expanded paths change
  useEffect(() => {
    virtualizer.measure();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- virtualizer is stable from useVirtualizer
  }, [expandedPaths]);

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
    <aside className="w-[500px] min-w-[400px] max-w-[700px] bg-forensic-bg-secondary border-l border-forensic-border flex flex-col overflow-hidden transition-all duration-200">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-forensic-border bg-forensic-bg-secondary shrink-0">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-5 h-5 text-accent-amber" />
          <h2 className="text-sm font-mono font-bold text-forensic-text-primary uppercase tracking-wide">
            File Artifacts
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex bg-forensic-bg-tertiary p-0.5">
            <button
              onClick={() => onViewModeChange('cumulative')}
              className={`px-2 py-1 text-[10px] font-mono font-medium uppercase tracking-wide transition-colors ${
                viewMode === 'cumulative'
                  ? 'bg-accent-amber text-forensic-bg-primary'
                  : 'text-forensic-text-secondary hover:text-forensic-text-primary'
              }`}
            >
              Cumul
            </button>
            <button
              onClick={() => onViewModeChange('full')}
              className={`px-2 py-1 text-[10px] font-mono font-medium uppercase tracking-wide transition-colors ${
                viewMode === 'full'
                  ? 'bg-accent-amber text-forensic-bg-primary'
                  : 'text-forensic-text-secondary hover:text-forensic-text-primary'
              }`}
            >
              Full
            </button>
          </div>

          {/* Expand to full page */}
          <button
            onClick={onExpandToFullPage}
            className="p-1.5 text-forensic-text-secondary hover:text-accent-cyan hover:bg-forensic-bg-tertiary transition-colors"
            title="Expand to full page"
          >
            <Maximize2 className="w-4 h-4" />
          </button>

          {/* Close */}
          <button
            onClick={onClose}
            className="p-1.5 text-forensic-text-secondary hover:text-forensic-text-primary hover:bg-forensic-bg-tertiary transition-colors"
            title="Close sidebar (a)"
          >
            <X className="w-4 h-4" />
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
      <div ref={parentRef} className="flex-1 overflow-auto p-3 bg-forensic-bg-primary">
        {displayArtifacts.length === 0 ? (
          <div className="text-center py-8">
            <FolderOpen className="w-10 h-10 text-forensic-text-muted mx-auto mb-3" />
            <p className="text-forensic-text-secondary font-mono text-sm">
              {searchQuery ? 'No files match your search' : 'No file operations yet'}
            </p>
            {viewMode === 'cumulative' && currentFrameIndex < frames.length - 1 && (
              <p className="text-forensic-text-muted text-xs font-mono mt-2">
                Try "Full" mode to see all files
              </p>
            )}
          </div>
        ) : displayArtifacts.length <= 100 ? (
          // Simple rendering for smaller lists
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

      {/* Footer hint */}
      <div className="p-2 border-t border-forensic-border bg-forensic-bg-secondary shrink-0">
        <div className="text-[10px] font-mono text-forensic-text-muted text-center">
          Press{' '}
          <kbd className="px-1 py-0.5 bg-forensic-bg-tertiary border border-forensic-border text-forensic-text-secondary">
            a
          </kbd>{' '}
          to toggle
        </div>
      </div>
    </aside>
  );
};

export default ArtifactsSidebar;
