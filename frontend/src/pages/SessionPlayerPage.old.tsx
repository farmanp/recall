/**
 * SessionPlayerPage Component
 *
 * Session detail view with timeline player
 * Handles data fetching, deep links, and error states
 */

import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import type { Session, SessionEvent, SessionDetailsResponse, SessionEventsResponse } from '@/types';
import { SessionPlayer } from '@/components/session-player';
import { LoadingSpinner, ErrorMessage } from '@/components/shared';
import { fetchSessionDetails, fetchSessionEvents } from '@/lib/api';

export const SessionPlayerPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [session, setSession] = useState<Session | null>(null);
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [totalEvents, setTotalEvents] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const LIMIT = 100;

  const loadSession = async () => {
    if (!sessionId) return;

    try {
      setLoading(true);
      setError(null);

      const [detailsResponse, eventsResponse]: [SessionDetailsResponse, SessionEventsResponse] =
        await Promise.all([
          fetchSessionDetails(sessionId),
          fetchSessionEvents(sessionId, { offset: 0, limit: LIMIT }),
        ]);

      setSession(detailsResponse.session);
      setEvents(eventsResponse.events);
      setTotalEvents(eventsResponse.total);
      setOffset(eventsResponse.events.length);

      // Phase 2: Handle deep links
      // const timestamp = searchParams.get('t');
      // const eventIndex = searchParams.get('e');
      // if (timestamp) {
      //   const index = findEventByTimestamp(eventsResponse.events, parseInt(timestamp));
      //   setCurrentEventIndex(index);
      // } else if (eventIndex) {
      //   setCurrentEventIndex(parseInt(eventIndex));
      // }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load session'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSession();
  }, [sessionId]);

  const handleLoadMoreEvents = async () => {
    if (!sessionId || loading || events.length >= totalEvents) return;

    try {
      setLoading(true);
      const response: SessionEventsResponse = await fetchSessionEvents(sessionId, {
        offset,
        limit: LIMIT,
      });

      setEvents((prev) => [...prev, ...response.events]);
      setOffset(offset + response.events.length);
    } catch (err) {
      console.error('Failed to load more events:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    setEvents([]);
    setOffset(0);
    loadSession();
  };

  const handleBack = () => {
    navigate('/');
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50 p-4">
        <ErrorMessage error={error} onRetry={handleRetry} />
        <button
          onClick={handleBack}
          className="mt-4 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
        >
          Back to Sessions
        </button>
      </div>
    );
  }

  if (loading && !session) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50 p-4">
        <ErrorMessage error="Session not found" onRetry={handleRetry} />
        <button
          onClick={handleBack}
          className="mt-4 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
        >
          Back to Sessions
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBack}
              className="p-2 rounded hover:bg-gray-100"
              aria-label="Back to sessions"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{session.project}</h1>
              <p className="text-sm text-gray-600">
                {totalEvents} events • {session.prompt_counter} prompts
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Session Player */}
      <SessionPlayer
        session={session}
        events={events}
        totalEvents={totalEvents}
        onLoadMoreEvents={handleLoadMoreEvents}
      />
    </div>
  );
};
