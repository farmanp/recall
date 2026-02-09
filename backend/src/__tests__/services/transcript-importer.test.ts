import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = {
  frameCount: 2,
};

vi.mock('../../parser/parser-factory', () => ({
  ParserFactory: {
    parseFile: vi.fn(async () => ({
      sessionId: 'session-1',
      entries: [{ id: 'entry-1' }, { id: 'entry-2' }],
      metadata: {
        startTime: '2026-01-01T00:00:00.000Z',
        endTime: '2026-01-01T00:00:05.000Z',
        totalEntries: 2,
        cwd: '/tmp/project',
      },
    })),
    buildTimeline: vi.fn(async () => ({
      sessionId: 'session-1',
      slug: 'session-1',
      project: 'project',
      agent: 'claude',
      startedAt: 1704067200000,
      completedAt: 1704067205000,
      totalFrames: mockState.frameCount,
      frames: Array.from({ length: mockState.frameCount }, (_, index) => ({
        id: `frame-${index + 1}`,
        type: 'user_message',
        timestamp: 1704067200000 + index,
        agent: 'claude',
        userMessage: { text: `msg-${index + 1}` },
        context: { cwd: '/tmp/project' },
      })),
      metadata: { cwd: '/tmp/project', claudeMdFiles: [] },
    })),
  },
}));

describe('transcript-importer', () => {
  const originalHome = process.env.HOME;
  let tempHome = '';

  beforeEach(() => {
    vi.resetModules();
    mockState.frameCount = 2;
    tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'recall-importer-test-'));
    process.env.HOME = tempHome;
  });

  afterEach(async () => {
    const { closeTranscriptDatabase } = await import('../../db/transcript-connection');
    closeTranscriptDatabase();
    process.env.HOME = originalHome;
    fs.rmSync(tempHome, { recursive: true, force: true });
  });

  it('re-imports a session without keeping stale frames', async () => {
    const { initializeTranscriptSchema, getTranscriptFrames } =
      await import('../../db/transcript-queries');
    const { importTranscript } = await import('../../services/transcript-importer');

    initializeTranscriptSchema();

    await importTranscript('/tmp/session-1.jsonl', 'claude');
    const firstImport = getTranscriptFrames('session-1', { offset: 0, limit: 10 });
    expect(firstImport.total).toBe(2);

    mockState.frameCount = 1;
    await importTranscript('/tmp/session-1.jsonl', 'claude');
    const secondImport = getTranscriptFrames('session-1', { offset: 0, limit: 10 });

    expect(secondImport.total).toBe(1);
    expect(secondImport.frames.map((frame) => frame.id)).toEqual(['frame-1']);
  });
});
