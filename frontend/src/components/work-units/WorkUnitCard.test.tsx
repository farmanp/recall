import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { WorkUnit } from '../../types/work-unit';
import { WorkUnitCard } from './WorkUnitCard';

const workUnit: WorkUnit = {
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
      frameCount: 10,
      firstUserMessage: 'Add search',
    },
  ],
  agents: ['claude', 'codex'],
  confidence: 'high',
  startTime: new Date('2024-01-01T10:00:00Z').toISOString(),
  endTime: new Date('2024-01-01T11:00:00Z').toISOString(),
  totalDuration: 3661,
  totalFrames: 42,
  filesTouched: [],
  createdAt: new Date('2024-01-01T12:00:00Z').toISOString(),
  updatedAt: new Date('2024-01-01T12:00:00Z').toISOString(),
};

describe('WorkUnitCard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T12:10:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders key work unit details', () => {
    render(
      <MemoryRouter>
        <WorkUnitCard workUnit={workUnit} />
      </MemoryRouter>
    );

    expect(screen.getByText('Alpha Work Unit')).toBeInTheDocument();
    expect(screen.getByText('/repo/alpha')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('1 session')).toBeInTheDocument();
    expect(screen.getByText('1h 1m')).toBeInTheDocument();
    expect(screen.getByText('42 frames')).toBeInTheDocument();
    expect(screen.getByText('2h ago')).toBeInTheDocument();
  });
});
