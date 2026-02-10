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
  const [fileContents, setFileContents] = useState<Record<string, string | null>>({});
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set());

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

  const fetchContent = async (filePath: string) => {
    if (fileContents[filePath] !== undefined || loadingPaths.has(filePath)) {
      return;
    }

    setLoadingPaths((prev) => new Set(prev).add(filePath));

    try {
      const response = await fetch(
        `http://localhost:3001/api/sessions/claudemd/content?path=${encodeURIComponent(filePath)}`
      );
      const data = await response.json();

      if (data.exists && data.content) {
        setFileContents((prev) => ({ ...prev, [filePath]: data.content }));
      } else {
        setFileContents((prev) => ({ ...prev, [filePath]: null }));
      }
    } catch (error) {
      console.error('Failed to fetch CLAUDE.md content:', error);
      setFileContents((prev) => ({ ...prev, [filePath]: null }));
    } finally {
      setLoadingPaths((prev) => {
        const next = new Set(prev);
        next.delete(filePath);
        return next;
      });
    }
  };

  const toggleExpand = (index: number) => {
    if (expandedIndex === index) {
      setExpandedIndex(null);
    } else {
      setExpandedIndex(index);
      // Fetch content when expanding
      const file = claudeMdFiles[index];
      if (file) {
        fetchContent(file.path);
      }
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-forensic-bg-secondary border border-forensic-border max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Terminal Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-forensic-bg-tertiary border-b border-forensic-border">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-accent-red"></div>
            <div className="w-3 h-3 rounded-full bg-accent-amber"></div>
            <div className="w-3 h-3 rounded-full bg-accent-green"></div>
          </div>
          <div className="flex items-center gap-2 font-mono text-xs text-forensic-text-secondary uppercase tracking-wide">
            Project Instructions
          </div>
          <button
            onClick={onClose}
            className="text-forensic-text-muted hover:text-forensic-text-primary text-xl font-bold"
          >
            ×
          </button>
        </div>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-forensic-border">
          <div>
            <h2 className="text-xl font-mono font-bold text-forensic-text-primary uppercase tracking-wide">
              CLAUDE.md Files
            </h2>
            <p className="text-sm font-mono text-forensic-text-secondary mt-1">
              Context loaded during this session
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-forensic-bg-primary">
          {claudeMdFiles.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-accent-amber text-4xl mb-4 font-mono">//</div>
              <p className="text-forensic-text-secondary font-mono">
                No CLAUDE.md files were loaded during this session.
              </p>
              <p className="text-forensic-text-muted text-sm font-mono mt-2">
                CLAUDE.md files provide project-specific instructions to the AI.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {claudeMdFiles.map((file, index) => (
                <div key={file.path} className="border border-forensic-border overflow-hidden">
                  {/* File Header - Clickable */}
                  <button
                    onClick={() => toggleExpand(index)}
                    className="w-full flex items-center justify-between p-4 bg-forensic-bg-tertiary hover:bg-forensic-border transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-accent-green font-mono text-lg">$</span>
                      <div>
                        <div className="text-forensic-text-primary font-mono font-medium">
                          {getDirectoryLabel(file.path)}
                        </div>
                        <div className="text-xs text-forensic-text-muted font-mono mt-0.5">
                          {getShortPath(file.path)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-forensic-text-muted font-mono">
                        {formatTime(file.loadedAt)}
                      </span>
                      <span className="text-accent-green">
                        {expandedIndex === index ? '▼' : '▶'}
                      </span>
                    </div>
                  </button>

                  {/* Expanded Content */}
                  {expandedIndex === index && (
                    <div className="border-t border-forensic-border p-4 bg-forensic-bg-primary">
                      {loadingPaths.has(file.path) ? (
                        <p className="text-forensic-text-secondary text-sm font-mono">
                          Loading content...
                        </p>
                      ) : fileContents[file.path] ? (
                        <pre className="text-sm text-forensic-text-secondary font-mono whitespace-pre-wrap overflow-x-auto max-h-96 overflow-y-auto">
                          {fileContents[file.path]}
                        </pre>
                      ) : fileContents[file.path] === null ? (
                        <p className="text-forensic-text-muted text-sm font-mono italic">
                          File not found. The file may have been moved or deleted since the session.
                        </p>
                      ) : (
                        <p className="text-forensic-text-secondary text-sm font-mono">
                          Click to load content...
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
        <div className="p-4 border-t border-forensic-border flex items-center justify-between bg-forensic-bg-secondary">
          <div className="text-xs font-mono text-forensic-text-muted">
            Press{' '}
            <kbd className="px-1.5 py-0.5 bg-forensic-bg-tertiary border border-forensic-border text-forensic-text-secondary">
              d
            </kbd>{' '}
            to toggle,{' '}
            <kbd className="px-1.5 py-0.5 bg-forensic-bg-tertiary border border-forensic-border text-forensic-text-secondary">
              Esc
            </kbd>{' '}
            to close
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-forensic-bg-tertiary hover:bg-forensic-border border border-forensic-border text-forensic-text-primary font-mono uppercase tracking-wide text-sm transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClaudeMdPanel;
