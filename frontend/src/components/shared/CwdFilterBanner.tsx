/**
 * CwdFilterBanner Component
 *
 * Displays an info banner when CWD (current working directory) filtering is active.
 * Shows the filtered path, session count comparison, and provides a quick action
 * to show all sessions.
 *
 * Follows the pattern of GitHub's "Viewing a fork" banner or VS Code's "Restricted Mode" bar.
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
    <div className="mb-4 px-4 py-3 bg-blue-900/20 border border-blue-500/30 rounded-lg flex items-center justify-between">
      <div className="flex items-center gap-3 text-sm">
        <FolderOpen className="w-4 h-4 text-blue-400 flex-shrink-0" />
        <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
          <span className="text-gray-300">
            Filtered to:{' '}
            <span className="text-blue-300 font-medium" title={cwdPath}>
              {displayPath}
            </span>
          </span>
          <span className="text-gray-500 text-xs sm:text-sm">
            Showing {filteredCount} of {totalCount} sessions
          </span>
        </div>
      </div>
      <button
        onClick={onShowAll}
        className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors whitespace-nowrap ml-4"
      >
        Show all sessions
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
};
