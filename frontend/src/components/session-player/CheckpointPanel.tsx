/**
 * CheckpointPanel Component
 *
 * Panel listing all checkpoints for a session.
 * Shows: name, frame index, timestamp, file count
 * Actions: create, delete, navigate to frame, compare
 */

import React, { useState } from 'react';
import {
  Bookmark,
  X,
  Plus,
  Trash2,
  Play,
  ArrowLeftRight,
  Clock,
  FileText,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  GitCommit,
} from 'lucide-react';
import type { Checkpoint } from '../../types/competitive';

interface CheckpointPanelProps {
  checkpoints: Checkpoint[];
  currentFrameIndex: number;
  totalFrames: number;
  isLoading?: boolean;
  error?: string | null;
  onClose: () => void;
  onNavigateToFrame: (frameIndex: number) => void;
  onCreate: () => void;
  onDelete: (checkpointId: string) => void;
  onCompare?: (checkpoint1Id: string, checkpoint2Id: string) => void;
}

export const CheckpointPanel: React.FC<CheckpointPanelProps> = ({
  checkpoints,
  currentFrameIndex,
  totalFrames,
  isLoading = false,
  error = null,
  onClose,
  onNavigateToFrame,
  onCreate,
  onDelete,
  onCompare,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleCheckpointClick = (checkpoint: Checkpoint) => {
    if (compareMode) {
      setSelectedForCompare((prev) => {
        if (prev.includes(checkpoint.id)) {
          return prev.filter((id) => id !== checkpoint.id);
        }
        if (prev.length >= 2) {
          return [prev[1], checkpoint.id];
        }
        return [...prev, checkpoint.id];
      });
    } else {
      setExpandedId((prev) => (prev === checkpoint.id ? null : checkpoint.id));
    }
  };

  const handleCompare = () => {
    if (selectedForCompare.length === 2 && onCompare) {
      onCompare(selectedForCompare[0], selectedForCompare[1]);
      setCompareMode(false);
      setSelectedForCompare([]);
    }
  };

  const sortedCheckpoints = [...checkpoints].sort((a, b) => a.frameIndex - b.frameIndex);

  return (
    <aside className="w-[400px] min-w-[350px] max-w-[500px] bg-forensic-bg-secondary border-l border-forensic-border flex flex-col overflow-hidden transition-all duration-200">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-forensic-border bg-forensic-bg-secondary shrink-0">
        <div className="flex items-center gap-2">
          <Bookmark className="w-5 h-5 text-accent-cyan" />
          <h2 className="text-sm font-mono font-bold text-forensic-text-primary uppercase tracking-wide">
            Checkpoints
          </h2>
          <span className="text-xs font-mono text-forensic-text-muted">({checkpoints.length})</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onCreate}
            className="flex items-center gap-1 px-2 py-1 bg-accent-green/10 border border-accent-green/30 text-accent-green text-xs font-mono hover:bg-accent-green/20 transition-colors"
            title="Create checkpoint at current frame"
          >
            <Plus className="w-3 h-3" />
            New
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-forensic-text-secondary hover:text-forensic-text-primary hover:bg-forensic-bg-tertiary transition-colors"
            title="Close panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Compare Mode Toolbar */}
      {onCompare && checkpoints.length >= 2 && (
        <div className="px-4 py-2 border-b border-forensic-border bg-forensic-bg-tertiary">
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                setCompareMode(!compareMode);
                setSelectedForCompare([]);
              }}
              className={`flex items-center gap-1.5 px-2 py-1 text-xs font-mono transition-colors ${
                compareMode
                  ? 'bg-accent-amber/20 text-accent-amber border border-accent-amber/30'
                  : 'text-forensic-text-secondary hover:text-forensic-text-primary'
              }`}
            >
              <ArrowLeftRight className="w-3 h-3" />
              Compare Mode
            </button>
            {compareMode && selectedForCompare.length === 2 && (
              <button
                onClick={handleCompare}
                className="px-2 py-1 bg-accent-cyan/10 border border-accent-cyan/30 text-accent-cyan text-xs font-mono hover:bg-accent-cyan/20 transition-colors"
              >
                Compare Selected
              </button>
            )}
          </div>
          {compareMode && (
            <p className="text-[10px] font-mono text-forensic-text-muted mt-1">
              Select 2 checkpoints to compare ({selectedForCompare.length}/2 selected)
            </p>
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-forensic-text-muted font-mono text-sm">Loading checkpoints...</div>
          </div>
        ) : error ? (
          <div className="p-4">
            <div className="flex items-center gap-2 text-accent-red">
              <AlertCircle className="w-4 h-4" />
              <span className="font-mono text-sm">{error}</span>
            </div>
          </div>
        ) : checkpoints.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <Bookmark className="w-10 h-10 text-forensic-text-muted mb-3" />
            <p className="text-forensic-text-secondary font-mono text-sm mb-2">
              No checkpoints yet
            </p>
            <p className="text-forensic-text-muted font-mono text-xs max-w-[250px]">
              Create a checkpoint to save the current state and easily return to it later.
            </p>
            <button
              onClick={onCreate}
              className="mt-4 flex items-center gap-2 px-3 py-2 bg-accent-green/10 border border-accent-green/30 text-accent-green text-xs font-mono hover:bg-accent-green/20 transition-colors"
            >
              <Plus className="w-3 h-3" />
              Create First Checkpoint
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedCheckpoints.map((checkpoint) => {
              const isExpanded = expandedId === checkpoint.id;
              const isSelected = selectedForCompare.includes(checkpoint.id);
              const isCurrent = checkpoint.frameIndex === currentFrameIndex;
              const progressPercent =
                totalFrames > 1 ? (checkpoint.frameIndex / (totalFrames - 1)) * 100 : 0;

              return (
                <div
                  key={checkpoint.id}
                  className={`border transition-colors ${
                    isSelected
                      ? 'border-accent-amber bg-accent-amber/5'
                      : isCurrent
                        ? 'border-accent-green bg-accent-green/5'
                        : 'border-forensic-border bg-forensic-bg-tertiary hover:bg-forensic-bg-primary'
                  }`}
                >
                  <button
                    onClick={() => handleCheckpointClick(checkpoint)}
                    className="w-full flex items-center gap-2 p-3 text-left"
                  >
                    {compareMode ? (
                      <div
                        className={`w-4 h-4 border flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'border-accent-amber bg-accent-amber'
                            : 'border-forensic-text-muted'
                        }`}
                      >
                        {isSelected && (
                          <span className="text-forensic-bg-primary text-xs">&#10003;</span>
                        )}
                      </div>
                    ) : isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-forensic-text-muted shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-forensic-text-muted shrink-0" />
                    )}
                    <Bookmark
                      className={`w-4 h-4 shrink-0 ${
                        isCurrent ? 'text-accent-green' : 'text-accent-cyan'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-sm text-forensic-text-primary truncate">
                        {checkpoint.name}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-mono text-forensic-text-muted">
                          Frame {checkpoint.frameIndex + 1}
                        </span>
                        {checkpoint.fileCount !== undefined && (
                          <>
                            <span className="text-forensic-border">|</span>
                            <span className="text-[10px] font-mono text-forensic-text-muted">
                              {checkpoint.fileCount} files
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    {isCurrent && (
                      <span className="px-1.5 py-0.5 bg-accent-green/10 text-accent-green text-[10px] font-mono uppercase border border-accent-green/30">
                        Current
                      </span>
                    )}
                  </button>

                  {/* Progress bar showing position in timeline */}
                  <div className="h-0.5 bg-forensic-bg-primary mx-3">
                    <div
                      className="h-full bg-accent-cyan/50"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && !compareMode && (
                    <div className="px-3 pb-3 pt-2 space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                        <div className="flex items-center gap-1.5 text-forensic-text-muted">
                          <Clock className="w-3 h-3" />
                          <span>{formatTimestamp(checkpoint.createdAt)}</span>
                        </div>
                        {checkpoint.gitCommit && (
                          <div className="flex items-center gap-1.5 text-forensic-text-muted">
                            <GitCommit className="w-3 h-3" />
                            <span>{checkpoint.gitCommit.slice(0, 7)}</span>
                          </div>
                        )}
                      </div>

                      {checkpoint.notes && (
                        <p className="text-xs font-mono text-forensic-text-secondary bg-forensic-bg-primary p-2 border border-forensic-border">
                          {checkpoint.notes}
                        </p>
                      )}

                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigateToFrame(checkpoint.frameIndex);
                          }}
                          className="flex items-center gap-1 px-2 py-1 bg-accent-green/10 border border-accent-green/30 text-accent-green text-[10px] font-mono hover:bg-accent-green/20 transition-colors"
                        >
                          <Play className="w-3 h-3" />
                          Go to Frame
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(checkpoint.id);
                          }}
                          className="flex items-center gap-1 px-2 py-1 bg-accent-red/10 border border-accent-red/30 text-accent-red text-[10px] font-mono hover:bg-accent-red/20 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-forensic-border bg-forensic-bg-secondary shrink-0">
        <div className="text-[10px] font-mono text-forensic-text-muted text-center">
          Press{' '}
          <kbd className="px-1 py-0.5 bg-forensic-bg-tertiary border border-forensic-border text-forensic-text-secondary">
            c
          </kbd>{' '}
          to toggle
        </div>
      </div>
    </aside>
  );
};

export default CheckpointPanel;
