/**
 * ObservationCard Component
 *
 * Display Claude's observation event
 * Color-coded by observation type with rich metadata
 */

import React from 'react';
import type { SessionEvent, ObservationType } from '@/types';
import { formatTimestamp } from '@/lib/formatters';

export interface ObservationCardProps {
  event: SessionEvent;
  index: number;
  expanded?: boolean;
  isCurrent?: boolean; // Phase 2
  onToggleExpand?: () => void;
  onClick?: () => void; // Phase 2
}

const typeColors: Record<ObservationType, { bg: string; text: string; border: string }> = {
  feature: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-500' },
  bugfix: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-500' },
  decision: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-500' },
  discovery: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-500' },
  refactor: { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-500' },
  change: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-500' },
};

const typeIcons: Record<ObservationType, string> = {
  feature: '🟣',
  bugfix: '🔴',
  decision: '🟡',
  discovery: '🔵',
  refactor: '⚪',
  change: '🟢',
};

export const ObservationCard: React.FC<ObservationCardProps> = ({
  event,
  index,
  expanded = false,
  isCurrent = false,
  onToggleExpand,
  onClick,
}) => {
  const obsType = event.obs_type || 'change';
  const colors = typeColors[obsType];
  const icon = typeIcons[obsType];

  // Narrative priority: title → subtitle → narrative → facts → fallback
  const title = event.title || 'Untitled Observation';
  const subtitle = event.subtitle || null;
  const narrative = event.narrative || null;
  const facts = event.facts || [];
  const hasDetails = narrative || facts.length > 0 || event.files_modified?.length || event.concepts?.length;

  const handleClick = () => {
    if (onClick) {
      onClick();
    }
  };

  return (
    <div
      className={`
        bg-white border-l-4 ${colors.border} rounded-lg p-4 shadow-sm
        ${isCurrent ? `ring-2 ${colors.border} ring-offset-2` : ''}
        ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}
      `}
      onClick={handleClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">
            {icon} {obsType.charAt(0).toUpperCase() + obsType.slice(1)}
          </span>
          {event.prompt_number !== null && (
            <span className="text-xs text-gray-500">
              pn:{event.prompt_number}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            {formatTimestamp(event.ts)}
          </span>
          {hasDetails && onToggleExpand && (
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

      {/* Title - Always visible */}
      <h4 className="text-base font-semibold text-gray-900 mb-1">
        {title}
      </h4>

      {/* Subtitle - Always visible if present */}
      {subtitle && (
        <p className="text-sm text-gray-700 mb-2">
          {subtitle}
        </p>
      )}

      {/* Expanded Details */}
      {expanded && (
        <div className="mt-3 space-y-3 border-t pt-3">
          {/* Narrative */}
          {narrative && (
            <div>
              <h5 className="text-xs font-semibold text-gray-600 mb-1">Narrative</h5>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {narrative}
              </p>
            </div>
          )}

          {/* Facts */}
          {facts.length > 0 && (
            <div>
              <h5 className="text-xs font-semibold text-gray-600 mb-1">Facts</h5>
              <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                {facts.map((fact, i) => (
                  <li key={i}>{fact}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Files Modified */}
          {event.files_modified && event.files_modified.length > 0 && (
            <div>
              <h5 className="text-xs font-semibold text-gray-600 mb-1">
                Files Modified ({event.files_modified.length})
              </h5>
              <div className="flex flex-wrap gap-1">
                {event.files_modified.map((file, i) => (
                  <span
                    key={i}
                    className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded font-mono"
                  >
                    {file}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Files Read */}
          {event.files_read && event.files_read.length > 0 && (
            <div>
              <h5 className="text-xs font-semibold text-gray-600 mb-1">
                Files Read ({event.files_read.length})
              </h5>
              <div className="flex flex-wrap gap-1">
                {event.files_read.map((file, i) => (
                  <span
                    key={i}
                    className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded font-mono"
                  >
                    {file}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Concepts */}
          {event.concepts && event.concepts.length > 0 && (
            <div>
              <h5 className="text-xs font-semibold text-gray-600 mb-1">Concepts</h5>
              <div className="flex flex-wrap gap-1">
                {event.concepts.map((concept, i) => (
                  <span
                    key={i}
                    className={`text-xs ${colors.bg} ${colors.text} px-2 py-1 rounded`}
                  >
                    {concept}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Fallback if no content */}
          {!narrative && facts.length === 0 && (
            <p className="text-sm text-gray-500 italic">
              No narrative recorded
            </p>
          )}
        </div>
      )}
    </div>
  );
};
