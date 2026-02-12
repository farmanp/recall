import { describe, it, expect } from 'vitest';
import { sessionToMarkdown, frameToMarkdown, sessionToHTML } from './exportSession';
import type { SessionTimeline, PlaybackFrame } from '../types/transcript';

describe('exportSession', () => {
  const mockFrame: PlaybackFrame = {
    id: 'frame-1',
    type: 'user_message',
    timestamp: 1644480000000,
    context: { cwd: '/test' },
    userMessage: { text: 'Hello AI' },
  };

  const mockSession: SessionTimeline = {
    sessionId: 'session-1',
    slug: 'test-session',
    project: 'test-project',
    agent: 'claude',
    startedAt: 1644480000000,
    totalFrames: 1,
    frames: [mockFrame],
    metadata: { cwd: '/test' },
  };

  describe('sessionToMarkdown', () => {
    it('should convert session to markdown summary', () => {
      const markdown = sessionToMarkdown(mockSession);
      expect(markdown).toContain('# test-session');
      expect(markdown).toContain('**Project:** test-project');
      expect(markdown).toContain('### User');
      expect(markdown).toContain('Hello AI');
    });

    it('should include AI response', () => {
      const sessionWithMoreFrames: SessionTimeline = {
        ...mockSession,
        frames: [
          mockFrame,
          {
            id: 'frame-3',
            type: 'claude_response',
            timestamp: 1644480002000,
            context: { cwd: '/test' },
            claudeResponse: { text: 'Hello human' },
          },
        ],
      };
      const markdown = sessionToMarkdown(sessionWithMoreFrames);
      expect(markdown).toContain('### Assistant');
      expect(markdown).toContain('Hello human');
    });

    it('should include tool execution info', () => {
      const sessionWithTool: SessionTimeline = {
        ...mockSession,
        frames: [
          {
            id: 'frame-4',
            type: 'tool_execution',
            timestamp: 1644480003000,
            context: { cwd: '/test' },
            toolExecution: {
              tool: 'ls',
              input: {},
              output: { content: 'file1.txt', isError: false },
            },
          },
        ],
      };
      const markdown = sessionToMarkdown(sessionWithTool);
      expect(markdown).toContain('### Tool: ls');
    });
  });

  describe('frameToMarkdown', () => {
    it('should convert single frame to markdown', () => {
      const markdown = frameToMarkdown(mockFrame, mockSession);
      expect(markdown).toContain('# Frame Export: test-session');
      expect(markdown).toContain('**Frame ID:** `frame-1`');
      expect(markdown).toContain('## 👤 User Message');
      expect(markdown).toContain('Hello AI');
    });
  });

  describe('sessionToHTML', () => {
    it('should convert session to HTML', () => {
      const html = sessionToHTML(mockSession);
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('test-session');
      expect(html).toContain('test-project');
      expect(html).toContain('USER MESSAGE');
      expect(html).toContain('Hello AI');
    });
  });
});
