/**
 * CreateCheckpointDialog Component
 *
 * Modal dialog to create a new checkpoint.
 * Fields: name (required), notes (optional)
 * Shows: current frame index, file count at this frame
 */

import React, { useState, useEffect, useRef } from 'react';
import { Bookmark, X, FileText, Hash, AlertCircle } from 'lucide-react';

interface CreateCheckpointDialogProps {
  isOpen: boolean;
  currentFrameIndex: number;
  totalFrames: number;
  fileCount?: number;
  isCreating?: boolean;
  error?: string | null;
  onClose: () => void;
  onCreate: (name: string, notes?: string) => void;
}

export const CreateCheckpointDialog: React.FC<CreateCheckpointDialogProps> = ({
  isOpen,
  currentFrameIndex,
  totalFrames,
  fileCount,
  isCreating = false,
  error = null,
  onClose,
  onCreate,
}) => {
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Focus name input when dialog opens
  useEffect(() => {
    if (isOpen) {
      setName('');
      setNotes('');
      setValidationError(null);
      // Small delay to ensure dialog is mounted
      setTimeout(() => nameInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setValidationError('Checkpoint name is required');
      nameInputRef.current?.focus();
      return;
    }

    if (name.length > 100) {
      setValidationError('Name must be 100 characters or less');
      return;
    }

    setValidationError(null);
    onCreate(name.trim(), notes.trim() || undefined);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkpoint-dialog-title"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-forensic-bg-primary/80" onClick={onClose} />

      {/* Dialog */}
      <div className="relative bg-forensic-bg-secondary border border-forensic-border w-full max-w-md mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-forensic-border">
          <div className="flex items-center gap-2">
            <Bookmark className="w-5 h-5 text-accent-cyan" />
            <h2
              id="checkpoint-dialog-title"
              className="text-sm font-mono font-bold text-forensic-text-primary uppercase tracking-wide"
            >
              Create Checkpoint
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-forensic-text-secondary hover:text-forensic-text-primary hover:bg-forensic-bg-tertiary transition-colors"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Frame Info */}
        <div className="px-4 py-3 bg-forensic-bg-tertiary border-b border-forensic-border">
          <div className="flex items-center justify-between font-mono text-xs">
            <div className="flex items-center gap-2 text-forensic-text-secondary">
              <Hash className="w-3 h-3" />
              <span>
                Frame {currentFrameIndex + 1} of {totalFrames}
              </span>
            </div>
            {fileCount !== undefined && (
              <div className="flex items-center gap-2 text-forensic-text-secondary">
                <FileText className="w-3 h-3" />
                <span>{fileCount} files tracked</span>
              </div>
            )}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Error Messages */}
          {(error || validationError) && (
            <div className="flex items-center gap-2 p-2 bg-accent-red/10 border border-accent-red/30 text-accent-red">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="font-mono text-xs">{error || validationError}</span>
            </div>
          )}

          {/* Name Field */}
          <div>
            <label
              htmlFor="checkpoint-name"
              className="block text-xs font-mono text-forensic-text-muted uppercase tracking-wide mb-1.5"
            >
              Name <span className="text-accent-red">*</span>
            </label>
            <input
              ref={nameInputRef}
              type="text"
              id="checkpoint-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setValidationError(null);
              }}
              placeholder="e.g., Before refactoring auth module"
              disabled={isCreating}
              className="w-full px-3 py-2 bg-forensic-bg-primary border border-forensic-border text-forensic-text-primary font-mono text-sm placeholder:text-forensic-text-muted focus:outline-none focus:border-accent-cyan disabled:opacity-50"
              maxLength={100}
            />
            <div className="text-right mt-1">
              <span className="text-[10px] font-mono text-forensic-text-muted">
                {name.length}/100
              </span>
            </div>
          </div>

          {/* Notes Field */}
          <div>
            <label
              htmlFor="checkpoint-notes"
              className="block text-xs font-mono text-forensic-text-muted uppercase tracking-wide mb-1.5"
            >
              Notes <span className="text-forensic-text-muted">(optional)</span>
            </label>
            <textarea
              id="checkpoint-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this checkpoint..."
              disabled={isCreating}
              rows={3}
              className="w-full px-3 py-2 bg-forensic-bg-primary border border-forensic-border text-forensic-text-primary font-mono text-sm placeholder:text-forensic-text-muted focus:outline-none focus:border-accent-cyan disabled:opacity-50 resize-none"
              maxLength={500}
            />
            <div className="text-right mt-1">
              <span className="text-[10px] font-mono text-forensic-text-muted">
                {notes.length}/500
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isCreating}
              className="px-4 py-2 text-xs font-mono text-forensic-text-secondary hover:text-forensic-text-primary transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating || !name.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-accent-green/10 border border-accent-green/30 text-accent-green text-xs font-mono hover:bg-accent-green/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating ? (
                <>
                  <span className="w-3 h-3 border border-accent-green border-t-transparent animate-spin rounded-full" />
                  Creating...
                </>
              ) : (
                <>
                  <Bookmark className="w-3 h-3" />
                  Create Checkpoint
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateCheckpointDialog;
