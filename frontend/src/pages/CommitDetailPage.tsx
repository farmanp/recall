/**
 * CommitDetailPage Component
 *
 * Detailed view of a single git commit showing:
 * - Commit metadata (hash, message, author, timestamp)
 * - Sessions that contributed to this commit
 * - File changes with expandable diffs
 */

import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  GitCommit,
  GitBranch,
  User,
  Clock,
  ArrowLeft,
  PlayCircle,
  FileText,
  ChevronDown,
  ChevronRight,
  Plus,
  Minus,
  RefreshCw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow, format } from 'date-fns';
import { useCommitDetail, useCommitDiff } from '../hooks/useTranscriptApi';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { DiffViewer } from '../components/DiffViewer';
import type { CommitFileDiff } from '../types/relays';

// Utility to get language from file extension
function getLanguageFromPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const langMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'tsx',
    js: 'javascript',
    jsx: 'jsx',
    py: 'python',
    md: 'markdown',
    yml: 'yaml',
    yaml: 'yaml',
    json: 'json',
    css: 'css',
    sql: 'sql',
    sh: 'bash',
    bash: 'bash',
  };
  return langMap[ext] || 'text';
}

// File diff card component
const FileDiffCard: React.FC<{
  file: CommitFileDiff;
  defaultExpanded?: boolean;
}> = ({ file, defaultExpanded = false }) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const language = getLanguageFromPath(file.path);

  const statusColors = {
    added: 'text-accent-green',
    modified: 'text-accent-amber',
    deleted: 'text-accent-red',
  };

  const statusBadges = {
    added: 'bg-accent-green/10 text-accent-green',
    modified: 'bg-accent-amber/10 text-accent-amber',
    deleted: 'bg-accent-red/10 text-accent-red',
  };

  const hasDiff = file.oldContent !== undefined || file.newContent !== undefined;

  return (
    <div className="border border-forensic-border rounded-lg overflow-hidden">
      {/* File header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-3 bg-forensic-bg-secondary hover:bg-forensic-bg-tertiary transition-colors text-left"
        disabled={!hasDiff}
      >
        {hasDiff ? (
          expanded ? (
            <ChevronDown className="w-4 h-4 text-forensic-text-muted" />
          ) : (
            <ChevronRight className="w-4 h-4 text-forensic-text-muted" />
          )
        ) : (
          <div className="w-4 h-4" />
        )}

        <FileText className={`w-4 h-4 ${statusColors[file.status]}`} />

        <span className="flex-1 font-mono text-sm text-forensic-text-primary truncate">
          {file.path}
        </span>

        {/* Stats */}
        {(file.additions !== undefined || file.deletions !== undefined) && (
          <div className="flex items-center gap-2 text-xs font-mono">
            {file.additions !== undefined && file.additions > 0 && (
              <span className="flex items-center gap-0.5 text-accent-green">
                <Plus className="w-3 h-3" />
                {file.additions}
              </span>
            )}
            {file.deletions !== undefined && file.deletions > 0 && (
              <span className="flex items-center gap-0.5 text-accent-red">
                <Minus className="w-3 h-3" />
                {file.deletions}
              </span>
            )}
          </div>
        )}

        <span className={`px-2 py-0.5 text-[10px] font-mono rounded ${statusBadges[file.status]}`}>
          {file.status.toUpperCase()}
        </span>
      </button>

      {/* Diff content */}
      <AnimatePresence>
        {expanded && hasDiff && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-forensic-border">
              <DiffViewer
                filePath={file.path}
                oldContent={file.oldContent}
                newContent={file.newContent || ''}
                language={language}
                isEdit={file.status === 'modified'}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const CommitDetailPage: React.FC = () => {
  const { hash } = useParams<{ hash: string }>();
  const navigate = useNavigate();

  // Fetch commit detail
  const { data: detail, isLoading: detailLoading, error: detailError } = useCommitDetail(hash);

  // Fetch commit diffs
  const cwd = detail?.sessions[0]?.cwd;
  const { data: diffData, isLoading: diffLoading } = useCommitDiff(hash, cwd);

  const commit = detail?.commit;
  const sessions = detail?.sessions ?? [];
  const files = diffData?.files ?? detail?.files ?? [];

  const formattedDate = commit?.committedAt
    ? formatDistanceToNow(new Date(commit.committedAt), { addSuffix: true })
    : 'Unknown date';

  const fullDate = commit?.committedAt ? format(new Date(commit.committedAt), 'PPpp') : 'Unknown';

  if (detailLoading) {
    return (
      <div className="min-h-screen bg-forensic-bg-primary flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (detailError || !commit) {
    return (
      <div className="min-h-screen bg-forensic-bg-primary p-6">
        <button
          onClick={() => navigate('/relays')}
          className="flex items-center gap-2 text-forensic-text-muted hover:text-forensic-text-primary transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="font-mono text-sm">Back to Relays</span>
        </button>

        <div className="bg-forensic-bg-secondary border border-forensic-border rounded-lg p-8 text-center">
          <GitCommit className="w-12 h-12 text-forensic-text-muted mx-auto mb-4" />
          <h2 className="text-lg font-mono text-forensic-text-primary mb-2">Commit Not Found</h2>
          <p className="text-forensic-text-muted font-mono text-sm">
            The commit with hash "{hash}" could not be found.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-forensic-bg-primary p-6">
      {/* Back button */}
      <button
        onClick={() => navigate('/relays')}
        className="flex items-center gap-2 text-forensic-text-muted hover:text-forensic-text-primary transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="font-mono text-sm">Back to Relays</span>
      </button>

      {/* Commit header */}
      <div className="bg-forensic-bg-secondary border border-forensic-border rounded-lg p-6 mb-6">
        <div className="flex items-start gap-4">
          {/* Commit icon */}
          <div className="p-3 rounded-lg bg-accent-purple/10">
            <GitCommit className="w-6 h-6 text-accent-purple" />
          </div>

          {/* Commit info */}
          <div className="flex-1 min-w-0">
            {/* Hash */}
            <div className="flex items-center gap-3 mb-2">
              <code className="font-mono text-lg text-accent-cyan">{commit.shortHash}</code>
              <code className="font-mono text-xs text-forensic-text-muted">{commit.hash}</code>
            </div>

            {/* Message */}
            <p className="text-forensic-text-primary text-lg mb-4">
              {commit.message || 'No commit message'}
            </p>

            {/* Meta info */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-forensic-text-muted">
              {/* Branch */}
              {commit.branch && (
                <div className="flex items-center gap-1.5">
                  <GitBranch className="w-4 h-4" />
                  <span className="font-mono">{commit.branch}</span>
                </div>
              )}

              {/* Author */}
              {commit.authorName && (
                <div className="flex items-center gap-1.5">
                  <User className="w-4 h-4" />
                  <span>{commit.authorName}</span>
                  {commit.authorEmail && (
                    <span className="text-forensic-text-muted/60">
                      &lt;{commit.authorEmail}&gt;
                    </span>
                  )}
                </div>
              )}

              {/* Time */}
              <div className="flex items-center gap-1.5" title={fullDate}>
                <Clock className="w-4 h-4" />
                <span>{formattedDate}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sessions section */}
      <div className="mb-6">
        <h2 className="text-sm font-mono text-forensic-text-muted mb-3 flex items-center gap-2">
          <PlayCircle className="w-4 h-4 text-accent-green" />
          CONTRIBUTING SESSIONS ({sessions.length})
        </h2>

        {sessions.length === 0 ? (
          <div className="bg-forensic-bg-secondary border border-forensic-border rounded-lg p-4 text-center">
            <p className="text-forensic-text-muted font-mono text-sm">
              No sessions linked to this commit
            </p>
          </div>
        ) : (
          <div className="grid gap-2">
            {sessions.map((session) => (
              <Link
                key={session.sessionId}
                to={`/session/${session.sessionId}`}
                className="flex items-center gap-3 p-3 bg-forensic-bg-secondary border border-forensic-border rounded-lg hover:border-accent-green/50 hover:bg-forensic-bg-tertiary/50 transition-colors"
              >
                <PlayCircle className="w-4 h-4 text-accent-green" />
                <code className="font-mono text-sm text-accent-cyan">
                  {session.sessionId.slice(0, 8)}...
                </code>
                <span className="flex-1 text-sm text-forensic-text-secondary truncate">
                  {session.firstUserMessage || session.project}
                </span>
                {session.duration && (
                  <span className="text-xs font-mono text-forensic-text-muted">
                    {Math.round(session.duration / 60)}m
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Files section */}
      <div>
        <h2 className="text-sm font-mono text-forensic-text-muted mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4 text-accent-amber" />
          FILES CHANGED ({files.length})
          {diffLoading && <RefreshCw className="w-3 h-3 animate-spin text-forensic-text-muted" />}
          {diffData?.truncated && (
            <span className="text-xs text-accent-amber">
              (showing first 10 of {diffData.totalFiles})
            </span>
          )}
        </h2>

        {files.length === 0 && !diffLoading ? (
          <div className="bg-forensic-bg-secondary border border-forensic-border rounded-lg p-4 text-center">
            <p className="text-forensic-text-muted font-mono text-sm">
              No file changes available for this commit
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {files.map((file, index) => (
              <motion.div
                key={file.path}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <FileDiffCard file={file} defaultExpanded={index === 0} />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CommitDetailPage;
