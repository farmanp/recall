/**
 * ExportModal Component
 *
 * Unified export modal for both frame and session exports
 */

import React, { useState } from 'react';
import { X, Download, FileText, Files } from 'lucide-react';
import type { PlaybackFrame, SessionTimeline } from '../../types/transcript';
import {
  sessionToMarkdown,
  sessionToHTML,
  frameToMarkdown,
  frameToHTML,
  downloadFile,
} from '../../lib/exportSession';

interface ExportModalProps {
  currentFrame: PlaybackFrame | null;
  currentFrameIndex: number;
  sessionDetails: Partial<SessionTimeline>;
  frames: PlaybackFrame[];
  onClose: () => void;
}

type ExportScope = 'frame' | 'session';
type ExportFormat = 'markdown' | 'html';

export const ExportModal: React.FC<ExportModalProps> = ({
  currentFrame,
  currentFrameIndex,
  sessionDetails,
  frames,
  onClose,
}) => {
  const [scope, setScope] = useState<ExportScope>('frame');
  const [format, setFormat] = useState<ExportFormat>('markdown');

  const handleExport = () => {
    if (scope === 'frame' && currentFrame) {
      // Export current frame
      if (format === 'markdown') {
        const markdown = frameToMarkdown(currentFrame, sessionDetails);
        downloadFile(`${sessionDetails.slug}_frame-${currentFrameIndex + 1}.md`, markdown);
      } else {
        const html = frameToHTML(currentFrame, sessionDetails);
        downloadFile(`${sessionDetails.slug}_frame-${currentFrameIndex + 1}.html`, html);
      }
    } else {
      // Export full session
      const timeline: SessionTimeline = { ...sessionDetails, frames } as SessionTimeline;
      if (format === 'markdown') {
        const markdown = sessionToMarkdown(timeline);
        downloadFile(`${sessionDetails.slug}.md`, markdown);
      } else {
        const html = sessionToHTML(timeline);
        downloadFile(`${sessionDetails.slug}.html`, html);
      }
    }
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />

      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-forensic-bg-secondary border border-forensic-border shadow-2xl z-50 w-[500px] max-w-[90vw]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-forensic-border">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-accent-green" />
            <h2 className="text-sm font-mono font-bold text-forensic-text-primary uppercase tracking-wide">
              Export Session
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-forensic-text-secondary hover:text-forensic-text-primary hover:bg-forensic-bg-tertiary transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Scope Selection */}
          <div>
            <h3 className="font-mono text-xs text-forensic-text-muted uppercase tracking-wide mb-3">
              What to Export
            </h3>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 bg-forensic-bg-tertiary border border-forensic-border cursor-pointer hover:border-accent-green/50 transition-colors">
                <input
                  type="radio"
                  name="scope"
                  value="frame"
                  checked={scope === 'frame'}
                  onChange={() => setScope('frame')}
                  className="w-4 h-4 text-accent-green focus:ring-accent-green"
                  disabled={!currentFrame}
                />
                <FileText className="w-5 h-5 text-forensic-text-secondary" />
                <div className="flex-1">
                  <div className="font-mono text-sm text-forensic-text-primary">Current Frame</div>
                  <div className="font-mono text-xs text-forensic-text-muted">
                    Frame {currentFrameIndex + 1} of {frames.length}
                  </div>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 bg-forensic-bg-tertiary border border-forensic-border cursor-pointer hover:border-accent-green/50 transition-colors">
                <input
                  type="radio"
                  name="scope"
                  value="session"
                  checked={scope === 'session'}
                  onChange={() => setScope('session')}
                  className="w-4 h-4 text-accent-green focus:ring-accent-green"
                />
                <Files className="w-5 h-5 text-forensic-text-secondary" />
                <div className="flex-1">
                  <div className="font-mono text-sm text-forensic-text-primary">Full Session</div>
                  <div className="font-mono text-xs text-forensic-text-muted">
                    All {frames.length} frames
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Format Selection */}
          <div>
            <h3 className="font-mono text-xs text-forensic-text-muted uppercase tracking-wide mb-3">
              Export Format
            </h3>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 bg-forensic-bg-tertiary border border-forensic-border cursor-pointer hover:border-accent-green/50 transition-colors">
                <input
                  type="radio"
                  name="format"
                  value="markdown"
                  checked={format === 'markdown'}
                  onChange={() => setFormat('markdown')}
                  className="w-4 h-4 text-accent-green focus:ring-accent-green"
                />
                <span className="font-mono text-sm text-forensic-text-muted">.md</span>
                <div className="flex-1">
                  <div className="font-mono text-sm text-forensic-text-primary">Markdown</div>
                  <div className="font-mono text-xs text-forensic-text-muted">
                    Plain text, readable anywhere
                  </div>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 bg-forensic-bg-tertiary border border-forensic-border cursor-pointer hover:border-accent-green/50 transition-colors">
                <input
                  type="radio"
                  name="format"
                  value="html"
                  checked={format === 'html'}
                  onChange={() => setFormat('html')}
                  className="w-4 h-4 text-accent-green focus:ring-accent-green"
                />
                <span className="font-mono text-sm text-accent-green">.html</span>
                <div className="flex-1">
                  <div className="font-mono text-sm text-forensic-text-primary">HTML</div>
                  <div className="font-mono text-xs text-forensic-text-muted">
                    Styled, syntax highlighted
                  </div>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-forensic-border bg-forensic-bg-tertiary">
          <button
            onClick={onClose}
            className="px-4 py-2 font-mono text-xs text-forensic-text-secondary hover:text-forensic-text-primary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={scope === 'frame' && !currentFrame}
            className="flex items-center gap-2 px-4 py-2 bg-accent-green/10 border border-accent-green/30 text-accent-green font-mono text-xs hover:bg-accent-green/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-3 h-3" />
            Export {format === 'markdown' ? 'Markdown' : 'HTML'}
          </button>
        </div>
      </div>
    </>
  );
};
