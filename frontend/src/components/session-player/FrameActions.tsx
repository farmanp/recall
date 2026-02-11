/**
 * Frame Actions Component
 *
 * Provides export actions for individual frames
 */

import React, { useState } from 'react';
import { Download } from 'lucide-react';
import type { PlaybackFrame, SessionTimeline } from '../../types/transcript';
import { frameToHTML, frameToMarkdown, downloadFile } from '../../lib/exportSession';

interface FrameActionsProps {
  frame: PlaybackFrame;
  sessionMeta?: Partial<SessionTimeline>;
}

export const FrameActions: React.FC<FrameActionsProps> = ({ frame, sessionMeta }) => {
  const [showMenu, setShowMenu] = useState(false);

  const handleExportMarkdown = () => {
    const markdown = frameToMarkdown(frame, sessionMeta);
    const filename = `${sessionMeta?.slug || 'frame'}_${frame.id}.md`;
    downloadFile(filename, markdown);
    setShowMenu(false);
  };

  const handleExportHTML = () => {
    const html = frameToHTML(frame, sessionMeta);
    const filename = `${sessionMeta?.slug || 'frame'}_${frame.id}.html`;
    downloadFile(filename, html);
    setShowMenu(false);
  };

  return (
    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity z-10">
      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="p-2 bg-forensic-bg-tertiary hover:bg-forensic-border border border-forensic-border text-forensic-text-muted hover:text-forensic-text-primary transition-all"
          title="Export this frame"
          aria-label="Export frame"
        >
          <Download className="w-4 h-4" />
        </button>

        {showMenu && (
          <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />

            {/* Dropdown */}
            <div className="absolute top-full right-0 mt-2 bg-forensic-bg-secondary border border-forensic-border shadow-2xl z-20 min-w-[180px]">
              <button
                onClick={handleExportMarkdown}
                className="w-full px-4 py-3 text-left font-mono text-sm text-forensic-text-secondary hover:bg-forensic-bg-tertiary hover:text-forensic-text-primary transition-colors flex items-center gap-3"
              >
                <span className="text-forensic-text-muted">.md</span>
                <span>Markdown</span>
              </button>

              <div className="border-t border-forensic-border" />

              <button
                onClick={handleExportHTML}
                className="w-full px-4 py-3 text-left font-mono text-sm text-forensic-text-secondary hover:bg-forensic-bg-tertiary hover:text-forensic-text-primary transition-colors flex items-center gap-3"
              >
                <span className="text-accent-green">.html</span>
                <span>HTML</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
