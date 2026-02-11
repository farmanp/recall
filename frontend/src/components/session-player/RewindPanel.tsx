/**
 * RewindPanel Component
 *
 * Shows rewind preview before execution.
 * Lists files that will be modified/created/deleted.
 * Shows conflicts if any.
 * Options: create backups (checkbox), skip conflicts (checkbox)
 * Buttons: Preview, Execute, Cancel
 */

import React, { useState } from 'react';
import {
  RotateCcw,
  X,
  FileText,
  FilePlus,
  FileX,
  FileWarning,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Archive,
  SkipForward,
} from 'lucide-react';
import type { RewindPlan, RewindFileAction, RewindConflict } from '../../types/competitive';

interface RewindPanelProps {
  sessionId: string;
  targetFrameIndex: number;
  currentFrameIndex: number;
  plan: RewindPlan | null;
  isLoadingPreview?: boolean;
  isExecuting?: boolean;
  previewError?: string | null;
  onClose: () => void;
  onPreview: () => void;
  onExecute: (options: { createBackups: boolean; skipConflicts: boolean }) => void;
}

export const RewindPanel: React.FC<RewindPanelProps> = ({
  sessionId,
  targetFrameIndex,
  currentFrameIndex,
  plan,
  isLoadingPreview = false,
  isExecuting = false,
  previewError = null,
  onClose,
  onPreview,
  onExecute,
}) => {
  const [createBackups, setCreateBackups] = useState(true);
  const [skipConflicts, setSkipConflicts] = useState(false);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  const toggleFileExpand = (path: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const getActionIcon = (action: RewindFileAction['action']) => {
    switch (action) {
      case 'create':
        return <FilePlus className="w-4 h-4 text-accent-green" />;
      case 'modify':
        return <FileText className="w-4 h-4 text-accent-amber" />;
      case 'delete':
        return <FileX className="w-4 h-4 text-accent-red" />;
      case 'skip':
        return <SkipForward className="w-4 h-4 text-forensic-text-muted" />;
      default:
        return <FileText className="w-4 h-4 text-forensic-text-muted" />;
    }
  };

  const getActionLabel = (action: RewindFileAction['action']): string => {
    switch (action) {
      case 'create':
        return 'CREATE';
      case 'modify':
        return 'MODIFY';
      case 'delete':
        return 'DELETE';
      case 'skip':
        return 'SKIP';
      default:
        // Exhaustive check - this should never happen
        const _exhaustive: never = action;
        return String(_exhaustive).toUpperCase();
    }
  };

  const getActionColor = (action: RewindFileAction['action']) => {
    switch (action) {
      case 'create':
        return 'text-accent-green';
      case 'modify':
        return 'text-accent-amber';
      case 'delete':
        return 'text-accent-red';
      case 'skip':
        return 'text-forensic-text-muted';
      default:
        return 'text-forensic-text-secondary';
    }
  };

  const fileCounts = plan
    ? {
        create: plan.files.filter((f) => f.action === 'create').length,
        modify: plan.files.filter((f) => f.action === 'modify').length,
        delete: plan.files.filter((f) => f.action === 'delete').length,
        skip: plan.files.filter((f) => f.action === 'skip').length,
      }
    : null;

  const hasConflicts = plan && plan.conflicts.length > 0;
  const hasWarnings = plan && plan.warnings.length > 0;

  return (
    <aside className="w-[500px] min-w-[400px] max-w-[600px] bg-forensic-bg-secondary border-l border-forensic-border flex flex-col overflow-hidden transition-all duration-200">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-forensic-border bg-forensic-bg-secondary shrink-0">
        <div className="flex items-center gap-2">
          <RotateCcw className="w-5 h-5 text-accent-amber" />
          <h2 className="text-sm font-mono font-bold text-forensic-text-primary uppercase tracking-wide">
            Rewind Session
          </h2>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-forensic-text-secondary hover:text-forensic-text-primary hover:bg-forensic-bg-tertiary transition-colors"
          title="Close panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Target Info */}
      <div className="px-4 py-3 bg-forensic-bg-tertiary border-b border-forensic-border">
        <div className="flex items-center justify-between font-mono text-xs">
          <div className="flex items-center gap-2">
            <span className="text-forensic-text-muted">From Frame</span>
            <span className="text-accent-red">{currentFrameIndex + 1}</span>
            <span className="text-forensic-text-muted">-&gt;</span>
            <span className="text-forensic-text-muted">To Frame</span>
            <span className="text-accent-green">{targetFrameIndex + 1}</span>
          </div>
          <span className="text-forensic-text-muted">
            {Math.abs(currentFrameIndex - targetFrameIndex)} frames back
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {/* No Preview Yet */}
        {!plan && !isLoadingPreview && !previewError && (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <RotateCcw className="w-10 h-10 text-forensic-text-muted mb-3" />
            <p className="text-forensic-text-secondary font-mono text-sm mb-2">
              Ready to preview rewind
            </p>
            <p className="text-forensic-text-muted font-mono text-xs max-w-[300px] mb-4">
              Preview will analyze which files need to be restored to match the state at frame{' '}
              {targetFrameIndex + 1}.
            </p>
            <button
              onClick={onPreview}
              className="flex items-center gap-2 px-4 py-2 bg-accent-amber/10 border border-accent-amber/30 text-accent-amber text-xs font-mono hover:bg-accent-amber/20 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Generate Preview
            </button>
          </div>
        )}

        {/* Loading Preview */}
        {isLoadingPreview && (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <div className="w-8 h-8 border-2 border-accent-amber border-t-transparent animate-spin rounded-full mb-3" />
            <p className="text-forensic-text-secondary font-mono text-sm">Analyzing changes...</p>
          </div>
        )}

        {/* Preview Error */}
        {previewError && (
          <div className="p-4 bg-accent-red/10 border border-accent-red/30">
            <div className="flex items-center gap-2 text-accent-red mb-2">
              <AlertCircle className="w-4 h-4" />
              <span className="font-mono text-sm font-bold">Preview Failed</span>
            </div>
            <p className="font-mono text-xs text-forensic-text-secondary">{previewError}</p>
            <button
              onClick={onPreview}
              className="mt-3 flex items-center gap-2 px-3 py-1.5 bg-forensic-bg-tertiary border border-forensic-border text-forensic-text-secondary text-xs font-mono hover:text-forensic-text-primary transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Preview Results */}
        {plan && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-4 gap-2">
              {fileCounts && (
                <>
                  <div className="bg-forensic-bg-tertiary border border-forensic-border p-2 text-center">
                    <div className="text-lg font-mono text-accent-green">{fileCounts.create}</div>
                    <div className="text-[10px] font-mono text-forensic-text-muted uppercase">
                      Create
                    </div>
                  </div>
                  <div className="bg-forensic-bg-tertiary border border-forensic-border p-2 text-center">
                    <div className="text-lg font-mono text-accent-amber">{fileCounts.modify}</div>
                    <div className="text-[10px] font-mono text-forensic-text-muted uppercase">
                      Modify
                    </div>
                  </div>
                  <div className="bg-forensic-bg-tertiary border border-forensic-border p-2 text-center">
                    <div className="text-lg font-mono text-accent-red">{fileCounts.delete}</div>
                    <div className="text-[10px] font-mono text-forensic-text-muted uppercase">
                      Delete
                    </div>
                  </div>
                  <div className="bg-forensic-bg-tertiary border border-forensic-border p-2 text-center">
                    <div className="text-lg font-mono text-forensic-text-muted">
                      {fileCounts.skip}
                    </div>
                    <div className="text-[10px] font-mono text-forensic-text-muted uppercase">
                      Skip
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Conflicts */}
            {hasConflicts && (
              <div className="bg-accent-red/10 border border-accent-red/30 p-3">
                <div className="flex items-center gap-2 text-accent-red mb-2">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="font-mono text-xs font-bold uppercase">
                    {plan.conflicts.length} Conflict{plan.conflicts.length > 1 ? 's' : ''} Detected
                  </span>
                </div>
                <div className="space-y-1">
                  {plan.conflicts.map((conflict: RewindConflict, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <FileWarning className="w-3 h-3 text-accent-red shrink-0 mt-0.5" />
                      <div>
                        <span className="font-mono text-xs text-forensic-text-primary">
                          {conflict.path}
                        </span>
                        <p className="font-mono text-[10px] text-forensic-text-muted">
                          {conflict.reason}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Warnings */}
            {hasWarnings && (
              <div className="bg-accent-amber/10 border border-accent-amber/30 p-3">
                <div className="flex items-center gap-2 text-accent-amber mb-2">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="font-mono text-xs font-bold uppercase">Warnings</span>
                </div>
                <ul className="space-y-1">
                  {plan.warnings.map((warning, idx) => (
                    <li key={idx} className="font-mono text-xs text-forensic-text-secondary">
                      {warning}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* File List */}
            <div className="bg-forensic-bg-tertiary border border-forensic-border">
              <div className="px-3 py-2 border-b border-forensic-border">
                <span className="font-mono text-xs text-forensic-text-muted uppercase tracking-wide">
                  Files to Process ({plan.files.length})
                </span>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {plan.files.map((file: RewindFileAction) => {
                  const isExpanded = expandedFiles.has(file.path);
                  return (
                    <div key={file.path} className="border-b border-forensic-border last:border-0">
                      <button
                        onClick={() => toggleFileExpand(file.path)}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-forensic-bg-primary transition-colors text-left"
                      >
                        {file.content ? (
                          isExpanded ? (
                            <ChevronDown className="w-3 h-3 text-forensic-text-muted shrink-0" />
                          ) : (
                            <ChevronRight className="w-3 h-3 text-forensic-text-muted shrink-0" />
                          )
                        ) : (
                          <span className="w-3" />
                        )}
                        {getActionIcon(file.action)}
                        <span className="font-mono text-xs text-forensic-text-primary truncate flex-1">
                          {file.path}
                        </span>
                        <span
                          className={`font-mono text-[10px] uppercase ${getActionColor(file.action)}`}
                        >
                          {getActionLabel(file.action)}
                        </span>
                      </button>
                      {isExpanded && file.content && (
                        <div className="px-3 pb-2">
                          <pre className="p-2 bg-forensic-bg-primary border border-forensic-border font-mono text-[10px] text-forensic-text-secondary overflow-x-auto max-h-32">
                            {file.content.slice(0, 500)}
                            {file.content.length > 500 && '\n...truncated'}
                          </pre>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Options */}
            <div className="bg-forensic-bg-tertiary border border-forensic-border p-3 space-y-3">
              <div className="font-mono text-xs text-forensic-text-muted uppercase tracking-wide mb-2">
                Options
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={createBackups}
                  onChange={(e) => setCreateBackups(e.target.checked)}
                  className="w-4 h-4 bg-forensic-bg-primary border border-forensic-border text-accent-green focus:ring-accent-green"
                />
                <div className="flex items-center gap-2">
                  <Archive className="w-4 h-4 text-forensic-text-secondary" />
                  <span className="font-mono text-xs text-forensic-text-primary">
                    Create backups before modifying
                  </span>
                </div>
              </label>
              {hasConflicts && (
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={skipConflicts}
                    onChange={(e) => setSkipConflicts(e.target.checked)}
                    className="w-4 h-4 bg-forensic-bg-primary border border-forensic-border text-accent-amber focus:ring-accent-amber"
                  />
                  <div className="flex items-center gap-2">
                    <SkipForward className="w-4 h-4 text-forensic-text-secondary" />
                    <span className="font-mono text-xs text-forensic-text-primary">
                      Skip conflicting files
                    </span>
                  </div>
                </label>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      {plan && (
        <div className="p-4 border-t border-forensic-border bg-forensic-bg-secondary shrink-0">
          <div className="flex items-center justify-between">
            <button
              onClick={onPreview}
              disabled={isExecuting}
              className="flex items-center gap-2 px-3 py-2 text-forensic-text-secondary text-xs font-mono hover:text-forensic-text-primary transition-colors disabled:opacity-50"
            >
              <RotateCcw className="w-3 h-3" />
              Refresh Preview
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                disabled={isExecuting}
                className="px-4 py-2 text-xs font-mono text-forensic-text-secondary hover:text-forensic-text-primary transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => onExecute({ createBackups, skipConflicts })}
                disabled={isExecuting || (!!hasConflicts && !skipConflicts)}
                className="flex items-center gap-2 px-4 py-2 bg-accent-amber/10 border border-accent-amber/30 text-accent-amber text-xs font-mono hover:bg-accent-amber/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isExecuting ? (
                  <>
                    <span className="w-3 h-3 border border-accent-amber border-t-transparent animate-spin rounded-full" />
                    Executing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-3 h-3" />
                    Execute Rewind
                  </>
                )}
              </button>
            </div>
          </div>
          {hasConflicts && !skipConflicts && (
            <p className="text-[10px] font-mono text-accent-red mt-2 text-right">
              Enable "Skip conflicting files" to proceed with conflicts
            </p>
          )}
        </div>
      )}
    </aside>
  );
};

export default RewindPanel;
