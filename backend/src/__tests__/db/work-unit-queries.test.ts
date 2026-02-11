import { beforeEach, describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';
import type { WorkUnit } from '../../types/work-unit';

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

function sampleWorkUnit(id: string = 'wu-1'): WorkUnit {
  return {
    id,
    name: 'Project A',
    projectPath: '/tmp/project-a',
    sessions: [
      {
        sessionId: 's1',
        agent: 'claude',
        correlationScore: 0.9,
        joinReason: ['project_path_match'],
        startTime: '2026-01-01T00:00:00.000Z',
        endTime: '2026-01-01T00:10:00.000Z',
        duration: 600,
        frameCount: 10,
        firstUserMessage: 'start',
      },
      {
        sessionId: 's2',
        agent: 'codex',
        correlationScore: 0.8,
        joinReason: ['file_overlap'],
        startTime: '2026-01-01T00:20:00.000Z',
        endTime: '2026-01-01T00:30:00.000Z',
        duration: 600,
        frameCount: 15,
        firstUserMessage: 'continue',
      },
    ],
    agents: ['claude', 'codex'],
    confidence: 'high',
    startTime: '2026-01-01T00:00:00.000Z',
    endTime: '2026-01-01T00:30:00.000Z',
    totalDuration: 1200,
    totalFrames: 25,
    filesTouched: ['a.ts', 'b.ts'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:30:00.000Z',
  };
}

describe('work-unit-queries', () => {
  beforeEach(() => {
    state.db?.close();
    state.db = new Database(':memory:');
    state.db.pragma('foreign_keys = ON');
    state.db.exec(`
      CREATE TABLE IF NOT EXISTS session_metadata (
        session_id TEXT PRIMARY KEY,
        start_time TEXT NOT NULL
      );
      INSERT INTO session_metadata (session_id, start_time) VALUES
        ('s1', '2026-01-01T00:00:00.000Z'),
        ('s2', '2026-01-01T00:20:00.000Z'),
        ('s3', '2026-01-02T00:00:00.000Z'),
        ('s4', '2026-01-03T00:00:00.000Z');
    `);
  });

  it('initializes schema and supports upsert/get/list/filter flows', async () => {
    const queries = await import('../../db/work-unit-queries');
    queries.initializeWorkUnitSchema();

    queries.upsertWorkUnit(sampleWorkUnit('wu-1'));
    queries.upsertWorkUnit({
      ...sampleWorkUnit('wu-2'),
      confidence: 'medium',
      projectPath: '/tmp/project-b',
      sessions: [
        {
          sessionId: 's3',
          agent: 'gemini',
          correlationScore: 0.5,
          joinReason: ['time_proximity'],
          startTime: '2026-01-02T00:00:00.000Z',
          frameCount: 8,
        },
      ],
      agents: ['gemini'],
      totalFrames: 8,
      totalDuration: 0,
      startTime: '2026-01-02T00:00:00.000Z',
      endTime: '2026-01-02T00:00:00.000Z',
      filesTouched: ['c.ts'],
    });

    const byId = queries.getWorkUnitById('wu-1');
    expect(byId?.sessions.length).toBe(2);
    expect(queries.getWorkUnitBySessionId('s2')?.id).toBe('wu-1');
    expect(queries.getWorkUnitById('missing')).toBeNull();
    expect(queries.getWorkUnitBySessionId('missing')).toBeNull();

    const listAll = queries.getWorkUnits({ includeUngrouped: true });
    expect(listAll.total).toBe(2);
    expect(listAll.workUnits.length).toBe(2);
    expect(listAll.ungroupedCount).toBe(1);

    const byConfidence = queries.getWorkUnits({ confidence: 'medium' });
    expect(byConfidence.total).toBe(1);
    expect(byConfidence.workUnits[0]?.id).toBe('wu-2');

    const byAgent = queries.getWorkUnits({ agent: 'gemini' });
    expect(byAgent.total).toBe(1);
    expect(byAgent.workUnits[0]?.id).toBe('wu-2');

    const byProject = queries.getWorkUnits({ project: 'project-a' });
    expect(byProject.total).toBe(1);
    expect(byProject.workUnits[0]?.id).toBe('wu-1');

    const paged = queries.getWorkUnits({ limit: 1, offset: 1 });
    expect(paged.limit).toBe(1);
    expect(paged.offset).toBe(1);
    expect(paged.workUnits.length).toBe(1);
  });

  it('updates metadata when adding/removing sessions and deletes empty units', async () => {
    const queries = await import('../../db/work-unit-queries');
    queries.initializeWorkUnitSchema();
    queries.upsertWorkUnit({
      ...sampleWorkUnit('wu-1'),
      sessions: [
        {
          sessionId: 's1',
          agent: 'claude',
          correlationScore: 0.9,
          joinReason: ['project_path_match'],
          startTime: '2026-01-01T00:00:00.000Z',
          frameCount: 10,
        },
      ],
      agents: ['claude'],
      totalFrames: 10,
      totalDuration: 0,
      endTime: '2026-01-01T00:00:00.000Z',
    });

    expect(
      queries.addSessionToWorkUnit(
        'wu-1',
        's2',
        'codex',
        '2026-01-01T00:20:00.000Z',
        '2026-01-01T00:30:00.000Z',
        600,
        15,
        'continue'
      )
    ).toBe(true);

    const afterAdd = queries.getWorkUnitById('wu-1');
    expect(afterAdd?.sessions.length).toBe(2);
    expect(afterAdd?.agents).toEqual(['claude', 'codex']);
    expect(afterAdd?.totalFrames).toBe(25);

    expect(queries.removeSessionFromWorkUnit('wu-1', 's2')).toBe(true);
    expect(queries.getWorkUnitById('wu-1')?.sessions.length).toBe(1);

    // Remove last session -> work unit should be deleted
    expect(queries.removeSessionFromWorkUnit('wu-1', 's1')).toBe(true);
    expect(queries.getWorkUnitById('wu-1')).toBeNull();

    expect(queries.removeSessionFromWorkUnit('missing', 's1')).toBe(false);
  });

  it('returns false when addSession fails', async () => {
    const queries = await import('../../db/work-unit-queries');
    queries.initializeWorkUnitSchema();
    // Missing work unit causes FK failure, caught and returned as false
    expect(
      queries.addSessionToWorkUnit('missing', 's1', 'claude', '2026-01-01T00:00:00.000Z')
    ).toBe(false);
  });

  it('caches and retrieves correlation data', async () => {
    const queries = await import('../../db/work-unit-queries');
    queries.initializeWorkUnitSchema();

    queries.cacheSessionCorrelationData({
      sessionId: 's1',
      agent: 'claude',
      model: 'claude-opus',
      projectPath: '/tmp/project-a',
      cwd: '/tmp/project-a',
      filesRead: ['a.ts'],
      filesModified: ['b.ts'],
      startTime: 1000,
      endTime: 2000,
      duration: 1000,
      frameCount: 10,
      firstUserMessage: 'hello',
    });
    queries.cacheSessionCorrelationData({
      sessionId: 's2',
      agent: 'codex',
      projectPath: '/tmp/project-a',
      cwd: '/tmp/project-a',
      filesRead: [],
      filesModified: [],
      startTime: 900,
      frameCount: 5,
    });

    expect(queries.getCachedCorrelationData('s1')?.filesRead).toEqual(['a.ts']);
    expect(queries.getCachedCorrelationData('missing')).toBeNull();
    expect(queries.getAllCachedCorrelationData().length).toBe(2);
  });

  it('computes work-unit stats and saveAllWorkUnits replaces prior data', async () => {
    const queries = await import('../../db/work-unit-queries');
    queries.initializeWorkUnitSchema();
    queries.upsertWorkUnit(sampleWorkUnit('wu-1'));

    const stats = queries.getWorkUnitStats();
    expect(stats.total).toBe(1);
    expect(stats.byConfidence.high).toBe(1);
    expect(stats.byAgent.claude).toBe(1);
    expect(stats.ungroupedSessions).toBe(2);

    queries.saveAllWorkUnits([
      {
        ...sampleWorkUnit('wu-new'),
        sessions: [
          {
            sessionId: 's4',
            agent: 'gemini',
            correlationScore: 1,
            joinReason: ['manual_override'],
            startTime: '2026-01-03T00:00:00.000Z',
            frameCount: 1,
          },
        ],
        agents: ['gemini'],
        confidence: 'low',
        totalFrames: 1,
        totalDuration: 0,
        startTime: '2026-01-03T00:00:00.000Z',
        endTime: '2026-01-03T00:00:00.000Z',
      },
    ]);

    const replaced = queries.getWorkUnits();
    expect(replaced.total).toBe(1);
    expect(replaced.workUnits[0]?.id).toBe('wu-new');
  });

  it('deletes work units by id', async () => {
    const queries = await import('../../db/work-unit-queries');
    queries.initializeWorkUnitSchema();
    queries.upsertWorkUnit(sampleWorkUnit('wu-del'));
    expect(queries.deleteWorkUnit('wu-del')).toBe(true);
    expect(queries.deleteWorkUnit('wu-del')).toBe(false);
  });
});
