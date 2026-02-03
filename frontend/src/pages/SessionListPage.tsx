/**
 * SessionListPage Component
 *
 * Main landing page showing all sessions from transcript files
 * Uses React Query for data fetching
 */

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessions } from '../hooks/useTranscriptApi';
import type { SessionMetadata } from '../types/transcript';

type DateRange = 'all' | 'today' | 'week' | 'month';

export const SessionListPage: React.FC = () => {
  const navigate = useNavigate();
  const [offset, setOffset] = useState(0);
  const LIMIT = 20;

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [minDuration, setMinDuration] = useState<number>(0);
  const [minEventCount, setMinEventCount] = useState<number>(0);

  const { data, isLoading, error, refetch } = useSessions({
    offset,
    limit: LIMIT,
  });

  // Extract data early to use in hooks (must be before any early returns)
  const sessions = data?.sessions || [];
  const total = data?.total || 0;

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
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50 p-4">
        <div className="bg-white rounded-lg shadow-md p-6 max-w-md">
          <h2 className="text-xl font-bold text-red-600 mb-2">Error Loading Sessions</h2>
          <p className="text-gray-700 mb-4">{error.message}</p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-gray-900">
            Recall
          </h1>
          <p className="text-sm text-gray-600 mt-2">
            {filteredSessions.length} of {total} {total === 1 ? 'session' : 'sessions'}
            {filteredSessions.length !== total && ' (filtered)'}
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          {/* Search Bar */}
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search by project name, session slug, or message content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Filter Controls */}
          <div className="flex flex-wrap gap-4">
            {/* Date Range Filter */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Date:</label>
              <div className="flex gap-1">
                {(['all', 'today', 'week', 'month'] as DateRange[]).map((range) => (
                  <button
                    key={range}
                    onClick={() => setDateRange(range)}
                    className={`px-3 py-1 text-sm rounded ${
                      dateRange === range
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {range === 'all' ? 'All Time' : range === 'today' ? 'Today' : range === 'week' ? 'This Week' : 'This Month'}
                  </button>
                ))}
              </div>
            </div>

            {/* Minimum Duration Filter */}
            <div className="flex items-center gap-2">
              <label htmlFor="min-duration" className="text-sm font-medium text-gray-700">
                Min Duration:
              </label>
              <select
                id="min-duration"
                value={minDuration}
                onChange={(e) => setMinDuration(Number(e.target.value))}
                className="px-3 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              <label htmlFor="min-events" className="text-sm font-medium text-gray-700">
                Min Events:
              </label>
              <select
                id="min-events"
                value={minEventCount}
                onChange={(e) => setMinEventCount(Number(e.target.value))}
                className="px-3 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            {(searchQuery || dateRange !== 'all' || minDuration > 0 || minEventCount > 0) && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setDateRange('all');
                  setMinDuration(0);
                  setMinEventCount(0);
                }}
                className="ml-auto px-3 py-1 text-sm text-gray-600 hover:text-gray-800 underline"
              >
                Clear All Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Session List */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {filteredSessions.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <p className="text-gray-600">No sessions found matching your criteria.</p>
            {(searchQuery || dateRange !== 'all' || minDuration > 0 || minEventCount > 0) && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setDateRange('all');
                  setMinDuration(0);
                  setMinEventCount(0);
                }}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredSessions.map((session: SessionMetadata) => (
            <div
              key={session.sessionId}
              onClick={() => handleSessionClick(session.sessionId)}
              className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer p-6 border border-gray-200"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-lg font-semibold text-gray-900">
                      {session.slug !== 'unknown-session' ? session.slug : `Session ${session.sessionId.slice(0, 8)}`}
                    </h2>
                    <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                      {session.eventCount} events
                    </span>
                  </div>

                  <p className="text-sm text-gray-600 mb-2">
                    📂 {session.project}
                  </p>

                  {session.firstUserMessage && (
                    <p className="text-sm text-gray-500 line-clamp-2 mb-3">
                      {session.firstUserMessage}
                    </p>
                  )}

                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>🕐 {new Date(session.startTime).toLocaleString()}</span>
                    {session.duration && (
                      <span>⏱️ {Math.round(session.duration / 60)} minutes</span>
                    )}
                  </div>
                </div>

                <div className="ml-4">
                  <svg
                    className="w-6 h-6 text-gray-400"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M9 5l7 7-7 7"></path>
                  </svg>
                </div>
              </div>
              </div>
            ))}
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
