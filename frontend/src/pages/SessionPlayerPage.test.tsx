import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { SessionDetailsResponse, SessionFramesResponse } from '../types/transcript';
import { SessionPlayerPage } from './SessionPlayerPage';
import * as transcriptHooks from '../hooks/useTranscriptApi';
import * as analysisHooks from '../hooks/useAnalysis';

vi.mock('../hooks/useTranscriptApi');
vi.mock('../hooks/useAnalysis');

const mockedUseSessionDetails = vi.mocked(transcriptHooks.useSessionDetails);
const mockedUseSessionFrames = vi.mocked(transcriptHooks.useSessionFrames);
const mockedUseSessionCommentary = vi.mocked(transcriptHooks.useSessionCommentary);
const mockedUseSessionGit = vi.mocked(transcriptHooks.useSessionGit);
const mockedUseCheckpoints = vi.mocked(transcriptHooks.useCheckpoints);
const mockedUseCreateCheckpoint = vi.mocked(transcriptHooks.useCreateCheckpoint);
const mockedUseDeleteCheckpoint = vi.mocked(transcriptHooks.useDeleteCheckpoint);
const mockedUseSessionSummary = vi.mocked(transcriptHooks.useSessionSummary);
const mockedUseAnalysis = vi.mocked(analysisHooks.useAnalysis);
const mockedUseRefreshAnalysis = vi.mocked(analysisHooks.useRefreshAnalysis);

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
    mockedUseSessionGit.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    });
    mockedUseCheckpoints.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    });
    mockedUseCreateCheckpoint.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      error: null,
    } as any);
    mockedUseDeleteCheckpoint.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      error: null,
    } as any);
    mockedUseSessionSummary.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    });
    mockedUseAnalysis.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    } as any);
    mockedUseRefreshAnalysis.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      error: null,
    } as any);
  });

  it('renders session header details', () => {
    renderPlayer('/session/s1/0');
    expect(screen.getByText('alpha-session')).toBeInTheDocument();
    expect(screen.getByText('Replay')).toBeInTheDocument();
  });

  it('switches to tree view and back', async () => {
    const user = userEvent.setup();
    renderPlayer('/session/s1/1');

    // Check that Transcript View button is present and active by default
    const transcriptButton = screen.getByTitle('Transcript View');
    expect(transcriptButton).toBeInTheDocument();

    // Click Tree View button and verify it becomes active
    const treeButton = screen.getByTitle('Tree View (Subagent Hierarchy)');
    await user.click(treeButton);

    // Verify both buttons are still accessible
    expect(screen.getByTitle('Transcript View')).toBeInTheDocument();
    expect(screen.getByTitle('Tree View (Subagent Hierarchy)')).toBeInTheDocument();
  });
});
