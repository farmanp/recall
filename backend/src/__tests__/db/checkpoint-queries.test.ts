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

describe('checkpoint-queries', () => {
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

  it('initializes schema and supports CRUD operations', async () => {
    const queries = await import('../../db/checkpoint-queries');
    queries.initializeCheckpointSchema();

    const checkpoint = queries.insertCheckpoint({
      id: 'c1',
      sessionId: 's1',
      name: 'before',
      frameIndex: 3,
      createdAt: '2026-01-01T00:00:00.000Z',
      notes: 'n',
      gitCommit: 'abc',
    });
    expect(checkpoint.fileCount).toBe(0);

    const file = queries.insertCheckpointFile('c1', {
      path: 'src/index.ts',
      contentHash: 'h1',
      content: 'one',
      status: 'created',
    });
    expect(file.id).toBeTypeOf('number');

    queries.insertCheckpointFiles('c1', [
      { path: 'src/a.ts', contentHash: 'h2', content: 'a', status: 'created' },
      { path: 'src/b.ts', contentHash: 'h3', content: 'b', status: 'modified' },
    ]);

    expect(queries.checkpointExists('c1')).toBe(true);
    expect(queries.getSessionCheckpointCount('s1')).toBe(1);
    expect(queries.getCheckpointFiles('c1').length).toBe(3);
    expect(queries.getSessionCheckpoints('s1')[0]?.fileCount).toBe(3);

    const full = queries.getCheckpointWithFiles('c1');
    expect(full?.files.length).toBe(3);

    const updated = queries.updateCheckpoint('c1', { name: 'after', notes: 'updated' });
    expect(updated?.name).toBe('after');
    expect(updated?.notes).toBe('updated');

    // No-op update path still returns checkpoint
    expect(queries.updateCheckpoint('c1', {})?.id).toBe('c1');

    expect(queries.deleteCheckpoint('c1')).toBe(true);
    expect(queries.deleteCheckpoint('c1')).toBe(false);
    expect(queries.getCheckpointById('c1')).toBeNull();
  });

  it('returns empty results for unknown ids', async () => {
    const queries = await import('../../db/checkpoint-queries');
    queries.initializeCheckpointSchema();
    expect(queries.getCheckpointById('missing')).toBeNull();
    expect(queries.getCheckpointWithFiles('missing')).toBeNull();
    expect(queries.getCheckpointFiles('missing')).toEqual([]);
    expect(queries.getSessionCheckpoints('missing')).toEqual([]);
    expect(queries.checkpointExists('missing')).toBe(false);
    expect(queries.getSessionCheckpointCount('missing')).toBe(0);
  });
});
