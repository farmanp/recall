/**
 * RewindConfirmDialog Component
 *
 * Confirmation dialog before executing rewind.
 * Shows summary: X files will be modified
 * Warning about irreversible changes
 * Option to undo after (if backups enabled)
 */

import React, { useEffect } from 'react';
import {
  RotateCcw,
  X,
  AlertTriangle,
  FileText,
  FilePlus,
  FileX,
  Archive,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import type { RewindPlan, RewindResult } from '../../types/competitive';

interface RewindConfirmDialogProps {
  isOpen: boolean;
  plan: RewindPlan;
  createBackups: boolean;
  skipConflicts: boolean;
  isExecuting?: boolean;
  result?: RewindResult | null;
  error?: string | null;
  onClose: () => void;
  onConfirm: () => void;
  onUndo?: () => void;
}

export const RewindConfirmDialog: React.FC<RewindConfirmDialogProps> = ({
  isOpen,
  plan,
  createBackups,
  skipConflicts,
  isExecuting = false,
  result = null,
  error = null,
  onClose,
  onConfirm,
  onUndo,
}) => {
  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isExecuting) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isExecuting, onClose]);

  if (!isOpen) return null;

  const fileCounts = {
    create: plan.files.filter((f) => f.action === 'create').length,
    modify: plan.files.filter((f) => f.action === 'modify').length,
    delete: plan.files.filter((f) => f.action === 'delete').length,
    skip: plan.files.filter((f) => f.action === 'skip').length,
  };

  const totalAffected = fileCounts.create + fileCounts.modify + fileCounts.delete;
  const showResult = result !== null;
  const showError = error !== null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rewind-dialog-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-forensic-bg-primary/80"
        onClick={!isExecuting && !showResult ? onClose : undefined}
      />

      {/* Dialog */}
      <div className="relative bg-forensic-bg-secondary border border-forensic-border w-full max-w-md mx-4 shadow-2xl">
        {/* Header */}
        <div
          className={`flex items-center justify-between p-4 border-b border-forensic-border ${
            showResult
              ? result?.success
                ? 'bg-accent-green/10'
                : 'bg-accent-red/10'
              : showError
                ? 'bg-accent-red/10'
                : 'bg-accent-amber/10'
          }`}
        >
          <div className="flex items-center gap-2">
            {showResult ? (
              result?.success ? (
                <CheckCircle className="w-5 h-5 text-accent-green" />
              ) : (
                <AlertCircle className="w-5 h-5 text-accent-red" />
              )
            ) : showError ? (
              <AlertCircle className="w-5 h-5 text-accent-red" />
            ) : (
              <RotateCcw className="w-5 h-5 text-accent-amber" />
            )}
            <h2
              id="rewind-dialog-title"
              className="text-sm font-mono font-bold text-forensic-text-primary uppercase tracking-wide"
            >
              {showResult
                ? result?.success
                  ? 'Rewind Complete'
                  : 'Rewind Failed'
                : showError
                  ? 'Rewind Error'
                  : 'Confirm Rewind'}
            </h2>
          </div>
          {!isExecuting && (
            <button
              onClick={onClose}
              className="p-1.5 text-forensic-text-secondary hover:text-forensic-text-primary hover:bg-forensic-bg-tertiary transition-colors"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Executing State */}
          {isExecuting && (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-10 h-10 border-2 border-accent-amber border-t-transparent animate-spin rounded-full mb-4" />
              <p className="text-forensic-text-secondary font-mono text-sm">Executing rewind...</p>
              <p className="text-forensic-text-muted font-mono text-xs mt-1">
                Please wait, do not close this dialog
              </p>
            </div>
          )}

          {/* Error State */}
          {showError && !isExecuting && (
            <div className="p-4 bg-accent-red/10 border border-accent-red/30">
              <div className="flex items-center gap-2 text-accent-red mb-2">
                <AlertCircle className="w-4 h-4" />
                <span className="font-mono text-sm font-bold">Error</span>
              </div>
              <p className="font-mono text-xs text-forensic-text-secondary">{error}</p>
            </div>
          )}

          {/* Result State */}
          {showResult && !isExecuting && (
            <>
              {result?.success ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-accent-green/10 border border-accent-green/30">
                    <CheckCircle className="w-6 h-6 text-accent-green shrink-0" />
                    <div>
                      <p className="font-mono text-sm text-forensic-text-primary">
                        Successfully restored {result.filesRestored} files
                      </p>
                      {result.backupsCreated.length > 0 && (
                        <p className="font-mono text-xs text-forensic-text-muted mt-1">
                          {result.backupsCreated.length} backups created
                        </p>
                      )}
                    </div>
                  </div>

                  {result.errors.length > 0 && (
                    <div className="p-3 bg-accent-amber/10 border border-accent-amber/30">
                      <div className="flex items-center gap-2 text-accent-amber mb-2">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="font-mono text-xs font-bold uppercase">
                          Partial Errors
                        </span>
                      </div>
                      <ul className="space-y-1">
                        {result.errors.map((err, idx) => (
                          <li key={idx} className="font-mono text-xs text-forensic-text-secondary">
                            {err}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {result.canUndo && onUndo && (
                    <div className="flex items-center gap-2 p-3 bg-forensic-bg-tertiary border border-forensic-border">
                      <Archive className="w-4 h-4 text-accent-cyan" />
                      <span className="font-mono text-xs text-forensic-text-secondary flex-1">
                        Backups available - you can undo this rewind
                      </span>
                      <button
                        onClick={onUndo}
                        className="px-2 py-1 bg-accent-cyan/10 border border-accent-cyan/30 text-accent-cyan text-xs font-mono hover:bg-accent-cyan/20 transition-colors"
                      >
                        Undo
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 bg-accent-red/10 border border-accent-red/30">
                  <div className="flex items-center gap-2 text-accent-red mb-2">
                    <AlertCircle className="w-4 h-4" />
                    <span className="font-mono text-sm font-bold">Rewind Failed</span>
                  </div>
                  {result?.errors.map((err, idx) => (
                    <p key={idx} className="font-mono text-xs text-forensic-text-secondary">
                      {err}
                    </p>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Confirmation State */}
          {!isExecuting && !showResult && !showError && (
            <>
              {/* Warning */}
              <div className="flex items-start gap-3 p-3 bg-accent-amber/10 border border-accent-amber/30">
                <AlertTriangle className="w-5 h-5 text-accent-amber shrink-0 mt-0.5" />
                <div>
                  <p className="font-mono text-sm text-forensic-text-primary font-bold">
                    This action will modify files on disk
                  </p>
                  <p className="font-mono text-xs text-forensic-text-muted mt-1">
                    {createBackups
                      ? 'Backups will be created before changes are made.'
                      : 'No backups will be created. Changes may be irreversible.'}
                  </p>
                </div>
              </div>

              {/* Summary */}
              <div className="bg-forensic-bg-tertiary border border-forensic-border p-3">
                <div className="font-mono text-xs text-forensic-text-muted uppercase tracking-wide mb-3">
                  Summary
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <FilePlus className="w-4 h-4 text-accent-green" />
                    <span className="font-mono text-sm text-forensic-text-primary">
                      {fileCounts.create} to create
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-accent-amber" />
                    <span className="font-mono text-sm text-forensic-text-primary">
                      {fileCounts.modify} to modify
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FileX className="w-4 h-4 text-accent-red" />
                    <span className="font-mono text-sm text-forensic-text-primary">
                      {fileCounts.delete} to delete
                    </span>
                  </div>
                  {fileCounts.skip > 0 && (
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-forensic-text-muted" />
                      <span className="font-mono text-sm text-forensic-text-muted">
                        {fileCounts.skip} skipped
                      </span>
                    </div>
                  )}
                </div>
                <div className="mt-3 pt-3 border-t border-forensic-border">
                  <span className="font-mono text-sm text-forensic-text-primary">
                    Total: {totalAffected} files will be affected
                  </span>
                </div>
              </div>

              {/* Options Summary */}
              <div className="flex items-center gap-4 text-xs font-mono">
                <div
                  className={`flex items-center gap-1.5 ${createBackups ? 'text-accent-green' : 'text-forensic-text-muted'}`}
                >
                  <Archive className="w-3 h-3" />
                  <span>{createBackups ? 'Backups enabled' : 'No backups'}</span>
                </div>
                {plan.conflicts.length > 0 && (
                  <div
                    className={`flex items-center gap-1.5 ${skipConflicts ? 'text-accent-amber' : 'text-forensic-text-muted'}`}
                  >
                    <AlertTriangle className="w-3 h-3" />
                    <span>
                      {skipConflicts
                        ? `${plan.conflicts.length} conflicts will be skipped`
                        : `${plan.conflicts.length} conflicts`}
                    </span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-forensic-border bg-forensic-bg-tertiary">
          {showResult || showError ? (
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-forensic-bg-primary border border-forensic-border text-forensic-text-primary text-xs font-mono hover:bg-forensic-bg-secondary transition-colors"
              >
                Close
              </button>
            </div>
          ) : !isExecuting ? (
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-xs font-mono text-forensic-text-secondary hover:text-forensic-text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                className="flex items-center gap-2 px-4 py-2 bg-accent-amber/10 border border-accent-amber/30 text-accent-amber text-xs font-mono hover:bg-accent-amber/20 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Confirm Rewind
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default RewindConfirmDialog;
