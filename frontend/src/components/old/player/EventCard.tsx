/**
 * EventCard
 *
 * Redesigned event display with color-coded types
 * Compact, scannable, visually distinct
 */

import React, { useState } from 'react';
import type { SessionEvent } from '@/types';
import { colors } from '@/styles/design-tokens';
import { formatTimestamp } from '@/lib/formatters';

export interface EventCardProps {
  event: SessionEvent;
  isActive?: boolean;
  number: number;
}

export const EventCard: React.FC<EventCardProps> = ({ event, isActive = false, number }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const isPrompt = event.event_type === 'prompt';

  const typeConfig = isPrompt
    ? {
        color: colors.prompt.primary,
        bg: colors.prompt.bg,
        border: colors.prompt.border,
        label: 'Prompt',
        icon: '▶',
      }
    : {
        color: colors.observation[event.obs_type || 'change'].primary,
        bg: colors.observation[event.obs_type || 'change'].bg,
        border: colors.observation[event.obs_type || 'change'].border,
        label: event.obs_type || 'change',
        icon: getObservationIcon(event.obs_type || 'change'),
      };

  function getObservationIcon(type: string): string {
    const icons = {
      feature: '✨',
      bugfix: '🐛',
      decision: '⚖️',
      discovery: '🔍',
      refactor: '♻️',
      change: '📝',
    };
    return icons[type as keyof typeof icons] || '📝';
  }

  const hasDetails = event.narrative || (event.facts && event.facts.length > 0);

  return (
    <div
      className={`relative transition-all duration-200 ${
        isActive ? 'ring-2 ring-indigo-500 ring-offset-2' : ''
      }`}
    >
      <div
        className={`bg-white border-l-4 rounded-r-lg shadow-sm hover:shadow-md transition-all ${
          isExpanded ? 'pb-4' : ''
        }`}
        style={{ borderLeftColor: typeConfig.color }}
      >
        {/* Header - Always visible */}
        <div
          onClick={() => hasDetails && setIsExpanded(!isExpanded)}
          className={`p-4 ${hasDetails ? 'cursor-pointer' : ''}`}
        >
          <div className="flex items-start justify-between gap-4">
            {/* Left: Type badge and content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                {/* Event number */}
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-xs font-mono font-medium text-gray-600">
                  {number}
                </span>

                {/* Type badge */}
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold"
                  style={{
                    backgroundColor: typeConfig.bg,
                    color: typeConfig.color,
                    borderColor: typeConfig.border,
                  }}
                >
                  <span>{typeConfig.icon}</span>
                  {typeConfig.label}
                </span>

                {/* Timestamp */}
                <span className="text-xs text-gray-500">{formatTimestamp(event.ts)}</span>
              </div>

              {/* Title/Text */}
              <h4 className="text-sm font-medium text-gray-900 leading-snug">
                {event.title || event.text?.substring(0, 150) || 'No title'}
              </h4>

              {/* Subtitle (observations only) */}
              {!isPrompt && event.subtitle && (
                <p className="text-xs text-gray-600 mt-1 leading-relaxed">{event.subtitle}</p>
              )}

              {/* Files touched indicator */}
              {!isPrompt && (event.files_read?.length || event.files_modified?.length) && (
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                  {event.files_read && event.files_read.length > 0 && (
                    <span className="flex items-center gap-1">
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                      {event.files_read.length} read
                    </span>
                  )}
                  {event.files_modified && event.files_modified.length > 0 && (
                    <span className="flex items-center gap-1">
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                      {event.files_modified.length} modified
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Right: Expand button */}
            {hasDetails && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
                className="flex-shrink-0 p-1 rounded hover:bg-gray-100 transition-colors"
                aria-label={isExpanded ? 'Collapse' : 'Expand'}
              >
                <svg
                  className={`w-5 h-5 text-gray-400 transition-transform ${
                    isExpanded ? 'rotate-180' : ''
                  }`}
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

        {/* Expanded content */}
        {isExpanded && hasDetails && (
          <div className="px-4 pb-4 pt-2 border-t border-gray-100 space-y-3">
            {/* Narrative */}
            {event.narrative && (
              <div>
                <h5 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">
                  Narrative
                </h5>
                <p className="text-sm text-gray-700 leading-relaxed">{event.narrative}</p>
              </div>
            )}

            {/* Facts */}
            {event.facts && event.facts.length > 0 && (
              <div>
                <h5 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                  Key Facts
                </h5>
                <ul className="space-y-1.5">
                  {event.facts.map((fact, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                      <span className="text-indigo-500 mt-0.5">•</span>
                      <span>{fact}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Concepts */}
            {event.concepts && event.concepts.length > 0 && (
              <div>
                <h5 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                  Concepts
                </h5>
                <div className="flex flex-wrap gap-2">
                  {event.concepts.map((concept, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-md font-medium"
                    >
                      {concept}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Files */}
            {(event.files_read?.length || event.files_modified?.length) && (
              <div className="space-y-2">
                {event.files_read && event.files_read.length > 0 && (
                  <div>
                    <h5 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">
                      Files Read
                    </h5>
                    <div className="flex flex-wrap gap-1.5">
                      {event.files_read.map((file, i) => (
                        <code
                          key={i}
                          className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded font-mono"
                        >
                          {file.split('/').pop()}
                        </code>
                      ))}
                    </div>
                  </div>
                )}
                {event.files_modified && event.files_modified.length > 0 && (
                  <div>
                    <h5 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">
                      Files Modified
                    </h5>
                    <div className="flex flex-wrap gap-1.5">
                      {event.files_modified.map((file, i) => (
                        <code
                          key={i}
                          className="px-2 py-0.5 bg-green-50 text-green-700 text-xs rounded font-mono"
                        >
                          {file.split('/').pop()}
                        </code>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
