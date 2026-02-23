import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useLiveSessionPolling } from './useLiveSessionPolling';
import * as transcriptApi from '../api/transcriptClient';
import type { SessionListResponse } from '../types/transcript';

vi.mock('../api/transcriptClient');

const mockedFetchSessions = vi.mocked(transcriptApi.fetchSessions);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

const baseResponse: SessionListResponse = {
  sessions: [
    {
      sessionId: 's1',
      slug: 'test-session',
      project: '/repo/test',
      agent: 'claude',
      startTime: new Date().toISOString(),
      duration: 120,
      eventCount: 5,
      cwd: '/repo/test',
      isOngoing: false,
    },
  ],
  total: 1,
  offset: 0,
  limit: 20,
};

const liveResponse: SessionListResponse = {
  ...baseResponse,
  sessions: [
    {
      ...baseResponse.sessions[0],
      isOngoing: true,
    },
  ],
};

describe('useLiveSessionPolling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedFetchSessions.mockResolvedValue(baseResponse);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns session data', async () => {
    const { result } = renderHook(() => useLiveSessionPolling(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data?.sessions).toHaveLength(1);
    expect(result.current.data?.sessions[0].sessionId).toBe('s1');
  });

  it('sets hasLiveSessions to false when no ongoing sessions', async () => {
    const { result } = renderHook(() => useLiveSessionPolling(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.hasLiveSessions).toBe(false);
  });

  it('sets hasLiveSessions to true when ongoing sessions exist', async () => {
    mockedFetchSessions.mockResolvedValue(liveResponse);

    const { result } = renderHook(() => useLiveSessionPolling(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.hasLiveSessions).toBe(true);
  });

  it('sets isPolling based on live session state', async () => {
    mockedFetchSessions.mockResolvedValue(liveResponse);

    const { result } = renderHook(() => useLiveSessionPolling(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    // isPolling should be true when live sessions exist
    expect(result.current.isPolling).toBe(true);
  });

  it('passes query parameters through', async () => {
    const { result } = renderHook(() => useLiveSessionPolling({ limit: 10, agent: 'claude' }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(mockedFetchSessions).toHaveBeenCalledWith({ limit: 10, agent: 'claude' });
  });

  it('provides refetch function', async () => {
    const { result } = renderHook(() => useLiveSessionPolling(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(typeof result.current.refetch).toBe('function');
  });

  it('provides loading state', async () => {
    const { result } = renderHook(() => useLiveSessionPolling(), {
      wrapper: createWrapper(),
    });

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });
});
