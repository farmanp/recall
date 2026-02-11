/**
 * GitBadge Component
 *
 * Displays git branch and commit information in a compact badge format.
 * Shows dirty state indicator when there are uncommitted changes.
 */

import React from 'react';
import { GitBranch, GitCommit } from 'lucide-react';

interface GitBadgeProps {
  branch?: string;
  commit?: string;
  isDirty?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md';
}

export const GitBadge: React.FC<GitBadgeProps> = ({
  branch,
  commit,
  isDirty,
  onClick,
  size = 'sm',
}) => {
  if (!branch && !commit) return null;

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-2.5 py-1 text-xs',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
  };

  const baseClasses = `flex items-center gap-1.5 ${sizeClasses[size]} bg-accent-purple/10 border border-accent-purple/30 text-accent-purple font-mono hover:bg-accent-purple/20 transition-colors`;

  const content = (
    <>
      <GitBranch className={iconSizes[size]} />
      <span>{branch || 'detached'}</span>
      {commit && (
        <>
          <span className="text-accent-purple/50">@</span>
          <GitCommit className={iconSizes[size]} />
          <span>{commit.slice(0, 7)}</span>
        </>
      )}
      {isDirty && (
        <span className="text-accent-amber" title="Uncommitted changes">
          *
        </span>
      )}
    </>
  );

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className={baseClasses}
        title={`Branch: ${branch || 'detached'}\nCommit: ${commit || 'unknown'}`}
      >
        {content}
      </button>
    );
  }

  return (
    <span
      className={baseClasses}
      title={`Branch: ${branch || 'detached'}\nCommit: ${commit || 'unknown'}`}
    >
      {content}
    </span>
  );
};

export default GitBadge;
