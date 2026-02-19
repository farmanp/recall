/**
 * SessionListItem Component
 *
 * Compact single-row session item for list view
 * Shows key metadata in a dense, scannable format
 */

import React from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, Clock, Activity, Radio } from 'lucide-react';
import type { SessionMetadata } from '../../types/transcript';
import { AgentBadge } from '../AgentBadge';

interface SessionListItemProps {
  session: SessionMetadata;
  index: number;
  onClick: () => void;
}

export const SessionListItem: React.FC<SessionListItemProps> = ({ session, index, onClick }) => {
  const formatDuration = (seconds: number): string => {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) return `${hrs}h ${mins % 60}m`;
    return `${mins}m`;
  };

  const formatDate = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <motion.button
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.02 }}
      onClick={onClick}
      className="w-full flex items-center gap-4 px-4 py-3 bg-forensic-bg-secondary border border-forensic-border hover:border-accent-green/50 hover:bg-forensic-bg-tertiary/30 transition-all group text-left"
    >
      {/* Agent indicator */}
      <div
        className={`w-2 h-2 rounded-full shrink-0 ${
          session.agent === 'claude'
            ? 'bg-agent-claude'
            : session.agent === 'gemini'
              ? 'bg-agent-gemini'
              : 'bg-agent-codex'
        }`}
      />

      {/* Session title */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-forensic-text-primary truncate group-hover:text-accent-green transition-colors">
            {session.slug !== 'unknown-session'
              ? session.slug
              : `Session ${session.sessionId.slice(0, 8)}`}
          </span>
          {session.isOngoing && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-mono font-medium bg-accent-green/20 text-accent-green rounded shrink-0">
              <Radio className="w-2.5 h-2.5 animate-pulse" />
              LIVE
            </span>
          )}
        </div>
      </div>

      {/* Project folder name */}
      <div className="hidden md:block w-32 shrink-0">
        <span className="font-mono text-xs text-forensic-text-muted truncate block">
          {session.project.split('/').pop()}
        </span>
      </div>

      {/* Event count */}
      <div className="hidden sm:flex items-center gap-1 w-16 shrink-0 text-xs font-mono text-forensic-text-muted">
        <Activity className="w-3 h-3" />
        <span>{session.eventCount}</span>
      </div>

      {/* Duration */}
      <div className="hidden sm:flex items-center gap-1 w-14 shrink-0 text-xs font-mono text-forensic-text-muted">
        <Clock className="w-3 h-3" />
        <span>{formatDuration(session.duration ?? 0)}</span>
      </div>

      {/* Date */}
      <div className="w-20 shrink-0 text-xs font-mono text-forensic-text-muted text-right">
        {formatDate(session.startTime)}
      </div>

      {/* Arrow */}
      <ChevronRight className="w-4 h-4 text-forensic-text-muted group-hover:text-accent-green group-hover:translate-x-0.5 transition-all shrink-0" />
    </motion.button>
  );
};

export default SessionListItem;
