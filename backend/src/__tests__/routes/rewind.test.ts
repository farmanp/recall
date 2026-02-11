import { beforeEach, describe, expect, it, vi } from 'vitest';
import express, { type Application } from 'express';
import request from 'supertest';

const mocks = vi.hoisted(() => ({
  rewindEngine: {
    previewRewind: vi.fn(),
    executeRewind: vi.fn(),
    undoLastRewind: vi.fn(),
    getUndoInfo: vi.fn(),
  },
  sessionIndexer: {
    getSessionMetadata: vi.fn(),
    findSessionFile: vi.fn(),
  },
  parserFactory: {
    parseFile: vi.fn(),
    buildTimeline: vi.fn(),
  },
  rewindQueries: {
    getSessionRewindHistory: vi.fn(),
    getRewindStats: vi.fn(),
    initializeRewindSchema: vi.fn(),
  },
}));

vi.mock('../../services/rewind-engine', () => ({
  RewindEngine: mocks.rewindEngine,
}));
vi.mock('../../parser/session-indexer', () => ({
  getSessionIndexer: () => mocks.sessionIndexer,
}));
vi.mock('../../parser/parser-factory', () => ({
  ParserFactory: mocks.parserFactory,
}));
vi.mock('../../parser/agent-detector', () => ({
  detectAgentFromPath: vi.fn(() => 'codex'),
}));
vi.mock('../../db/rewind-queries', () => mocks.rewindQueries);

describe('Rewind Routes', () => {
  let app: Application;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    const router = (await import('../../routes/rewind')).default;
    app = express();
    app.use(express.json());
    app.use('/api/sessions', router);
  });

  it('validates frameIndex for preview', async () => {
    const response = await request(app)
      .post('/api/sessions/s1/rewind/preview')
      .send({ frameIndex: -1 });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid frameIndex');
  });

  it('returns 404 when preview session metadata is missing', async () => {
    mocks.sessionIndexer.getSessionMetadata.mockResolvedValue(null);
    await request(app).post('/api/sessions/s1/rewind/preview').send({ frameIndex: 1 }).expect(404);
  });

  it('returns 400 when preview frameIndex exceeds total frames', async () => {
    mocks.sessionIndexer.getSessionMetadata.mockResolvedValue({ cwd: '/tmp/project' });
    mocks.sessionIndexer.findSessionFile.mockResolvedValue('/tmp/session.jsonl');
    mocks.parserFactory.parseFile.mockResolvedValue({});
    mocks.parserFactory.buildTimeline.mockResolvedValue({ frames: [{ id: 'f1' }] });

    const response = await request(app)
      .post('/api/sessions/s1/rewind/preview')
      .send({ frameIndex: 2 });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Frame index out of bounds');
  });

  it('returns rewind preview plan', async () => {
    mocks.sessionIndexer.getSessionMetadata.mockResolvedValue({ cwd: '/tmp/project' });
    mocks.sessionIndexer.findSessionFile.mockResolvedValue('/tmp/session.jsonl');
    mocks.parserFactory.parseFile.mockResolvedValue({});
    mocks.parserFactory.buildTimeline.mockResolvedValue({ frames: [{ id: 'f1' }, { id: 'f2' }] });
    mocks.rewindEngine.previewRewind.mockResolvedValue({ sessionId: 's1', files: [] });

    const response = await request(app)
      .post('/api/sessions/s1/rewind/preview')
      .send({ frameIndex: 1, checkpointId: 'cp-1' })
      .expect(200);

    expect(response.body.sessionId).toBe('s1');
    expect(mocks.rewindEngine.previewRewind).toHaveBeenCalledWith(
      's1',
      1,
      [{ id: 'f1' }, { id: 'f2' }],
      '/tmp/project',
      'cp-1'
    );
  });

  it('executes rewind after generating a plan', async () => {
    mocks.sessionIndexer.getSessionMetadata.mockResolvedValue({ cwd: '/tmp/project' });
    mocks.sessionIndexer.findSessionFile.mockResolvedValue('/tmp/session.jsonl');
    mocks.parserFactory.parseFile.mockResolvedValue({});
    mocks.parserFactory.buildTimeline.mockResolvedValue({ frames: [{ id: 'f1' }] });
    mocks.rewindEngine.previewRewind.mockResolvedValue({
      sessionId: 's1',
      files: [],
      conflicts: [],
    });
    mocks.rewindEngine.executeRewind.mockResolvedValue({ success: true, filesRestored: 1 });

    const response = await request(app)
      .post('/api/sessions/s1/rewind/execute')
      .send({ frameIndex: 0, createBackups: false, skipConflicts: true })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(mocks.rewindEngine.executeRewind).toHaveBeenCalled();
  });

  it('returns 404 for undo when there is no undoable rewind', async () => {
    mocks.rewindEngine.undoLastRewind.mockResolvedValue({
      success: false,
      rewindId: '',
      filesRestored: 0,
      errors: [],
      message: 'No undoable rewind',
    });

    await request(app).post('/api/sessions/s1/rewind/undo').expect(404);
  });

  it('returns rewind history and count', async () => {
    mocks.rewindQueries.getSessionRewindHistory.mockReturnValue([{ id: 'r1' }, { id: 'r2' }]);
    const response = await request(app).get('/api/sessions/s1/rewind/history').expect(200);
    expect(response.body.count).toBe(2);
  });

  it('returns undo info payload', async () => {
    mocks.rewindEngine.getUndoInfo.mockReturnValue({ canUndo: true, lastRewindId: 'r1' });
    const response = await request(app).get('/api/sessions/s1/rewind/undo-info').expect(200);
    expect(response.body.sessionId).toBe('s1');
    expect(response.body.canUndo).toBe(true);
  });

  it('returns rewind stats payload', async () => {
    mocks.rewindQueries.getRewindStats.mockReturnValue({ totalRewinds: 3, undoableRewinds: 1 });
    const response = await request(app).get('/api/sessions/s1/rewind/stats').expect(200);
    expect(response.body.sessionId).toBe('s1');
    expect(response.body.totalRewinds).toBe(3);
  });
});
