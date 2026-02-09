/**
 * ArtifactFileRow Component
 *
 * Displays a single file artifact with expand/collapse functionality.
 * Shows file icon, filename, path, change stats, and status badge in collapsed state.
 * Expanded state shows full path, list of operations with frame numbers, and optional inline diff viewer.
 */

import React, { useState } from 'react';
import {
  File,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  AlertCircle,
  Eye,
  X,
} from 'lucide-react';
import type { ArtifactFile, ArtifactOperation, ArtifactStatus } from '../../types/artifacts';
import { CodeBlock } from '../CodeBlock';
import { DiffViewer } from '../DiffViewer';

interface ArtifactFileRowProps {
  artifact: ArtifactFile;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onNavigateToFrame: (frameIndex: number) => void;
}

/**
 * Get the status badge configuration based on artifact status
 */
function getStatusBadge(status: ArtifactStatus): {
  label: string;
  bgColor: string;
  textColor: string;
} {
  switch (status) {
    case 'created':
      return { label: 'Created', bgColor: 'bg-green-900/50', textColor: 'text-green-400' };
    case 'modified':
      return { label: 'Modified', bgColor: 'bg-orange-900/50', textColor: 'text-orange-400' };
    case 'read_only':
      return { label: 'Read', bgColor: 'bg-blue-900/50', textColor: 'text-blue-400' };
    default:
      return { label: 'Unknown', bgColor: 'bg-gray-700', textColor: 'text-gray-400' };
  }
}

/**
 * Get operation type label and color
 */
function getOperationStyle(type: ArtifactOperation['type']): { label: string; color: string } {
  switch (type) {
    case 'write':
      return { label: 'Write', color: 'text-green-400' };
    case 'edit':
      return { label: 'Edit', color: 'text-orange-400' };
    case 'read':
      return { label: 'Read', color: 'text-blue-400' };
    default:
      return { label: type, color: 'text-gray-400' };
  }
}

/**
 * Truncate a path for display, keeping the end visible
 */
function truncatePath(path: string, maxLength: number = 40): string {
  if (path.length <= maxLength) {
    return path;
  }
  return '...' + path.slice(-(maxLength - 3));
}

/**
 * Format change stats (+X -Y)
 */
function formatChangeStats(additions: number, deletions: number): string | null {
  if (additions === 0 && deletions === 0) {
    return null;
  }
  const parts: string[] = [];
  if (additions > 0) {
    parts.push(`+${additions}`);
  }
  if (deletions > 0) {
    parts.push(`-${deletions}`);
  }
  return parts.join(' ');
}

/**
 * Format timestamp to readable time
 */
function formatTime(timestamp: number): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return 'Unknown';
  }
}

