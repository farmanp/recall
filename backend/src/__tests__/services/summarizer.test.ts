import { describe, expect, it } from 'vitest';
import { Summarizer } from '../../services/summarizer';

describe('summarizer', () => {
  it('counts tool usage and file changes', () => {
    const frames: any[] = [
      { type: 'tool_execution', toolExecution: { tool: 'Read', input: { file_path: 'a.ts' } } },
      { type: 'tool_execution', toolExecution: { tool: 'Edit', input: { file_path: 'a.ts' } } },
      { type: 'tool_execution', toolExecution: { tool: 'Write', input: { file_path: 'b.ts' } } },
    ];

    expect(Summarizer.countToolUsage(frames)).toEqual({ Read: 1, Edit: 1, Write: 1 });
    expect(Summarizer.extractFileChanges(frames)).toEqual({
      created: ['b.ts'],
      modified: ['a.ts'],
      deleted: [],
    });
  });

  it('extracts key decisions with dedupe and cap', () => {
    const frame = {
      type: 'claude_response',
      claudeResponse: {
        text: [
          "Let's implement the new parser flow with strict validation.",
          "I'll add backend route coverage for all new endpoints.",
          'We should include regression tests for status mapping.',
          'I recommend improving error handling for missing frames.',
          'Going to refactor this service into smaller helpers.',
          "Let's implement the new parser flow with strict validation.",
        ].join(' '),
      },
    };

    const decisions = Summarizer.extractKeyDecisions([frame as any]);
    expect(decisions.length).toBeLessThanOrEqual(5);
    expect(new Set(decisions).size).toBe(decisions.length);
  });

  it('detects success indicators and error count', () => {
    const frames: any[] = [
      {
        type: 'tool_execution',
        toolExecution: { output: { content: 'all tests passed', isError: false } },
      },
      {
        type: 'tool_execution',
        toolExecution: { output: { content: 'build succeeded', isError: false } },
      },
      {
        type: 'tool_execution',
        toolExecution: { output: { content: 'command failed', isError: true } },
      },
    ];

    const indicators = Summarizer.detectSuccessIndicators(frames);
    expect(indicators).toContain('all tests passing');
    expect(indicators).toContain('build succeeded');
    expect(Summarizer.countErrors(frames)).toBe(1);
  });

  it('generates summary text for empty and populated sessions', () => {
    const empty = Summarizer.generateSummaryText([], {}, { created: [], modified: [] }, 0);
    expect(empty).toBe('Session.');

    const populated = Summarizer.generateSummaryText(
      [{ type: 'user_message' } as any, { type: 'user_message' } as any],
      { Read: 2, Edit: 1 },
      { created: ['a.ts'], modified: ['b.ts'] },
      1
    );
    expect(populated).toContain('2 conversation turns');
    expect(populated).toContain('3 tool executions');
    expect(populated).toContain('2 files touched');
    expect(populated).toContain('1 error encountered');
  });

  it('converts to/from db row shape', () => {
    const summary = {
      sessionId: 's1',
      summaryText: 'summary',
      keyDecisions: ['decide'],
      filesChanged: { created: ['a.ts'], modified: [], deleted: [] },
      toolsUsed: { Read: 1 },
      errorCount: 0,
      successIndicators: ['all tests passing'],
      generatedAt: '2026-01-01T00:00:00.000Z',
      generatedBy: 'heuristic' as const,
    };

    const row = Summarizer.toRow(summary);
    const back = Summarizer.fromRow(row);
    expect(back).toEqual(summary);
  });

  it('generates complete summary payload', () => {
    const frames: any[] = [
      { type: 'user_message' },
      { type: 'tool_execution', toolExecution: { tool: 'Write', input: { file_path: 'new.ts' } } },
    ];
    const summary = Summarizer.generateSummary('session-1', frames);
    expect(summary.sessionId).toBe('session-1');
    expect(summary.generatedBy).toBe('heuristic');
    expect(summary.filesChanged.created).toContain('new.ts');
  });
});
