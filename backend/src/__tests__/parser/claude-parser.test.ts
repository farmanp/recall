import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { ClaudeParser } from '../../parser/claude-parser';
import { TranscriptEntry, ToolResultBlock } from '../../types/transcript';

describe('ClaudeParser', () => {
  const parser = new ClaudeParser();
  const fixturesDir = path.join(__dirname, '../fixtures/claude');

  describe('parseEntry', () => {
    it('returns null for non-object input', () => {
      expect(parser.parseEntry(null)).toBeNull();
      expect(parser.parseEntry('string')).toBeNull();
      expect(parser.parseEntry(123)).toBeNull();
      expect(parser.parseEntry(undefined)).toBeNull();
    });

    it('returns null when uuid is missing', () => {
      expect(parser.parseEntry({ timestamp: '2024-01-01' })).toBeNull();
    });

    it('returns null when timestamp is missing', () => {
      expect(parser.parseEntry({ uuid: 'abc' })).toBeNull();
    });

    it('parses valid entry with all fields', () => {
      const entry = parser.parseEntry({
        uuid: 'test-uuid',
        timestamp: '2024-01-01T00:00:00Z',
        type: 'user',
        message: { role: 'user', content: 'Hello' },
        cwd: '/test',
        sessionId: 'session-1',
      });

      expect(entry).not.toBeNull();
      expect(entry?.uuid).toBe('test-uuid');
      expect(entry?.type).toBe('user');
      expect(entry?.cwd).toBe('/test');
      expect(entry?.sessionId).toBe('session-1');
    });

    it('parses entry with minimal required fields', () => {
      const entry = parser.parseEntry({
        uuid: 'minimal',
        timestamp: '2024-01-01T00:00:00Z',
      });

      expect(entry).not.toBeNull();
      expect(entry?.uuid).toBe('minimal');
    });

    it('infers type from message role when type is missing', () => {
      const userEntry = parser.parseEntry({
        uuid: 'test-user',
        timestamp: '2024-01-01T00:00:00Z',
        message: { role: 'user' },
      });
      expect(userEntry?.type).toBe('user');

      const assistantEntry = parser.parseEntry({
        uuid: 'test-assistant',
        timestamp: '2024-01-01T00:00:00Z',
        message: { role: 'assistant' },
      });
      expect(assistantEntry?.type).toBe('assistant');
    });

    it('preserves model information from message.model', () => {
      const entry = parser.parseEntry({
        uuid: 'test',
        timestamp: '2024-01-01T00:00:00Z',
        message: { role: 'assistant', model: 'claude-3-opus' },
      });

      expect((entry as any).model).toBe('claude-3-opus');
    });

    it('preserves slug field', () => {
      const entry = parser.parseEntry({
        uuid: 'test',
        timestamp: '2024-01-01T00:00:00Z',
        slug: 'my-session-slug',
      });

      expect((entry as any).slug).toBe('my-session-slug');
    });

    it('preserves parentUuid for threading', () => {
      const entry = parser.parseEntry({
        uuid: 'child',
        parentUuid: 'parent',
        timestamp: '2024-01-01T00:00:00Z',
      });

      expect(entry?.parentUuid).toBe('parent');
    });
  });

  describe('collectToolResults', () => {
    it('returns empty map for entries without tool results', () => {
      const entries: TranscriptEntry[] = [
        {
          uuid: 'e1',
          timestamp: '2024-01-01T00:00:00Z',
          type: 'user',
          message: { role: 'user', content: 'Hello' },
        },
      ];

      const resultMap = parser.collectToolResults(entries);
      expect(resultMap.size).toBe(0);
    });

    it('maps tool_use_id to tool results', () => {
      const entries: TranscriptEntry[] = [
        {
          uuid: 'e1',
          timestamp: '2024-01-01T00:00:00Z',
          type: 'user',
          message: {
            role: 'user',
            content: [{ type: 'tool_result', tool_use_id: 'tool-1', content: 'success' }],
          },
        },
      ];

      const resultMap = parser.collectToolResults(entries);
      expect(resultMap.has('tool-1')).toBe(true);
      expect(resultMap.get('tool-1')?.content).toBe('success');
    });

    it('handles multiple tool results in same entry', () => {
      const entries: TranscriptEntry[] = [
        {
          uuid: 'e1',
          timestamp: '2024-01-01T00:00:00Z',
          type: 'user',
          message: {
            role: 'user',
            content: [
              { type: 'tool_result', tool_use_id: 'tool-1', content: 'result-1' },
              { type: 'tool_result', tool_use_id: 'tool-2', content: 'result-2' },
            ],
          },
        },
      ];

      const resultMap = parser.collectToolResults(entries);
      expect(resultMap.size).toBe(2);
      expect(resultMap.get('tool-1')?.content).toBe('result-1');
      expect(resultMap.get('tool-2')?.content).toBe('result-2');
    });

    it('handles entries without message', () => {
      const entries: TranscriptEntry[] = [
        {
          uuid: 'e1',
          timestamp: '2024-01-01T00:00:00Z',
          type: 'session_metadata',
        },
      ];

      const resultMap = parser.collectToolResults(entries);
      expect(resultMap.size).toBe(0);
    });

    it('handles entries with string content (not array)', () => {
      const entries: TranscriptEntry[] = [
        {
          uuid: 'e1',
          timestamp: '2024-01-01T00:00:00Z',
          type: 'user',
          message: { role: 'user', content: 'plain string content' },
        },
      ];

      const resultMap = parser.collectToolResults(entries);
      expect(resultMap.size).toBe(0);
    });
  });

  describe('extractToolExecution', () => {
    it('creates tool execution with name and input', () => {
      const toolUse = {
        type: 'tool_use' as const,
        id: 'tool-1',
        name: 'Read',
        input: { file_path: '/test/file.ts' },
      };

      const execution = parser.extractToolExecution(toolUse, undefined);

      expect(execution.tool).toBe('Read');
      expect(execution.input).toEqual({ file_path: '/test/file.ts' });
    });

    it('includes tool result output when available', () => {
      const toolUse = {
        type: 'tool_use' as const,
        id: 'tool-1',
        name: 'Read',
        input: { file_path: '/test/file.ts' },
      };
      const toolResult: ToolResultBlock = {
        type: 'tool_result',
        tool_use_id: 'tool-1',
        content: 'file contents here',
      };

      const execution = parser.extractToolExecution(toolUse, toolResult);

      expect(execution.output).toBeDefined();
    });
  });

  describe('extractFramesFromEntry', () => {
    const emptyToolResultMap = new Map<string, ToolResultBlock>();

    it('returns empty array for entry without content', () => {
      const entry: TranscriptEntry = {
        uuid: 'test',
        timestamp: '2024-01-01T00:00:00Z',
        type: 'user',
      };

      const frames = parser.extractFramesFromEntry(entry, emptyToolResultMap);
      expect(frames).toHaveLength(0);
    });

    it('creates user_message frame from user text', () => {
      const entry: TranscriptEntry = {
        uuid: 'user-1',
        timestamp: '2024-01-01T00:00:00Z',
        type: 'user',
        message: { role: 'user', content: 'Hello world' },
        cwd: '/test',
      };

      const frames = parser.extractFramesFromEntry(entry, emptyToolResultMap);

      expect(frames).toHaveLength(1);
      expect(frames[0]?.type).toBe('user_message');
      expect(frames[0]?.userMessage?.text).toBe('Hello world');
      expect(frames[0]?.agent).toBe('claude');
    });

    it('creates claude_response frame from assistant text', () => {
      const entry: TranscriptEntry = {
        uuid: 'assist-1',
        timestamp: '2024-01-01T00:00:00Z',
        type: 'assistant',
        message: { role: 'assistant', content: 'I can help with that.' },
        cwd: '/test',
      };

      const frames = parser.extractFramesFromEntry(entry, emptyToolResultMap);

      expect(frames).toHaveLength(1);
      expect(frames[0]?.type).toBe('claude_response');
      expect(frames[0]?.claudeResponse?.text).toBe('I can help with that.');
    });

    it('creates claude_thinking frame from thinking block', () => {
      const entry: TranscriptEntry = {
        uuid: 'think-1',
        timestamp: '2024-01-01T00:00:00Z',
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'thinking',
              thinking: 'Let me analyze this problem...',
              signature: 'sig-123',
            },
          ],
        },
        cwd: '/test',
      };

      const frames = parser.extractFramesFromEntry(entry, emptyToolResultMap);

      expect(frames).toHaveLength(1);
      expect(frames[0]?.type).toBe('claude_thinking');
      expect(frames[0]?.thinking?.text).toBe('Let me analyze this problem...');
      expect(frames[0]?.thinking?.signature).toBe('sig-123');
    });

    it('creates tool_execution frame from tool_use block', () => {
      const entry: TranscriptEntry = {
        uuid: 'tool-1',
        timestamp: '2024-01-01T00:00:00Z',
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'tu-1',
              name: 'Bash',
              input: { command: 'ls -la' },
            },
          ],
        },
        cwd: '/test',
      };

      const frames = parser.extractFramesFromEntry(entry, emptyToolResultMap);

      expect(frames).toHaveLength(1);
      expect(frames[0]?.type).toBe('tool_execution');
      expect(frames[0]?.toolExecution?.tool).toBe('Bash');
      expect(frames[0]?.toolExecution?.input).toEqual({ command: 'ls -la' });
    });

    it('creates multiple frames from mixed content', () => {
      const entry: TranscriptEntry = {
        uuid: 'mixed-1',
        timestamp: '2024-01-01T00:00:00Z',
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            { type: 'thinking', thinking: 'Thinking...' },
            { type: 'text', text: 'Here is my response.' },
            { type: 'tool_use', id: 'tu-1', name: 'Read', input: { file_path: '/test.ts' } },
          ],
        },
        cwd: '/test',
      };

      const frames = parser.extractFramesFromEntry(entry, emptyToolResultMap);

      expect(frames).toHaveLength(3);
      expect(frames[0]?.type).toBe('claude_thinking');
      expect(frames[1]?.type).toBe('claude_response');
      expect(frames[2]?.type).toBe('tool_execution');
    });

    it('skips empty text blocks', () => {
      const entry: TranscriptEntry = {
        uuid: 'empty-1',
        timestamp: '2024-01-01T00:00:00Z',
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            { type: 'text', text: '' },
            { type: 'text', text: '   ' },
            { type: 'text', text: 'Actual content' },
          ],
        },
        cwd: '/test',
      };

      const frames = parser.extractFramesFromEntry(entry, emptyToolResultMap);

      expect(frames).toHaveLength(1);
      expect(frames[0]?.claudeResponse?.text).toBe('Actual content');
    });

    it('skips tool_result blocks (handled separately)', () => {
      const entry: TranscriptEntry = {
        uuid: 'result-1',
        timestamp: '2024-01-01T00:00:00Z',
        type: 'user',
        message: {
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: 'tu-1', content: 'result' }],
        },
      };

      const frames = parser.extractFramesFromEntry(entry, emptyToolResultMap);

      expect(frames).toHaveLength(0);
    });
  });

  describe('golden file tests', () => {
    it('parses simple-session.jsonl correctly', () => {
      const content = fs.readFileSync(path.join(fixturesDir, 'simple-session.jsonl'), 'utf-8');
      const lines = content.split('\n').filter((l) => l.trim());

      const entries = lines.map((line) => parser.parseEntry(JSON.parse(line))).filter(Boolean);

      expect(entries).toHaveLength(3);
      expect(entries[0]?.type).toBe('session_metadata');
      expect(entries[1]?.type).toBe('user');
      expect(entries[2]?.type).toBe('assistant');
    });

    it('parses tool-session.jsonl and matches tool results', () => {
      const content = fs.readFileSync(path.join(fixturesDir, 'tool-session.jsonl'), 'utf-8');
      const lines = content.split('\n').filter((l) => l.trim());

      const entries = lines
        .map((line) => parser.parseEntry(JSON.parse(line)))
        .filter(Boolean) as TranscriptEntry[];
      const toolResultMap = parser.collectToolResults(entries);

      expect(entries).toHaveLength(4);
      expect(toolResultMap.has('tool-1')).toBe(true);

      // Extract frames from the assistant entry with tool_use
      const assistantEntry = entries.find((e) => e.uuid === 'assist-1');
      const frames = parser.extractFramesFromEntry(assistantEntry!, toolResultMap);

      // Should have text frame and tool_execution frame
      expect(frames.length).toBeGreaterThanOrEqual(2);
      const toolFrame = frames.find((f) => f.type === 'tool_execution');
      expect(toolFrame?.toolExecution?.tool).toBe('Read');
    });

    it('parses thinking-session.jsonl with thinking blocks', () => {
      const content = fs.readFileSync(path.join(fixturesDir, 'thinking-session.jsonl'), 'utf-8');
      const lines = content.split('\n').filter((l) => l.trim());

      const entries = lines
        .map((line) => parser.parseEntry(JSON.parse(line)))
        .filter(Boolean) as TranscriptEntry[];

      const assistantEntry = entries.find((e) => e.type === 'assistant');
      const frames = parser.extractFramesFromEntry(assistantEntry!, new Map());

      // Should have thinking frame and text response frame
      expect(frames.length).toBe(2);
      const thinkingFrame = frames.find((f) => f.type === 'claude_thinking');
      expect(thinkingFrame?.thinking?.signature).toBe('thinking-sig-1');
    });
  });

  describe('edge cases', () => {
    const edgeCasesDir = path.join(__dirname, '../fixtures/edge-cases');

    it('handles empty files gracefully', () => {
      const content = fs.readFileSync(path.join(edgeCasesDir, 'empty-file.jsonl'), 'utf-8');
      const lines = content.split('\n').filter((l) => l.trim());

      expect(lines).toHaveLength(0);
    });

    it('continues parsing after malformed JSON lines', () => {
      const content = fs.readFileSync(path.join(edgeCasesDir, 'malformed.jsonl'), 'utf-8');
      const lines = content.split('\n').filter((l) => l.trim());

      const entries: TranscriptEntry[] = [];
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          const entry = parser.parseEntry(parsed);
          if (entry) entries.push(entry);
        } catch {
          // Skip malformed lines
        }
      }

      // Should have parsed 3 valid entries
      expect(entries).toHaveLength(3);
    });

    it('handles entries with missing optional fields', () => {
      const content = fs.readFileSync(path.join(edgeCasesDir, 'missing-fields.jsonl'), 'utf-8');
      const lines = content.split('\n').filter((l) => l.trim());

      const entries: TranscriptEntry[] = [];
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          const entry = parser.parseEntry(parsed);
          if (entry) entries.push(entry);
        } catch {
          // Skip invalid lines
        }
      }

      // Entry without uuid should be skipped
      // Entry with uuid+timestamp should be parsed
      expect(entries.length).toBeGreaterThanOrEqual(2);
    });
  });
});
