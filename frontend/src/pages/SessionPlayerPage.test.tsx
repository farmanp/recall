import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { SessionDetailsResponse, SessionFramesResponse } from '../types/transcript';
import { SessionPlayerPage } from './SessionPlayerPage';
import * as transcriptHooks from '../hooks/useTranscriptApi';

vi.mock('../hooks/useTranscriptApi');

const mockedUseSessionDetails = vi.mocked(transcriptHooks.useSessionDetails);
const mockedUseSessionFrames = vi.mocked(transcriptHooks.useSessionFrames);
const mockedUseSessionCommentary = vi.mocked(transcriptHooks.useSessionCommentary);

const sessionDetails: SessionDetailsResponse = {
  sessionId: 's1',
  slug: 'alpha-session',
  project: '/repo/alpha',
  agent: 'claude',
  startedAt: Date.now(),
  totalFrames: 2,
  metadata: { cwd: '/repo/alpha' },
};

const sessionFrames: SessionFramesResponse = {
  total: 2,
  offset: 0,
  limit: 1000,
  frames: [
    {
      id: 'f1',
      type: 'user_message',
      timestamp: Date.now() - 2000,
      duration: 500,
      agent: 'claude',
      userMessage: { text: 'Hello session' },
      context: { cwd: '/repo/alpha' },
    },
    {
      id: 'f2',
      type: 'claude_response',
      timestamp: Date.now() - 1500,
      duration: 500,
      agent: 'claude',
      claudeResponse: { text: 'Hi there' },
      context: { cwd: '/repo/alpha' },
    },
  ],
};

function renderPlayer(route: string) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/session/:sessionId/:frameIndex?" element={<SessionPlayerPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('SessionPlayerPage', () => {
  beforeEach(() => {
    localStorage.clear();
    mockedUseSessionDetails.mockReturnValue({
      data: sessionDetails,
      isLoading: false,
      error: null,
    });
    mockedUseSessionFrames.mockReturnValue({
      data: sessionFrames,
      isLoading: false,
      error: null,
    });
    mockedUseSessionCommentary.mockReturnValue({
      data: { commentary: [], total: 0, sessionId: 's1' },
      isLoading: false,
      error: null,
    });
  });

  it('renders session header details', () => {
    renderPlayer('/session/s1/0');
    expect(screen.getByText('alpha-session')).toBeInTheDocument();
    expect(screen.getByText('Live Replay')).toBeInTheDocument();
  });

  it('switches to chat view and shows messages', async () => {
    const user = userEvent.setup();
    renderPlayer('/session/s1/1');

    await user.click(screen.getByTitle('Switch to Chat View'));
    expect(screen.getByText('Hello session')).toBeInTheDocument();
    expect(screen.getByText('Hi there')).toBeInTheDocument();
  });
});
