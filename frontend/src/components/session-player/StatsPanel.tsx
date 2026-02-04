/**
 * StatsPanel Component
 *
 * Collapsible panel showing session statistics:
 * - Frame counts by type
 * - Duration breakdown
 * - Tool usage
 * - Compression savings
 */

import React from 'react';
import type { SessionStats } from '../../hooks/useSessionStats';

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
  const frameTypeLabels: Record<string, { icon: string; label: string; color: string }> = {
    user_message: { icon: '👤', label: 'User', color: 'text-blue-400' },
    claude_thinking: { icon: '🧠', label: 'Thinking', color: 'text-purple-400' },
    claude_response: { icon: '🤖', label: 'Claude', color: 'text-green-400' },
    tool_execution: { icon: '🛠️', label: 'Tools', color: 'text-orange-400' },
  };

  const totalFrames = Object.values(stats.frameCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-300 uppercase">Session Statistics</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-lg"
            title="Close statistics (s)"
          >
            ×
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Frame Counts */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
              Frames ({totalFrames})
            </h4>
            <div className="space-y-1">
              {Object.entries(stats.frameCounts).map(([type, count]) => {
                const meta = frameTypeLabels[type];
                if (!meta) return null;
                const percentage = totalFrames > 0 ? Math.round((count / totalFrames) * 100) : 0;
                return (
                  <div key={type} className="flex items-center justify-between text-sm">
                    <span className={meta.color}>
                      {meta.icon} {meta.label}
                    </span>
                    <span className="text-gray-400">
                      {count} <span className="text-gray-500">({percentage}%)</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Duration */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Duration</h4>
            <div className="space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Total</span>
                <span className="text-gray-400 font-mono">
                  {formatDuration(stats.totalDuration)}
                </span>
              </div>
              {stats.compressionStats.compressedFrameCount > 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-amber-400">Time Saved</span>
                    <span className="text-amber-400 font-mono">
                      {formatDuration(stats.compressionStats.timeSaved)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Compressed Frames</span>
                    <span className="text-gray-500">
                      {stats.compressionStats.compressedFrameCount}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Top Tools */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Top Tools</h4>
            <div className="space-y-1 text-sm">
              {stats.toolUsage.slice(0, 5).map((tool) => (
                <div key={tool.tool} className="flex items-center justify-between">
                  <span className="text-orange-400 font-mono">{tool.tool}</span>
                  <span className="text-gray-400">
                    {tool.count}
                    {tool.errors > 0 && (
                      <span className="text-red-400 ml-1">({tool.errors} err)</span>
                    )}
                  </span>
                </div>
              ))}
              {stats.toolUsage.length === 0 && (
                <span className="text-gray-500 italic">No tool executions</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
