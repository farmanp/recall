/**
 * DiffViewer Component
 *
 * Beautiful side-by-side file diff visualization with:
 * - Line-by-line highlighting (additions in green, deletions in red)
 * - Line numbers on both sides
 * - Syntax highlighting
 * - Collapsible/expandable view
 * - Virtual scrolling for large files
 */

import React, { useState, useMemo, useRef, useCallback } from 'react';
import * as Diff from 'diff';
import Prism from 'prismjs';
import { useVirtualizer } from '@tanstack/react-virtual';

// Import Prism components (same as CodeBlock)
import 'prismjs/themes/prism-tomorrow.css';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-sql';

export interface DiffViewerProps {
  filePath: string;
  oldContent?: string;
  newContent: string;
  language: string;
  isEdit?: boolean; // true for Edit tool, false for Write tool
}

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

interface DiffBlock {
  leftLines: DiffLine[];
  rightLines: DiffLine[];
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  filePath,
  oldContent = '',
  newContent,
  language,
  isEdit = true,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [viewMode, setViewMode] = useState<'split' | 'unified'>('split');

  // Syntax highlighting helper with cache
  const highlightCache = useRef<Record<string, string>>({});

  const highlightCode = useCallback((code: string, lang: string): string => {
    if (!code || code.trim() === '') return '\u00A0';

    // Check cache
    const cacheKey = `${lang}:${code}`;
    if (highlightCache.current[cacheKey]) return highlightCache.current[cacheKey];

    // Normalize language name
    const langMap: Record<string, string> = {
      ts: 'typescript',
      tsx: 'tsx',
      js: 'javascript',
      jsx: 'jsx',
      py: 'python',
      md: 'markdown',
      yml: 'yaml',
      yaml: 'yaml',
      html: 'markup',
      css: 'css',
    };
    const prismLang = langMap[lang] || lang || 'plaintext';
    const grammar = Prism.languages[prismLang];

    let result: string;
    if (!grammar) {
      const div = document.createElement('div');
      div.textContent = code;
      result = div.innerHTML;
    } else {
      try {
        result = Prism.highlight(code, grammar, prismLang);
      } catch (e) {
        const div = document.createElement('div');
        div.textContent = code;
        result = div.innerHTML;
      }
    }

    highlightCache.current[cacheKey] = result;
    return result;
  }, []);

  // Compute the diff blocks
  const diffBlocks = useMemo(() => {
    if (!isEdit || !oldContent) {
      // For Write tool, show only the new content
      const lines = newContent.split('\n');
      const rightLines: DiffLine[] = lines.map((content, index) => ({
        type: 'added' as const,
        content,
        newLineNumber: index + 1,
      }));

      return {
        leftLines: [],
        rightLines,
        stats: {
          additions: lines.length,
          deletions: 0,
          unchanged: 0,
        },
      };
    }

    // For Edit tool, compute line-by-line diff
    const changes = Diff.diffLines(oldContent, newContent);
    const leftLines: DiffLine[] = [];
    const rightLines: DiffLine[] = [];
    let oldLineNum = 1;
    let newLineNum = 1;

    let additions = 0;
    let deletions = 0;
    let unchanged = 0;

    changes.forEach((change) => {
      const lines = change.value.split('\n');
      // Remove last empty line if exists
      if (lines[lines.length - 1] === '') {
        lines.pop();
      }

      if (change.added) {
        additions += lines.length;
        lines.forEach((content) => {
          leftLines.push({
            type: 'unchanged',
            content: '',
            oldLineNumber: undefined,
          });
          rightLines.push({
            type: 'added',
            content,
            newLineNumber: newLineNum++,
          });
        });
      } else if (change.removed) {
        deletions += lines.length;
        lines.forEach((content) => {
          leftLines.push({
            type: 'removed',
            content,
            oldLineNumber: oldLineNum++,
          });
          rightLines.push({
            type: 'unchanged',
            content: '',
            newLineNumber: undefined,
          });
        });
      } else {
        unchanged += lines.length;
        lines.forEach((content) => {
          leftLines.push({
            type: 'unchanged',
            content,
            oldLineNumber: oldLineNum++,
          });
          rightLines.push({
            type: 'unchanged',
            content,
            newLineNumber: newLineNum++,
          });
        });
      }
    });

    return {
      leftLines,
      rightLines,
      stats: { additions, deletions, unchanged },
    };
  }, [oldContent, newContent, isEdit]);

  const { leftLines, rightLines, stats } = diffBlocks;

  // Get file extension for icon
  const getFileIcon = (path: string) => {
    const ext = path.split('.').pop()?.toLowerCase();
    const iconMap: Record<string, string> = {
      ts: '📘',
      tsx: '⚛️',
      js: '📜',
      jsx: '⚛️',
      py: '🐍',
      json: '📋',
      md: '📝',
      css: '🎨',
      html: '🌐',
      yml: '⚙️',
      yaml: '⚙️',
    };
    return iconMap[ext || ''] || '📄';
  };

  const parentRef = useRef<HTMLDivElement>(null);

  const splitVirtualizer = useVirtualizer({
    count: Math.max(leftLines.length, rightLines.length),
    getScrollElement: () => parentRef.current,
    estimateSize: () => 24, // Estimate height of a line
    overscan: 10,
  });

