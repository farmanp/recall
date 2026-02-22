/**
 * CompactionBoundary Component
 *
 * Displays a horizontal divider/boundary marker in the transcript when
 * context compaction occurs. Shows token reduction stats and frame count.
 * Uses amber/yellow accent colors to draw attention to this system event.
 */

import React from 'react';
import { Scissors, TrendingDown } from 'lucide-react';
import type { CompactionInfo } from '../../../types/transcript';

interface CompactionBoundaryProps {
  compaction: CompactionInfo;
}

/**
 * Format token count for display (e.g., 150000 -> "150K")
 */
function formatTokens(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${Math.round(count / 1000)}K`;
  }
  return String(count);
}

/**
 * Calculate reduction percentage
 */
function getReductionPercent(before: number, after: number): number {
  if (before === 0) return 0;
  return Math.round(((before - after) / before) * 100);
}

export const CompactionBoundary: React.FC<CompactionBoundaryProps> = ({ compaction }) => {
  const { tokensBefore, tokensAfter, summarizedFrames } = compaction;
  const reductionPercent = getReductionPercent(tokensBefore, tokensAfter);

  return (
    <div className="my-6 relative">
      {/* Horizontal line with gradient fade */}
      <div className="absolute inset-0 flex items-center" aria-hidden="true">
        <div className="w-full border-t border-dashed border-accent-amber/40" />
      </div>

      {/* Center label */}
      <div className="relative flex justify-center">
        <div className="bg-forensic-bg-primary px-4 py-2 flex items-center gap-3 border border-accent-amber/30 rounded-lg">
          {/* Icon */}
          <div className="flex items-center justify-center w-6 h-6 rounded bg-accent-amber/20">
            <Scissors className="w-3.5 h-3.5 text-accent-amber" />
          </div>

          {/* Label */}
          <span className="font-mono text-xs font-semibold text-accent-amber uppercase tracking-wider">
            Context Compacted
          </span>

          {/* Divider */}
          <div className="w-px h-4 bg-accent-amber/30" />

          {/* Token delta */}
          <div className="flex items-center gap-1.5 font-mono text-xs">
            <span className="text-forensic-text-secondary">{formatTokens(tokensBefore)}</span>
            <TrendingDown className="w-3 h-3 text-accent-amber" />
            <span className="text-accent-amber font-semibold">{formatTokens(tokensAfter)}</span>
            <span className="text-forensic-text-muted">tokens</span>
          </div>

          {/* Reduction badge */}
          <span className="px-1.5 py-0.5 bg-accent-amber/20 text-accent-amber text-[10px] font-mono font-semibold rounded">
            -{reductionPercent}%
          </span>

          {/* Summarized frames count (if available) */}
          {summarizedFrames !== undefined && summarizedFrames > 0 && (
            <>
              <div className="w-px h-4 bg-accent-amber/30" />
              <span className="font-mono text-xs text-forensic-text-muted">
                {summarizedFrames} frame{summarizedFrames !== 1 ? 's' : ''} summarized
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
