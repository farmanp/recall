/**
 * GitPanel Component
 *
 * Slide-out panel showing git context for a session:
 * - Branch name and current commit
 * - List of commits made during session
 * - Files modified
 * - Link to GitHub if remote detected
 */

import React, { useState } from 'react';
import {
  GitBranch,
  GitCommit,
  X,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  FileText,
  AlertCircle,
  Clock,
} from 'lucide-react';
import type { GitContext, GitCommitInfo } from '../../types/competitive';

interface GitPanelProps {
  gitContext: GitContext | null;
  isLoading?: boolean;
  error?: string | null;
  onClose: () => void;
}

export const GitPanel: React.FC<GitPanelProps> = ({
  gitContext,
  isLoading = false,
  error = null,
  onClose,
}) => {
  const [expandedCommits, setExpandedCommits] = useState<Set<string>>(new Set());

  const toggleCommitExpand = (hash: string) => {
    setExpandedCommits((prev) => {
      const next = new Set(prev);
      if (next.has(hash)) {
        next.delete(hash);
      } else {
        next.add(hash);
      }
      return next;
    });
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getGitHubUrl = (remoteUrl?: string, commit?: string) => {
    if (!remoteUrl) return null;
    // Parse GitHub URL from various remote formats
    const match = remoteUrl.match(/github\.com[:/]([^/]+\/[^/.]+)/);
    if (!match) return null;
    const repo = match[1].replace(/\.git$/, '');
    return commit ? `https://github.com/${repo}/commit/${commit}` : `https://github.com/${repo}`;
  };

  return (
    <aside className="w-[400px] min-w-[350px] max-w-[500px] bg-forensic-bg-secondary border-l border-forensic-border flex flex-col overflow-hidden transition-all duration-200">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-forensic-border bg-forensic-bg-secondary shrink-0">
        <div className="flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-accent-purple" />
          <h2 className="text-sm font-mono font-bold text-forensic-text-primary uppercase tracking-wide">
            Git Context
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

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-forensic-text-muted font-mono text-sm">Loading git info...</div>
          </div>
        ) : error ? (
          <div className="p-4">
            <div className="flex items-center gap-2 text-accent-red">
              <AlertCircle className="w-4 h-4" />
              <span className="font-mono text-sm">{error}</span>
            </div>
          </div>
        ) : !gitContext ? (
          <div className="flex flex-col items-center justify-center h-32 text-center p-4">
            <GitBranch className="w-8 h-8 text-forensic-text-muted mb-2" />
            <p className="text-forensic-text-muted font-mono text-sm">No git context available</p>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {/* Branch & HEAD Info */}
            <div className="bg-forensic-bg-tertiary border border-forensic-border p-3">
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-xs text-forensic-text-muted uppercase tracking-wide">
                  Current Branch
                </span>
                {gitContext.isDirty && (
                  <span className="px-1.5 py-0.5 bg-accent-amber/10 text-accent-amber text-[10px] font-mono uppercase border border-accent-amber/30">
                    Dirty
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-accent-purple" />
                <span className="font-mono text-sm text-accent-purple">{gitContext.branch}</span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <GitCommit className="w-4 h-4 text-forensic-text-secondary" />
                <code className="font-mono text-xs text-forensic-text-secondary">
                  {gitContext.headCommit.slice(0, 12)}
                </code>
                {gitContext.commitMessage && (
                  <span className="font-mono text-xs text-forensic-text-muted truncate flex-1">
                    {gitContext.commitMessage}
                  </span>
                )}
              </div>
              {(() => {
                const githubUrl = getGitHubUrl(gitContext.remoteUrl, gitContext.headCommit);
                return githubUrl ? (
                  <a
                    href={githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 mt-3 text-xs text-accent-cyan hover:underline font-mono"
                  >
                    <ExternalLink className="w-3 h-3" />
                    View on GitHub
                  </a>
                ) : null;
              })()}
            </div>

            {/* Staged Files */}
            {gitContext.stagedFiles && gitContext.stagedFiles.length > 0 && (
              <div className="bg-forensic-bg-tertiary border border-forensic-border p-3">
                <div className="font-mono text-xs text-forensic-text-muted uppercase tracking-wide mb-2">
                  Staged Files ({gitContext.stagedFiles.length})
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {gitContext.stagedFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <FileText className="w-3 h-3 text-accent-green shrink-0" />
                      <span className="font-mono text-xs text-forensic-text-secondary truncate">
                        {file}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Commits Made During Session */}
            {gitContext.commitsInSession && gitContext.commitsInSession.length > 0 && (
              <div className="bg-forensic-bg-tertiary border border-forensic-border p-3">
                <div className="font-mono text-xs text-forensic-text-muted uppercase tracking-wide mb-3">
                  Commits in Session ({gitContext.commitsInSession.length})
                </div>
                <div className="space-y-2">
                  {gitContext.commitsInSession.map((commit: GitCommitInfo) => (
                    <div
                      key={commit.hash}
                      className="border border-forensic-border bg-forensic-bg-primary"
                    >
                      <button
                        onClick={() => toggleCommitExpand(commit.hash)}
                        className="w-full flex items-center gap-2 p-2 hover:bg-forensic-bg-tertiary transition-colors"
                      >
                        {expandedCommits.has(commit.hash) ? (
                          <ChevronDown className="w-3 h-3 text-forensic-text-muted shrink-0" />
                        ) : (
                          <ChevronRight className="w-3 h-3 text-forensic-text-muted shrink-0" />
                        )}
                        <code className="font-mono text-xs text-accent-purple">
                          {commit.hash.slice(0, 7)}
                        </code>
                        <span className="font-mono text-xs text-forensic-text-primary truncate flex-1 text-left">
                          {commit.message.split('\n')[0]}
                        </span>
                      </button>
                      {expandedCommits.has(commit.hash) && (
                        <div className="px-2 pb-2 space-y-2">
                          <div className="flex items-center gap-2 text-[10px] font-mono text-forensic-text-muted">
                            <Clock className="w-3 h-3" />
                            <span>{formatTimestamp(commit.timestamp)}</span>
                            <span className="text-forensic-border">|</span>
                            <span>{commit.author}</span>
                          </div>
                          {commit.message.includes('\n') && (
                            <p className="text-xs font-mono text-forensic-text-secondary whitespace-pre-wrap pl-5">
                              {commit.message.split('\n').slice(1).join('\n').trim()}
                            </p>
                          )}
                          {(() => {
                            const commitUrl = getGitHubUrl(gitContext.remoteUrl, commit.hash);
                            return commitUrl ? (
                              <a
                                href={commitUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 pl-5 text-[10px] text-accent-cyan hover:underline font-mono"
                              >
                                <ExternalLink className="w-3 h-3" />
                                View commit
                              </a>
                            ) : null;
                          })()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-forensic-border bg-forensic-bg-secondary shrink-0">
        <div className="text-[10px] font-mono text-forensic-text-muted text-center">
          Press{' '}
          <kbd className="px-1 py-0.5 bg-forensic-bg-tertiary border border-forensic-border text-forensic-text-secondary">
            g
          </kbd>{' '}
          to toggle
        </div>
      </div>
    </aside>
  );
};

export default GitPanel;
