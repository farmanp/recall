/**
 * ArtifactsFullPage Component
 *
 * Dedicated full-page view for deep artifact analysis.
 * Route: /session/:sessionId/artifacts
 * Full-width layout with file list, large diff viewer, and session context.
 */

import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSessionDetails, useSessionFrames } from '../hooks/useTranscriptApi';
import { useArtifacts, exportArtifacts } from '../hooks/useArtifacts';
import type { ArtifactFilters, ArtifactSortOption, ExportFormat } from '../types/artifacts';
import { ArtifactSummaryBar } from '../components/session-player/ArtifactSummaryBar';
import { ArtifactFileRow } from '../components/session-player/ArtifactFileRow';
import { ArtifactToolbar } from '../components/session-player/ArtifactToolbar';
import { AgentBadge } from '../components/AgentBadge';
import { ChevronLeft, FolderOpen, Calendar, Folder, Hash } from 'lucide-react';

export const ArtifactsFullPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  // State for artifacts display
  const [viewMode, setViewMode] = useState<'cumulative' | 'full'>('full');
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<ArtifactSortOption>('activity');
  const [filters, setFilters] = useState<ArtifactFilters>({
    showCreated: true,
    showModified: true,
    showReadOnly: true,
  });

  // Fetch session data
  const { data: sessionDetails, isLoading: loadingDetails } = useSessionDetails(sessionId);
  const { data: framesData, isLoading: loadingFrames } = useSessionFrames(sessionId, {
    offset: 0,
    limit: 1000,
  });

  const frames = useMemo(() => framesData?.frames ?? [], [framesData?.frames]);

  // Get artifacts - use full session by default for full-page view
  const currentFrameIndex = frames.length - 1;
  const { summary, sortedAndFiltered } = useArtifacts(frames, currentFrameIndex, viewMode);

  // Get filtered and sorted artifacts
  const displayArtifacts = useMemo(
    () => sortedAndFiltered(sortBy, filters, searchQuery),
    [sortedAndFiltered, sortBy, filters, searchQuery]
  );

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
    a.download = `artifacts-${sessionDetails?.slug || 'session'}.${extensions[format]}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Navigate to frame in session player
  const handleNavigateToFrame = (frameIndex: number) => {
    navigate(`/session/${sessionId}/${frameIndex}`);
  };

  // Loading state
  if (loadingDetails || loadingFrames) {
    return (
      <div className="flex items-center justify-center h-screen bg-forensic-bg-primary">
        <div className="terminal max-w-md w-full mx-4">
          <div className="terminal-header">
            <div className="terminal-dot terminal-dot-red"></div>
            <div className="terminal-dot terminal-dot-amber"></div>
            <div className="terminal-dot terminal-dot-green"></div>
          </div>
          <div className="terminal-body">
            <div className="flex items-center gap-3 font-mono text-sm">
              <span className="text-accent-green">$</span>
              <span className="text-forensic-text-primary">recall --artifacts</span>
              <div className="cursor-blink"></div>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-accent-amber border-t-transparent"></div>
              <span className="text-forensic-text-secondary font-mono text-sm">
                Loading artifacts...
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (!sessionDetails || frames.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-forensic-bg-primary">
        <div className="evidence-card max-w-md text-center" data-id="ERR-404">
          <p className="font-mono text-xl text-accent-red mb-4">Session not found</p>
          <p className="font-mono text-sm text-forensic-text-secondary mb-6">
            The requested session could not be located.
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-accent-green text-forensic-bg-primary font-mono text-sm font-semibold uppercase tracking-wider hover:bg-green-600 transition-colors"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-forensic-bg-primary text-forensic-text-primary overflow-hidden">
      {/* Header */}
      <div className="bg-forensic-bg-secondary border-b border-forensic-border px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-6">
          <button
            onClick={() => navigate(`/session/${sessionId}`)}
            className="p-2.5 hover:bg-forensic-bg-tertiary border border-forensic-border transition-all text-forensic-text-muted hover:text-accent-green group flex items-center gap-2"
            title="Back to Session Player"
          >
            <ChevronLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
            <span className="font-mono text-xs uppercase tracking-wide">Back to Session</span>
          </button>

          <div className="w-[1px] h-8 bg-forensic-border" />

          <div className="flex items-center gap-3">
            <FolderOpen className="w-6 h-6 text-accent-amber" />
            <div>
              <h1 className="font-mono text-xl font-bold text-forensic-text-primary uppercase tracking-wide">
                File Artifacts
              </h1>
              <p className="text-xs font-mono text-forensic-text-secondary mt-0.5">
                {sessionDetails.slug}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* View mode toggle */}
          <div className="flex bg-forensic-bg-tertiary p-1">
            <button
              onClick={() => setViewMode('cumulative')}
              className={`px-3 py-1.5 text-xs font-mono font-medium uppercase tracking-wide transition-colors ${
                viewMode === 'cumulative'
                  ? 'bg-accent-amber text-forensic-bg-primary'
                  : 'text-forensic-text-secondary hover:text-forensic-text-primary'
              }`}
            >
              Cumulative
            </button>
            <button
              onClick={() => setViewMode('full')}
              className={`px-3 py-1.5 text-xs font-mono font-medium uppercase tracking-wide transition-colors ${
                viewMode === 'full'
                  ? 'bg-accent-amber text-forensic-bg-primary'
                  : 'text-forensic-text-secondary hover:text-forensic-text-primary'
              }`}
            >
              Full Session
            </button>
          </div>

          {/* Session info */}
          <div className="flex items-center gap-3 px-4 py-2 bg-forensic-bg-tertiary border border-forensic-border">
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-mono text-forensic-text-muted uppercase tracking-wide">
                Files
              </span>
              <span className="text-sm font-mono font-bold text-accent-amber">
                {summary.totalFiles}
              </span>
            </div>
            <div className="w-[1px] h-6 bg-forensic-border" />
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-mono text-forensic-text-muted uppercase tracking-wide">
                Frames
              </span>
              <span className="text-sm font-mono font-bold text-accent-green">{frames.length}</span>
            </div>
            <div className="w-[1px] h-6 bg-forensic-border" />
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-mono text-forensic-text-muted uppercase tracking-wide">
                Agent
              </span>
              <div className="mt-0.5">
                <AgentBadge agent={sessionDetails.agent} />
              </div>
            </div>
          </div>
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

      {/* Main Content - Full-width file list */}
      <div className="flex-1 overflow-auto p-6 bg-forensic-bg-primary">
        <div className="max-w-6xl mx-auto">
          {displayArtifacts.length === 0 ? (
            <div className="text-center py-16">
              <FolderOpen className="w-16 h-16 text-forensic-text-muted mx-auto mb-4" />
              <p className="text-forensic-text-secondary font-mono text-lg">
                {searchQuery ? 'No files match your search' : 'No file operations recorded'}
              </p>
              <p className="text-forensic-text-muted text-sm font-mono mt-2">
                {searchQuery
                  ? 'Try a different search term'
                  : 'This session has no file read/write/edit operations'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {displayArtifacts.map((artifact) => (
                <ArtifactFileRow
                  key={artifact.path}
                  artifact={artifact}
                  isExpanded={expandedPaths.has(artifact.path)}
                  onToggleExpand={() => toggleExpand(artifact.path)}
                  onNavigateToFrame={handleNavigateToFrame}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-3 border-t border-forensic-border bg-forensic-bg-secondary flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4 text-xs font-mono text-forensic-text-muted">
          <div className="flex items-center gap-2">
            <Folder className="w-3 h-3 text-accent-amber" />
            <span>{sessionDetails.project.split('/').pop()}</span>
          </div>
          <span className="text-forensic-text-muted">//</span>
          <div className="flex items-center gap-2">
            <Calendar className="w-3 h-3" />
            <span>{new Date(sessionDetails.startedAt).toLocaleDateString()}</span>
          </div>
          <span className="text-forensic-text-muted">//</span>
          <div className="flex items-center gap-2">
            <Hash className="w-3 h-3" />
            <span>{sessionId?.slice(0, 8)}</span>
          </div>
        </div>

        <button
          onClick={() => navigate(`/session/${sessionId}`)}
          className="px-4 py-2 bg-forensic-bg-tertiary hover:bg-forensic-border border border-forensic-border text-forensic-text-primary font-mono uppercase tracking-wide text-xs transition-colors"
        >
          Back to Session
        </button>
      </div>
    </div>
  );
};

export default ArtifactsFullPage;
