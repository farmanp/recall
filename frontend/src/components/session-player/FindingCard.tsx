/**
 * FindingCard Component
 *
 * Displays a single drift finding with:
 * - Severity and confidence badges
 * - Title and description
 * - Evidence list
 * - Links to frames and repo examples
 *
 * Forensic terminal aesthetic
 */

import React from 'react';
import {
  AlertTriangle,
  Info,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  FileCode,
  ExternalLink,
  Play,
} from 'lucide-react';
import type { DriftFinding, DriftSeverity, DriftConfidence } from '../../types/analysis';
import {
  getSeverityBadgeConfig,
  getConfidenceBadgeConfig,
  getCategoryDisplayName,
} from '../../types/analysis';

interface FindingCardProps {
  finding: DriftFinding;
  isExpanded: boolean;
  onToggle: () => void;
  onJumpToFrame?: (frameIndex: number) => void;
}

/**
 * Get icon for severity
 */
function getSeverityIcon(severity: DriftSeverity) {
  switch (severity) {
    case 'high':
      return <AlertCircle className="w-4 h-4" />;
    case 'review':
      return <AlertTriangle className="w-4 h-4" />;
    default:
      return <Info className="w-4 h-4" />;
  }
}

/**
 * Severity badge
 */
function SeverityBadge({ severity }: { severity: DriftSeverity }) {
  const config = getSeverityBadgeConfig(severity);

  return (
    <span
      className={`inline-flex items-center gap-1 font-mono text-xs px-2 py-0.5 rounded border ${config.bgColor} ${config.color} ${config.borderColor}`}
    >
      {getSeverityIcon(severity)}
      {severity}
    </span>
  );
}

/**
 * Confidence badge
 */
function ConfidenceBadge({ confidence }: { confidence: DriftConfidence }) {
  const config = getConfidenceBadgeConfig(confidence);

  const baseClasses = 'font-mono text-xs px-2 py-0.5 rounded';
  const styleClasses =
    config.style === 'solid'
      ? 'bg-forensic-bg-tertiary text-forensic-text-primary border border-forensic-border'
      : config.style === 'outlined'
        ? 'bg-transparent text-forensic-text-secondary border border-forensic-border'
        : 'text-forensic-text-muted';

  return <span className={`${baseClasses} ${styleClasses}`}>confidence: {config.label}</span>;
}

export const FindingCard: React.FC<FindingCardProps> = ({
  finding,
  isExpanded,
  onToggle,
  onJumpToFrame,
}) => {
  const severityConfig = getSeverityBadgeConfig(finding.severity);

  return (
    <div
      className={`border rounded ${severityConfig.borderColor} bg-forensic-bg-tertiary overflow-hidden`}
    >
      {/* Header - always visible */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-start gap-3 text-left hover:bg-forensic-bg-secondary/50 transition-colors"
      >
        {/* Expand/collapse icon */}
        <div className="flex-shrink-0 mt-0.5">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-forensic-text-muted" />
          ) : (
            <ChevronRight className="w-4 h-4 text-forensic-text-muted" />
          )}
        </div>

        {/* Severity icon */}
        <div className={`flex-shrink-0 mt-0.5 ${severityConfig.color}`}>
          {getSeverityIcon(finding.severity)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            {/* Category badge */}
            <span className="font-mono text-xs text-forensic-text-muted uppercase">
              {getCategoryDisplayName(finding.category)}
            </span>
            <span className="text-forensic-text-muted">•</span>
            <SeverityBadge severity={finding.severity} />
            <ConfidenceBadge confidence={finding.confidence} />
          </div>

          {/* Title */}
          <div className="font-mono text-sm text-forensic-text-primary">{finding.title}</div>

          {/* Files affected preview */}
          {!isExpanded && finding.filesAffected.length > 0 && (
            <div className="font-mono text-xs text-forensic-text-muted mt-1 truncate">
              {finding.filesAffected[0].split('/').pop()}
              {finding.filesAffected.length > 1 && ` +${finding.filesAffected.length - 1} more`}
            </div>
          )}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-forensic-border/50">
          {/* Description */}
          <div className="mt-3 font-mono text-sm text-forensic-text-secondary">
            {finding.description}
          </div>

          {/* Evidence */}
          {finding.evidence.length > 0 && (
            <div className="mt-4">
              <div className="font-mono text-xs text-forensic-text-muted uppercase mb-2">
                Evidence
              </div>
              <div className="space-y-1">
                {finding.evidence.map((ev, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 font-mono text-xs text-forensic-text-secondary"
                  >
                    <FileCode className="w-3 h-3 flex-shrink-0 mt-0.5 text-forensic-text-muted" />
                    <div>
                      {ev.filePath && (
                        <span className="text-accent-cyan">{ev.filePath.split('/').pop()}</span>
                      )}
                      {ev.filePath && ev.description && (
                        <span className="text-forensic-text-muted"> — </span>
                      )}
                      <span>{ev.description}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Repo examples */}
          {finding.repoExamples && finding.repoExamples.length > 0 && (
            <div className="mt-4">
              <div className="font-mono text-xs text-forensic-text-muted uppercase mb-2">
                Similar in Repo
              </div>
              <div className="space-y-1">
                {finding.repoExamples.map((example, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 font-mono text-xs text-forensic-text-secondary"
                  >
                    <ExternalLink className="w-3 h-3 text-forensic-text-muted" />
                    <span className="text-accent-purple">{example.filePath.split('/').pop()}</span>
                    <span className="text-forensic-text-muted">—</span>
                    <span>{example.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Suggestion */}
          {finding.suggestion && (
            <div className="mt-4 p-2 bg-forensic-bg-secondary rounded border border-forensic-border">
              <div className="font-mono text-xs text-accent-green mb-1">Suggestion</div>
              <div className="font-mono text-xs text-forensic-text-secondary">
                {finding.suggestion}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="mt-4 flex items-center gap-3">
            {onJumpToFrame && (
              <button
                onClick={() => onJumpToFrame(finding.frameIndex)}
                className="flex items-center gap-1 font-mono text-xs text-accent-cyan hover:text-accent-cyan/80 transition-colors"
              >
                <Play className="w-3 h-3" />
                View Frame {finding.frameIndex}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
