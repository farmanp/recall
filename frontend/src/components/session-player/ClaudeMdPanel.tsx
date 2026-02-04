/**
 * ClaudeMdPanel Component
 *
 * Modal overlay showing CLAUDE.md files that were loaded during the session.
 * Provides observability into the context that guided the AI's behavior.
 * Press 'd' to toggle, Escape to close.
 */

import React, { useEffect, useState } from 'react';
import type { ClaudeMdInfo } from '../../types/transcript';

interface ClaudeMdPanelProps {
  claudeMdFiles: ClaudeMdInfo[];
  onClose: () => void;
}

/**
 * Format a timestamp to a readable time string
 */
function formatTime(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return 'Unknown time';
  }
}

/**
 * Extract a short display name from a full path
 */
function getShortPath(fullPath: string): string {
  // Get the last 2-3 path segments for display
  const segments = fullPath.split('/').filter(Boolean);
  if (segments.length <= 3) {
    return fullPath;
  }
  return '.../' + segments.slice(-3).join('/');
}

/**
 * Get the parent directory label (e.g., "frontend", "backend/src")
 */
function getDirectoryLabel(fullPath: string): string {
  const segments = fullPath.split('/').filter(Boolean);
  // Remove the CLAUDE.md filename
  segments.pop();
  if (segments.length === 0) {
    return 'Project Root';
  }
  // Return last 2 segments as the directory label
  return segments.slice(-2).join('/');
}

export const ClaudeMdPanel: React.FC<ClaudeMdPanelProps> = ({ claudeMdFiles, onClose }) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const toggleExpand = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-gray-800 border-2 border-gray-600 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-lg">📋</span>
              Project Instructions
            </h2>
            <p className="text-sm text-gray-400 mt-1">CLAUDE.md files loaded during this session</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl font-bold">
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {claudeMdFiles.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-4">📄</div>
              <p className="text-gray-400">No CLAUDE.md files were loaded during this session.</p>
              <p className="text-gray-500 text-sm mt-2">
                CLAUDE.md files provide project-specific instructions to the AI.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {claudeMdFiles.map((file, index) => (
                <div key={file.path} className="border border-gray-700 rounded-lg overflow-hidden">
                  {/* File Header - Clickable */}
                  <button
                    onClick={() => toggleExpand(index)}
                    className="w-full flex items-center justify-between p-4 bg-gray-750 hover:bg-gray-700 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">📄</span>
                      <div>
                        <div className="text-white font-medium">{getDirectoryLabel(file.path)}</div>
                        <div className="text-xs text-gray-500 font-mono mt-0.5">
                          {getShortPath(file.path)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500">
                        Loaded at {formatTime(file.loadedAt)}
                      </span>
                      <span className="text-gray-400">{expandedIndex === index ? '▼' : '▶'}</span>
                    </div>
                  </button>

                  {/* Expanded Content */}
                  {expandedIndex === index && (
                    <div className="border-t border-gray-700 p-4 bg-gray-900">
                      {file.content ? (
                        <pre className="text-sm text-gray-300 font-mono whitespace-pre-wrap overflow-x-auto max-h-64 overflow-y-auto">
                          {file.content}
                        </pre>
                      ) : (
                        <p className="text-gray-500 text-sm italic">
                          Content not available. The file was loaded but content was not captured in
                          the session log.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-700 flex items-center justify-between">
          <div className="text-xs text-gray-500">
            Press <kbd className="px-1 py-0.5 bg-gray-700 rounded text-gray-300">d</kbd> to toggle,{' '}
            <kbd className="px-1 py-0.5 bg-gray-700 rounded text-gray-300">Esc</kbd> to close
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClaudeMdPanel;
