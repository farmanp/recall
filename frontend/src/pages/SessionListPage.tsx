/**
 * SessionListPage Component
 *
 * Main landing page showing all sessions from transcript files
 * Uses React Query for data fetching
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSessions, useGlobalSearch } from '../hooks/useTranscriptApi';
import type { SessionMetadata, AgentType, SearchResult } from '../types/transcript';
import { AgentBadge } from '../components/AgentBadge';
import { ModelBadge } from '../components/ModelBadge';
import { ErrorMessage } from '../components/shared/ErrorMessage';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Clock, ChevronRight, Hash, Folder, Activity, Search } from 'lucide-react';

type DateRange = 'all' | 'today' | 'week' | 'month';

export const SessionListPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [offset, setOffset] = useState(0);
  const LIMIT = 20;

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [minDuration, setMinDuration] = useState<number>(0);
  const [minEventCount, setMinEventCount] = useState<number>(0);
  const [selectedAgent, setSelectedAgent] = useState<AgentType | 'all'>('all');
  const [searchMode, setSearchMode] = useState<'sessions' | 'content'>(
    (searchParams.get('mode') as 'sessions' | 'content') || 'sessions'
  );

  const { data, isLoading, error, refetch } = useSessions({
    offset,
    limit: LIMIT,
    ...(selectedAgent !== 'all' && { agent: selectedAgent }),
  });

  const { data: globalSearchData, isLoading: isSearchingContent } = useGlobalSearch({
    query: searchQuery,
    limit: 50,
    offset: 0,
    ...(selectedAgent !== 'all' && { agent: selectedAgent }),
  });

  // Extract data early to use in hooks (must be before any early returns)
  const sessions = useMemo(() => data?.sessions ?? [], [data?.sessions]);
  const total = data?.total ?? 0;

  // Filter sessions based on search and filter criteria
  // MUST be called before early returns to maintain consistent hook order
  const filteredSessions = useMemo(() => {
    let filtered = sessions;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((session) => {
        const matchesProject = session.project.toLowerCase().includes(query);
        const matchesSlug = session.slug.toLowerCase().includes(query);
        const matchesMessage = session.firstUserMessage?.toLowerCase().includes(query) || false;
        return matchesProject || matchesSlug || matchesMessage;
      });
    }

    // Date range filter
    if (dateRange !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      filtered = filtered.filter((session) => {
        const sessionDate = new Date(session.startTime);

        switch (dateRange) {
          case 'today':
            return sessionDate >= today;
          case 'week':
            const weekAgo = new Date(today);
            weekAgo.setDate(weekAgo.getDate() - 7);
            return sessionDate >= weekAgo;
          case 'month':
            const monthAgo = new Date(today);
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            return sessionDate >= monthAgo;
          default:
            return true;
        }
      });
    }

    // Minimum duration filter (convert to seconds)
    if (minDuration > 0) {
      filtered = filtered.filter((session) => {
        return (session.duration || 0) >= minDuration * 60;
      });
    }

    // Minimum event count filter
    if (minEventCount > 0) {
      filtered = filtered.filter((session) => {
        return session.eventCount >= minEventCount;
      });
    }

    return filtered;
  }, [sessions, searchQuery, dateRange, minDuration, minEventCount]);

  // Early returns MUST come after all hooks to maintain consistent hook order
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 p-6">
        <ErrorMessage error={error} onRetry={refetch} context="Sessions" />
      </div>
    );
  }

  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading sessions...</p>
        </div>
      </div>
    );
  }

  const handleSessionClick = (sessionId: string) => {
    navigate(`/session/${sessionId}`);
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

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <div className="bg-gray-900/40 backdrop-blur-xl border-b border-blue-500/20 shadow-[0_0_20px_rgba(59,130,246,0.1)] sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-gray-100">Recall</h1>
          <p className="text-sm text-gray-400 mt-2">
            {filteredSessions.length} of {total} {total === 1 ? 'session' : 'sessions'}
            {filteredSessions.length !== total && ' (filtered)'}
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-gray-900/40 backdrop-blur-xl border-b border-blue-500/20 shadow-[0_0_20px_rgba(59,130,246,0.1)]">
        <div className="max-w-7xl mx-auto px-4 py-4">
          {/* Search Bar & Mode Toggle */}
          <div className="flex gap-4 mb-4">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder={
                  searchMode === 'sessions'
                    ? 'Search sessions by project, slug, or title...'
                    : 'Deep search through all session content (messages, thinking, logs)...'
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-blue-500/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition-all text-gray-100 placeholder:text-gray-500"
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
              {isLoading || isSearchingContent ? (
                <div className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
              ) : (
                searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 font-bold"
                  >
                    ×
                  </button>
                )
              )}
            </div>

            <div className="flex bg-gray-800/50 p-1 rounded-xl border border-blue-500/30 shadow-inner">
              <button
                onClick={() => setSearchMode('sessions')}
                className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${searchMode === 'sessions' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-300'}`}
              >
                Sessions
              </button>
              <button
                onClick={() => setSearchMode('content')}
                className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${searchMode === 'content' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-300'}`}
              >
                Content ✨
              </button>
            </div>
          </div>

          {/* Agent Filter Tabs */}
          <div className="flex gap-2 mb-4">
            <button
              className={`px-3 py-1 rounded text-sm ${selectedAgent === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
              onClick={() => setSelectedAgent('all')}
            >
              All
            </button>
            <button
              className={`px-3 py-1 rounded text-sm ${selectedAgent === 'claude' ? 'bg-orange-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
              onClick={() => setSelectedAgent('claude')}
            >
              Claude
            </button>
            <button
              className={`px-3 py-1 rounded text-sm ${selectedAgent === 'codex' ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
              onClick={() => setSelectedAgent('codex')}
            >
              Codex
            </button>
            <button
              className={`px-3 py-1 rounded text-sm ${selectedAgent === 'gemini' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
              onClick={() => setSelectedAgent('gemini')}
            >
              Gemini
            </button>
          </div>

          {/* Filter Controls */}
          <div className="flex flex-wrap gap-4">
            {/* Date Range Filter */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-300">Date:</label>
              <div className="flex gap-1">
                {(['all', 'today', 'week', 'month'] as DateRange[]).map((range) => (
                  <button
                    key={range}
                    onClick={() => setDateRange(range)}
                    className={`px-3 py-1 text-sm rounded ${
                      dateRange === range
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50 border border-blue-500/20'
                    }`}
                  >
                    {range === 'all'
                      ? 'All Time'
                      : range === 'today'
                        ? 'Today'
                        : range === 'week'
                          ? 'This Week'
                          : 'This Month'}
                  </button>
                ))}
              </div>
            </div>

            {/* Minimum Duration Filter */}
            <div className="flex items-center gap-2">
              <label htmlFor="min-duration" className="text-sm font-medium text-gray-300">
                Min Duration:
              </label>
              <select
                id="min-duration"
                value={minDuration}
                onChange={(e) => setMinDuration(Number(e.target.value))}
                className="px-3 py-1 text-sm bg-gray-800/50 border border-blue-500/30 rounded text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="0">Any</option>
                <option value="1">1+ min</option>
                <option value="5">5+ min</option>
                <option value="10">10+ min</option>
                <option value="30">30+ min</option>
                <option value="60">60+ min</option>
              </select>
            </div>

            {/* Minimum Event Count Filter */}
            <div className="flex items-center gap-2">
              <label htmlFor="min-events" className="text-sm font-medium text-gray-300">
                Min Events:
              </label>
              <select
                id="min-events"
                value={minEventCount}
                onChange={(e) => setMinEventCount(Number(e.target.value))}
                className="px-3 py-1 text-sm bg-gray-800/50 border border-blue-500/30 rounded text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="0">Any</option>
                <option value="5">5+</option>
                <option value="10">10+</option>
                <option value="25">25+</option>
                <option value="50">50+</option>
                <option value="100">100+</option>
              </select>
            </div>

            {/* Clear Filters Button */}
            {(searchQuery ||
              dateRange !== 'all' ||
              minDuration > 0 ||
              minEventCount > 0 ||
              selectedAgent !== 'all') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setDateRange('all');
                  setMinDuration(0);
                  setMinEventCount(0);
                  setSelectedAgent('all');
                }}
                className="ml-auto px-3 py-1 text-sm text-gray-400 hover:text-gray-200 underline"
              >
                Clear All Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Session List */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {searchMode === 'content' && searchQuery.length > 2 ? (
          <div className="space-y-6">
            {isSearchingContent && !globalSearchData ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mb-4"></div>
                <p className="text-gray-400">Searching through all session contents...</p>
              </div>
            ) : globalSearchData?.results.length === 0 ? (
              <div className="bg-white dark:bg-gray-950 rounded-[2.5rem] shadow-xl p-16 text-center border border-gray-100 dark:border-white/5 max-w-2xl mx-auto">
                <div className="text-6xl mb-6">🔍</div>
                <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-3 tracking-tight">
                  No content matches
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-8 leading-relaxed font-medium">
                  We couldn't find "{searchQuery}" in any session messages, thinking, or logs. Try a
                  different keyword or check your filters.
                </p>
              </div>
            ) : (
              <div className="space-y-4 max-w-5xl mx-auto">
                {globalSearchData?.results.map((result: SearchResult, idx: number) => (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    key={`${result.sessionId}-${result.frameId}`}
                    onClick={() => navigate(`/session/${result.sessionId}/${result.frameId}`)}
                    className="group relative bg-white dark:bg-gray-900/40 rounded-3xl shadow-sm hover:shadow-2xl transition-all duration-500 cursor-pointer border border-gray-100 dark:border-white/5 p-6 flex items-start gap-6 overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 group-hover:from-blue-500/5 transition-all duration-500" />

                    <div className="flex-shrink-0 flex flex-col items-center gap-3 w-40 pr-6 border-r border-gray-100 dark:border-white/5 relative z-10">
                      <AgentBadge agent={result.agent} />
                      <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2 py-1 bg-gray-50 dark:bg-white/5 rounded-lg border border-gray-100 dark:border-white/5">
                        {result.matchType.replace('_', ' ')}
                      </div>
                      <div className="mt-auto flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500">
                        <Calendar className="w-3 h-3" />
                        {new Date(result.timestamp).toLocaleDateString()}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0 relative z-10">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="flex items-center gap-2 px-2.5 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-widest rounded-lg border border-blue-500/20">
                          <Folder className="w-3 h-3" />
                          {result.project.split('/').pop()}
                        </div>
                        <span className="text-sm font-black text-gray-900 dark:text-gray-100 tracking-tight truncate group-hover:text-blue-500 transition-colors">
                          {result.slug}
                        </span>
                      </div>

                      <div className="bg-gray-50 dark:bg-gray-950/50 rounded-2xl p-4 border border-gray-100 dark:border-white/5 font-mono text-xs text-gray-700 dark:text-gray-400 whitespace-pre-wrap break-all line-clamp-4 relative overflow-hidden group-hover:border-blue-500/20 transition-all duration-500 shadow-inner">
                        <div
                          className="leading-relaxed"
                          dangerouslySetInnerHTML={{
                            __html: result.snippet.replace(
                              new RegExp(searchQuery, 'gi'),
                              (match) =>
                                `<mark class="bg-blue-500 text-white px-1 shadow-[0_0_10px_rgba(59,130,246,0.5)] rounded font-bold">${match}</mark>`
                            ),
                          }}
                        />
                        <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-gray-50 dark:from-gray-950/50 to-transparent" />
                      </div>
                    </div>

                    <div className="flex flex-col items-center justify-center self-stretch pr-2 text-gray-300 dark:text-gray-700 group-hover:text-blue-500 transition-all duration-500 relative z-10">
                      <div className="w-10 h-10 rounded-full bg-gray-50 dark:bg-white/5 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white group-hover:scale-110 shadow-sm transition-all duration-500">
                        <ChevronRight className="w-6 h-6" />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-xl p-16 text-center border border-gray-100 max-w-2xl mx-auto">
            <div className="text-6xl mb-6">📂</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">No sessions found</h2>
            <p className="text-gray-600 mb-8 leading-relaxed">
              Recall visualizes coding sessions from AI assistants like Claude Code.
              {searchQuery ||
              dateRange !== 'all' ||
              minDuration > 0 ||
              minEventCount > 0 ||
              selectedAgent !== 'all'
                ? ' Try adjusting your filters to see more results.'
                : " Make sure you've run some sessions and the backend is correctly configured."}
            </p>

            {searchQuery ||
            dateRange !== 'all' ||
            minDuration > 0 ||
            minEventCount > 0 ||
            selectedAgent !== 'all' ? (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setDateRange('all');
                  setMinDuration(0);
                  setMinEventCount(0);
                  setSelectedAgent('all');
                }}
                className="px-8 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg hover:shadow-blue-500/25 active:scale-95"
              >
                Clear All Filters
              </button>
            ) : (
              <div className="bg-gray-900/60 backdrop-blur-xl rounded-xl p-8 text-left border border-blue-500/20 shadow-[0_0_30px_rgba(59,130,246,0.15)]">
                <h3 className="font-bold text-gray-200 mb-4 flex items-center gap-2">
                  <span className="text-blue-400 font-bold">💡</span> Quick Start Guide:
                </h3>
                <ul className="space-y-4 text-sm text-gray-300">
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-600/20 text-blue-400 rounded-full flex items-center justify-center font-bold text-xs border border-blue-500/30">
                      1
                    </span>
                    <span>
                      Run{' '}
                      <code className="bg-blue-900/30 px-1.5 py-0.5 rounded text-blue-400 font-mono border border-blue-500/20">
                        claude-code
                      </code>{' '}
                      in your project terminal.
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-600/20 text-blue-400 rounded-full flex items-center justify-center font-bold text-xs border border-blue-500/30">
                      2
                    </span>
                    <span>
                      Start Recall backend:{' '}
                      <code className="bg-blue-900/30 px-1.5 py-0.5 rounded text-blue-400 font-mono border border-blue-500/20">
                        npm run dev
                      </code>{' '}
                      in the backend folder.
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-600/20 text-blue-400 rounded-full flex items-center justify-center font-bold text-xs border border-blue-500/30">
                      3
                    </span>
                    <span>
                      Sessions are automatically indexed from{' '}
                      <code className="bg-blue-900/30 px-1.5 py-0.5 rounded text-blue-400 font-mono border border-blue-500/20">
                        ~/.claude-mem/
                      </code>
                      .
                    </span>
                  </li>
                </ul>
                <div className="mt-8 pt-6 border-t border-blue-500/20">
                  <a
                    href="https://github.com/farmanp/recall#quick-start"
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-400 hover:text-blue-300 font-bold flex items-center justify-center gap-2 group transition-all"
                  >
                    Explore Documentation
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </a>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <AnimatePresence>
              {filteredSessions.map((session: SessionMetadata, idx: number) => (
                <motion.div
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  key={session.sessionId}
                  onClick={() => handleSessionClick(session.sessionId)}
                  className="group relative bg-gray-900/40 backdrop-blur-xl rounded-[2rem] shadow-sm hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-500 cursor-pointer border border-blue-500/20 hover:border-blue-500/40 overflow-hidden flex flex-col h-full"
                >
                  {/* Hover Glow Effect */}
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 via-blue-500/0 to-blue-500/0 group-hover:from-blue-500/5 group-hover:via-transparent group-hover:to-purple-500/5 transition-all duration-500" />

                  <div className="p-8 flex-1 relative z-10">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-2">
                        <AgentBadge agent={session.agent} />
                        <ModelBadge model={session.model} />
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider bg-gray-800 text-gray-400 px-3 py-1.5 rounded-full">
                        <Activity className="w-3 h-3 text-blue-500" />
                        {session.eventCount} Events
                      </div>
                    </div>

                    <h2 className="text-2xl font-black text-gray-100 mb-3 group-hover:text-blue-400 transition-colors line-clamp-2 leading-tight">
                      {session.slug !== 'unknown-session'
                        ? session.slug
                        : `Session ${session.sessionId.slice(0, 8)}`}
                    </h2>

                    <div className="flex items-center gap-2 text-xs text-gray-400 mb-6 font-mono">
                      <div className="flex items-center gap-1 bg-blue-900/20 text-blue-400 px-2 py-1 rounded-lg shrink-0">
                        <Folder className="w-3 h-3" />
                        <span className="font-bold">{session.project.split('/').pop()}</span>
                      </div>
                      <span className="truncate opacity-60">{session.project}</span>
                    </div>

                    {session.firstUserMessage && (
                      <div className="relative group/msg">
                        <div className="absolute -left-4 top-0 bottom-0 w-1 bg-blue-500 rounded-full scale-y-0 group-hover:scale-y-100 transition-transform duration-500" />
                        <p className="text-sm text-gray-300 line-clamp-3 italic leading-relaxed">
                          "{session.firstUserMessage}"
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="px-8 py-6 bg-gray-800/20 border-t border-gray-700/50 flex items-center justify-between mt-auto relative z-10">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-3 text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-gray-400" />
                          {new Date(session.startTime).toLocaleDateString()}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-gray-400" />
                          {new Date(session.startTime).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {session.duration && (
                        <div className="flex items-center gap-1.5 text-[10px] font-black text-blue-400 bg-blue-900/40 px-3 py-1.5 rounded-xl border border-blue-700/30">
                          {Math.round(session.duration / 60)}M {session.duration % 60}S
                        </div>
                      )}
                      <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-900 flex items-center justify-center translate-x-4 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-500 shadow-lg">
                        <ChevronRight className="w-5 h-5" />
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Pagination */}
        {total > LIMIT && (
          <div className="flex items-center justify-between mt-6 px-4">
            <button
              onClick={handlePrevPage}
              disabled={offset === 0}
              className="px-4 py-2 bg-white border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              ← Previous
            </button>

            <span className="text-sm text-gray-600">
              Showing {offset + 1} - {Math.min(offset + LIMIT, total)} of {total}
            </span>

            <button
              onClick={handleNextPage}
              disabled={offset + LIMIT >= total}
              className="px-4 py-2 bg-white border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
