/**
 * ImpactPanel Component
 *
 * Displays drift analysis results for a session:
 * - Impact summary (files, churn, hotspot, scope)
 * - Drift findings with severity badges
 * - Blast radius visualization
 *
 * Forensic terminal aesthetic
 */

import React, { useState } from 'react';
import {
  AlertTriangle,
  Info,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  FileText,
  GitBranch,
  Layers,
  X,
  Loader2,
} from 'lucide-react';
import type { DriftAnalysisResult, DriftFinding } from '../../types/analysis';
import {
  getSeverityBadgeConfig,
  getConfidenceBadgeConfig,
  getScopeDescription,
  formatChurn,
  getCategoryDisplayName,
} from '../../types/analysis';
import { FindingCard } from './FindingCard';
import { BlastRadiusChart } from './BlastRadiusChart';

interface ImpactPanelProps {
  analysis: DriftAnalysisResult | null | undefined;
  isLoading: boolean;
  error: Error | null;
  onRefresh: () => void;
  isRefreshing?: boolean;
  onClose: () => void;
  onJumpToFrame?: (frameIndex: number) => void;
  /** Filter findings to only show these analyzer categories (if specified) */
  enabledAnalyzers?: string[];
}

/**
 * Get icon for severity
 */
function getSeverityIcon(severity: string) {
  switch (severity) {
    case 'high':
      return <AlertCircle className="w-4 h-4" />;
    case 'review':
      return <AlertTriangle className="w-4 h-4" />;
    default:
      return <Info className="w-4 h-4" />;
  }
}

