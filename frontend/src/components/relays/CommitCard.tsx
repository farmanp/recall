/**
 * CommitCard Component
 *
 * Displays a git commit with linked session information.
 * Expandable to show sessions that contributed to the commit.
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  GitCommit,
  GitBranch,
  ChevronDown,
  ChevronRight,
  User,
  Clock,
  PlayCircle,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { RelayCommit } from '../../types/relays';

interface CommitCardProps {
  commit: RelayCommit;
  onCommitClick?: (hash: string) => void;
}

export const CommitCard: React.FC<CommitCardProps> = ({ commit, onCommitClick }) => {
  const [expanded, setExpanded] = useState(false);

  const formattedDate = commit.committedAt
    ? formatDistanceToNow(new Date(commit.committedAt), { addSuffix: true })
    : 'Unknown date';

  const handleCommitClick = () => {
    if (onCommitClick) {
      onCommitClick(commit.hash);
    }
  };

  return (
    <div className="border border-forensic-border rounded-lg bg-forensic-bg-secondary hover:bg-forensic-bg-tertiary/50 transition-colors">
      {/* Main commit row */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Expand toggle */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-1 p-0.5 rounded hover:bg-forensic-bg-primary text-forensic-text-muted hover:text-forensic-text-primary transition-colors"
            title={expanded ? 'Collapse sessions' : 'Expand sessions'}
          >
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>

          {/* Commit icon */}
          <div className="mt-0.5 p-1.5 rounded bg-accent-purple/10">
            <GitCommit className="w-4 h-4 text-accent-purple" />
          </div>

          {/* Commit info */}
          <div className="flex-1 min-w-0">
            {/* Hash and message */}
            <div className="flex items-center gap-2 mb-1">
              <button
                onClick={handleCommitClick}
                className="font-mono text-sm text-accent-cyan hover:underline cursor-pointer"
                title={`View commit ${commit.hash}`}
              >
                {commit.shortHash}
              </button>
              <span className="text-forensic-text-primary truncate">
                {commit.message || 'No commit message'}
              </span>
            </div>

            {/* Meta info */}
            <div className="flex items-center gap-4 text-xs text-forensic-text-muted">
              {/* Branch */}
              {commit.branch && (
                <div className="flex items-center gap-1">
                  <GitBranch className="w-3 h-3" />
                  <span className="font-mono">{commit.branch}</span>
                </div>
              )}

              {/* Author */}
              {commit.authorName && (
                <div className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  <span>{commit.authorName}</span>
                </div>
              )}

              {/* Time */}
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>{formattedDate}</span>
              </div>

              {/* Session count */}
              <div className="flex items-center gap-1 text-accent-green">
                <PlayCircle className="w-3 h-3" />
                <span>
                  {commit.sessionCount} {commit.sessionCount === 1 ? 'session' : 'sessions'}
                </span>
              </div>
            </div>
          </div>

          {/* View commit button */}
          <button
            onClick={handleCommitClick}
            className="px-3 py-1.5 text-xs font-mono bg-forensic-bg-primary hover:bg-forensic-bg-tertiary border border-forensic-border rounded transition-colors text-forensic-text-secondary hover:text-forensic-text-primary"
          >
            View
          </button>
        </div>
      </div>

      {/* Expanded sessions list */}
      {expanded && commit.sessionIds.length > 0 && (
        <div className="border-t border-forensic-border bg-forensic-bg-primary/50">
          <div className="px-4 py-2">
            <div className="text-xs font-mono text-forensic-text-muted mb-2 pl-8">
              CONTRIBUTING SESSIONS
            </div>
            <div className="space-y-1 pl-8">
              {commit.sessionIds.map((sessionId) => (
                <Link
                  key={sessionId}
                  to={`/session/${sessionId}`}
                  className="flex items-center gap-2 px-3 py-2 rounded bg-forensic-bg-secondary hover:bg-forensic-bg-tertiary transition-colors"
                >
                  <PlayCircle className="w-4 h-4 text-accent-green" />
                  <span className="font-mono text-sm text-accent-cyan hover:underline truncate">
                    {sessionId.slice(0, 8)}...
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommitCard;
