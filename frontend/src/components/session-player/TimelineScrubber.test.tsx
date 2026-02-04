import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { PlaybackFrame } from '../../types/transcript';
import { TimelineScrubber } from './TimelineScrubber';

const frames: PlaybackFrame[] = [
  {
    id: 'f1',
    type: 'user_message',
    timestamp: 1000,
    duration: 500,
    agent: 'claude',
    userMessage: { text: 'Hello' },
    context: { cwd: '/repo' },
  },
  {
    id: 'f2',
    type: 'claude_response',
    timestamp: 1500,
    duration: 500,
    agent: 'claude',
    claudeResponse: { text: 'Hi' },
    context: { cwd: '/repo' },
  },
  {
    id: 'f3',
    type: 'tool_execution',
    timestamp: 2000,
    duration: 500,
    agent: 'claude',
    toolExecution: {
      tool: 'Bash',
      input: {},
      output: { content: 'ok', isError: false },
    },
    context: { cwd: '/repo' },
  },
  {
    id: 'f4',
    type: 'claude_thinking',
    timestamp: 2500,
    duration: 500,
    agent: 'claude',
    thinking: { text: 'Thinking' },
    context: { cwd: '/repo' },
  },
];

describe('TimelineScrubber', () => {
  it('seeks to a frame on click', () => {
    const onSeek = vi.fn();
    render(
      <TimelineScrubber
        frames={frames}
        currentFrameIndex={0}
        onSeek={onSeek}
        showCommentary={false}
        activeFrameTypes={
          new Set(['user_message', 'claude_response', 'tool_execution', 'claude_thinking'])
        }
      />
    );

    const slider = screen.getByRole('slider', { name: 'Playback timeline' });
    vi.spyOn(slider, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      width: 100,
      top: 0,
      height: 10,
      right: 100,
      bottom: 10,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.click(slider, { clientX: 50 });
    expect(onSeek).toHaveBeenCalledWith(2);
  });

  it('handles keyboard navigation', () => {
    const onSeek = vi.fn();
    render(
      <TimelineScrubber
        frames={frames}
        currentFrameIndex={1}
        onSeek={onSeek}
        showCommentary={false}
        activeFrameTypes={
          new Set(['user_message', 'claude_response', 'tool_execution', 'claude_thinking'])
        }
      />
    );

    const slider = screen.getByRole('slider', { name: 'Playback timeline' });
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    fireEvent.keyDown(slider, { key: 'ArrowLeft' });

    expect(onSeek).toHaveBeenCalledWith(2);
    expect(onSeek).toHaveBeenCalledWith(0);
  });
});
