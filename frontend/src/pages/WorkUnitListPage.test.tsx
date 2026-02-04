import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { WorkUnitListResponse, WorkUnitStats } from '../types/work-unit';
import { WorkUnitListPage } from './WorkUnitListPage';
import * as workUnitHooks from '../hooks/useWorkUnits';

vi.mock('../hooks/useWorkUnits');

const mockedUseWorkUnits = vi.mocked(workUnitHooks.useWorkUnits);
const mockedUseWorkUnitStats = vi.mocked(workUnitHooks.useWorkUnitStats);
const mockedUseRecomputeWorkUnits = vi.mocked(workUnitHooks.useRecomputeWorkUnits);

const workUnits: WorkUnitListResponse = {
  total: 2,
  offset: 0,
  limit: 20,
  ungroupedCount: 0,
  workUnits: [
    {
      id: 'wu-1',
      name: 'Alpha work unit',
      projectPath: '/repo/alpha',
      sessions: [
        {
          sessionId: 's1',
          agent: 'claude',
          correlationScore: 0.9,
          joinReason: ['project_path_match'],
          startTime: new Date('2024-01-01T10:00:00Z').toISOString(),
          frameCount: 10,
          firstUserMessage: 'Add search',
        },
      ],
      agents: ['claude'],
      confidence: 'high',
      startTime: new Date('2024-01-01T10:00:00Z').toISOString(),
      endTime: new Date('2024-01-01T11:00:00Z').toISOString(),
      totalDuration: 3600,
      totalFrames: 10,
      filesTouched: [],
      createdAt: new Date('2024-01-01T12:00:00Z').toISOString(),
      updatedAt: new Date('2024-01-01T12:00:00Z').toISOString(),
    },
    {
      id: 'wu-2',
      name: 'Beta work unit',
      projectPath: '/repo/beta',
      sessions: [
        {
          sessionId: 's2',
          agent: 'codex',
          correlationScore: 0.8,
          joinReason: ['project_path_match'],
          startTime: new Date('2024-01-02T10:00:00Z').toISOString(),
          frameCount: 5,
          firstUserMessage: 'Fix player',
        },
      ],
      agents: ['codex'],
      confidence: 'medium',
      startTime: new Date('2024-01-02T10:00:00Z').toISOString(),
      endTime: new Date('2024-01-02T11:00:00Z').toISOString(),
      totalDuration: 1800,
      totalFrames: 5,
      filesTouched: [],
      createdAt: new Date('2024-01-02T12:00:00Z').toISOString(),
      updatedAt: new Date('2024-01-02T12:00:00Z').toISOString(),
    },
  ],
};

const stats: WorkUnitStats = {
  total: 2,
  ungroupedSessions: 0,
  byConfidence: { high: 1, medium: 1, low: 0 },
  byAgent: { claude: 1, codex: 1, gemini: 0, unknown: 0 },
};

describe('WorkUnitListPage', () => {
  beforeEach(() => {
    mockedUseWorkUnits.mockReturnValue({
      data: workUnits,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    mockedUseWorkUnitStats.mockReturnValue({
      data: stats,
      isLoading: false,
      error: null,
    });
    mockedUseRecomputeWorkUnits.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);
  });

  it('calls useWorkUnits with agent filter after selecting Claude', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <WorkUnitListPage />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: 'Claude' }));

    const lastCall = mockedUseWorkUnits.mock.calls.at(-1)?.[0];
    expect(lastCall?.agent).toBe('claude');
  });

  it('triggers recompute mutation', async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn();
    mockedUseRecomputeWorkUnits.mockReturnValue({
      mutateAsync,
      isPending: false,
    } as any);

    render(
      <MemoryRouter>
        <WorkUnitListPage />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: 'Recompute' }));
    expect(mutateAsync).toHaveBeenCalledWith(true);
  });
});
