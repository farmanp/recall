import { beforeEach, describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';

const state = vi.hoisted(() => ({
  db: null as Database.Database | null,
}));

vi.mock('../../db/connection', () => ({
  getDbInstance: () => state.db,
}));

describe('claudemd-queries', () => {
  beforeEach(() => {
    state.db?.close();
    state.db = new Database(':memory:');
    state.db.exec(`
      CREATE TABLE claudemd_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content_hash TEXT NOT NULL UNIQUE,
        file_path TEXT NOT NULL,
        content TEXT NOT NULL,
        content_size INTEGER NOT NULL,
        first_seen_at TEXT NOT NULL,
        first_seen_at_epoch INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        created_at_epoch INTEGER NOT NULL
      );

      CREATE TABLE session_claudemd (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        snapshot_id INTEGER NOT NULL,
        file_path TEXT NOT NULL,
        loaded_at TEXT NOT NULL,
        loaded_at_epoch INTEGER NOT NULL
      );

      CREATE TABLE sdk_sessions (
        content_session_id TEXT PRIMARY KEY,
        project TEXT NOT NULL,
        started_at TEXT NOT NULL
      );

      INSERT INTO sdk_sessions (content_session_id, project, started_at) VALUES
        ('sess-1', 'proj-a', '2026-01-01T00:00:00.000Z'),
        ('sess-2', 'proj-a', '2026-01-02T00:00:00.000Z');
    `);
  });

  it('creates snapshots and links sessions without duplicating links', async () => {
    const queries = await import('../../db/claudemd-queries');
    const snap = queries.createClaudeMdSnapshot(
      'h1',
      '/tmp/CLAUDE.md',
      'content',
      '2026-01-01T00:00:00.000Z'
    );
    expect(snap?.id).toBeTypeOf('number');
    expect(queries.getClaudeMdSnapshot(snap!.id)?.content_hash).toBe('h1');
    expect(queries.getClaudeMdSnapshotByHash('h1')?.id).toBe(snap?.id);

    queries.linkSessionToClaudeMd('sess-1', snap!.id, '/tmp/CLAUDE.md', '2026-01-01T00:00:00.000Z');
    queries.linkSessionToClaudeMd('sess-1', snap!.id, '/tmp/CLAUDE.md', '2026-01-01T00:00:00.000Z');

    const snapshots = queries.getSessionClaudeMdSnapshots('sess-1');
    expect(snapshots.length).toBe(1);
  });

  it('returns project history with aggregated usage range', async () => {
    const queries = await import('../../db/claudemd-queries');
    const snap1 = queries.createClaudeMdSnapshot(
      'h1',
      '/tmp/CLAUDE.md',
      'one',
      '2026-01-01T00:00:00.000Z'
    );
    const snap2 = queries.createClaudeMdSnapshot(
      'h2',
      '/tmp/CLAUDE.md',
      'two',
      '2026-01-02T00:00:00.000Z'
    );
    queries.linkSessionToClaudeMd(
      'sess-1',
      snap1!.id,
      '/tmp/CLAUDE.md',
      '2026-01-01T00:00:00.000Z'
    );
    queries.linkSessionToClaudeMd(
      'sess-2',
      snap1!.id,
      '/tmp/CLAUDE.md',
      '2026-01-02T00:00:00.000Z'
    );
    queries.linkSessionToClaudeMd(
      'sess-2',
      snap2!.id,
      '/tmp/CLAUDE.md',
      '2026-01-02T00:00:00.000Z'
    );

    const history = queries.getClaudeMdHistory('proj-a');
    expect(history.versions.length).toBe(2);
    expect(history.versions[0]?.sessionCount).toBe(2);
    expect(history.versions[0]?.dateRange.from).toBe('2026-01-01T00:00:00.000Z');
  });

  it('compares snapshots by id', async () => {
    const queries = await import('../../db/claudemd-queries');
    const snap1 = queries.createClaudeMdSnapshot(
      'h1',
      '/tmp/CLAUDE.md',
      'one',
      '2026-01-01T00:00:00.000Z'
    );
    const snap2 = queries.createClaudeMdSnapshot(
      'h2',
      '/tmp/CLAUDE.md',
      'two',
      '2026-01-02T00:00:00.000Z'
    );
    const compared = queries.compareClaudeMdSnapshots(snap1!.id, snap2!.id);
    expect(compared?.from.content_hash).toBe('h1');
    expect(compared?.to.content_hash).toBe('h2');
    expect(queries.compareClaudeMdSnapshots(999, snap2!.id)).toBeNull();
  });

  it('handles unavailable db gracefully', async () => {
    const queries = await import('../../db/claudemd-queries');
    state.db?.close();
    state.db = null;

    expect(queries.getClaudeMdSnapshot(1)).toBeNull();
    expect(queries.getClaudeMdSnapshotByHash('x')).toBeNull();
    expect(
      queries.createClaudeMdSnapshot('h', '/tmp/CLAUDE.md', 'x', '2026-01-01T00:00:00.000Z')
    ).toBeNull();
    expect(queries.getClaudeMdHistory('proj')).toEqual({ project: 'proj', versions: [] });
    expect(queries.getSessionClaudeMdSnapshots('s1')).toEqual([]);
  });
});
