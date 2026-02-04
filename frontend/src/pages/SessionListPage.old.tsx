/**
 * SessionListPage Component
 *
 * Main landing page showing all sessions
 * Handles data fetching, pagination, and error states
 */

import React, { useState, useEffect } from 'react';
import type { Session, SessionListResponse } from '@/types';
import { SessionList } from '@/components/session-list';
import { LoadingSpinner, ErrorMessage } from '@/components/shared';
import { fetchSessions } from '@/lib/api';

export const SessionListPage: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const LIMIT = 20;

  const loadSessions = async (append = false) => {
    try {
      setLoading(true);
      setError(null);

      const currentOffset = append ? offset : 0;
      const response: SessionListResponse = await fetchSessions({
        offset: currentOffset,
        limit: LIMIT,
      });

      if (append) {
        setSessions((prev) => [...prev, ...response.sessions]);
      } else {
        setSessions(response.sessions);
      }

      setTotal(response.total);
      setOffset(currentOffset + response.sessions.length);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load sessions'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const handleLoadMore = () => {
    if (!loading && sessions.length < total) {
      loadSessions(true);
    }
  };

  const handleRetry = () => {
    setSessions([]);
    setOffset(0);
    loadSessions();
  };

  if (error && sessions.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 p-4">
        <ErrorMessage error={error} onRetry={handleRetry} />
      </div>
    );
  }

  if (loading && sessions.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Claude Code Sessions</h1>
          <p className="text-sm text-gray-600 mt-1">
            {total} {total === 1 ? 'session' : 'sessions'} recorded
          </p>
        </div>
      </div>

      {/* Session List */}
      <SessionList
        sessions={sessions}
        total={total}
        onLoadMore={handleLoadMore}
        loading={loading}
      />
    </div>
  );
};
