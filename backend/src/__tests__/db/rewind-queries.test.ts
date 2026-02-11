import { beforeEach, describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';

const state = vi.hoisted(() => ({
  db: null as Database.Database | null,
}));

vi.mock('../../db/transcript-connection', () => ({
  getTranscriptDbInstance: () => {
    if (!state.db) {
      throw new Error('db not initialized');
    }
    return state.db;
  },
}));

describe('rewind-queries', () => {
  beforeEach(() => {
    state.db?.close();
    state.db = new Database(':memory:');
    state.db.exec(`
      CREATE TABLE IF NOT EXISTS session_metadata (
        session_id TEXT PRIMARY KEY,
        start_time TEXT NOT NULL
      );
      INSERT INTO session_metadata (session_id, start_time) VALUES ('s1', '2026-01-01T00:00:00.000Z');
    `);
  });

  it('stores, reads, updates and deletes rewind history', async () => {
    const queries = await import('../../db/rewind-queries');
    queries.initializeRewindSchema();

    const one = queries.insertRewindHistory({
      id: 'r1',
      sessionId: 's1',
      frameIndex: 10,
      cwd: '/tmp/project',
      executedAt: '2026-01-01T01:00:00.000Z',
      filesModified: ['a.ts', 'b.ts'],
      backupsCreated: { 'a.ts': '/tmp/backup/a.ts' },
      canUndo: true,
    });
    const two = queries.insertRewindHistory({
      id: 'r2',
      sessionId: 's1',
      frameIndex: 20,
      cwd: '/tmp/project',
      executedAt: '2026-01-02T01:00:00.000Z',
      filesModified: ['c.ts'],
      canUndo: false,
    });

    expect(one.id).toBe('r1');
    expect(two.id).toBe('r2');
    expect(queries.getRewindHistoryById('r1')?.filesModified).toEqual(['a.ts', 'b.ts']);
    expect(queries.getRewindHistoryById('missing')).toBeNull();

    const history = queries.getSessionRewindHistory('s1');
    expect(history.length).toBe(2);
    expect(history[0]?.id).toBe('r2');

    expect(queries.getLastUndoableRewind('s1')?.id).toBe('r1');
    expect(queries.getSessionRewindCount('s1')).toBe(2);
    expect(queries.getUndoableRewindCount('s1')).toBe(1);

    expect(queries.markRewindAsUsed('r1')).toBe(true);
    expect(queries.getUndoableRewindCount('s1')).toBe(0);
    expect(queries.markRewindAsUsed('missing')).toBe(false);

    expect(queries.deleteRewindHistory('r2')).toBe(true);
    expect(queries.deleteRewindHistory('missing')).toBe(false);
  });

  it('computes rewind stats and handles malformed JSON safely', async () => {
    const queries = await import('../../db/rewind-queries');
    queries.initializeRewindSchema();

    queries.insertRewindHistory({
      id: 'r1',
      sessionId: 's1',
      frameIndex: 1,
      cwd: '/tmp/project',
      executedAt: '2026-01-01T00:00:00.000Z',
      filesModified: ['a.ts', 'b.ts'],
      canUndo: true,
    });

    state
      .db!.prepare(
        `
      INSERT INTO rewind_history (
        id, session_id, frame_index, cwd, executed_at, executed_at_epoch, files_modified, can_undo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
      )
      .run('bad', 's1', 2, '/tmp/project', '2026-01-03T00:00:00.000Z', Date.now(), 'not-json', 1);

    const stats = queries.getRewindStats('s1');
    expect(stats.totalRewinds).toBe(2);
    expect(stats.undoableRewinds).toBe(2);
    expect(stats.totalFilesModified).toBe(2);
    expect(stats.lastRewindAt).toBeDefined();
  });

  it('cleans up old non-undoable rewinds', async () => {
    const queries = await import('../../db/rewind-queries');
    queries.initializeRewindSchema();

    const oldEpoch = Date.now() - 90 * 24 * 60 * 60 * 1000;
    state
      .db!.prepare(
        `
      INSERT INTO rewind_history (
        id, session_id, frame_index, cwd, executed_at, executed_at_epoch, files_modified, can_undo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
      )
      .run('old', 's1', 1, '/tmp/project', '2025-01-01T00:00:00.000Z', oldEpoch, '[]', 0);

    const deleted = queries.cleanupOldRewindHistory(30);
    expect(deleted).toBe(1);
  });
});
