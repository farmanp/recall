/**
 * Example React component demonstrating API client usage
 * This shows how to use all the React Query hooks in a real component
 */

import React, { useState } from 'react';
import {
  useHealthCheck,
  useSessions,
  useSession,
  useSessionEvents,
  useLiveSession,
} from '../hooks/useApi';
import type { Session, SessionEvent } from '../../../shared/types';

/**
 * Health status indicator component
 */
export function HealthStatus() {
  const { data, isError, isLoading } = useHealthCheck({
    refetchInterval: 30000, // Check every 30 seconds
  });

  if (isLoading) return <span>Checking...</span>;
  if (isError) return <span className="text-red-500">🔴 API Down</span>;

  return (
    <div className="flex items-center gap-2">
      <span className="text-green-500">🟢 API Up</span>
      {data?.database && (
        <span className="text-sm text-gray-500">
          DB: {data.database}
        </span>
      )}
    </div>
  );
}

/**
 * Session list with filtering
 */
export function SessionList() {
  const [project, setProject] = useState<string>('');
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const { data, isLoading, error } = useSessions({
    offset: page * pageSize,
    limit: pageSize,
    project: project || undefined,
  });

  if (isLoading) {
    return <div className="p-4">Loading sessions...</div>;
  }

  if (error) {
    return (
      <div className="p-4 text-red-500">
        Error loading sessions: {error.message}
      </div>
    );
  }

  const totalPages = Math.ceil((data?.total || 0) / pageSize);

  return (
    <div className="p-4">
      <div className="mb-4 flex gap-4 items-center">
        <input
          type="text"
          placeholder="Filter by project..."
          value={project}
          onChange={(e) => {
            setProject(e.target.value);
            setPage(0); // Reset to first page on filter change
          }}
          className="px-3 py-2 border rounded"
        />
        <span className="text-sm text-gray-500">
          {data?.total} total sessions
        </span>
      </div>

      <div className="space-y-2">
        {data?.sessions.map((session) => (
          <SessionListItem key={session.id} session={session} />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex gap-2 justify-center">
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="px-4 py-2 border rounded disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-4 py-2">
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1}
            className="px-4 py-2 border rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Individual session item
 */
function SessionListItem({ session }: { session: Session }) {
  const [expanded, setExpanded] = useState(false);

  const statusColors = {
    active: 'bg-green-100 text-green-800',
    completed: 'bg-blue-100 text-blue-800',
    failed: 'bg-red-100 text-red-800',
  };

  return (
    <div className="border rounded p-4">
      <div
        className="flex justify-between items-start cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-semibold">{session.project}</h3>
            <span
              className={`px-2 py-1 rounded text-xs ${
                statusColors[session.status]
              }`}
            >
              {session.status}
            </span>
          </div>
          {session.user_prompt && (
            <p className="text-sm text-gray-600 line-clamp-2">
              {session.user_prompt}
            </p>
          )}
          <p className="text-xs text-gray-500 mt-2">
            Started: {new Date(session.started_at).toLocaleString()}
          </p>
        </div>
        <button className="text-gray-400 hover:text-gray-600">
          {expanded ? '▼' : '▶'}
        </button>
      </div>

      {expanded && <SessionDetails sessionId={session.id} />}
    </div>
  );
}

/**
 * Session details with live updates for active sessions
 */
function SessionDetails({ sessionId }: { sessionId: number }) {
  // Use live session hook that auto-refetches for active sessions
  const { data: sessionData, isLoading } = useLiveSession(sessionId);

  const [showEvents, setShowEvents] = useState(false);

  if (isLoading) {
    return <div className="mt-4 p-4 bg-gray-50 rounded">Loading...</div>;
  }

  if (!sessionData) {
    return null;
  }

  const { session, eventCount, promptCount, observationCount } = sessionData;

  return (
    <div className="mt-4 p-4 bg-gray-50 rounded space-y-3">
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-600">Session ID:</span>
          <p className="font-mono text-xs">{session.claude_session_id}</p>
        </div>
        <div>
          <span className="text-gray-600">Events:</span>
          <p>{eventCount} total</p>
        </div>
        <div>
          <span className="text-gray-600">Prompts:</span>
          <p>{promptCount}</p>
        </div>
        <div>
          <span className="text-gray-600">Observations:</span>
          <p>{observationCount}</p>
        </div>
      </div>

      {session.completed_at && (
        <div className="text-sm text-gray-600">
          Completed: {new Date(session.completed_at).toLocaleString()}
        </div>
      )}

      <button
        onClick={() => setShowEvents(!showEvents)}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        {showEvents ? 'Hide Events' : 'Show Events'}
      </button>

      {showEvents && <SessionEventsList sessionId={sessionId} />}
    </div>
  );
}

/**
 * Session events list with pagination and filtering
 */
function SessionEventsList({ sessionId }: { sessionId: number }) {
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('');
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const { data, isLoading, error } = useSessionEvents(sessionId, {
    offset: page * pageSize,
    limit: pageSize,
    types: eventTypeFilter || undefined,
  });

  if (isLoading) {
    return <div className="mt-4 p-4 border rounded">Loading events...</div>;
  }

  if (error) {
    return (
      <div className="mt-4 p-4 border rounded text-red-500">
        Error: {error.message}
      </div>
    );
  }

  const totalPages = Math.ceil((data?.total || 0) / pageSize);

  return (
    <div className="mt-4 space-y-4">
      <div className="flex gap-2">
        <select
          value={eventTypeFilter}
          onChange={(e) => {
            setEventTypeFilter(e.target.value);
            setPage(0);
          }}
          className="px-3 py-2 border rounded"
        >
          <option value="">All Events</option>
          <option value="decision">Decisions</option>
          <option value="bugfix">Bug Fixes</option>
          <option value="feature">Features</option>
          <option value="refactor">Refactors</option>
          <option value="discovery">Discoveries</option>
          <option value="change">Changes</option>
        </select>
        <span className="px-3 py-2 text-sm text-gray-500">
          {data?.total} events
        </span>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {data?.events.map((event) => (
          <EventItem key={`${event.event_type}-${event.row_id}`} event={event} />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex gap-2 justify-center">
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="px-3 py-1 border rounded disabled:opacity-50 text-sm"
          >
            Prev
          </button>
          <span className="px-3 py-1 text-sm">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1}
            className="px-3 py-1 border rounded disabled:opacity-50 text-sm"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Individual event item
 */
function EventItem({ event }: { event: SessionEvent }) {
  const [expanded, setExpanded] = useState(false);

  const eventTypeColors = {
    prompt: 'bg-purple-100 text-purple-800',
    observation: 'bg-teal-100 text-teal-800',
  };

  const obsTypeColors = {
    decision: 'bg-yellow-100 text-yellow-800',
    bugfix: 'bg-red-100 text-red-800',
    feature: 'bg-green-100 text-green-800',
    refactor: 'bg-blue-100 text-blue-800',
    discovery: 'bg-indigo-100 text-indigo-800',
    change: 'bg-gray-100 text-gray-800',
  };

  return (
    <div className="border rounded p-3">
      <div
        className="flex justify-between items-start cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`px-2 py-0.5 rounded text-xs ${
                eventTypeColors[event.event_type]
              }`}
            >
              {event.event_type}
            </span>
            {event.obs_type && (
              <span
                className={`px-2 py-0.5 rounded text-xs ${
                  obsTypeColors[event.obs_type]
                }`}
              >
                {event.obs_type}
              </span>
            )}
            {event.prompt_number !== null && (
              <span className="text-xs text-gray-500">
                Prompt #{event.prompt_number}
              </span>
            )}
          </div>
          {event.title && (
            <h4 className="font-semibold text-sm mb-1">{event.title}</h4>
          )}
          {event.subtitle && (
            <p className="text-sm text-gray-600 mb-1">{event.subtitle}</p>
          )}
          <p className="text-sm text-gray-700 line-clamp-2">{event.text}</p>
          <p className="text-xs text-gray-500 mt-1">
            {new Date(event.ts).toLocaleString()}
          </p>
        </div>
        <button className="text-gray-400 hover:text-gray-600 text-sm">
          {expanded ? '▼' : '▶'}
        </button>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t space-y-2">
          {event.narrative && (
            <div>
              <h5 className="font-semibold text-sm mb-1">Narrative:</h5>
              <p className="text-sm text-gray-700">{event.narrative}</p>
            </div>
          )}
          {event.facts && event.facts.length > 0 && (
            <div>
              <h5 className="font-semibold text-sm mb-1">Facts:</h5>
              <ul className="list-disc list-inside text-sm text-gray-700">
                {event.facts.map((fact, i) => (
                  <li key={i}>{fact}</li>
                ))}
              </ul>
            </div>
          )}
          {event.concepts && event.concepts.length > 0 && (
            <div>
              <h5 className="font-semibold text-sm mb-1">Concepts:</h5>
              <div className="flex flex-wrap gap-1">
                {event.concepts.map((concept, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 bg-gray-100 rounded text-xs"
                  >
                    {concept}
                  </span>
                ))}
              </div>
            </div>
          )}
          {event.files_read && event.files_read.length > 0 && (
            <div>
              <h5 className="font-semibold text-sm mb-1">Files Read:</h5>
              <ul className="list-disc list-inside text-sm text-gray-700 font-mono text-xs">
                {event.files_read.map((file, i) => (
                  <li key={i}>{file}</li>
                ))}
              </ul>
            </div>
          )}
          {event.files_modified && event.files_modified.length > 0 && (
            <div>
              <h5 className="font-semibold text-sm mb-1">Files Modified:</h5>
              <ul className="list-disc list-inside text-sm text-gray-700 font-mono text-xs">
                {event.files_modified.map((file, i) => (
                  <li key={i}>{file}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Complete example app component
 */
export function SessionViewerApp() {
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Recall</h1>
          <HealthStatus />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <SessionList />
      </main>
    </div>
  );
}

export default SessionViewerApp;
