/**
 * Unit tests for LLM Summary Generator
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LlmSummaryGenerator } from '../../services/llm-summary-generator';
import type { PlaybackFrame } from '../../types/transcript';

describe('LlmSummaryGenerator', () => {
  let generator: LlmSummaryGenerator;
  let originalApiKey: string | undefined;

  beforeEach(() => {
    originalApiKey = process.env.RECALL_ANTHROPIC_API_KEY;
    delete process.env.RECALL_ANTHROPIC_API_KEY;
    generator = new LlmSummaryGenerator();
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original environment
    if (originalApiKey !== undefined) {
      process.env.RECALL_ANTHROPIC_API_KEY = originalApiKey;
    } else {
      delete process.env.RECALL_ANTHROPIC_API_KEY;
    }
  });

  describe('isAvailable', () => {
    it('should return false when API key not configured', () => {
      delete process.env.RECALL_ANTHROPIC_API_KEY;
      const gen = new LlmSummaryGenerator();
      expect(gen.isAvailable()).toBe(false);
    });

    it('should return true when API key is configured', () => {
      process.env.RECALL_ANTHROPIC_API_KEY = 'sk-ant-test';
      const gen = new LlmSummaryGenerator();
      expect(gen.isAvailable()).toBe(true);
    });
  });

  describe('estimateCost', () => {
    it('should estimate cost correctly for Haiku model', () => {
      const cost = (generator as any).estimateCost(1000, 'claude-3-haiku-20240307');
      expect(cost).toBeCloseTo(0.00075, 5); // $0.75 per million tokens
    });

    it('should use higher cost for non-Haiku models', () => {
      const cost = (generator as any).estimateCost(1000, 'claude-3-opus-20240229');
      expect(cost).toBeCloseTo(0.003, 5); // $3.00 per million tokens
    });
  });

  describe('buildTranscript', () => {
    it('should build transcript from frames', () => {
      const frames: PlaybackFrame[] = [
        {
          id: '1',
          type: 'user_message',
          timestamp: Date.now(),
          userMessage: { text: 'Add a new button' },
          context: { cwd: '/test' },
        },
        {
          id: '2',
          type: 'claude_response',
          timestamp: Date.now(),
          claudeResponse: { text: "I'll add the button" },
          context: { cwd: '/test' },
        },
      ];

      const transcript = (generator as any).buildTranscript(frames);
      expect(transcript).toContain('USER: Add a new button');
      expect(transcript).toContain("ASSISTANT: I'll add the button");
    });

    it('should truncate transcript if too long', () => {
      const longText = 'x'.repeat(1500);
      const frames: PlaybackFrame[] = Array.from({ length: 10 }, (_, i) => ({
        id: String(i),
        type: 'user_message' as const,
        timestamp: Date.now(),
        userMessage: { text: longText },
        context: { cwd: '/test' },
      }));

      const transcript = (generator as any).buildTranscript(frames);
      expect(transcript.length).toBeLessThan(13000); // Should be under MAX_TRANSCRIPT_CHARS
    });
  });

  describe('rate limiting', () => {
    it('should track and reset request count', () => {
      const generator = new LlmSummaryGenerator();

      // First request should work
      expect(() => (generator as any).checkRateLimit()).not.toThrow();

      // Simulate many requests
      for (let i = 0; i < 9; i++) {
        (generator as any).checkRateLimit();
      }

      //  11th request should throw
      expect(() => (generator as any).checkRateLimit()).toThrow('Rate limit exceeded');
    });
  });

  describe('parseResponse', () => {
    it('should parse valid JSON response', () => {
      const validJson = JSON.stringify({
        oneLiner: 'Added new feature',
        accomplishments: ['Thing 1', 'Thing 2'],
        filesModified: ['file1.ts', 'file2.ts'],
        complexity: 'medium',
      });

      const result = (generator as any).parseResponse(validJson);
      expect(result.oneLiner).toBe('Added new feature');
      expect(result.accomplishments).toEqual(['Thing 1', 'Thing 2']);
      expect(result.complexity).toBe('medium');
    });

    it('should handle response with surrounding text', () => {
      const responseWithText = `Here is the summary:\n${JSON.stringify({
        oneLiner: 'Test',
        accomplishments: ['A'],
        complexity: 'low',
      })}\nHope that helps!`;

      const result = (generator as any).parseResponse(responseWithText);
      expect(result.oneLiner).toBe('Test');
    });

    it('should throw on invalid JSON', () => {
      expect(() => (generator as any).parseResponse('not json')).toThrow();
    });

    it('should throw on missing required fields', () => {
      const invalidJson = JSON.stringify({ oneLiner: 'Test' }); // missing accomplishments
      expect(() => (generator as any).parseResponse(invalidJson)).toThrow();
    });
  });
});
