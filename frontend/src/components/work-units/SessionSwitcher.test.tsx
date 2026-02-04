import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { WorkUnitSession } from '../../types/work-unit';
import { SessionSwitcher } from './SessionSwitcher';

const sessions: WorkUnitSession[] = [
  {
    sessionId: 's1',
    agent: 'claude',
    correlationScore: 0.9,
    joinReason: ['project_path_match'],
    startTime: new Date('2024-01-01T10:00:00Z').toISOString(),
    duration: 120,
    frameCount: 10,
    firstUserMessage: 'Add search',
  },
  {
    sessionId: 's2',
    agent: 'codex',
    correlationScore: 0.8,
    joinReason: ['project_path_match'],
    startTime: new Date('2024-01-01T10:10:00Z').toISOString(),
    duration: 60,
    frameCount: 5,
    firstUserMessage: 'Fix bug',
  },
];

describe('SessionSwitcher', () => {
  it('shows current session info and allows navigation', async () => {
    const user = userEvent.setup();
    const onSessionChange = vi.fn();

    render(
      <SessionSwitcher
        sessions={sessions}
        currentSessionId="s1"
        onSessionChange={onSessionChange}
        currentFrameIndex={2}
        totalFrames={10}
      />
    );

    expect(screen.getByText('Session 1 of 2')).toBeInTheDocument();
    expect(screen.getByText('Frame 3 / 10')).toBeInTheDocument();

    await user.click(screen.getByTitle('Next session'));
    expect(onSessionChange).toHaveBeenCalledWith('s2');
  });
});