export const ArtifactFileRow: React.FC<ArtifactFileRowProps> = ({
  artifact,
  isExpanded,
  onToggleExpand,
  onNavigateToFrame,
}) => {
  const [viewingOperation, setViewingOperation] = useState<ArtifactOperation | null>(null);
  const statusBadge = getStatusBadge(artifact.status);
  const changeStats = formatChangeStats(artifact.totalAdditions, artifact.totalDeletions);

  // Check if operation has viewable content
  const hasViewableContent = (op: ArtifactOperation): boolean => {
    if (op.type === 'read' && op.content) return true;
    if ((op.type === 'write' || op.type === 'edit') && op.diff?.newContent) return true;
    return false;
  };

  return (
    <div
      className={`border rounded-lg overflow-hidden transition-colors ${
        artifact.hasErrors
          ? 'border-red-700 bg-red-900/10'
          : 'border-gray-700 hover:border-gray-600'
      }`}
    >
      {/* Collapsed Header - Clickable */}
      <button
        onClick={onToggleExpand}
        className="w-full flex items-center justify-between p-3 bg-gray-800 hover:bg-gray-750 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Expand/Collapse Icon */}
          <span className="text-gray-400 flex-shrink-0">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </span>

          {/* File Icon */}
          <span className="text-gray-400 flex-shrink-0">
            {isExpanded ? <FolderOpen className="w-4 h-4" /> : <File className="w-4 h-4" />}
          </span>

          {/* Filename and Path */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-white font-medium truncate">{artifact.filename}</span>
              {artifact.hasErrors && <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />}
            </div>
            <div className="text-xs text-gray-500 font-mono truncate" title={artifact.directory}>
              {truncatePath(artifact.directory)}
            </div>
          </div>
        </div>

        {/* Right side: Change stats, Status badge */}
        <div className="flex items-center gap-3 flex-shrink-0 ml-2">
          {/* Change Stats */}
          {changeStats && (
            <span className="text-xs font-mono">
              {artifact.totalAdditions > 0 && (
                <span className="text-green-400">+{artifact.totalAdditions}</span>
              )}
              {artifact.totalAdditions > 0 && artifact.totalDeletions > 0 && (
                <span className="text-gray-500"> </span>
              )}
              {artifact.totalDeletions > 0 && (
                <span className="text-red-400">-{artifact.totalDeletions}</span>
              )}
            </span>
          )}

          {/* Status Badge */}
          <span
            className={`px-2 py-0.5 text-xs font-medium rounded ${statusBadge.bgColor} ${statusBadge.textColor}`}
          >
            {statusBadge.label}
          </span>
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-gray-700 bg-gray-900">
          {/* Full Path */}
          <div className="px-4 py-2 border-b border-gray-800">
            <span className="text-xs text-gray-500">Full path: </span>
            <span className="text-xs text-gray-400 font-mono break-all">{artifact.path}</span>
          </div>

          {/* Operations List */}
          <div className="divide-y divide-gray-800">
            {artifact.operations.map((operation, index) => {
              const opStyle = getOperationStyle(operation.type);
              return (
                <div key={index} className={operation.isError ? 'bg-red-900/20' : ''}>
                  <div className="px-4 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Operation Type */}
                      <span className={`text-xs font-medium ${opStyle.color}`}>
                        {opStyle.label}
                      </span>

                      {/* Tool Name */}
                      <span className="text-xs text-gray-500 font-mono">{operation.tool}</span>

                      {/* Timestamp */}
                      <span className="text-xs text-gray-600">
                        {formatTime(operation.timestamp)}
                      </span>

                      {/* Diff Stats (if available) */}
                      {operation.diff &&
                        (operation.diff.additions > 0 || operation.diff.deletions > 0) && (
                          <span className="text-xs font-mono">
                            {operation.diff.additions > 0 && (
                              <span className="text-green-500">+{operation.diff.additions}</span>
                            )}
                            {operation.diff.additions > 0 && operation.diff.deletions > 0 && (
                              <span className="text-gray-600"> </span>
                            )}
                            {operation.diff.deletions > 0 && (
                              <span className="text-red-500">-{operation.diff.deletions}</span>
                            )}
                          </span>
                        )}

                      {/* Error Indicator */}
                      {operation.isError && (
                        <span className="flex items-center gap-1 text-xs text-red-400">
                          <AlertCircle className="w-3 h-3" />
                          {operation.errorMessage ? (
                            <span className="truncate max-w-[200px]" title={operation.errorMessage}>
                              {operation.errorMessage}
                            </span>
                          ) : (
                            'Error'
                          )}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {/* View Content Button */}
                      {hasViewableContent(operation) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewingOperation(viewingOperation === operation ? null : operation);
                          }}
                          className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
                            viewingOperation === operation
                              ? 'bg-cyan-600 text-white'
                              : 'text-gray-400 hover:text-white hover:bg-gray-700'
                          }`}
                          title="View content"
                        >
                          <Eye className="w-3 h-3" />
                          <span>View</span>
                        </button>
                      )}

                      {/* Go to Frame Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigateToFrame(operation.frameIndex);
                        }}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                        title={`Go to frame ${operation.frameIndex}`}
                      >
                        <span className="font-mono">#{operation.frameIndex}</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Inline Content Viewer */}
                  {viewingOperation === operation && (
                    <div className="mx-4 mb-2 border border-gray-700 rounded-lg overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2 bg-gray-800 border-b border-gray-700">
                        <span className="text-xs text-gray-400">
                          {operation.type === 'read' ? 'File Content' : 'Changes'}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewingOperation(null);
                          }}
                          className="text-gray-400 hover:text-white"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="max-h-[300px] overflow-auto">
                        {operation.type === 'read' && operation.content ? (
                          <CodeBlock
                            code={operation.content}
                            language={artifact.language}
                            showLineNumbers
                            maxHeight="300px"
                          />
                        ) : operation.diff ? (
                          <DiffViewer
                            filePath={artifact.path}
                            oldContent={operation.diff.oldContent || ''}
                            newContent={operation.diff.newContent || ''}
                            language={artifact.language}
                            isEdit={operation.type === 'edit'}
                          />
                        ) : (
                          <div className="p-4 text-gray-500 text-sm">No content available</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Summary Footer */}
          <div className="px-4 py-2 bg-gray-850 border-t border-gray-800 flex items-center justify-between text-xs text-gray-500">
            <span>
              {artifact.operations.length} operation{artifact.operations.length !== 1 ? 's' : ''} |{' '}
              {artifact.reads > 0 && `${artifact.reads} read${artifact.reads !== 1 ? 's' : ''}`}
              {artifact.reads > 0 && (artifact.writes > 0 || artifact.edits > 0) && ', '}
              {artifact.writes > 0 && `${artifact.writes} write${artifact.writes !== 1 ? 's' : ''}`}
              {artifact.writes > 0 && artifact.edits > 0 && ', '}
              {artifact.edits > 0 && `${artifact.edits} edit${artifact.edits !== 1 ? 's' : ''}`}
            </span>
            <span>
              Frames {artifact.firstFrameIndex}
              {artifact.firstFrameIndex !== artifact.lastFrameIndex &&
                ` - ${artifact.lastFrameIndex}`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ArtifactFileRow;
