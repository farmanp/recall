import { beforeEach, describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';

const state = vi.hoisted(() => ({
  db: null as Database.Database | null,
  indexer: {
    getAllSessions: vi.fn(),
    findSessionFile: vi.fn(),
  },
  parserFactory: {
    parseFile: vi.fn(),
    buildTimeline: vi.fn(),
  },
  detectAgentFromPath: vi.fn(),
}));

vi.mock('../../db/transcript-connection', () => ({
  getTranscriptDbInstance: () => {
    if (!state.db) throw new Error('db not initialized');
    return state.db;
  },
}));
vi.mock('../../parser/session-indexer', () => ({
  getSessionIndexer: () => state.indexer,
}));
vi.mock('../../parser/parser-factory', () => ({
  ParserFactory: state.parserFactory,
}));
vi.mock('../../parser/agent-detector', () => ({
  detectAgentFromPath: state.detectAgentFromPath,
}));
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'wu-generated-id'),
}));

describe('work-unit-correlator', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    state.db?.close();
    state.db = new Database(':memory:');
    state.db.exec(`
      CREATE TABLE IF NOT EXISTS work_unit_sessions (
        session_id TEXT PRIMARY KEY,
        work_unit_id TEXT NOT NULL
      );
    `);
  });

  it('normalizes project paths', async () => {
    const mod = await import('../../services/work-unit-correlator');
    process.env.HOME = '/Users/test';
    expect(mod.normalizeProjectPath('/Users/test/MyProj///')).toBe('~/myproj');
    expect(mod.normalizeProjectPath('')).toBe('');
  });

  it('computes similarity and time window checks', async () => {
    const mod = await import('../../services/work-unit-correlator');
    expect(mod.jaccardSimilarity([], [])).toBe(0);
    expect(mod.jaccardSimilarity(['A.ts'], ['a.ts', 'b.ts'])).toBe(0.5);
    expect(mod.isWithinTimeWindow(1000, 1000 + 3 * 60 * 60 * 1000, 4)).toBe(true);
    expect(mod.isWithinTimeWindow(1000, 1000 + 5 * 60 * 60 * 1000, 4)).toBe(false);
  });

  it('calculates correlation scores and confidence', async () => {
    const mod = await import('../../services/work-unit-correlator');
    const s1 = {
      sessionId: 's1',
      agent: 'claude',
      projectPath: '/tmp/proj',
      cwd: '/tmp/proj',
      filesRead: ['a.ts'],
      filesModified: ['b.ts'],
      startTime: 1000,
      endTime: 2000,
      frameCount: 1,
    } as any;
    const s2 = {
      sessionId: 's2',
      agent: 'codex',
      projectPath: '/tmp/proj',
      cwd: '/tmp/proj/sub',
      filesRead: ['a.ts'],
      filesModified: [],
      startTime: 2500,
      endTime: 3000,
      frameCount: 1,
    } as any;

    const result = mod.calculateCorrelationScore(s1, s2);
    expect(result.score).toBeGreaterThan(0.5);
    expect(result.reasons).toContain('project_path_match');
    expect(mod.determineConfidence(result.score, result.reasons)).toBe('high');
    expect(mod.determineConfidence(0.45, ['project_path_match'])).toBe('medium');
    expect(mod.determineConfidence(0.1, [])).toBe('low');
  });

  it('extracts correlation data from timeline and handles parser errors', async () => {
    const mod = await import('../../services/work-unit-correlator');
    state.detectAgentFromPath.mockReturnValue('codex');
    state.parserFactory.parseFile.mockResolvedValue({});
    state.parserFactory.buildTimeline.mockResolvedValue({
      agent: 'codex',
      project: '/tmp/proj',
      metadata: { cwd: '/tmp/proj' },
      startedAt: 1000,
      completedAt: 5000,
      totalFrames: 2,
      frames: [
        {
          context: { filesRead: ['a.ts'], filesModified: ['b.ts'] },
          userMessage: { text: 'hello there' },
        },
        {
          context: {},
          toolExecution: { tool: 'Edit', input: { file_path: 'c.ts' } },
        },
      ],
    });

    const data = await mod.extractCorrelationData('s1', '/tmp/session.jsonl');
    expect(data?.projectPath).toBe('/tmp/proj');
    expect(data?.filesRead).toContain('a.ts');
    expect(data?.filesModified).toContain('c.ts');
    expect(data?.duration).toBe(4);

    state.parserFactory.parseFile.mockRejectedValueOnce(new Error('parse fail'));
    expect(await mod.extractCorrelationData('s2', '/tmp/bad.jsonl')).toBeNull();
  });

  it('computes work units from session clusters', async () => {
    const mod = await import('../../services/work-unit-correlator');
    state.indexer.getAllSessions.mockResolvedValue([
      { sessionId: 's1' },
      { sessionId: 's2' },
      { sessionId: 's3' },
    ]);
    state.indexer.findSessionFile.mockImplementation(async (id: string) => `/tmp/${id}.jsonl`);
    state.detectAgentFromPath.mockReturnValue('claude');
    state.parserFactory.parseFile.mockImplementation(async (filePath: string) => ({
      sessionId: filePath.split('/').pop()?.replace('.jsonl', '') || 's1',
    }));
    state.parserFactory.buildTimeline.mockImplementation(async (transcript: any) => {
      const id = transcript.sessionId as string;
      if (id === 's1') {
        return {
          agent: 'claude',
          project: '/tmp/project-a',
          metadata: { cwd: '/tmp/project-a' },
          startedAt: 1_000,
          completedAt: 2_000,
          totalFrames: 1,
          frames: [{ context: {}, userMessage: { text: 'start one' } }],
        };
      }
      if (id === 's2') {
        return {
          agent: 'codex',
          project: '/tmp/project-a',
          metadata: { cwd: '/tmp/project-a' },
          startedAt: 2_500,
          completedAt: 3_000,
          totalFrames: 1,
          frames: [{ context: {}, userMessage: { text: 'continue' } }],
        };
      }
      return {
        agent: 'gemini',
        project: '/tmp/project-a',
        metadata: { cwd: '/tmp/project-a' },
        startedAt: 40_000_000, // far enough for a new cluster
        completedAt: 40_000_500,
        totalFrames: 1,
        frames: [{ context: {}, userMessage: { text: 'later' } }],
      };
    });

    const workUnits = await mod.computeWorkUnits();
    expect(workUnits.length).toBe(2);
    expect(workUnits[0]?.id).toBe('wu-generated-id');
    expect(workUnits[0]?.sessions.length).toBeGreaterThanOrEqual(1);
  });

  it('finds session work unit id and ungrouped sessions', async () => {
    const mod = await import('../../services/work-unit-correlator');
    state
      .db!.prepare('INSERT INTO work_unit_sessions (session_id, work_unit_id) VALUES (?, ?)')
      .run('s1', 'wu-1');
    state.indexer.getAllSessions.mockResolvedValue([{ sessionId: 's1' }, { sessionId: 's2' }]);

    expect(mod.getSessionWorkUnitId('s1')).toBe('wu-1');
    expect(mod.getSessionWorkUnitId('missing')).toBeNull();
    const ungrouped = await mod.getUngroupedSessions();
    expect(ungrouped).toEqual(['s2']);
  });
});
