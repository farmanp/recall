/**
 * SessionListPage Component
 *
 * Main landing page showing all sessions from transcript files
 * Uses React Query for data fetching
 * Forensic/terminal aesthetic design
 */

import React, { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSessions, useGlobalSearch } from '../hooks/useTranscriptApi';
import type { SessionMetadata, AgentType, SearchResult } from '../types/transcript';
import { AgentBadge } from '../components/AgentBadge';
import { ModelBadge } from '../components/ModelBadge';
import { ErrorMessage } from '../components/shared/ErrorMessage';
import { LoadingPage, LoadingSpinner } from '../components/shared/LoadingSpinner';
import { CwdFilterBanner } from '../components/shared/CwdFilterBanner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  Clock,
  ChevronRight,
  Folder,
  FolderOpen,
  Activity,
  FileText,
  Search,
  X,
  Terminal,
  LayoutGrid,
  List,
} from 'lucide-react';
import { SessionListItem } from '../components/session-list/SessionListItem';

type DateRange = 'all' | 'today' | 'week' | 'month';
type ViewMode = 'grid' | 'list';

const VIEW_MODE_KEY = 'recall-session-view-mode';

export const SessionListPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [offset, setOffset] = useState(0);
  const LIMIT = 20;

  // Search state (local)
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [searchMode, setSearchMode] = useState<'sessions' | 'content'>(
    (searchParams.get('mode') as 'sessions' | 'content') || 'sessions'
  );

  // Filter state from URL params (synced with sidebar filters)
  const selectedAgent = (searchParams.get('agent') as AgentType | 'all') || 'all';
  const dateRange = (searchParams.get('date') as DateRange) || 'all';
  const minDuration = parseInt(searchParams.get('duration') || '0', 10);

  // Local filter state (not in sidebar yet)
  const [minEventCount, setMinEventCount] = useState<number>(0);
  const [hasClaudeMdFilter, setHasClaudeMdFilter] = useState<boolean>(false);
  const [showAllProjects, setShowAllProjects] = useState<boolean>(false);

  // View mode (grid/list) with localStorage persistence
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem(VIEW_MODE_KEY);
    return (saved as ViewMode) || 'grid';
  });

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem(VIEW_MODE_KEY, mode);
  };

  // URL param filter helpers
  const updateUrlFilter = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value === 'all' || value === '0') {
      newParams.delete(key);
    } else {
      newParams.set(key, value);
    }
    setSearchParams(newParams);
  };

  const handleAgentChange = (agent: AgentType | 'all') => {
    updateUrlFilter('agent', agent);
  };

  const handleDateRangeChange = (range: DateRange) => {
    updateUrlFilter('date', range);
  };

  const handleDurationChange = (duration: number) => {
    updateUrlFilter('duration', String(duration));
  };

  // Project filter from URL (from Folders page navigation)
  const projectFilter = searchParams.get('project');

  // Determine if we need to bypass CWD filter
  const needsShowAll = showAllProjects || projectFilter || selectedAgent !== 'all';

  const { data, isLoading, error, refetch } = useSessions({
    offset,
    limit: LIMIT,
    ...(selectedAgent !== 'all' && { agent: selectedAgent }),
    ...(hasClaudeMdFilter && { hasClaudeMd: true }),
    ...(needsShowAll ? { showAll: true } : {}),
    ...(projectFilter && { project: projectFilter }),
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

  // Early returns MUST come after all hooks
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-forensic-bg-primary p-6">
        <ErrorMessage error={error} onRetry={refetch} context="Sessions" />
      </div>
    );
  }

  if (isLoading && !data) {
    return <LoadingPage message="Indexing session files..." />;
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

  const clearFilters = () => {
    // Clear local state
    setSearchQuery('');
    setMinEventCount(0);
    setHasClaudeMdFilter(false);
    setShowAllProjects(false);

    // Clear URL params
    navigate('/sessions');
  };

  const clearProjectFilter = () => {
    // Keep other params, just remove project
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('project');
    setSearchParams(newParams);
  };

  const hasActiveFilters =
    searchQuery ||
    dateRange !== 'all' ||
    minDuration > 0 ||
    minEventCount > 0 ||
    selectedAgent !== 'all' ||
    hasClaudeMdFilter ||
    showAllProjects ||
    projectFilter;

  return (
    <div className="min-h-screen bg-forensic-bg-primary">
      {/* Header */}
      <header className="border-b border-forensic-border sticky top-0 z-10 bg-forensic-bg-primary">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-forensic-text-muted font-mono">&gt;</span>
                <h1 className="font-mono text-xl font-bold text-accent-green">recall</h1>
              </div>
              <span className="badge badge-green">v{__APP_VERSION__}</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="font-mono text-sm text-forensic-text-secondary">
                {filteredSessions.length} sessions
              </div>
              {/* View Mode Toggle */}
              <div className="flex border border-forensic-border">
                <button
                  onClick={() => handleViewModeChange('grid')}
                  className={`p-2 transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-forensic-bg-tertiary text-accent-green'
                      : 'text-forensic-text-muted hover:text-forensic-text-primary hover:bg-forensic-bg-secondary'
                  }`}
                  title="Grid view"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleViewModeChange('list')}
                  className={`p-2 transition-colors ${
                    viewMode === 'list'
                      ? 'bg-forensic-bg-tertiary text-accent-green'
                      : 'text-forensic-text-muted hover:text-forensic-text-primary hover:bg-forensic-bg-secondary'
                  }`}
                  title="List view"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Project Filter Banner */}
      {projectFilter && (
        <div className="border-b border-forensic-border bg-accent-amber/10">
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FolderOpen className="w-4 h-4 text-accent-amber" />
              <span className="font-mono text-sm text-forensic-text-primary">
                Filtering by folder:{' '}
                <span className="text-accent-amber">{projectFilter.split('/').pop()}</span>
              </span>
              <span className="font-mono text-xs text-forensic-text-muted truncate max-w-md">
                {projectFilter}
              </span>
            </div>
            <button
              onClick={clearProjectFilter}
              className="flex items-center gap-1 px-2 py-1 text-xs font-mono text-forensic-text-muted hover:text-forensic-text-primary hover:bg-forensic-bg-tertiary rounded transition-colors"
            >
              <X className="w-3 h-3" />
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="border-b border-forensic-border bg-forensic-bg-secondary">
        <div className="max-w-7xl mx-auto px-6 py-4">
          {/* Search Bar & Mode Toggle */}
          <div className="flex gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-forensic-text-muted" />
              <input
                type="text"
                placeholder={
                  searchMode === 'sessions'
                    ? 'Search sessions by project, slug, or message...'
                    : 'Deep search through all session content...'
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-10 py-3 bg-forensic-bg-primary border border-forensic-border font-mono text-sm text-forensic-text-primary placeholder:text-forensic-text-muted focus:outline-none focus:border-accent-green transition-colors"
              />
              {isLoading || isSearchingContent ? (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <LoadingSpinner size="sm" />
                </div>
              ) : (
                searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-forensic-text-muted hover:text-forensic-text-primary transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )
              )}
            </div>

            {/* TODO: Bring back Content search button when feature is ready
            <div className="flex bg-forensic-bg-primary border border-forensic-border">
              <button
                onClick={() => setSearchMode('sessions')}
                className={`px-4 py-2 font-mono text-xs uppercase tracking-wider transition-colors ${
                  searchMode === 'sessions'
                    ? 'bg-accent-green text-forensic-bg-primary font-semibold'
                    : 'text-forensic-text-secondary hover:text-forensic-text-primary'
                }`}
              >
                Sessions
              </button>
              <button
                onClick={() => setSearchMode('content')}
                className={`px-4 py-2 font-mono text-xs uppercase tracking-wider transition-colors ${
                  searchMode === 'content'
                    ? 'bg-accent-green text-forensic-bg-primary font-semibold'
                    : 'text-forensic-text-secondary hover:text-forensic-text-primary'
                }`}
              >
                Content
              </button>
            </div>
            */}
          </div>

          {/* Agent Filter Tabs */}
          <div className="flex gap-2 mb-4">
            {(['all', 'claude', 'codex', 'gemini'] as const).map((agent) => (
              <button
                key={agent}
                onClick={() => handleAgentChange(agent)}
                className={`px-3 py-1.5 font-mono text-xs uppercase tracking-wider border transition-colors ${
                  selectedAgent === agent
                    ? agent === 'all'
                      ? 'bg-accent-green text-forensic-bg-primary border-accent-green'
                      : agent === 'claude'
                        ? 'bg-agent-claude/20 text-agent-claude border-agent-claude/50'
                        : agent === 'codex'
                          ? 'bg-agent-codex/20 text-agent-codex border-agent-codex/50'
                          : 'bg-agent-gemini/20 text-agent-gemini border-agent-gemini/50'
                    : 'bg-transparent text-forensic-text-secondary border-forensic-border hover:border-forensic-text-muted'
                }`}
              >
                {agent}
              </button>
            ))}
          </div>

          {/* Filter Controls */}
          <div className="flex flex-wrap gap-4 items-center">
            {/* Date Range Filter */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-mono text-forensic-text-muted uppercase tracking-wide">
                Date:
              </label>
              <div className="flex">
                {(['all', 'today', 'week', 'month'] as DateRange[]).map((range) => (
                  <button
                    key={range}
                    onClick={() => handleDateRangeChange(range)}
                    className={`px-2 py-1 font-mono text-xs border-y border-r first:border-l first:rounded-l last:rounded-r transition-colors ${
                      dateRange === range
                        ? 'bg-accent-green text-forensic-bg-primary border-accent-green'
                        : 'bg-forensic-bg-primary text-forensic-text-secondary border-forensic-border hover:text-forensic-text-primary'
                    }`}
                  >
                    {range === 'all'
                      ? 'All'
                      : range === 'today'
                        ? 'Today'
                        : range === 'week'
                          ? '7d'
                          : '30d'}
                  </button>
                ))}
              </div>
            </div>

            {/* Minimum Duration Filter */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-mono text-forensic-text-muted uppercase tracking-wide">
                Min Duration:
              </label>
              <select
                value={minDuration}
                onChange={(e) => handleDurationChange(Number(e.target.value))}
                className="px-2 py-1 font-mono text-xs bg-forensic-bg-primary border border-forensic-border text-forensic-text-secondary focus:outline-none focus:border-accent-green"
              >
                <option value="0">Any</option>
                <option value="1">1m+</option>
                <option value="5">5m+</option>
                <option value="10">10m+</option>
                <option value="30">30m+</option>
              </select>
            </div>

            {/* Minimum Event Count Filter */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-mono text-forensic-text-muted uppercase tracking-wide">
                Min Events:
              </label>
              <select
                value={minEventCount}
                onChange={(e) => setMinEventCount(Number(e.target.value))}
                className="px-2 py-1 font-mono text-xs bg-forensic-bg-primary border border-forensic-border text-forensic-text-secondary focus:outline-none focus:border-accent-green"
              >
                <option value="0">Any</option>
                <option value="5">5+</option>
                <option value="10">10+</option>
                <option value="25">25+</option>
                <option value="50">50+</option>
              </select>
            </div>

            {/* Toggle Filters */}
            {/* TODO: Bring back CLAUDE.md filter when feature is ready
            <button
              onClick={() => setHasClaudeMdFilter(!hasClaudeMdFilter)}
              className={`px-3 py-1.5 font-mono text-xs uppercase tracking-wider border flex items-center gap-1.5 transition-colors ${
                hasClaudeMdFilter
                  ? 'bg-accent-cyan/20 text-accent-cyan border-accent-cyan/50'
                  : 'bg-transparent text-forensic-text-secondary border-forensic-border hover:border-forensic-text-muted'
              }`}
            >
              <FileText className="w-3 h-3" />
              CLAUDE.md
            </button>
            */}

            <button
              onClick={() => setShowAllProjects(!showAllProjects)}
              className={`px-3 py-1.5 font-mono text-xs uppercase tracking-wider border flex items-center gap-1.5 transition-colors ${
                showAllProjects
                  ? 'bg-accent-amber/20 text-accent-amber border-accent-amber/50'
                  : 'bg-transparent text-forensic-text-secondary border-forensic-border hover:border-forensic-text-muted'
              }`}
            >
              <FolderOpen className="w-3 h-3" />
              {showAllProjects ? 'Current Directory' : 'All Directories'}
            </button>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="ml-auto px-3 py-1.5 font-mono text-xs text-forensic-text-muted hover:text-accent-red transition-colors"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Session List */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* CWD Filter Banner */}
        {data?.cwdFilter && !showAllProjects && (
          <CwdFilterBanner
            cwdPath={data.cwdFilter}
            filteredCount={data.total}
            totalCount={data.totalUnfiltered ?? data.total}
            onShowAll={() => setShowAllProjects(true)}
          />
        )}

        {/* Content Search Results */}
        {searchMode === 'content' && searchQuery.length > 2 ? (
          <div className="space-y-4">
            {isSearchingContent && !globalSearchData ? (
              <div className="flex flex-col items-center justify-center py-20">
                <LoadingSpinner size="lg" label="Searching session contents..." />
              </div>
            ) : globalSearchData?.results.length === 0 ? (
              <EmptyState
                icon={<Search className="w-12 h-12" />}
                title="No matches found"
                description={`No content matching "${searchQuery}" in any session.`}
                onClear={clearFilters}
              />
            ) : (
              <div className="space-y-3">
                {globalSearchData?.results.map((result: SearchResult, idx: number) => (
                  <SearchResultCard
                    key={`${result.sessionId}-${result.frameId}`}
                    result={result}
                    searchQuery={searchQuery}
                    index={idx}
                    onClick={() => navigate(`/session/${result.sessionId}/${result.frameId}`)}
                  />
                ))}
              </div>
            )}
          </div>
        ) : filteredSessions.length === 0 ? (
          <EmptyState
            icon={<Terminal className="w-12 h-12" />}
            title="No sessions found"
            description={
              hasActiveFilters
                ? 'Try adjusting your filters to see more results.'
                : 'Run an AI coding session to get started.'
            }
            onClear={hasActiveFilters ? clearFilters : undefined}
            showQuickStart={!hasActiveFilters}
          />
        ) : viewMode === 'list' ? (
          /* List View */
          <div className="space-y-1">
            <AnimatePresence>
              {filteredSessions.map((session: SessionMetadata, idx: number) => (
                <SessionListItem
                  key={session.sessionId}
                  session={session}
                  index={idx}
                  onClick={() => handleSessionClick(session.sessionId)}
                />
              ))}
            </AnimatePresence>
          </div>
        ) : (
          /* Grid View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {filteredSessions.map((session: SessionMetadata, idx: number) => (
                <SessionCard
                  key={session.sessionId}
                  session={session}
                  index={idx}
                  onClick={() => handleSessionClick(session.sessionId)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Pagination */}
        {total > LIMIT && searchMode !== 'content' && (
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

// Session Card Component - Terminal Window Style
interface SessionCardProps {
  session: SessionMetadata;
  index: number;
  onClick: () => void;
}

const SessionCard: React.FC<SessionCardProps> = ({ session, index, onClick }) => {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      onClick={onClick}
      data-testid="session-card"
      className="group cursor-pointer bg-forensic-bg-secondary border border-forensic-border hover:border-accent-green/50 transition-all overflow-hidden"
    >
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-forensic-bg-tertiary border-b border-forensic-border">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-accent-red"></div>
          <div className="w-3 h-3 rounded-full bg-accent-amber"></div>
          <div className="w-3 h-3 rounded-full bg-accent-green"></div>
        </div>
        <div className="flex items-center gap-2">
          <AgentBadge agent={session.agent} />
          <ModelBadge model={session.model} />
        </div>
        <div className="flex items-center gap-3">
          {session.isOngoing && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-accent-red/20 border border-accent-red/50 text-accent-red text-[10px] font-mono uppercase tracking-wide">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-red animate-pulse" />
              LIVE
            </div>
          )}
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-accent-green uppercase tracking-wide">
            <Activity className="w-3 h-3" />
            {session.eventCount} events
          </div>
        </div>
      </div>

      {/* Terminal Body */}
      <div className="p-5">
        {/* Session Title */}
        <h2 className="font-mono text-lg text-forensic-text-primary mb-3 group-hover:text-accent-green transition-colors line-clamp-2 leading-tight">
          {session.slug !== 'unknown-session'
            ? session.slug
            : `Session ${session.sessionId.slice(0, 8)}`}
        </h2>

        {/* Project Path */}
        <div className="flex items-center gap-2 text-xs font-mono text-forensic-text-secondary mb-4">
          <Folder className="w-3 h-3 text-accent-amber" />
          <span className="truncate">{session.project.split('/').pop()}</span>
          {session.claudeMdFiles && session.claudeMdFiles.length > 0 && (
            <span className="flex items-center gap-1 ml-auto px-2 py-0.5 bg-accent-cyan/10 text-accent-cyan text-[10px] border border-accent-cyan/30">
              <FileText className="w-3 h-3" />
              {session.claudeMdFiles.length}
            </span>
          )}
        </div>

        {/* First User Message - Command Style */}
        {session.firstUserMessage && (
          <div className="bg-forensic-bg-primary border border-forensic-border p-3 mb-4">
            <div className="flex items-start gap-2 font-mono text-sm">
              <span className="text-accent-green shrink-0">$</span>
              <p className="text-forensic-text-secondary line-clamp-2 leading-relaxed">
                {session.firstUserMessage}
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-forensic-border">
          <div className="flex items-center gap-3 text-[10px] font-mono text-forensic-text-muted uppercase tracking-wide">
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {new Date(session.startTime).toLocaleDateString()}
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(session.startTime).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {session.duration && session.duration > 0 && (
              <span className="text-[10px] font-mono px-2 py-1 bg-accent-green/10 text-accent-green border border-accent-green/30">
                {Math.floor(session.duration / 60)}m {Math.round(session.duration % 60)}s
              </span>
            )}
            <ChevronRight className="w-4 h-4 text-forensic-text-muted group-hover:text-accent-green group-hover:translate-x-1 transition-all" />
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// Search Result Card Component
interface SearchResultCardProps {
  result: SearchResult;
  searchQuery: string;
  index: number;
  onClick: () => void;
}

const SearchResultCard: React.FC<SearchResultCardProps> = ({
  result,
  searchQuery,
  index,
  onClick,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
      onClick={onClick}
      className="group evidence-card cursor-pointer hover:border-accent-green/50 transition-colors flex items-start gap-4"
      data-id={`HIT-${String(index + 1).padStart(3, '0')}`}
    >
      {/* Left sidebar */}
      <div className="flex flex-col items-center gap-2 w-28 pr-4 border-r border-forensic-border shrink-0">
        <AgentBadge agent={result.agent} />
        <span className="text-[10px] font-mono text-accent-amber uppercase tracking-wide px-2 py-0.5 bg-accent-amber/10 border border-accent-amber/30">
          {result.matchType.replace('_', ' ')}
        </span>
        <span className="text-[10px] font-mono text-forensic-text-muted flex items-center gap-1 mt-auto">
          <Calendar className="w-3 h-3" />
          {new Date(result.timestamp).toLocaleDateString()}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-mono text-accent-amber flex items-center gap-1">
            <Folder className="w-3 h-3" />
            {result.project.split('/').pop()}
          </span>
          <span className="text-sm font-mono text-forensic-text-primary truncate group-hover:text-accent-green transition-colors">
            {result.slug}
          </span>
        </div>

        <div className="bg-forensic-bg-tertiary border border-forensic-border p-3 font-mono text-xs text-forensic-text-secondary overflow-hidden">
          <div
            className="line-clamp-3 leading-relaxed"
            dangerouslySetInnerHTML={{
              __html: (() => {
                // Escape HTML entities in the snippet first
                const escapeHtml = (str: string) =>
                  str.replace(
                    /[&<>"']/g,
                    (c) =>
                      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
                        c
                      ] || c
                  );
                // Escape regex special characters in search query
                const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const safeSnippet = escapeHtml(result.snippet);
                const safeQuery = escapeRegex(searchQuery);
                return safeSnippet.replace(
                  new RegExp(safeQuery, 'gi'),
                  (match) =>
                    `<mark class="bg-accent-green text-forensic-bg-primary px-0.5">${match}</mark>`
                );
              })(),
            }}
          />
        </div>
      </div>

      {/* Arrow */}
      <ChevronRight className="w-5 h-5 text-forensic-text-muted group-hover:text-accent-green group-hover:translate-x-1 transition-all shrink-0 self-center" />
    </motion.div>
  );
};

// Empty State Component
interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClear?: () => void;
  showQuickStart?: boolean;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  onClear,
  showQuickStart,
}) => {
  return (
    <div className="evidence-card max-w-2xl mx-auto text-center py-12" data-id="EMPTY">
      <div className="text-forensic-text-muted mb-6">{icon}</div>
      <h2 className="font-mono text-xl text-forensic-text-primary mb-2">{title}</h2>
      <p className="font-mono text-sm text-forensic-text-secondary mb-6">{description}</p>

      {onClear && (
        <button
          onClick={onClear}
          className="px-6 py-2 bg-accent-green text-forensic-bg-primary font-mono text-sm font-semibold uppercase tracking-wider hover:bg-green-600 transition-colors"
        >
          Clear Filters
        </button>
      )}

      {showQuickStart && (
        <div className="mt-8 pt-8 border-t border-forensic-border text-left">
          <p className="font-mono text-xs text-forensic-text-muted uppercase tracking-wide mb-4">
            // Quick Start
          </p>
          <div className="space-y-3">
            {[
              { step: '01', text: 'npx recall-player', desc: 'Run the app' },
              { step: '02', text: 'http://localhost:3001', desc: 'Open dashboard' },
              { step: '03', text: 'claude', desc: 'Start a coding session' },
            ].map(({ step, text, desc }) => (
              <div key={step} className="flex items-center gap-3 font-mono text-sm">
                <span className="text-accent-amber">{step}</span>
                <code className="text-accent-green">{text}</code>
                <span className="text-forensic-text-muted">// {desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
