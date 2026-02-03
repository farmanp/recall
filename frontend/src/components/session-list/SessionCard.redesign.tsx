/**
 * SessionCard - Redesigned
 *
 * Modern, compact session card with better visual hierarchy
 * Inspired by Linear/GitHub design patterns
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { Session } from '@/types';
import { formatTimestamp, formatDuration } from '@/lib/formatters';
import { colors } from '@/styles/design-tokens';

export interface SessionCardProps {
  session: Session;
  onClick?: (sessionId: string) => void;
}

export const SessionCard: React.FC<SessionCardProps> = ({ session, onClick }) => {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onClick) {
      onClick(session.claude_session_id);
    } else {
      navigate(`/session/${session.claude_session_id}`);
    }
  };

  const duration =
    session.completed_at_epoch && session.started_at_epoch
      ? session.completed_at_epoch - session.started_at_epoch
      : null;

  const statusConfig = {
    active: {
      color: colors.ui.success,
      text: 'Active',
      icon: '●'
    },
    completed: {
      color: colors.ui.text.tertiary,
      text: 'Completed',
      icon: '✓'
    },
    failed: {
      color: colors.ui.error,
      text: 'Failed',
      icon: '✕'
    }
  }[session.status];

  return (
    <div
      onClick={handleClick}
      className="group relative bg-white border border-gray-200 rounded-xl p-5 hover:border-indigo-300 hover:shadow-lg transition-all duration-200 cursor-pointer"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      aria-label={`Session ${session.project} - ${session.prompt_counter} prompts`}
    >
      {/* Hover indicator */}
      <div className="absolute inset-0 bg-gradient-to-r from-indigo-50 to-purple-50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-xl pointer-events-none" />

      <div className="relative">
        {/* Header Row */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-base font-semibold text-gray-900 truncate group-hover:text-indigo-600 transition-colors">
                {session.project}
              </h3>
              <span
                className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                style={{
                  color: statusConfig.color,
                  backgroundColor: `${statusConfig.color}15`
                }}
              >
                <span className="text-[10px]">{statusConfig.icon}</span>
                {statusConfig.text}
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {formatTimestamp(session.started_at_epoch)}
              </span>

              {duration && (
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  {formatDuration(duration)}
                </span>
              )}
            </div>
          </div>

          {/* Prompt count badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 group-hover:bg-indigo-50 rounded-lg transition-colors">
            <svg className="w-4 h-4 text-gray-600 group-hover:text-indigo-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            <span className="text-sm font-semibold text-gray-700 group-hover:text-indigo-600 transition-colors">
              {session.prompt_counter}
            </span>
          </div>
        </div>

        {/* First prompt preview */}
        {session.user_prompt && (
          <div className="relative">
            <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">
              {session.user_prompt}
            </p>
            <div className="absolute bottom-0 right-0 w-16 h-6 bg-gradient-to-l from-white to-transparent pointer-events-none" />
          </div>
        )}

        {/* Action indicator */}
        <div className="flex items-center justify-end mt-3 text-xs font-medium text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="flex items-center gap-1">
            View session
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </span>
        </div>
      </div>
    </div>
  );
};
