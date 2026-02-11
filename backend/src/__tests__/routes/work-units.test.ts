import { beforeEach, describe, expect, it, vi } from 'vitest';
import express, { type Application } from 'express';
import request from 'supertest';

const mocks = vi.hoisted(() => ({
  workUnitQueries: {
    initializeWorkUnitSchema: vi.fn(),
    getWorkUnits: vi.fn(),
    getWorkUnitById: vi.fn(),
    getWorkUnitSessions: vi.fn(),
    getWorkUnitBySessionId: vi.fn(),
    saveAllWorkUnits: vi.fn(),
    addSessionToWorkUnit: vi.fn(),
    removeSessionFromWorkUnit: vi.fn(),
    deleteWorkUnit: vi.fn(),
    getWorkUnitStats: vi.fn(),
  },
  correlator: {
    computeWorkUnits: vi.fn(),
    DEFAULT_CORRELATION_CONFIG: { minCorrelationScore: 0.3 },
  },
  indexer: {
    getAllSessions: vi.fn(),
    getSessionMetadata: vi.fn(),
  },
}));

vi.mock('../../db/work-unit-queries', () => mocks.workUnitQueries);
vi.mock('../../services/work-unit-correlator', () => mocks.correlator);
vi.mock('../../parser/session-indexer', () => ({
  getSessionIndexer: () => mocks.indexer,
}));

describe('Work Unit Routes', () => {
  let app: Application;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    const router = (await import('../../routes/work-units')).default;
    app = express();
    app.use(express.json());
    app.use('/api/work-units', router);
    app.get('/api/sessions/:id/work-unit', async (req, res) => {
      const mod = await import('../../routes/work-units');
      return mod.getSessionWorkUnit(req, res);
    });
  });

  it('lists work units with parsed query params', async () => {
    mocks.workUnitQueries.getWorkUnits.mockReturnValue({
      workUnits: [],
      total: 0,
      offset: 5,
      limit: 10,
    });
    const response = await request(app)
      .get(
        '/api/work-units?offset=5&limit=10&confidence=high&agent=claude&project=test&includeUngrouped=true'
      )
      .expect(200);

    expect(response.body.limit).toBe(10);
    expect(mocks.workUnitQueries.getWorkUnits).toHaveBeenCalledWith({
      offset: 5,
      limit: 10,
      confidence: 'high',
      agent: 'claude',
      project: 'test',
      includeUngrouped: true,
    });
  });

  it('returns stats', async () => {
    mocks.workUnitQueries.getWorkUnitStats.mockReturnValue({
      total: 1,
      byConfidence: {},
      byAgent: {},
      ungroupedSessions: 2,
    });
    const response = await request(app).get('/api/work-units/stats').expect(200);
    expect(response.body.total).toBe(1);
  });

  it('returns 404 for missing work unit', async () => {
    mocks.workUnitQueries.getWorkUnitById.mockReturnValue(null);
    await request(app).get('/api/work-units/wu-1').expect(404);
  });

  it('returns work unit details', async () => {
    mocks.workUnitQueries.getWorkUnitById.mockReturnValue({
      id: 'wu-1',
      sessions: [{ sessionId: 's1' }],
    });
    const response = await request(app).get('/api/work-units/wu-1').expect(200);
    expect(response.body.workUnit.id).toBe('wu-1');
    expect(response.body.sessions.length).toBe(1);
  });

  it('returns paginated work unit sessions', async () => {
    mocks.workUnitQueries.getWorkUnitSessions.mockReturnValue([
      { sessionId: 's1' },
      { sessionId: 's2' },
    ]);
    const response = await request(app)
      .get('/api/work-units/wu-1/sessions?offset=1&limit=1')
      .expect(200);
    expect(response.body.total).toBe(2);
    expect(response.body.sessions).toEqual([{ sessionId: 's2' }]);
  });

  it('recomputes work units', async () => {
    mocks.correlator.computeWorkUnits.mockResolvedValue([{ id: 'wu-1' }]);
    mocks.indexer.getAllSessions.mockResolvedValue([{ sessionId: 's1' }, { sessionId: 's2' }]);
    const response = await request(app).post('/api/work-units/recompute').send({}).expect(200);
    expect(response.body.success).toBe(true);
    expect(response.body.workUnitsCreated).toBe(1);
    expect(response.body.sessionsProcessed).toBe(2);
    expect(mocks.workUnitQueries.saveAllWorkUnits).toHaveBeenCalledTimes(1);
  });

  it('validates patch payload', async () => {
    await request(app).patch('/api/work-units/wu-1').send({}).expect(400);
    await request(app)
      .patch('/api/work-units/wu-1')
      .send({ action: 'bad', sessionId: 's1' })
      .expect(400);
  });

  it('returns 404 when patching missing work unit', async () => {
    mocks.workUnitQueries.getWorkUnitById.mockReturnValue(null);
    await request(app)
      .patch('/api/work-units/wu-1')
      .send({ action: 'remove', sessionId: 's1' })
      .expect(404);
  });

  it('adds a session to work unit through patch', async () => {
    mocks.workUnitQueries.getWorkUnitById.mockReturnValue({ id: 'wu-1' });
    mocks.indexer.getSessionMetadata.mockResolvedValue({
      agent: 'codex',
      startTime: '2026-01-01T00:00:00.000Z',
      endTime: '2026-01-01T00:01:00.000Z',
      duration: 60,
      eventCount: 5,
      firstUserMessage: 'hello',
    });
    mocks.workUnitQueries.addSessionToWorkUnit.mockReturnValue(true);
    mocks.workUnitQueries.getWorkUnitById.mockReturnValue({
      id: 'wu-1',
      sessions: [{ sessionId: 's1' }],
    });

    const response = await request(app)
      .patch('/api/work-units/wu-1')
      .send({ action: 'add', sessionId: 's1' })
      .expect(200);
    expect(response.body.success).toBe(true);
  });

  it('returns 404 when adding missing session', async () => {
    mocks.workUnitQueries.getWorkUnitById.mockReturnValue({ id: 'wu-1' });
    mocks.indexer.getSessionMetadata.mockResolvedValue(null);
    await request(app)
      .patch('/api/work-units/wu-1')
      .send({ action: 'add', sessionId: 'missing' })
      .expect(404);
  });

  it('handles failed remove update', async () => {
    mocks.workUnitQueries.getWorkUnitById.mockReturnValue({ id: 'wu-1' });
    mocks.workUnitQueries.removeSessionFromWorkUnit.mockReturnValue(false);
    const response = await request(app)
      .patch('/api/work-units/wu-1')
      .send({ action: 'remove', sessionId: 's1' });
    expect(response.status).toBe(500);
  });

  it('deletes work unit and handles not found', async () => {
    mocks.workUnitQueries.deleteWorkUnit.mockReturnValueOnce(true).mockReturnValueOnce(false);
    await request(app).delete('/api/work-units/wu-1').expect(200);
    await request(app).delete('/api/work-units/wu-1').expect(404);
  });

  it('gets work unit for a session', async () => {
    mocks.workUnitQueries.getWorkUnitBySessionId
      .mockReturnValueOnce(null)
      .mockReturnValueOnce({ id: 'wu-1' });
    await request(app).get('/api/sessions/s1/work-unit').expect(404);
    const response = await request(app).get('/api/sessions/s1/work-unit').expect(200);
    expect(response.body.workUnit.id).toBe('wu-1');
  });
});
