/**
 * WorkUnitListPage Component
 *
 * Displays all work units (cross-agent session groups) with filtering and stats.
 * Forensic/terminal aesthetic design.
 */

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useWorkUnits, useWorkUnitStats, useRecomputeWorkUnits } from '../hooks/useWorkUnits';
import type { WorkUnitConfidence } from '../types/work-unit';
import type { AgentType } from '../types/transcript';
import { WorkUnitCard } from '../components/work-units/WorkUnitCard';
import { ErrorMessage } from '../components/shared/ErrorMessage';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Layers, List, Clock, Files, Activity } from 'lucide-react';

export const WorkUnitListPage: React.FC = () => {
  const navigate = useNavigate();
  const [offset, setOffset] = useState(0);
  const LIMIT = 20;

  // Filter state
  const [selectedConfidence, setSelectedConfidence] = useState<WorkUnitConfidence | 'all'>('all');
  const [selectedAgent, setSelectedAgent] = useState<AgentType | 'all'>('all');

  const { data, isLoading, error, refetch } = useWorkUnits({
    offset,
    limit: LIMIT,
    ...(selectedConfidence !== 'all' && { confidence: selectedConfidence }),
    ...(selectedAgent !== 'all' && { agent: selectedAgent }),
    includeUngrouped: true,
  });

  const { data: stats } = useWorkUnitStats();
  const recomputeMutation = useRecomputeWorkUnits();

  const workUnits = data?.workUnits || [];
  const total = data?.total || 0;
  const ungroupedCount = data?.ungroupedCount || 0;

  const handleRecompute = async () => {
    try {
      await recomputeMutation.mutateAsync(true);
    } catch (err) {
      console.error('Failed to recompute work units:', err);
    }
  };

  const handleNextPage = () => {
    if (offset + LIMIT < total) {
      setOffset(offset + LIMIT);
    }
  };

  const handlePrevPage = () => {
    if (offset > 0) {
      setOffset(Math.max(0, offset - LIMIT));
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-forensic-bg-primary p-6">
        <ErrorMessage error={error} onRetry={refetch} context="Work Units" />
      </div>
    );
  }

  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center h-screen bg-forensic-bg-primary">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 font-mono text-sm text-forensic-text-secondary">
            Loading work units...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-forensic-bg-primary">
      {/* Header */}
      <header className="border-b border-forensic-border sticky top-0 z-10 bg-forensic-bg-primary">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Layers className="w-6 h-6 text-accent-purple" />
                <h1 className="font-mono text-xl font-bold text-accent-purple">work-units</h1>
              </div>
              <span className="font-mono text-xs text-accent-amber bg-accent-amber/10 border border-accent-amber/30 px-2 py-0.5">
                {total} unit{total !== 1 ? 's' : ''}
              </span>
              {ungroupedCount > 0 && (
                <span className="font-mono text-xs text-forensic-text-muted">
                  ({ungroupedCount} ungrouped)
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Link
                to="/"
                className="px-4 py-2 font-mono text-xs uppercase tracking-wide text-forensic-text-secondary border border-forensic-border hover:border-accent-green hover:text-accent-green transition-colors flex items-center gap-2"
              >
                <List className="w-4 h-4" />
                Sessions
              </Link>
              <button
                onClick={handleRecompute}
                disabled={recomputeMutation.isPending}
                className="px-4 py-2 font-mono text-xs uppercase tracking-wide bg-accent-green text-forensic-bg-primary hover:bg-green-600 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-4 h-4 ${recomputeMutation.isPending ? 'animate-spin' : ''}`}
                />
                {recomputeMutation.isPending ? 'Computing...' : 'Recompute'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      {stats && (
        <div className="border-b border-forensic-border bg-forensic-bg-secondary">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 font-mono text-xs">
                <span className="text-forensic-text-muted uppercase tracking-wide">
                  Confidence:
                </span>
                <span className="px-2 py-0.5 bg-accent-green/10 text-accent-green border border-accent-green/30">
                  High: {stats.byConfidence.high}
                </span>
                <span className="px-2 py-0.5 bg-accent-amber/10 text-accent-amber border border-accent-amber/30">
                  Med: {stats.byConfidence.medium}
                </span>
                <span className="px-2 py-0.5 bg-forensic-bg-tertiary text-forensic-text-muted border border-forensic-border">
                  Low: {stats.byConfidence.low}
                </span>
              </div>
              <div className="h-4 w-px bg-forensic-border" />
              <div className="flex items-center gap-2 font-mono text-xs">
                <span className="text-forensic-text-muted uppercase tracking-wide">Agents:</span>
                {Object.entries(stats.byAgent).map(([agent, count]) => (
                  <span
                    key={agent}
                    className={`px-2 py-0.5 border ${
                      agent === 'claude'
                        ? 'bg-agent-claude/10 text-agent-claude border-agent-claude/30'
                        : agent === 'codex'
                          ? 'bg-agent-codex/10 text-agent-codex border-agent-codex/30'
                          : agent === 'gemini'
                            ? 'bg-agent-gemini/10 text-agent-gemini border-agent-gemini/30'
                            : 'bg-forensic-bg-tertiary text-forensic-text-muted border-forensic-border'
                    }`}
                  >
                    {agent}: {count}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="border-b border-forensic-border bg-forensic-bg-secondary">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-6">
            {/* Confidence Filter */}
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-forensic-text-muted uppercase tracking-wide">
                Confidence:
              </span>
              <div className="flex">
                {(['all', 'high', 'medium', 'low'] as const).map((level) => (
                  <button
                    key={level}
                    onClick={() => setSelectedConfidence(level)}
                    className={`px-3 py-1.5 font-mono text-xs uppercase tracking-wide border-y border-r first:border-l first:rounded-l last:rounded-r transition-colors ${
                      selectedConfidence === level
                        ? level === 'high'
                          ? 'bg-accent-green text-forensic-bg-primary border-accent-green'
                          : level === 'medium'
                            ? 'bg-accent-amber text-forensic-bg-primary border-accent-amber'
                            : level === 'low'
                              ? 'bg-forensic-text-muted text-forensic-bg-primary border-forensic-text-muted'
                              : 'bg-accent-purple text-forensic-bg-primary border-accent-purple'
                        : 'bg-forensic-bg-primary text-forensic-text-secondary border-forensic-border hover:text-forensic-text-primary'
                    }`}
                  >
                    {level === 'all' ? 'All' : level.charAt(0).toUpperCase() + level.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-4 w-px bg-forensic-border" />

            {/* Agent Filter */}
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-forensic-text-muted uppercase tracking-wide">
                Agent:
              </span>
              <div className="flex">
                {(['all', 'claude', 'codex', 'gemini'] as const).map((agent) => (
                  <button
                    key={agent}
                    onClick={() => setSelectedAgent(agent)}
                    className={`px-3 py-1.5 font-mono text-xs uppercase tracking-wide border-y border-r first:border-l first:rounded-l last:rounded-r transition-colors ${
                      selectedAgent === agent
                        ? agent === 'claude'
                          ? 'bg-agent-claude text-forensic-bg-primary border-agent-claude'
                          : agent === 'codex'
                            ? 'bg-agent-codex text-forensic-bg-primary border-agent-codex'
                            : agent === 'gemini'
                              ? 'bg-agent-gemini text-forensic-bg-primary border-agent-gemini'
                              : 'bg-accent-purple text-forensic-bg-primary border-accent-purple'
                        : 'bg-forensic-bg-primary text-forensic-text-secondary border-forensic-border hover:text-forensic-text-primary'
                    }`}
                  >
                    {agent === 'all' ? 'All' : agent.charAt(0).toUpperCase() + agent.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Clear Filters */}
            {(selectedConfidence !== 'all' || selectedAgent !== 'all') && (
              <button
                onClick={() => {
                  setSelectedConfidence('all');
                  setSelectedAgent('all');
                }}
                className="ml-auto font-mono text-xs text-forensic-text-muted hover:text-accent-red transition-colors"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Work Unit List */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {workUnits.length === 0 ? (
          <div className="bg-forensic-bg-secondary border border-forensic-border p-12 text-center max-w-2xl mx-auto">
            {/* Terminal header */}
            <div className="flex items-center gap-2 mb-6 justify-center">
              <div className="w-3 h-3 rounded-full bg-accent-red"></div>
              <div className="w-3 h-3 rounded-full bg-accent-amber"></div>
              <div className="w-3 h-3 rounded-full bg-accent-green"></div>
            </div>

            <Layers className="w-12 h-12 mx-auto text-forensic-text-muted mb-4" />
            <h2 className="font-mono text-lg text-forensic-text-primary mb-2">
              No Work Units Found
            </h2>
            <p className="font-mono text-sm text-forensic-text-secondary mb-6">
              {selectedConfidence !== 'all' || selectedAgent !== 'all'
                ? 'No work units match your current filters. Try adjusting them.'
                : "Work units are created by analyzing patterns across your coding sessions. Click 'Recompute' to analyze your sessions."}
            </p>

            {selectedConfidence !== 'all' || selectedAgent !== 'all' ? (
              <button
                onClick={() => {
                  setSelectedConfidence('all');
                  setSelectedAgent('all');
                }}
                className="px-6 py-2 bg-accent-green text-forensic-bg-primary font-mono text-sm uppercase tracking-wide hover:bg-green-600 transition-colors"
              >
                Clear Filters
              </button>
            ) : (
              <button
                onClick={handleRecompute}
                disabled={recomputeMutation.isPending}
                className="px-6 py-2 bg-accent-green text-forensic-bg-primary font-mono text-sm uppercase tracking-wide hover:bg-green-600 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
              >
                <RefreshCw
                  className={`w-4 h-4 ${recomputeMutation.isPending ? 'animate-spin' : ''}`}
                />
                {recomputeMutation.isPending ? 'Computing...' : 'Compute Work Units'}
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {workUnits.map((workUnit, idx) => (
                <motion.div
                  key={workUnit.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                >
                  <WorkUnitCard workUnit={workUnit} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Pagination */}
        {total > LIMIT && (
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-forensic-border">
            <button
              onClick={handlePrevPage}
              disabled={offset === 0}
              className="px-4 py-2 font-mono text-sm border border-forensic-border text-forensic-text-secondary hover:border-accent-green hover:text-accent-green disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-forensic-border disabled:hover:text-forensic-text-secondary transition-colors"
            >
              &lt; Previous
            </button>

            <span className="font-mono text-sm text-forensic-text-muted">
              {offset + 1} - {Math.min(offset + LIMIT, total)} of {total}
            </span>

            <button
              onClick={handleNextPage}
              disabled={offset + LIMIT >= total}
              className="px-4 py-2 font-mono text-sm border border-forensic-border text-forensic-text-secondary hover:border-accent-green hover:text-accent-green disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-forensic-border disabled:hover:text-forensic-text-secondary transition-colors"
            >
              Next &gt;
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default WorkUnitListPage;
