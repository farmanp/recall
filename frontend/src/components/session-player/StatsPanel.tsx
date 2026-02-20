/**
 * StatsPanel Component
 *
 * Collapsible panel showing session statistics:
 * - Frame counts by type
 * - Duration breakdown
 * - Tool usage
 * - Compression savings
 *
 * Forensic terminal aesthetic
 */

import React from 'react';
import type { SessionStats } from '../../hooks/useSessionStats';
import { BarChart2, Clock, Wrench, X, Zap } from 'lucide-react';

interface StatsPanelProps {
  stats: SessionStats;
  onClose: () => void;
}

/**
 * Format milliseconds to human-readable duration
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

export const StatsPanel: React.FC<StatsPanelProps> = ({ stats, onClose }) => {
  const frameTypeLabels: Record<string, { label: string; color: string }> = {
    user_message: { label: 'USER', color: 'text-accent-cyan' },
    claude_thinking: { label: 'THINKING', color: 'text-accent-purple' },
    claude_response: { label: 'RESPONSE', color: 'text-accent-green' },
    tool_execution: { label: 'TOOL', color: 'text-accent-amber' },
  };

  const totalFrames = Object.values(stats.frameCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="bg-forensic-bg-secondary border-b border-forensic-border px-6 py-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-mono text-sm text-accent-green uppercase tracking-wide flex items-center gap-2">
            <BarChart2 className="w-4 h-4" />
            // Session Statistics
          </h3>
          <button
            onClick={onClose}
            className="text-forensic-text-muted hover:text-forensic-text-primary transition-colors"
            title="Close statistics (s)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Frame Counts */}
          <div className="bg-forensic-bg-tertiary border border-forensic-border p-4">
            <h4 className="font-mono text-xs text-forensic-text-muted uppercase tracking-wide mb-3 flex items-center gap-2">
              Frames
              <span className="text-accent-green">({totalFrames})</span>
            </h4>
            <div className="space-y-2">
              {Object.entries(stats.frameCounts).map(([type, count]) => {
                const meta = frameTypeLabels[type];
                if (!meta) return null;
                const percentage = totalFrames > 0 ? Math.round((count / totalFrames) * 100) : 0;
                return (
                  <div key={type} className="flex items-center justify-between font-mono text-sm">
                    <span className={meta.color}>{meta.label}</span>
                    <span className="text-forensic-text-secondary">
                      {count} <span className="text-forensic-text-muted">({percentage}%)</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Duration */}
          <div className="bg-forensic-bg-tertiary border border-forensic-border p-4">
            <h4 className="font-mono text-xs text-forensic-text-muted uppercase tracking-wide mb-3 flex items-center gap-2">
              <Clock className="w-3 h-3" />
              Duration
            </h4>
            <div className="space-y-2 font-mono text-sm">
              <div className="flex items-center justify-between">
                <span className="text-forensic-text-secondary">Total</span>
                <span className="text-accent-green">{formatDuration(stats.totalDuration)}</span>
              </div>
              {stats.compressionStats.compressedFrameCount > 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-forensic-text-secondary">Time Saved</span>
                    <span className="text-accent-amber">
                      {formatDuration(stats.compressionStats.timeSaved)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-forensic-text-muted">Compressed</span>
                    <span className="text-forensic-text-muted">
                      {stats.compressionStats.compressedFrameCount} frames
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Top Tools */}
          <div className="bg-forensic-bg-tertiary border border-forensic-border p-4">
            <h4 className="font-mono text-xs text-forensic-text-muted uppercase tracking-wide mb-3 flex items-center gap-2">
              <Wrench className="w-3 h-3" />
              Top Tools
            </h4>
            <div className="space-y-2 font-mono text-sm">
              {stats.toolUsage.slice(0, 5).map((tool) => (
                <div key={tool.tool} className="flex items-center justify-between">
                  <span className="text-accent-amber">{tool.tool}</span>
                  <span className="text-forensic-text-secondary">
                    {tool.count}
                    {tool.errors > 0 && (
                      <span className="text-accent-red ml-1">({tool.errors} err)</span>
                    )}
                  </span>
                </div>
              ))}
              {stats.toolUsage.length === 0 && (
                <span className="text-forensic-text-muted italic">// No tool executions</span>
              )}
            </div>
          </div>

          {/* Token Usage */}
          <div className="bg-forensic-bg-tertiary border border-forensic-border p-4">
            <h4 className="font-mono text-xs text-forensic-text-muted uppercase tracking-wide mb-3 flex items-center gap-2">
              <Zap className="w-3 h-3" />
              Token Usage
            </h4>
            <div className="space-y-2 font-mono text-sm">
              {stats.tokenStats.responseCount > 0 ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-accent-cyan">Input</span>
                    <span className="text-forensic-text-secondary">
                      {stats.tokenStats.totalInputTokens.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-accent-green">Output</span>
                    <span className="text-forensic-text-secondary">
                      {stats.tokenStats.totalOutputTokens.toLocaleString()}
                    </span>
                  </div>
                  {stats.tokenStats.totalCacheReadTokens > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-accent-purple">Cache Read</span>
                      <span className="text-forensic-text-secondary">
                        {stats.tokenStats.totalCacheReadTokens.toLocaleString()}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between border-t border-forensic-border pt-2 mt-2">
                    <span className="text-forensic-text-muted">Total</span>
                    <span className="text-accent-yellow">
                      {(
                        stats.tokenStats.totalInputTokens + stats.tokenStats.totalOutputTokens
                      ).toLocaleString()}
                    </span>
                  </div>
                </>
              ) : (
                <span className="text-forensic-text-muted italic">// No token data</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
