/**
 * RelaysPage Component
 *
 * Commit-centric view of sessions - shows which sessions contributed to each git commit.
 * Provides branch filtering and links to commit detail pages.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GitCommit, GitBranch, RefreshCw, ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';
import { useRelaysStatus, useRelayCommits, useRelayBranches } from '../hooks/useTranscriptApi';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { GitUnavailableBanner } from '../components/relays/GitUnavailableBanner';
import { CommitCard } from '../components/relays/CommitCard';

export const RelaysPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedBranch, setSelectedBranch] = useState<string | undefined>(undefined);
  const [offset, setOffset] = useState(0);
  const limit = 20;

  // Check if git integration is available
  const { data: status, isLoading: statusLoading, refetch: refetchStatus } = useRelaysStatus();

  // Fetch branches for filter dropdown
  const { data: branchesData } = useRelayBranches();
  const branches = branchesData?.branches ?? [];

  // Fetch commits
  const {
    data: commitsData,
    isLoading: commitsLoading,
    isFetching: commitsFetching,
  } = useRelayCommits({
    branch: selectedBranch,
    limit,
    offset,
  });

  const commits = commitsData?.commits ?? [];
  const hasMore = commitsData?.hasMore ?? false;
  const total = commitsData?.total ?? 0;

  const handleCommitClick = (hash: string) => {
    navigate(`/relays/${hash}`);
  };

  const handleBranchChange = (branch: string) => {
    setSelectedBranch(branch === 'all' ? undefined : branch);
    setOffset(0);
  };

  const handleLoadMore = () => {
    setOffset(offset + limit);
  };

  const handleRefresh = () => {
    refetchStatus();
  };

  // Loading state for initial status check
  if (statusLoading) {
    return (
      <div className="min-h-screen bg-forensic-bg-primary flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Git unavailable state
  if (!status?.available) {
    return (
      <div className="min-h-screen bg-forensic-bg-primary">
        <header className="p-6 pb-0">
          <h1 className="text-2xl font-mono font-medium text-forensic-text-primary mb-1">Relays</h1>
          <p className="text-forensic-text-muted font-mono text-sm">
            View sessions organized by git commits
          </p>
        </header>
        <GitUnavailableBanner message={status?.message} onRefresh={handleRefresh} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-forensic-bg-primary p-6">
      {/* Header */}
      <header className="mb-6">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl font-mono font-medium text-forensic-text-primary">Relays</h1>
          <button
            onClick={handleRefresh}
            className="p-2 rounded hover:bg-forensic-bg-secondary text-forensic-text-muted hover:text-forensic-text-primary transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${commitsFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <p className="text-forensic-text-muted font-mono text-sm">
          {total} commits linked to sessions
        </p>
      </header>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        {/* Branch filter */}
        <div className="relative">
          <div className="flex items-center gap-2 text-xs font-mono text-forensic-text-muted">
            <GitBranch className="w-4 h-4" />
            <span>Branch:</span>
          </div>
          <div className="relative mt-1">
            <select
              value={selectedBranch ?? 'all'}
              onChange={(e) => handleBranchChange(e.target.value)}
              className="appearance-none bg-forensic-bg-secondary border border-forensic-border rounded px-3 py-1.5 pr-8 font-mono text-sm text-forensic-text-primary focus:outline-none focus:border-accent-green cursor-pointer"
            >
              <option value="all">All branches</option>
              {branches.map((b) => (
                <option key={b.branch} value={b.branch}>
                  {b.branch} ({b.commitCount})
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-forensic-text-muted pointer-events-none" />
          </div>
        </div>

        {/* Stats summary */}
        <div className="flex-1" />
        <div className="flex items-center gap-4 text-xs font-mono text-forensic-text-muted">
          <div className="flex items-center gap-1">
            <GitCommit className="w-4 h-4" />
            <span>{status.totalCommits} total commits</span>
          </div>
          <div className="flex items-center gap-1">
            <GitBranch className="w-4 h-4" />
            <span>{status.uniqueBranches} branches</span>
          </div>
        </div>
      </div>

      {/* Commit list */}
      {commitsLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : commits.length === 0 ? (
        <div className="bg-forensic-bg-secondary border border-forensic-border rounded-lg p-8 text-center">
          <GitCommit className="w-12 h-12 text-forensic-text-muted mx-auto mb-4" />
          <p className="text-forensic-text-muted font-mono">
            {selectedBranch ? `No commits found on branch "${selectedBranch}"` : 'No commits found'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {commits.map((commit, index) => (
            <motion.div
              key={commit.hash}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
            >
              <CommitCard commit={commit} onCommitClick={handleCommitClick} />
            </motion.div>
          ))}

          {/* Load more */}
          {hasMore && (
            <div className="flex justify-center pt-4">
              <button
                onClick={handleLoadMore}
                disabled={commitsFetching}
                className="px-4 py-2 font-mono text-sm bg-forensic-bg-secondary hover:bg-forensic-bg-tertiary border border-forensic-border rounded transition-colors text-forensic-text-secondary hover:text-forensic-text-primary disabled:opacity-50"
              >
                {commitsFetching ? (
                  <span className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Loading...
                  </span>
                ) : (
                  `Load more (${total - offset - commits.length} remaining)`
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RelaysPage;
