/**
 * PromptCard Component
 *
 * Display user prompt event
 * Green accent with collapsible content
 */

import React from 'react';
import type { SessionEvent } from '@/types';
import { formatTimestamp } from '@/lib/formatters';

export interface PromptCardProps {
  event: SessionEvent;
  index: number;
  expanded?: boolean;
  isCurrent?: boolean; // Phase 2
  onToggleExpand?: () => void;
  onClick?: () => void; // Phase 2
}

export const PromptCard: React.FC<PromptCardProps> = ({
  event,
  index,
  expanded = false,
  isCurrent = false,
  onToggleExpand,
  onClick,
}) => {
  const previewLength = 100;
  const isLong = event.text.length > previewLength;
  const displayText =
    !expanded && isLong ? event.text.substring(0, previewLength) + '...' : event.text;

  const handleClick = () => {
    if (onClick) {
      onClick();
    }
  };

  return (
    <div
      className={`
        bg-white border-l-4 border-green-500 rounded-lg p-4 shadow-sm
        ${isCurrent ? 'ring-2 ring-green-500 ring-offset-2' : ''}
        ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}
      `}
      onClick={handleClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-green-600 font-semibold text-sm">🟢 User Prompt</span>
          {event.prompt_number !== null && (
            <span className="text-xs text-gray-500">#{event.prompt_number}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{formatTimestamp(event.ts)}</span>
          {isLong && onToggleExpand && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand();
              }}
              className="text-gray-400 hover:text-gray-600"
              aria-label={expanded ? 'Collapse' : 'Expand'}
            >
              <svg
                className={`w-5 h-5 transition-transform ${expanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="text-gray-800 whitespace-pre-wrap">{displayText}</div>
    </div>
  );
};
