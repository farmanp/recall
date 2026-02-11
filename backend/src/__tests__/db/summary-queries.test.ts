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

describe('summary-queries', () => {
  beforeEach(() => {
    state.db?.close();
    state.db = new Database(':memory:');
    state.db.exec(`
      CREATE TABLE IF NOT EXISTS session_metadata (
        session_id TEXT PRIMARY KEY,
        start_time TEXT NOT NULL
      );
      INSERT INTO session_metadata (session_id, start_time)
      VALUES ('s1', '2026-01-03T00:00:00.000Z'), ('s2', '2026-01-02T00:00:00.000Z'), ('s3', '2026-01-01T00:00:00.000Z');
    `);
  });

  it('stores and retrieves summaries', async () => {
    const queries = await import('../../db/summary-queries');
    queries.initializeSummarySchema();

    const summary = {
      sessionId: 's1',
      summaryText: 'one',
      keyDecisions: ['a'],
      filesChanged: { created: ['x.ts'], modified: ['y.ts'], deleted: [] },
      toolsUsed: { Read: 1 },
      errorCount: 1,
      successIndicators: ['all tests passing'],
      generatedAt: '2026-01-01T00:00:00.000Z',
      generatedBy: 'heuristic' as const,
    };

    queries.storeSummary(summary);
    expect(queries.hasSummary('s1')).toBe(true);
    expect(queries.getSummary('s1')?.summaryText).toBe('one');
    expect(queries.getSummary('missing')).toBeNull();
  });

  it('supports batch operations and stats', async () => {
    const queries = await import('../../db/summary-queries');
    queries.initializeSummarySchema();

    const summaries = [
      {
        sessionId: 's1',
        summaryText: 'one',
        keyDecisions: [],
        filesChanged: { created: ['a.ts'], modified: [], deleted: [] },
        toolsUsed: {},
        errorCount: 0,
        successIndicators: [],
        generatedAt: '2026-01-01T00:00:00.000Z',
        generatedBy: 'heuristic' as const,
      },
      {
        sessionId: 's2',
        summaryText: 'two',
        keyDecisions: [],
        filesChanged: { created: [], modified: ['b.ts', 'c.ts'], deleted: [] },
        toolsUsed: {},
        errorCount: 2,
        successIndicators: [],
        generatedAt: '2026-01-01T00:00:00.000Z',
        generatedBy: 'llm' as const,
      },
    ];

    expect(queries.storeSummariesBatch(summaries)).toBe(2);
    expect(queries.storeSummariesBatch([])).toBe(0);

    const batch = queries.getSummariesBatch(['s1', 's2', 'missing']);
    expect(batch.size).toBe(2);
    expect(queries.getSummariesBatch([]).size).toBe(0);

    const stats = queries.getSummaryStats();
    expect(stats.total).toBe(2);
    expect(stats.heuristic).toBe(1);
    expect(stats.llm).toBe(1);
    expect(stats.avgErrorCount).toBe(1);
    expect(stats.avgFilesChanged).toBe(1.5);
  });

  it('returns sessions without summaries ordered by start_time and limited', async () => {
    const queries = await import('../../db/summary-queries');
    queries.initializeSummarySchema();
    queries.storeSummary({
      sessionId: 's1',
      summaryText: 'one',
      keyDecisions: [],
      filesChanged: { created: [], modified: [], deleted: [] },
      toolsUsed: {},
      errorCount: 0,
      successIndicators: [],
      generatedAt: '2026-01-01T00:00:00.000Z',
      generatedBy: 'heuristic',
    });

    const missing = queries.getSessionsWithoutSummaries(1);
    expect(missing).toEqual(['s2']);
  });

  it('deletes summary rows and reports status', async () => {
    const queries = await import('../../db/summary-queries');
    queries.initializeSummarySchema();
    queries.storeSummary({
      sessionId: 's1',
      summaryText: 'one',
      keyDecisions: [],
      filesChanged: { created: [], modified: [], deleted: [] },
      toolsUsed: {},
      errorCount: 0,
      successIndicators: [],
      generatedAt: '2026-01-01T00:00:00.000Z',
      generatedBy: 'heuristic',
    });

    expect(queries.deleteSummary('s1')).toBe(true);
    expect(queries.deleteSummary('s1')).toBe(false);
  });
});