  const renderSplitView = () => {
    const virtualItems = splitVirtualizer.getVirtualItems();

    return (
      <div
        ref={parentRef}
        className="max-h-[600px] overflow-auto border border-gray-700 rounded-lg bg-gray-950"
      >
        <div className="relative w-full" style={{ height: `${splitVirtualizer.getTotalSize()}px` }}>
          {virtualItems.map((virtualRow) => {
            const left = leftLines[virtualRow.index];
            const right = rightLines[virtualRow.index];

            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                className="absolute top-0 left-0 w-full flex"
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {/* Left side */}
                {isEdit && oldContent && (
                  <div
                    className={`flex-1 flex border-r border-gray-800 ${
                      left?.type === 'removed'
                        ? 'bg-red-900/30'
                        : left?.type === 'unchanged' && left?.content
                          ? 'bg-gray-900/50'
                          : ''
                    }`}
                  >
                    <div className="w-12 flex-shrink-0 text-right pr-3 py-1 text-[10px] font-mono text-gray-600 select-none border-r border-gray-800 bg-gray-900/20">
                      {left?.oldLineNumber || ''}
                    </div>
                    <div className="flex-1 px-3 py-1 overflow-hidden">
                      <pre className="text-xs font-mono text-gray-300 whitespace-pre">
                        <code
                          dangerouslySetInnerHTML={{
                            __html: left?.content
                              ? highlightCode(left.content, language)
                              : '\u00A0',
                          }}
                        />
                      </pre>
                    </div>
                  </div>
                )}

                {/* Right side */}
                <div
                  className={`flex-1 flex ${
                    right?.type === 'added'
                      ? 'bg-green-900/30'
                      : right?.type === 'unchanged' && right?.content
                        ? 'bg-gray-900/50'
                        : ''
                  }`}
                >
                  <div className="w-12 flex-shrink-0 text-right pr-3 py-1 text-[10px] font-mono text-gray-600 select-none border-r border-gray-800 bg-gray-900/20">
                    {right?.newLineNumber || ''}
                  </div>
                  <div className="flex-1 px-3 py-1 overflow-hidden">
                    <pre className="text-xs font-mono text-gray-300 whitespace-pre">
                      <code
                        dangerouslySetInnerHTML={{
                          __html: right?.content
                            ? highlightCode(right.content, language)
                            : '\u00A0',
                        }}
                      />
                    </pre>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const allLines = useMemo(() => {
    const lines: Array<DiffLine & { side: 'left' | 'right' | 'both' }> = [];
    const maxLines = Math.max(leftLines.length, rightLines.length);
    for (let i = 0; i < maxLines; i++) {
      const left = leftLines[i];
      const right = rightLines[i];

      if (left && right && left.type === 'unchanged' && right.type === 'unchanged') {
        lines.push({ ...right, side: 'both' });
      } else {
        if (left && left.type === 'removed') {
          lines.push({ ...left, side: 'left' });
        }
        if (right && right.type === 'added') {
          lines.push({ ...right, side: 'right' });
        }
      }
    }
    return lines;
  }, [leftLines, rightLines]);

  const unifiedVirtualizer = useVirtualizer({
    count: allLines.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 24,
    overscan: 10,
  });

  const renderUnifiedView = () => {
    const virtualItems = unifiedVirtualizer.getVirtualItems();

    return (
      <div
        ref={parentRef}
        className="max-h-[600px] overflow-auto border border-gray-700 rounded-lg bg-gray-950"
      >
        <div
          className="relative w-full"
          style={{ height: `${unifiedVirtualizer.getTotalSize()}px` }}
        >
          {virtualItems.map((virtualRow) => {
            const line = allLines[virtualRow.index];
            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                className={`absolute top-0 left-0 w-full flex ${
                  line.type === 'added'
                    ? 'bg-green-900/30'
                    : line.type === 'removed'
                      ? 'bg-red-900/30'
                      : 'bg-gray-900/50'
                }`}
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <div className="w-12 flex-shrink-0 text-right pr-3 py-1 text-[10px] font-mono text-gray-600 select-none border-r border-gray-800 bg-gray-900/20">
                  {line.oldLineNumber || line.newLineNumber || ''}
                </div>
                <div className="w-6 flex-shrink-0 text-center py-1 text-xs font-bold border-r border-gray-800">
                  {line.type === 'added' ? (
                    <span className="text-green-400">+</span>
                  ) : line.type === 'removed' ? (
                    <span className="text-red-400">-</span>
                  ) : (
                    ''
                  )}
                </div>
                <div className="flex-1 px-3 py-1 overflow-hidden">
                  <pre className="text-xs font-mono text-gray-300 whitespace-pre">
                    <code
                      dangerouslySetInnerHTML={{ __html: highlightCode(line.content, language) }}
                    />
                  </pre>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="bg-gray-800 px-4 py-3 flex items-center justify-between border-b border-gray-700">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label={isCollapsed ? 'Expand diff' : 'Collapse diff'}
          >
            {isCollapsed ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            )}
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xl">{getFileIcon(filePath)}</span>
            <span className="font-mono text-sm text-gray-200">{filePath}</span>
          </div>

          <div className="flex items-center gap-2 ml-4">
            {stats.additions > 0 && (
              <span className="px-2 py-0.5 bg-green-900/50 text-green-300 text-xs rounded font-semibold">
                +{stats.additions}
              </span>
            )}
            {stats.deletions > 0 && (
              <span className="px-2 py-0.5 bg-red-900/50 text-red-300 text-xs rounded font-semibold">
                -{stats.deletions}
              </span>
            )}
          </div>
        </div>

        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('split')}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                viewMode === 'split'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Split
            </button>
            <button
              onClick={() => setViewMode('unified')}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                viewMode === 'unified'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Unified
            </button>
          </div>
        )}
      </div>

      {/* Diff Content */}
      {!isCollapsed && (
        <div className="relative">
          {viewMode === 'split' ? renderSplitView() : renderUnifiedView()}
        </div>
      )}
    </div>
  );
};