export const ImpactPanel: React.FC<ImpactPanelProps> = ({
  analysis,
  isLoading,
  error,
  onRefresh,
  isRefreshing = false,
  onClose,
  onJumpToFrame,
  enabledAnalyzers,
}) => {
  const [expandAll, setExpandAll] = useState(false);
  const [expandedFindings, setExpandedFindings] = useState<Set<string>>(new Set());

  const toggleFinding = (id: string) => {
    setExpandedFindings((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleExpandAll = (findings: DriftFinding[]) => {
    if (expandAll) {
      setExpandedFindings(new Set());
    } else {
      setExpandedFindings(new Set(findings.map((f) => f.id)));
    }
    setExpandAll(!expandAll);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="bg-forensic-bg-secondary border-b border-forensic-border px-6 py-8">
        <div className="flex items-center justify-center gap-3 text-forensic-text-muted">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="font-mono text-sm">Analyzing session...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-forensic-bg-secondary border-b border-forensic-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-400">
            <AlertCircle className="w-4 h-4" />
            <span className="font-mono text-sm">Analysis failed: {error.message}</span>
          </div>
          <button
            onClick={onClose}
            className="text-forensic-text-muted hover:text-forensic-text-primary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  // No analysis yet
  if (!analysis) {
    return (
      <div className="bg-forensic-bg-secondary border-b border-forensic-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-forensic-text-muted">
            <Layers className="w-4 h-4" />
            <span className="font-mono text-sm">No analysis available</span>
          </div>
          <button
            onClick={onClose}
            className="text-forensic-text-muted hover:text-forensic-text-primary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  const { impact } = analysis;

  // Filter findings by enabled analyzers (if specified)
  const filteredFindings =
    enabledAnalyzers && enabledAnalyzers.length > 0
      ? analysis.findings.filter((f) => enabledAnalyzers.includes(f.category))
      : analysis.findings;

  // Recalculate severity counts for filtered findings
  const filteredBySeverity = filteredFindings.reduce(
    (acc, f) => {
      acc[f.severity] = (acc[f.severity] || 0) + 1;
      return acc;
    },
    { high: 0, review: 0, info: 0 } as Record<string, number>
  );

  const totalFindings = filteredFindings.length;
  const hasHighFindings = filteredBySeverity.high > 0;
  const hasReviewFindings = filteredBySeverity.review > 0;

  return (
    <div className="bg-forensic-bg-secondary border-b border-forensic-border max-h-[60vh] flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-forensic-border flex-shrink-0">
        <div className="flex items-center justify-between">
          <h3 className="font-mono text-sm text-accent-green uppercase tracking-wide flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Session Impact Analysis
            {analysis.cached && (
              <span className="text-xs text-forensic-text-muted normal-case">(cached)</span>
            )}
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-1 text-forensic-text-muted hover:text-accent-cyan transition-colors disabled:opacity-50"
              title="Refresh analysis"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="text-forensic-text-muted hover:text-forensic-text-primary transition-colors"
              title="Close impact panel (i)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 py-4 space-y-6 overflow-y-auto flex-1">
        {/* Impact Summary - "HOW BIG?" */}
        <div>
          <h4 className="font-mono text-xs text-forensic-text-muted uppercase tracking-wide mb-3">
            How Big?
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Files */}
            <div className="bg-forensic-bg-tertiary border border-forensic-border p-3">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-3 h-3 text-accent-cyan" />
                <span className="font-mono text-xs text-forensic-text-muted">Files</span>
              </div>
              <div className="font-mono text-lg text-forensic-text-primary">
                {impact.filesAffected}
              </div>
              <div className="font-mono text-xs text-forensic-text-muted">
                {impact.filesCreated} new, {impact.filesModified} modified
              </div>
            </div>

            {/* Churn */}
            <div className="bg-forensic-bg-tertiary border border-forensic-border p-3">
              <div className="flex items-center gap-2 mb-1">
                <GitBranch className="w-3 h-3 text-accent-amber" />
                <span className="font-mono text-xs text-forensic-text-muted">Churn</span>
              </div>
              <div className="font-mono text-lg text-forensic-text-primary">
                {formatChurn(impact.churn)} lines
              </div>
              <div className="font-mono text-xs text-forensic-text-muted">
                +{impact.linesAdded} -{impact.linesRemoved}
              </div>
            </div>

            {/* Hotspot */}
            <div className="bg-forensic-bg-tertiary border border-forensic-border p-3">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-3 h-3 text-accent-purple" />
                <span className="font-mono text-xs text-forensic-text-muted">Hotspot</span>
              </div>
              <div className="font-mono text-lg text-forensic-text-primary">
                {impact.hotspotIndex} edits
              </div>
              <div className="font-mono text-xs text-forensic-text-muted">to single file</div>
            </div>

            {/* Scope */}
            <div className="bg-forensic-bg-tertiary border border-forensic-border p-3">
              <div className="flex items-center gap-2 mb-1">
                <Layers className="w-3 h-3 text-accent-green" />
                <span className="font-mono text-xs text-forensic-text-muted">Scope</span>
              </div>
              <div className="font-mono text-lg text-forensic-text-primary capitalize">
                {impact.scope}
              </div>
              <div className="font-mono text-xs text-forensic-text-muted">
                {getScopeDescription(impact.scope)}
              </div>
            </div>
          </div>

          {/* New Dependencies */}
          {impact.newDependencies.length > 0 && (
            <div className="mt-3 bg-forensic-bg-tertiary border border-forensic-border p-3">
              <div className="font-mono text-xs text-forensic-text-muted uppercase mb-2">
                New Dependencies
              </div>
              <div className="flex flex-wrap gap-2">
                {impact.newDependencies.map((dep) => (
                  <span
                    key={dep}
                    className="font-mono text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded"
                  >
                    {dep}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Findings */}
        {totalFindings > 0 && (
          <div>
            {/* Disclaimer - reinforces the mental model */}
            <div className="font-mono text-xs text-forensic-text-muted mb-4 opacity-70">
              Findings are based on patterns observed in this repository.
            </div>

            <div className="flex items-center justify-between mb-3">
              <h4 className="font-mono text-xs text-forensic-text-muted uppercase tracking-wide flex items-center gap-2">
                Findings
                <span className="text-forensic-text-primary">
                  (
                  {hasHighFindings && (
                    <span className="text-red-400">{filteredBySeverity.high} high</span>
                  )}
                  {hasHighFindings && hasReviewFindings && ', '}
                  {hasReviewFindings && (
                    <span className="text-amber-400">{filteredBySeverity.review} review</span>
                  )}
                  {(hasHighFindings || hasReviewFindings) && filteredBySeverity.info > 0 && ', '}
                  {filteredBySeverity.info > 0 && (
                    <span className="text-blue-400">{filteredBySeverity.info} info</span>
                  )}
                  )
                </span>
              </h4>
              <button
                onClick={() => toggleExpandAll(filteredFindings)}
                className="font-mono text-xs text-forensic-text-muted hover:text-accent-cyan transition-colors flex items-center gap-1"
              >
                {expandAll ? (
                  <>
                    <ChevronDown className="w-3 h-3" />
                    Collapse All
                  </>
                ) : (
                  <>
                    <ChevronRight className="w-3 h-3" />
                    Expand All
                  </>
                )}
              </button>
            </div>

            <div className="space-y-2">
              {filteredFindings.map((finding) => (
                <FindingCard
                  key={finding.id}
                  finding={finding}
                  isExpanded={expandedFindings.has(finding.id)}
                  onToggle={() => toggleFinding(finding.id)}
                  onJumpToFrame={onJumpToFrame}
                />
              ))}
            </div>
          </div>
        )}

        {/* No Findings */}
        {totalFindings === 0 && (
          <div className="text-center py-4">
            <div className="font-mono text-sm text-forensic-text-muted">
              No drift findings detected
            </div>
            <div className="font-mono text-xs text-forensic-text-muted mt-1">
              This session follows repository conventions
            </div>
          </div>
        )}

        {/* Blast Radius */}
        {impact.blastRadius.length > 0 && <BlastRadiusChart blastRadius={impact.blastRadius} />}
      </div>
    </div>
  );
};
