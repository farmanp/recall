/**
 * SessionCard Component
 *
 * Individual session card in the list
 * Shows session metadata and navigates to player on click
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { Session } from '@/types';
import { formatTimestamp, formatDuration } from '@/lib/formatters';

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

  const statusColor = {
    active: 'bg-green-500',
    completed: 'bg-gray-400',
    failed: 'bg-red-500',
  }[session.status];

  const duration =
    session.completed_at_epoch && session.started_at_epoch
      ? session.completed_at_epoch - session.started_at_epoch
      : null;

  return (
    <div
      onClick={handleClick}
      className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
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
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 truncate">{session.project}</h3>
          <p className="text-sm text-gray-500">{formatTimestamp(session.started_at_epoch)}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`${statusColor} w-2 h-2 rounded-full`} title={session.status}></span>
        </div>
      </div>

      {/* First prompt preview */}
      {session.user_prompt && (
        <p className="text-sm text-gray-700 mb-3 line-clamp-2">{session.user_prompt}</p>
      )}

      {/* Metadata */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
            />
          </svg>
          {session.prompt_counter} {session.prompt_counter === 1 ? 'prompt' : 'prompts'}
        </span>

        {duration && (
          <span className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {formatDuration(duration)}
          </span>
        )}
      </div>
    </div>
  );
};
