import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { WorkUnitDetailsResponse } from '../types/work-unit';
import { WorkUnitPlayerPage } from './WorkUnitPlayerPage';
import * as workUnitHooks from '../hooks/useWorkUnits';
import * as transcriptHooks from '../hooks/useTranscriptApi';

vi.mock('../hooks/useWorkUnits');
vi.mock('../hooks/useTranscriptApi');

const mockedUseWorkUnit = vi.mocked(workUnitHooks.useWorkUnit);
const mockedUseSessionFrames = vi.mocked(transcriptHooks.useSessionFrames);

const workUnitDetails: WorkUnitDetailsResponse = {
  workUnit: {
    id: 'wu-1',
    name: 'Alpha Work Unit',
    projectPath: '/repo/alpha',
    sessions: [
      {
        sessionId: 's1',
        agent: 'claude',
        correlationScore: 0.9,
        joinReason: ['project_path_match'],
        startTime: new Date('2024-01-01T10:00:00Z').toISOString(),
        frameCount: 0,
      },
    ],
    agents: ['claude'],
    confidence: 'high',
    startTime: new Date('2024-01-01T10:00:00Z').toISOString(),
    endTime: new Date('2024-01-01T11:00:00Z').toISOString(),
    totalDuration: 3600,
    totalFrames: 0,
    filesTouched: [],
    createdAt: new Date('2024-01-01T12:00:00Z').toISOString(),
    updatedAt: new Date('2024-01-01T12:00:00Z').toISOString(),
  },
  sessions: [],
};

function renderWorkUnitPlayer(route: string) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/work-units/:workUnitId" element={<WorkUnitPlayerPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('WorkUnitPlayerPage', () => {
  beforeEach(() => {
    mockedUseWorkUnit.mockReturnValue({
      data: workUnitDetails,
      isLoading: false,
      error: null,
    });
    mockedUseSessionFrames.mockReturnValue({
      data: { frames: [], total: 0, offset: 0, limit: 1000 },
      isLoading: false,
      error: null,
    });
  });

  it('shows empty state when session has no frames', () => {
    renderWorkUnitPlayer('/work-units/wu-1');
    expect(screen.getByText('Alpha Work Unit')).toBeInTheDocument();
    expect(screen.getByText('No frames in this session')).toBeInTheDocument();
  });
});
