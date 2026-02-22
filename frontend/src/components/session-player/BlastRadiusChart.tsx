/**
 * BlastRadiusChart Component
 *
 * Visualizes the blast radius of changes by directory.
 * Simple bar chart using CSS - no chart library needed for v1.
 *
 * Forensic terminal aesthetic
 */

import React from 'react';
import { Folder } from 'lucide-react';

interface BlastRadiusChartProps {
  blastRadius: Array<{
    directory: string;
    fileCount: number;
  }>;
}

export const BlastRadiusChart: React.FC<BlastRadiusChartProps> = ({ blastRadius }) => {
  if (blastRadius.length === 0) {
    return null;
  }

  // Find max for scaling
  const maxCount = Math.max(...blastRadius.map((d) => d.fileCount));

  // Color palette for bars
  const colors = [
    'bg-accent-cyan',
    'bg-accent-green',
    'bg-accent-purple',
    'bg-accent-amber',
    'bg-blue-500',
    'bg-pink-500',
    'bg-orange-500',
    'bg-teal-500',
  ];

  return (
    <div>
      <h4 className="font-mono text-xs text-forensic-text-muted uppercase tracking-wide mb-3 flex items-center gap-2">
        <Folder className="w-3 h-3" />
        Blast Radius
      </h4>

      <div className="bg-forensic-bg-tertiary border border-forensic-border p-4 rounded">
        <div className="space-y-2">
          {blastRadius.map((item, idx) => {
            const percentage = (item.fileCount / maxCount) * 100;
            const colorClass = colors[idx % colors.length];
            const displayName = item.directory === '*' ? '(root)' : item.directory;

            return (
              <div key={item.directory} className="flex items-center gap-3">
                {/* Directory name */}
                <div className="w-32 flex-shrink-0 font-mono text-xs text-forensic-text-secondary truncate">
                  {displayName}/
                </div>

                {/* Bar */}
                <div className="flex-1 h-4 bg-forensic-bg-secondary rounded overflow-hidden">
                  <div
                    className={`h-full ${colorClass} transition-all duration-300`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>

                {/* Count */}
                <div className="w-16 flex-shrink-0 font-mono text-xs text-forensic-text-muted text-right">
                  {item.fileCount} {item.fileCount === 1 ? 'file' : 'files'}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-4 pt-3 border-t border-forensic-border/50">
          <div className="font-mono text-xs text-forensic-text-muted">
            {blastRadius.length} {blastRadius.length === 1 ? 'directory' : 'directories'} affected
            <span className="mx-2">•</span>
            {blastRadius.reduce((sum, d) => sum + d.fileCount, 0)} total files
          </div>
        </div>
      </div>
    </div>
  );
};
