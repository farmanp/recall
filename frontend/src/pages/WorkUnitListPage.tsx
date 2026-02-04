/**
 * WorkUnitListPage Component
 *
 * Displays all work units (cross-agent session groups) with filtering and stats.
 */

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useWorkUnits, useWorkUnitStats, useRecomputeWorkUnits } from '../hooks/useWorkUnits';
import type { WorkUnitConfidence } from '../types/work-unit';
import type { AgentType } from '../types/transcript';
import { WorkUnitCard } from '../components/work-units/WorkUnitCard';
import { ErrorMessage } from '../components/shared/ErrorMessage';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RefreshCw,
  Layers,
  List,
  Filter,
  ChevronDown,
  Clock,
  Files,
  GitBranch,
} from 'lucide-react';

export const WorkUnitListPage: React.FC = () => {
  const navigate = useNavigate();
  const [offset, setOffset] = useState(0);
  const LIMIT = 20;

  // Filter state
  const [selectedConfidence, setSelectedConfidence] = useState<WorkUnitConfidence | 'all'>('all');
  const [selectedAgent, setSelectedAgent] = useState<AgentType | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);

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
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 p-6">
        <ErrorMessage error={error} onRetry={refetch} context="Work Units" />
      </div>
    );
  }

  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading work units...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <Layers className="w-8 h-8 text-blue-500" />
                Work Units
              </h1>
              <p className="text-sm text-gray-400 mt-2">
                {total} work unit{total !== 1 ? 's' : ''} across your coding sessions
                {ungroupedCount > 0 && (
                  <span className="ml-2 text-yellow-500">
                    ({ungroupedCount} ungrouped session{ungroupedCount !== 1 ? 's' : ''})
                  </span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link
                to="/"
                className="px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors flex items-center gap-2"
              >
                <List className="w-4 h-4" />
                Sessions
              </Link>
              <button
                onClick={handleRecompute}
                disabled={recomputeMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-4 h-4 ${recomputeMutation.isPending ? 'animate-spin' : ''}`}
                />
                {recomputeMutation.isPending ? 'Computing...' : 'Recompute'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      {stats && (
        <div className="bg-gray-850 border-b border-gray-700">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500">Confidence:</span>
                <span className="px-2 py-0.5 bg-green-700 text-green-100 rounded text-xs">
                  High: {stats.byConfidence.high}
                </span>
                <span className="px-2 py-0.5 bg-yellow-700 text-yellow-100 rounded text-xs">
                  Medium: {stats.byConfidence.medium}
                </span>
                <span className="px-2 py-0.5 bg-gray-600 text-gray-100 rounded text-xs">
                  Low: {stats.byConfidence.low}
                </span>
              </div>
              <div className="h-4 w-px bg-gray-700" />
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500">Agents:</span>
                {Object.entries(stats.byAgent).map(([agent, count]) => (
                  <span
                    key={agent}
                    className={`px-2 py-0.5 rounded text-xs ${
                      agent === 'claude'
                        ? 'bg-orange-600 text-orange-100'
                        : agent === 'codex'
                          ? 'bg-green-600 text-green-100'
                          : agent === 'gemini'
                            ? 'bg-blue-600 text-blue-100'
                            : 'bg-gray-600 text-gray-100'
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
      <div className="bg-gray-850 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center gap-4">
            {/* Confidence Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Confidence:</span>
              <div className="flex gap-1">
                {(['all', 'high', 'medium', 'low'] as const).map((level) => (
                  <button
                    key={level}
                    onClick={() => setSelectedConfidence(level)}
                    className={`px-3 py-1 text-sm rounded transition-colors ${
                      selectedConfidence === level
                        ? level === 'high'
                          ? 'bg-green-600 text-white'
                          : level === 'medium'
                            ? 'bg-yellow-600 text-white'
                            : level === 'low'
                              ? 'bg-gray-500 text-white'
                              : 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {level === 'all' ? 'All' : level.charAt(0).toUpperCase() + level.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-4 w-px bg-gray-700" />

            {/* Agent Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Agent:</span>
              <div className="flex gap-1">
                {(['all', 'claude', 'codex', 'gemini'] as const).map((agent) => (
                  <button
                    key={agent}
                    onClick={() => setSelectedAgent(agent)}
                    className={`px-3 py-1 text-sm rounded transition-colors ${
                      selectedAgent === agent
                        ? agent === 'claude'
                          ? 'bg-orange-600 text-white'
                          : agent === 'codex'
                            ? 'bg-green-600 text-white'
                            : agent === 'gemini'
                              ? 'bg-blue-600 text-white'
                              : 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
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
                className="ml-auto text-sm text-gray-400 hover:text-white underline"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Work Unit List */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {workUnits.length === 0 ? (
          <div className="bg-gray-800 rounded-2xl p-16 text-center border border-gray-700 max-w-2xl mx-auto">
            <div className="text-6xl mb-6">
              <Layers className="w-16 h-16 mx-auto text-gray-600" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">No Work Units Found</h2>
            <p className="text-gray-400 mb-8 leading-relaxed">
              {selectedConfidence !== 'all' || selectedAgent !== 'all'
                ? 'No work units match your current filters. Try adjusting them.'
                : "Work units are created by analyzing patterns across your coding sessions. Click 'Recompute' to analyze your sessions and create work units."}
            </p>

            {selectedConfidence !== 'all' || selectedAgent !== 'all' ? (
              <button
                onClick={() => {
                  setSelectedConfidence('all');
                  setSelectedAgent('all');
                }}
                className="px-8 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all"
              >
                Clear Filters
              </button>
            ) : (
              <button
                onClick={handleRecompute}
                disabled={recomputeMutation.isPending}
                className="px-8 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center gap-2 mx-auto"
              >
                <RefreshCw
                  className={`w-5 h-5 ${recomputeMutation.isPending ? 'animate-spin' : ''}`}
                />
                {recomputeMutation.isPending ? 'Computing...' : 'Compute Work Units'}
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {workUnits.map((workUnit, idx) => (
                <motion.div
                  key={workUnit.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <WorkUnitCard workUnit={workUnit} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Pagination */}
        {total > LIMIT && (
          <div className="flex items-center justify-between mt-8 px-4">
            <button
              onClick={handlePrevPage}
              disabled={offset === 0}
              className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700"
            >
              Previous
            </button>

            <span className="text-sm text-gray-400">
              Showing {offset + 1} - {Math.min(offset + LIMIT, total)} of {total}
            </span>

            <button
              onClick={handleNextPage}
              disabled={offset + LIMIT >= total}
              className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkUnitListPage;
