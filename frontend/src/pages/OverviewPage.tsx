/**
 * OverviewPage Component
 *
 * Dashboard showing high-level statistics and recent activity
 * Entry point for the new sidebar-based navigation
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Clock, Radio, List, ArrowRight, Timer, Folder } from 'lucide-react';
import { motion } from 'framer-motion';
import { useSessions, useOverviewStats } from '../hooks/useTranscriptApi';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { ActivityHeatmap } from '../components/overview/ActivityHeatmap';
import { TokenUsageCard } from '../components/overview/TokenUsageCard';

export const OverviewPage: React.FC = () => {
  const navigate = useNavigate();
  const { data: sessionsData, isLoading: sessionsLoading } = useSessions({ limit: 5 });
  const { data: stats, isLoading: statsLoading } = useOverviewStats();

  const sessions = sessionsData?.sessions ?? [];

  const formatDuration = (ms: number): string => {
    if (!ms) return '0m';
    const mins = Math.floor(ms / 60000);
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
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatSessionDuration = (seconds: number): string => {
    if (!seconds) return '0m';
    const mins = Math.floor(seconds / 60);
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) return `${hrs}h ${mins % 60}m`;
    return `${mins}m`;
  };

  const StatCard: React.FC<{
    label: string;
    value: string | number;
    icon: React.ReactNode;
    pulse?: boolean;
    color?: string;
    loading?: boolean;
  }> = ({ label, value, icon, pulse, color = 'text-accent-green', loading }) => (
    <div className="bg-forensic-bg-secondary border border-forensic-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-forensic-text-muted text-sm font-mono">{label}</span>
        <span className={`${color} ${pulse ? 'animate-pulse' : ''}`}>{icon}</span>
      </div>
      {loading ? (
        <div className="h-8 flex items-center">
          <LoadingSpinner size="sm" />
        </div>
      ) : (
        <div className={`text-2xl font-mono font-medium ${color}`}>{value}</div>
      )}
    </div>
  );

  const isLoading = sessionsLoading || statsLoading;

  return (
    <div className="min-h-screen bg-forensic-bg-primary p-6">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-2xl font-mono font-medium text-forensic-text-primary mb-1">Overview</h1>
        <p className="text-forensic-text-muted font-mono text-sm">
          AI coding session analytics and recent activity
        </p>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total Sessions"
          value={stats?.totalSessions ?? 0}
          icon={<List className="w-5 h-5" />}
          loading={statsLoading}
        />
        <StatCard
          label="This Week"
          value={stats?.thisWeek ?? 0}
          icon={<Activity className="w-5 h-5" />}
          loading={statsLoading}
        />
        <StatCard
          label="Live Now"
          value={stats?.liveCount ?? 0}
          icon={<Radio className="w-5 h-5" />}
          pulse={(stats?.liveCount ?? 0) > 0}
          color={(stats?.liveCount ?? 0) > 0 ? 'text-accent-green' : 'text-forensic-text-muted'}
          loading={statsLoading}
        />
        <StatCard
          label="Avg Duration"
          value={formatDuration(stats?.avgDurationMs ?? 0)}
          icon={<Timer className="w-5 h-5" />}
          loading={statsLoading}
        />
      </div>

      {/* Activity Heatmap, Agent Breakdown & Token Usage */}
      <div className="grid lg:grid-cols-3 gap-4 mb-8">
        {/* Left column: Heatmap + Agent Breakdown */}
        <div className="lg:col-span-2 space-y-4">
          {statsLoading ? (
            <div className="bg-forensic-bg-secondary border border-forensic-border rounded-lg p-4 h-40 flex items-center justify-center">
              <LoadingSpinner size="md" />
            </div>
          ) : (
            <ActivityHeatmap activityByDay={stats?.activityByDay ?? []} />
          )}

          {/* Agent Breakdown */}
          <div className="bg-forensic-bg-secondary border border-forensic-border rounded-lg p-4">
            <h3 className="font-mono text-sm text-forensic-text-primary mb-4">Agent Breakdown</h3>
            {statsLoading ? (
              <div className="flex justify-center py-4">
                <LoadingSpinner size="sm" />
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {Object.entries(stats?.agentBreakdown ?? {})
                  .filter(([, count]) => count > 0)
                  .sort(([, a], [, b]) => b - a)
                  .map(([agent, count]) => {
                    const total = stats?.totalSessions ?? 1;
                    const percentage = Math.round((count / total) * 100);
                    const color =
                      agent === 'claude'
                        ? 'bg-agent-claude'
                        : agent === 'gemini'
                          ? 'bg-agent-gemini'
                          : 'bg-agent-codex';

                    return (
                      <div key={agent} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-mono">
                          <span className="text-forensic-text-primary capitalize">{agent}</span>
                          <span className="text-forensic-text-muted">
                            {count} ({percentage}%)
                          </span>
                        </div>
                        <div className="h-1.5 bg-forensic-bg-tertiary rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${percentage}%` }}
                            transition={{ duration: 0.5, delay: 0.2 }}
                            className={`h-full ${color} rounded-full`}
                          />
                        </div>
                      </div>
                    );
                  })}
                {Object.values(stats?.agentBreakdown ?? {}).every((c) => c === 0) && (
                  <p className="text-xs font-mono text-forensic-text-muted text-center py-2 col-span-full">
                    No sessions yet
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right column: Token Usage */}
        <TokenUsageCard />
      </div>

      {/* Recent Sessions */}
      <section className="bg-forensic-bg-secondary border border-forensic-border rounded-lg">
        <div className="flex items-center justify-between p-4 border-b border-forensic-border">
          <h2 className="font-mono font-medium text-forensic-text-primary">Recent Sessions</h2>
          <button
            onClick={() => navigate('/sessions')}
            className="flex items-center gap-1 text-sm font-mono text-accent-green hover:text-accent-green/80 transition-colors"
          >
            View all
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {sessionsLoading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner size="md" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="p-8 text-center text-forensic-text-muted font-mono">
            No sessions found. Start a Claude Code session to see it here.
          </div>
        ) : (
          <div className="divide-y divide-forensic-border">
            {sessions.slice(0, 5).map((session, index) => (
              <motion.button
                key={session.sessionId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => navigate(`/session/${session.sessionId}`)}
                className="w-full flex items-center gap-4 p-4 hover:bg-forensic-bg-tertiary/50 transition-colors text-left"
              >
                {/* Agent indicator */}
                <div
                  className={`w-2 h-2 rounded-full ${
                    session.agent === 'claude'
                      ? 'bg-agent-claude'
                      : session.agent === 'gemini'
                        ? 'bg-agent-gemini'
                        : 'bg-agent-codex'
                  }`}
                />

                {/* Session info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-mono text-forensic-text-primary truncate">
                      {session.slug || session.sessionId.slice(0, 8)}
                    </span>
                    {session.isOngoing && (
                      <span className="px-1.5 py-0.5 text-[10px] font-mono font-medium bg-accent-green/20 text-accent-green rounded animate-pulse">
                        LIVE
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-mono text-forensic-text-muted truncate">
                    {session.project.split('/').pop()}
                  </div>
                </div>

                {/* Metadata */}
                <div className="flex items-center gap-4 text-xs font-mono text-forensic-text-muted">
                  <span>{formatSessionDuration(session.duration ?? 0)}</span>
                  <span>{formatDate(session.startTime)}</span>
                </div>

                <ArrowRight className="w-4 h-4 text-forensic-text-muted" />
              </motion.button>
            ))}
          </div>
        )}
      </section>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-4 mt-8">
        <button
          onClick={() => navigate('/sessions')}
          className="flex items-center gap-3 p-4 bg-forensic-bg-secondary border border-forensic-border rounded-lg hover:border-accent-green/50 transition-colors group"
        >
          <List className="w-5 h-5 text-accent-green" />
          <div className="text-left">
            <div className="font-mono text-forensic-text-primary group-hover:text-accent-green transition-colors">
              Browse Sessions
            </div>
            <div className="text-xs font-mono text-forensic-text-muted">
              View all recorded sessions
            </div>
          </div>
        </button>

        <button
          onClick={() => navigate('/folders')}
          className="flex items-center gap-3 p-4 bg-forensic-bg-secondary border border-forensic-border rounded-lg hover:border-accent-purple/50 transition-colors group"
        >
          <Folder className="w-5 h-5 text-accent-purple" />
          <div className="text-left">
            <div className="font-mono text-forensic-text-primary group-hover:text-accent-purple transition-colors">
              Browse Folders
            </div>
            <div className="text-xs font-mono text-forensic-text-muted">
              Navigate by project directory
            </div>
          </div>
        </button>
      </div>
    </div>
  );
};

export default OverviewPage;
