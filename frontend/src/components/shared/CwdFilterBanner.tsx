/**
 * CwdFilterBanner Component
 *
 * Displays an info banner when CWD (current working directory) filtering is active.
 * Shows the filtered path, session count comparison, and provides a quick action
 * to show all sessions.
 */

import React from 'react';
import { FolderOpen, ChevronRight } from 'lucide-react';

interface CwdFilterBannerProps {
  cwdPath: string;
  filteredCount: number;
  totalCount: number;
  onShowAll: () => void;
}

/**
 * Truncates a path to show only the last N segments with ~ for home directory
 */
function truncatePath(path: string, maxSegments: number = 2): string {
  // Replace home directory with ~
  const homeDir = path.match(/^\/Users\/[^/]+/)?.[0];
  let displayPath = path;
  if (homeDir) {
    displayPath = path.replace(homeDir, '~');
  }

  // Split and take last N segments
  const segments = displayPath.split('/').filter(Boolean);
  if (segments.length <= maxSegments) {
    return displayPath;
  }

  // Keep ~ prefix if present, then show last segments
  const lastSegments = segments.slice(-maxSegments);
  if (displayPath.startsWith('~')) {
    return '~/' + lastSegments.join('/');
  }
  return '.../' + lastSegments.join('/');
}

export const CwdFilterBanner: React.FC<CwdFilterBannerProps> = ({
  cwdPath,
  filteredCount,
  totalCount,
  onShowAll,
}) => {
  const displayPath = truncatePath(cwdPath);

  // Don't show if no filtering is happening
  if (filteredCount === totalCount) {
    return null;
  }

  return (
    <div className="mb-4 px-4 py-3 bg-accent-amber/10 border border-accent-amber/30 flex items-center justify-between">
      <div className="flex items-center gap-3 text-sm">
        <FolderOpen className="w-4 h-4 text-accent-amber flex-shrink-0" />
        <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 font-mono">
          <span className="text-forensic-text-secondary">
            Scope:{' '}
            <span className="text-accent-amber" title={cwdPath}>
              {displayPath}
            </span>
          </span>
          <span className="text-forensic-text-muted text-xs">
            {filteredCount} of {totalCount} sessions
          </span>
        </div>
      </div>
      <button
        onClick={onShowAll}
        className="text-sm text-accent-green hover:text-green-400 flex items-center gap-1 transition-colors whitespace-nowrap ml-4 font-mono uppercase tracking-wide"
      >
        Expand Scope
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
};
