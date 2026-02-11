/**
 * SummaryCard Component
 *
 * Collapsible card showing session summary.
 * Shows: summary text, key decisions, files changed, tool usage chart
 * "Regenerate" button to refresh summary
 */

import React, { useState } from 'react';
import {
  FileText,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Lightbulb,
  FilePlus,
  FileEdit,
  FileX,
  Wrench,
  Clock,
  X,
} from 'lucide-react';
import type { SessionSummary } from '../../types/competitive';

interface SummaryCardProps {
  summary: SessionSummary | null;
  isLoading?: boolean;
  isRegenerating?: boolean;
  error?: string | null;
  onRegenerate: () => void;
  onClose?: () => void;
  defaultExpanded?: boolean;
}

export const SummaryCard: React.FC<SummaryCardProps> = ({
  summary,
  isLoading = false,
  isRegenerating = false,
  error = null,
  onRegenerate,
  onClose,
  defaultExpanded = true,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['summary', 'decisions'])
  );

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Calculate top tools for display
  const topTools = summary
    ? Object.entries(summary.toolsUsed)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
    : [];

  const maxToolUsage = topTools.length > 0 ? topTools[0][1] : 1;

  return (
    <div className="bg-forensic-bg-secondary border border-forensic-border">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-forensic-border">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-left flex-1"
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-forensic-text-muted" />
          ) : (
            <ChevronRight className="w-4 h-4 text-forensic-text-muted" />
          )}
          <FileText className="w-4 h-4 text-accent-cyan" />
          <span className="font-mono text-sm font-bold text-forensic-text-primary uppercase tracking-wide">
            Session Summary
          </span>
          {summary && (
            <span className="text-xs font-mono text-forensic-text-muted">
              ({summary.filesChanged.created.length + summary.filesChanged.modified.length} files
              changed)
            </span>
          )}
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={onRegenerate}
            disabled={isLoading || isRegenerating}
            className="flex items-center gap-1.5 px-2 py-1 text-xs font-mono text-forensic-text-secondary hover:text-accent-cyan transition-colors disabled:opacity-50"
            title="Regenerate summary"
          >
            <RefreshCw className={`w-3 h-3 ${isRegenerating ? 'animate-spin' : ''}`} />
            {isRegenerating ? 'Generating...' : 'Regenerate'}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 text-forensic-text-muted hover:text-forensic-text-primary transition-colors"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="p-4">
          {/* Loading State */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-8 h-8 border-2 border-accent-cyan border-t-transparent animate-spin rounded-full mb-3" />
              <p className="text-forensic-text-muted font-mono text-sm">Generating summary...</p>
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <div className="p-4 bg-accent-red/10 border border-accent-red/30">
              <div className="flex items-center gap-2 text-accent-red mb-2">
                <AlertCircle className="w-4 h-4" />
                <span className="font-mono text-sm font-bold">Failed to load summary</span>
              </div>
              <p className="font-mono text-xs text-forensic-text-secondary">{error}</p>
              <button
                onClick={onRegenerate}
                className="mt-3 flex items-center gap-2 px-3 py-1.5 bg-forensic-bg-tertiary border border-forensic-border text-forensic-text-secondary text-xs font-mono hover:text-forensic-text-primary transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                Try Again
              </button>
            </div>
          )}

          {/* No Summary Yet */}
          {!summary && !isLoading && !error && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <FileText className="w-10 h-10 text-forensic-text-muted mb-3" />
              <p className="text-forensic-text-secondary font-mono text-sm mb-2">
                No summary available
              </p>
              <p className="text-forensic-text-muted font-mono text-xs max-w-[300px] mb-4">
                Generate an AI summary of this session to see key decisions, files changed, and tool
                usage.
              </p>
              <button
                onClick={onRegenerate}
                className="flex items-center gap-2 px-4 py-2 bg-accent-cyan/10 border border-accent-cyan/30 text-accent-cyan text-xs font-mono hover:bg-accent-cyan/20 transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                Generate Summary
              </button>
            </div>
          )}

          {/* Summary Content */}
          {summary && !isLoading && (
            <div className="space-y-4">
              {/* Summary Text Section */}
              <div className="bg-forensic-bg-tertiary border border-forensic-border">
                <button
                  onClick={() => toggleSection('summary')}
                  className="w-full flex items-center gap-2 p-3 text-left hover:bg-forensic-bg-primary transition-colors"
                >
                  {expandedSections.has('summary') ? (
                    <ChevronDown className="w-3 h-3 text-forensic-text-muted" />
                  ) : (
                    <ChevronRight className="w-3 h-3 text-forensic-text-muted" />
                  )}
                  <FileText className="w-4 h-4 text-accent-cyan" />
                  <span className="font-mono text-xs text-forensic-text-muted uppercase tracking-wide">
                    Summary
                  </span>
                </button>
                {expandedSections.has('summary') && (
                  <div className="px-3 pb-3">
                    <p className="font-mono text-sm text-forensic-text-primary leading-relaxed">
                      {summary.summaryText}
                    </p>
                  </div>
                )}
              </div>

              {/* Key Decisions Section */}
              {summary.keyDecisions.length > 0 && (
                <div className="bg-forensic-bg-tertiary border border-forensic-border">
                  <button
                    onClick={() => toggleSection('decisions')}
                    className="w-full flex items-center gap-2 p-3 text-left hover:bg-forensic-bg-primary transition-colors"
                  >
                    {expandedSections.has('decisions') ? (
                      <ChevronDown className="w-3 h-3 text-forensic-text-muted" />
                    ) : (
                      <ChevronRight className="w-3 h-3 text-forensic-text-muted" />
                    )}
                    <Lightbulb className="w-4 h-4 text-accent-amber" />
                    <span className="font-mono text-xs text-forensic-text-muted uppercase tracking-wide">
                      Key Decisions ({summary.keyDecisions.length})
                    </span>
                  </button>
                  {expandedSections.has('decisions') && (
                    <div className="px-3 pb-3">
                      <ul className="space-y-2">
                        {summary.keyDecisions.map((decision, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <CheckCircle className="w-3 h-3 text-accent-green shrink-0 mt-1" />
                            <span className="font-mono text-xs text-forensic-text-secondary">
                              {decision}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Files Changed Section */}
              <div className="bg-forensic-bg-tertiary border border-forensic-border">
                <button
                  onClick={() => toggleSection('files')}
                  className="w-full flex items-center gap-2 p-3 text-left hover:bg-forensic-bg-primary transition-colors"
                >
                  {expandedSections.has('files') ? (
                    <ChevronDown className="w-3 h-3 text-forensic-text-muted" />
                  ) : (
                    <ChevronRight className="w-3 h-3 text-forensic-text-muted" />
                  )}
                  <FileEdit className="w-4 h-4 text-accent-purple" />
                  <span className="font-mono text-xs text-forensic-text-muted uppercase tracking-wide">
                    Files Changed
                  </span>
                  <div className="flex items-center gap-2 ml-auto text-[10px] font-mono">
                    <span className="text-accent-green">
                      +{summary.filesChanged.created.length}
                    </span>
                    <span className="text-accent-amber">
                      ~{summary.filesChanged.modified.length}
                    </span>
                    <span className="text-accent-red">-{summary.filesChanged.deleted.length}</span>
                  </div>
                </button>
                {expandedSections.has('files') && (
                  <div className="px-3 pb-3 space-y-3">
                    {summary.filesChanged.created.length > 0 && (
                      <div>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <FilePlus className="w-3 h-3 text-accent-green" />
                          <span className="font-mono text-[10px] text-accent-green uppercase">
                            Created
                          </span>
                        </div>
                        <div className="space-y-0.5">
                          {summary.filesChanged.created.map((file, idx) => (
                            <div
                              key={idx}
                              className="font-mono text-xs text-forensic-text-secondary truncate"
                            >
                              {file}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {summary.filesChanged.modified.length > 0 && (
                      <div>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <FileEdit className="w-3 h-3 text-accent-amber" />
                          <span className="font-mono text-[10px] text-accent-amber uppercase">
                            Modified
                          </span>
                        </div>
                        <div className="space-y-0.5">
                          {summary.filesChanged.modified.map((file, idx) => (
                            <div
                              key={idx}
                              className="font-mono text-xs text-forensic-text-secondary truncate"
                            >
                              {file}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {summary.filesChanged.deleted.length > 0 && (
                      <div>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <FileX className="w-3 h-3 text-accent-red" />
                          <span className="font-mono text-[10px] text-accent-red uppercase">
                            Deleted
                          </span>
                        </div>
                        <div className="space-y-0.5">
                          {summary.filesChanged.deleted.map((file, idx) => (
                            <div
                              key={idx}
                              className="font-mono text-xs text-forensic-text-secondary truncate"
                            >
                              {file}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Tool Usage Section */}
              {topTools.length > 0 && (
                <div className="bg-forensic-bg-tertiary border border-forensic-border">
                  <button
                    onClick={() => toggleSection('tools')}
                    className="w-full flex items-center gap-2 p-3 text-left hover:bg-forensic-bg-primary transition-colors"
                  >
                    {expandedSections.has('tools') ? (
                      <ChevronDown className="w-3 h-3 text-forensic-text-muted" />
                    ) : (
                      <ChevronRight className="w-3 h-3 text-forensic-text-muted" />
                    )}
                    <Wrench className="w-4 h-4 text-accent-amber" />
                    <span className="font-mono text-xs text-forensic-text-muted uppercase tracking-wide">
                      Tool Usage
                    </span>
                  </button>
                  {expandedSections.has('tools') && (
                    <div className="px-3 pb-3 space-y-2">
                      {topTools.map(([tool, count]) => (
                        <div key={tool} className="flex items-center gap-2">
                          <span className="font-mono text-xs text-accent-amber w-20 truncate">
                            {tool}
                          </span>
                          <div className="flex-1 h-2 bg-forensic-bg-primary border border-forensic-border overflow-hidden">
                            <div
                              className="h-full bg-accent-amber/50"
                              style={{ width: `${(count / maxToolUsage) * 100}%` }}
                            />
                          </div>
                          <span className="font-mono text-xs text-forensic-text-muted w-8 text-right">
                            {count}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Success Indicators & Errors */}
              <div className="flex items-center justify-between pt-2 border-t border-forensic-border">
                <div className="flex items-center gap-4">
                  {summary.successIndicators.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <CheckCircle className="w-3 h-3 text-accent-green" />
                      <span className="font-mono text-xs text-accent-green">
                        {summary.successIndicators.length} success indicators
                      </span>
                    </div>
                  )}
                  {summary.errorCount > 0 && (
                    <div className="flex items-center gap-1.5">
                      <AlertCircle className="w-3 h-3 text-accent-red" />
                      <span className="font-mono text-xs text-accent-red">
                        {summary.errorCount} errors
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-forensic-text-muted">
                  <Clock className="w-3 h-3" />
                  <span className="font-mono text-[10px]">
                    Generated {formatTimestamp(summary.generatedAt)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SummaryCard;
