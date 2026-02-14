/**
 * ThinkingBlock Component
 *
 * Collapsible block for displaying Claude's thinking/reasoning.
 * Shows first 3 lines when collapsed, full content when expanded.
 * Uses purple accent styling to distinguish from responses.
 */

import React from 'react';
import { ChevronRight, ChevronDown, Zap, Clock } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { highlightText } from '../../../lib/frameSearch';

interface ThinkingBlockProps {
  text: string;
  timestamp: string;
  frameIndex: number;
  agentName: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
  searchQuery?: string;
}

/**
 * Get preview text (first 3 lines or 200 chars)
 */
function getPreviewText(text: string): string {
  const lines = text.split('\n').slice(0, 3);
  const preview = lines.join('\n');
  if (preview.length > 200) {
    return preview.substring(0, 200) + '...';
  }
  if (text.split('\n').length > 3) {
    return preview + '...';
  }
  return preview;
}

export const ThinkingBlock: React.FC<ThinkingBlockProps> = ({
  text,
  timestamp,
  frameIndex,
  agentName,
  isExpanded,
  onToggleExpand,
  searchQuery = '',
}) => {
  const lineCount = text.split('\n').length;
  const charCount = text.length;
  const needsExpansion = lineCount > 3 || charCount > 200;
  const previewText = getPreviewText(text);

  return (
    <div className="flex items-start gap-4 p-4">
      {/* Avatar */}
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-accent-purple/20 border border-accent-purple/30 flex items-center justify-center">
        <Zap className="w-5 h-5 text-accent-purple" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <span className="font-mono text-sm font-semibold text-accent-purple italic">
            {agentName} thinking
          </span>
          <span className="font-mono text-xs text-forensic-text-muted flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {timestamp}
          </span>
          <span className="font-mono text-xs text-forensic-text-muted">#{frameIndex}</span>
        </div>

        {/* Thinking Content Card */}
        <div className="bg-forensic-bg-secondary border border-accent-purple/20 rounded-lg overflow-hidden">
          {/* Expandable Header (if needed) */}
          {needsExpansion && (
            <button
              onClick={onToggleExpand}
              className="w-full flex items-center gap-2 px-4 py-2 bg-accent-purple/10 hover:bg-accent-purple/15 transition-colors text-left border-b border-accent-purple/20"
            >
              <span className="text-accent-purple">
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </span>
              <span className="font-mono text-xs text-accent-purple/80">
                {isExpanded ? 'Collapse' : 'Expand'} ({lineCount} lines, {charCount} chars)
              </span>
            </button>
          )}

          {/* Content */}
          <div className="p-4">
            {isExpanded || !needsExpansion ? (
              /* Full content */
              <div className="prose prose-invert prose-sm max-w-none prose-p:text-forensic-text-secondary prose-p:italic prose-p:leading-relaxed">
                {searchQuery ? (
                  <div className="whitespace-pre-wrap text-forensic-text-secondary italic">
                    {highlightText(text, searchQuery)}
                  </div>
                ) : (
                  <ReactMarkdown>{text}</ReactMarkdown>
                )}
              </div>
            ) : (
              /* Preview (collapsed) */
              <div className="text-forensic-text-secondary italic font-mono text-sm leading-relaxed whitespace-pre-wrap">
                {searchQuery ? highlightText(previewText, searchQuery) : previewText}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
