import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlaybackFrame, SessionMetadata } from '../../types/transcript';

describe('Transcript ordering', () => {
  const originalHome = process.env.HOME;
  let tempHome = '';

  beforeEach(() => {
    vi.resetModules();
    tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'recall-transcript-ordering-'));
    process.env.HOME = tempHome;
  });

  afterEach(async () => {
    const { closeTranscriptDatabase } = await import('../../db/transcript-connection');
    closeTranscriptDatabase();
    process.env.HOME = originalHome;
    fs.rmSync(tempHome, { recursive: true, force: true });
  });

  it('orders sessions and frames deterministically when timestamps tie', async () => {
    const queries = await import('../../db/transcript-queries');
    queries.initializeTranscriptSchema();

    const sessionA: SessionMetadata = {
      sessionId: 'session-a',
      slug: 'session-a',
      project: 'proj',
      agent: 'claude',
      startTime: '2026-01-01T00:00:00.000Z',
      eventCount: 2,
      cwd: '/tmp/proj',
    };

    const sessionB: SessionMetadata = {
      sessionId: 'session-b',
      slug: 'session-b',
      project: 'proj',
      agent: 'claude',
      startTime: '2026-01-01T00:00:00.000Z',
      eventCount: 1,
      cwd: '/tmp/proj',
    };

    queries.insertSession(sessionA);
    queries.insertSession(sessionB);

    const frame2: PlaybackFrame = {
      id: 'frame-2',
      type: 'user_message',
      timestamp: 1000,
      agent: 'claude',
      userMessage: { text: 'second' },
      context: { cwd: '/tmp/proj' },
    };

    const frame1: PlaybackFrame = {
      id: 'frame-1',
      type: 'user_message',
      timestamp: 1000,
      agent: 'claude',
      userMessage: { text: 'first' },
      context: { cwd: '/tmp/proj' },
    };

    // Insert reverse id order to confirm query tie-breaker controls result ordering
    queries.insertFrame('session-a', frame2);
    queries.insertFrame('session-a', frame1);

    const sessions = queries.getTranscriptSessions({ offset: 0, limit: 10 });
    expect(sessions.sessions.map((s) => s.sessionId).slice(0, 2)).toEqual([
      'session-b',
      'session-a',
    ]);

    const frames = queries.getTranscriptFrames('session-a', { offset: 0, limit: 10 });
    expect(frames.frames.map((f) => f.id)).toEqual(['frame-1', 'frame-2']);
  });
});
