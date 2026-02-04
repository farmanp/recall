import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { SessionListResponse, SearchGlobalResponse } from '../types/transcript';
import { SessionListPage } from './SessionListPage';
import * as transcriptHooks from '../hooks/useTranscriptApi';

vi.mock('../hooks/useTranscriptApi');

const mockedUseSessions = vi.mocked(transcriptHooks.useSessions);
const mockedUseGlobalSearch = vi.mocked(transcriptHooks.useGlobalSearch);

const baseSessions: SessionListResponse = {
  sessions: [
    {
      sessionId: 's1',
      slug: 'alpha-session',
      project: '/repo/alpha',
      agent: 'claude',
      startTime: new Date('2024-01-01T10:00:00Z').toISOString(),
      duration: 120,
      eventCount: 5,
      cwd: '/repo/alpha',
      firstUserMessage: 'Implement search',
    },
    {
      sessionId: 's2',
      slug: 'beta-session',
      project: '/repo/beta',
      agent: 'codex',
      startTime: new Date('2024-01-02T10:00:00Z').toISOString(),
      duration: 240,
      eventCount: 12,
      cwd: '/repo/beta',
      firstUserMessage: 'Fix player bug',
    },
  ],
  total: 2,
  offset: 0,
  limit: 20,
};

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderWithRouter(initialEntries: string[]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <LocationDisplay />
      <Routes>
        <Route path="/" element={<SessionListPage />} />
        <Route path="/session/:sessionId/:frameIndex?" element={<div>Session Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('SessionListPage', () => {
  beforeEach(() => {
    mockedUseSessions.mockReturnValue({
      data: baseSessions,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    mockedUseGlobalSearch.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    });
  });

  it('filters sessions by search query', async () => {
    const user = userEvent.setup();
    renderWithRouter(['/']);

    expect(screen.getByText('alpha-session')).toBeInTheDocument();
    expect(screen.getByText('beta-session')).toBeInTheDocument();

    await user.type(
      screen.getByPlaceholderText('Search sessions by project, slug, or title...'),
      'alpha'
    );

    expect(screen.getByText('alpha-session')).toBeInTheDocument();
    expect(screen.queryByText('beta-session')).not.toBeInTheDocument();
  });

  it('navigates to a session from content search results', async () => {
    const user = userEvent.setup();

    const searchResults: SearchGlobalResponse = {
      query: 'router',
      limit: 50,
      offset: 0,
      total: 1,
      results: [
        {
          sessionId: 's99',
          slug: 'router-session',
          project: '/repo/router',
          frameId: 'f10',
          frameType: 'claude_response',
          timestamp: Date.now(),
          snippet: 'Updated router config',
          matchType: 'response',
          agent: 'claude',
        },
      ],
    };

    mockedUseGlobalSearch.mockReturnValue({
      data: searchResults,
      isLoading: false,
      error: null,
    });

    renderWithRouter(['/?mode=content&q=router']);

    const resultCard = screen.getByText('router-session');
    await user.click(resultCard);

    expect(screen.getByTestId('location').textContent).toBe('/session/s99/f10');
  });
});
