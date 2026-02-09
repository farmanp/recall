/**
 * ArtifactSummaryBar Component
 *
 * Displays compact summary statistics for file artifacts in the session player.
 * Shows counts of created, modified, and read-only files with color-coded icons.
 */

import React from 'react';
import { FolderOpen, Plus, Edit, Eye } from 'lucide-react';
import type { ArtifactsSummary } from '../../types/artifacts';

interface ArtifactSummaryBarProps {
  summary: ArtifactsSummary;
  currentFrameIndex: number;
  totalFrames: number;
  viewMode: 'cumulative' | 'full';
}

export const ArtifactSummaryBar: React.FC<ArtifactSummaryBarProps> = ({
  summary,
  currentFrameIndex,
  totalFrames,
  viewMode,
}) => {
  return (
    <div className="flex items-center gap-4 px-3 py-2 bg-gray-800 border-b border-gray-700 text-sm">
      {/* Total Files */}
      <div className="flex items-center gap-1.5 text-gray-300">
        <FolderOpen className="w-4 h-4 text-gray-400" />
        <span className="font-medium">{summary.totalFiles}</span>
        <span className="text-gray-500">files</span>
      </div>

      {/* Separator */}
      <div className="h-4 w-px bg-gray-700" />

      {/* Created Count */}
      <div className="flex items-center gap-1.5">
        <Plus className="w-4 h-4 text-green-500" />
        <span className="text-green-400 font-medium">{summary.createdCount}</span>
        <span className="text-gray-500">created</span>
      </div>

      {/* Modified Count */}
      <div className="flex items-center gap-1.5">
        <Edit className="w-4 h-4 text-orange-500" />
        <span className="text-orange-400 font-medium">{summary.modifiedCount}</span>
        <span className="text-gray-500">modified</span>
      </div>

      {/* Read-Only Count */}
      <div className="flex items-center gap-1.5">
        <Eye className="w-4 h-4 text-blue-500" />
        <span className="text-blue-400 font-medium">{summary.readOnlyCount}</span>
        <span className="text-gray-500">read-only</span>
      </div>

      {/* Frame info in cumulative mode */}
      {viewMode === 'cumulative' && totalFrames > 0 && (
        <>
          <div className="h-4 w-px bg-gray-700" />
          <div className="text-gray-500 text-xs">
            Up to frame <span className="text-gray-400">{currentFrameIndex + 1}</span> of{' '}
            <span className="text-gray-400">{totalFrames}</span>
          </div>
        </>
      )}
    </div>
  );
};

export default ArtifactSummaryBar;
