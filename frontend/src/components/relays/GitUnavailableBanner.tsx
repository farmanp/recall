/**
 * GitUnavailableBanner Component
 *
 * Displays an informative banner when git integration is not available.
 * Explains why the Relays page is empty and how to enable git tracking.
 */

import React from 'react';
import { GitBranch, Info, RefreshCw } from 'lucide-react';

interface GitUnavailableBannerProps {
  message?: string;
  onRefresh?: () => void;
}

export const GitUnavailableBanner: React.FC<GitUnavailableBannerProps> = ({
  message = 'Git tracking not available. Sessions imported from git repositories will appear here.',
  onRefresh,
}) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
      <div className="max-w-md text-center">
        {/* Icon */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-forensic-bg-tertiary mb-6">
          <GitBranch className="w-8 h-8 text-forensic-text-muted" />
        </div>

        {/* Title */}
        <h2 className="text-xl font-mono text-forensic-text-primary mb-3">No Git Data Available</h2>

        {/* Message */}
        <p className="text-forensic-text-secondary mb-6">{message}</p>

        {/* Info box */}
        <div className="bg-accent-blue/10 border border-accent-blue/20 rounded-lg p-4 mb-6 text-left">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-accent-blue flex-shrink-0 mt-0.5" />
            <div className="space-y-2 text-sm text-forensic-text-secondary">
              <p>
                <strong className="text-forensic-text-primary">How to enable git tracking:</strong>
              </p>
              <ol className="list-decimal list-inside space-y-1 ml-1">
                <li>Import sessions from directories that are git repositories</li>
                <li>Sessions will automatically capture git context (branch, commits)</li>
                <li>Commits made during sessions will be linked here</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Refresh button */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="inline-flex items-center gap-2 px-4 py-2 bg-forensic-bg-tertiary hover:bg-forensic-bg-primary border border-forensic-border rounded transition-colors text-forensic-text-secondary hover:text-forensic-text-primary font-mono text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Check Again
          </button>
        )}
      </div>
    </div>
  );
};

export default GitUnavailableBanner;
