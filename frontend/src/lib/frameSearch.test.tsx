import { describe, it, expect } from 'vitest';
import {
  getSearchableText,
  frameMatchesQuery,
  findMatchingFrameIndices,
  findNextMatchIndex,
  findPrevMatchIndex,
  highlightText,
} from './frameSearch';
import type { PlaybackFrame } from '../types/transcript';
import React from 'react';
import { render } from '@testing-library/react';

describe('frameSearch', () => {
  const mockFrame: PlaybackFrame = {
    id: 'f1',
    type: 'user_message',
    timestamp: 123,
    context: { cwd: '/test' },
    userMessage: { text: 'Hello World' },
    thinking: { text: 'AI is thinking about the world' },
    claudeResponse: { text: 'The world is round' },
    toolExecution: {
      tool: 'grep',
      input: {},
      output: { content: 'grep result', isError: false },
      fileDiff: {
        filePath: 'src/main.ts',
        newContent: 'console.log("world")',
        language: 'typescript',
      },
    },
  };

  describe('getSearchableText', () => {
    it('combines all text fields', () => {
      const text = getSearchableText(mockFrame);
      expect(text).toContain('Hello World');
      expect(text).toContain('AI is thinking');
      expect(text).toContain('The world is round');
      expect(text).toContain('grep');
      expect(text).toContain('grep result');
      expect(text).toContain('src/main.ts');
      expect(text).toContain('console.log("world")');
    });
  });

  describe('frameMatchesQuery', () => {
    it('returns true if query matches any part', () => {
      expect(frameMatchesQuery(mockFrame, 'world')).toBe(true);
      expect(frameMatchesQuery(mockFrame, 'GREP')).toBe(true);
      expect(frameMatchesQuery(mockFrame, 'main.ts')).toBe(true);
    });

    it('returns false if query does not match', () => {
      expect(frameMatchesQuery(mockFrame, 'nonexistent')).toBe(false);
    });

    it('returns false for empty query', () => {
      expect(frameMatchesQuery(mockFrame, '')).toBe(false);
    });
  });

  describe('findMatchingFrameIndices', () => {
    it('returns indices of matching frames', () => {
      const frames = [
        mockFrame,
        {
          ...mockFrame,
          userMessage: { text: 'other' },
          thinking: undefined,
          claudeResponse: undefined,
          toolExecution: undefined,
        },
      ];
      expect(findMatchingFrameIndices(frames, 'world')).toEqual([0]);
      expect(findMatchingFrameIndices(frames, 'other')).toEqual([1]);
    });
  });

  describe('findNextMatchIndex', () => {
    it('finds next index or wraps around', () => {
      const matches = [2, 5, 8];
      expect(findNextMatchIndex(0, matches)).toBe(2);
      expect(findNextMatchIndex(3, matches)).toBe(5);
      expect(findNextMatchIndex(9, matches)).toBe(2);
    });

    it('returns -1 if no matches', () => {
      expect(findNextMatchIndex(0, [])).toBe(-1);
    });
  });

  describe('findPrevMatchIndex', () => {
    it('finds previous index or wraps around', () => {
      const matches = [2, 5, 8];
      expect(findPrevMatchIndex(9, matches)).toBe(8);
      expect(findPrevMatchIndex(6, matches)).toBe(5);
      expect(findPrevMatchIndex(1, matches)).toBe(8);
    });

    it('returns -1 if no matches', () => {
      expect(findPrevMatchIndex(0, [])).toBe(-1);
    });
  });

  describe('highlightText', () => {
    it('returns original text if query empty', () => {
      expect(highlightText('Hello', '')).toBe('Hello');
    });

    it('wraps matches in <mark> tags', () => {
      const node = highlightText('Hello World', 'World');
      const { container } = render(<div>{node}</div>);
      const mark = container.querySelector('mark');
      expect(mark).toBeInTheDocument();
      expect(mark?.textContent).toBe('World');
      expect(container.textContent).toBe('Hello World');
    });

    it('handles case-insensitive matching', () => {
      const node = highlightText('Hello World', 'world');
      const { container } = render(<div>{node}</div>);
      const mark = container.querySelector('mark');
      expect(mark?.textContent).toBe('World');
    });
  });
});
