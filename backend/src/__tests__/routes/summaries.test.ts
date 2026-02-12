import { beforeEach, describe, expect, it, vi } from 'vitest';
import express, { type Application } from 'express';
import request from 'supertest';

const mocks = vi.hoisted(() => ({
  summaryQueries: {
    getSummary: vi.fn(),
    storeSummary: vi.fn(),
    getSummaryStats: vi.fn(),
    initializeSummarySchema: vi.fn(),
    getSessionsWithoutSummaries: vi.fn(),
    storeSummariesBatch: vi.fn(),
  },
  transcriptQueries: {
    getTranscriptFrames: vi.fn(),
    getTranscriptSessionById: vi.fn(),
  },
  summarizer: {
    generateSummary: vi.fn(),
  },
  parserFactory: {
    parseFile: vi.fn(),
    buildTimeline: vi.fn(),
  },
  indexer: {
    findSessionFile: vi.fn(),
  },
}));

vi.mock('../../db/summary-queries', () => mocks.summaryQueries);
vi.mock('../../db/transcript-queries', () => mocks.transcriptQueries);
vi.mock('../../services/summarizer', () => ({
  Summarizer: mocks.summarizer,
}));
vi.mock('../../parser/parser-factory', () => ({
  ParserFactory: mocks.parserFactory,
}));
vi.mock('../../parser/agent-detector', () => ({
  detectAgentFromPath: vi.fn(() => 'codex'),
}));
vi.mock('../../parser/session-indexer', () => ({
  getSessionIndexer: () => mocks.indexer,
}));

describe('Summary Routes', () => {
  let app: Application;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    const router = (await import('../../routes/summaries')).default;
    app = express();
    app.use(express.json());
    app.use('/api/sessions', router);
    app.use('/api/summaries', router);
  });

  it('returns cached summary when available', async () => {
    mocks.summaryQueries.getSummary.mockReturnValue({ sessionId: 's1', summaryText: 'cached' });
    const response = await request(app).get('/api/sessions/s1/summary').expect(200);

    expect(response.body.cached).toBe(true);
    expect(response.body.summary.summaryText).toBe('cached');
  });

  it('returns 404 for missing DB session when source=db', async () => {
    mocks.summaryQueries.getSummary.mockReturnValue(null);
    mocks.transcriptQueries.getTranscriptSessionById.mockReturnValue(null);
    await request(app).get('/api/sessions/s1/summary?source=db').expect(404);
  });

  it('returns 404 when DB frames are empty', async () => {
    mocks.summaryQueries.getSummary.mockReturnValue(null);
    mocks.transcriptQueries.getTranscriptSessionById.mockReturnValue({ id: 's1' });
    mocks.transcriptQueries.getTranscriptFrames.mockReturnValue({ frames: [] });
    await request(app).get('/api/sessions/s1/summary?source=db').expect(404);
  });

  it('generates and stores summary from filesystem frames', async () => {
    mocks.summaryQueries.getSummary.mockReturnValue(null);
    mocks.indexer.findSessionFile.mockResolvedValue('/tmp/session.jsonl');
    mocks.parserFactory.parseFile.mockResolvedValue({
      entries: [],
      metadata: { projectName: 'test-project' },
    });
    mocks.parserFactory.buildTimeline.mockResolvedValue({
      frames: [{ id: 'f1' }],
    });
    mocks.summarizer.generateSummary.mockReturnValue({ sessionId: 's1', summaryText: 'new' });

    const response = await request(app)
      .get('/api/sessions/s1/summary?source=filesystem')
      .expect(200);
    expect(response.body.cached).toBe(false);
    expect(response.body.summary.summaryText).toBe('new');
    expect(mocks.summaryQueries.storeSummary).toHaveBeenCalledTimes(1);
  });

  it('regenerates summary on demand', async () => {
    mocks.transcriptQueries.getTranscriptSessionById.mockReturnValue({ id: 's1' });
    mocks.transcriptQueries.getTranscriptFrames.mockReturnValue({ frames: [{ id: 'f1' }] });
    mocks.summarizer.generateSummary.mockReturnValue({ sessionId: 's1', summaryText: 'regen' });

    const response = await request(app).post('/api/sessions/s1/summary/regenerate').expect(200);
    expect(response.body.regenerated).toBe(true);
    expect(response.body.summary.summaryText).toBe('regen');
  });

  it('returns summary stats', async () => {
    mocks.summaryQueries.getSummaryStats.mockReturnValue({ total: 5, heuristic: 5, llm: 0 });
    const response = await request(app).get('/api/summaries/stats').expect(200);
    expect(response.body.total).toBe(5);
  });

  it('returns early when no sessions need summaries', async () => {
    mocks.summaryQueries.getSessionsWithoutSummaries.mockReturnValue([]);
    const response = await request(app).post('/api/summaries/generate-batch').send({ limit: 10 });
    expect(response.status).toBe(200);
    expect(response.body.generated).toBe(0);
    expect(response.body.message).toContain('All sessions have summaries');
  });

  it('generates batch summaries and reports per-session errors', async () => {
    mocks.summaryQueries.getSessionsWithoutSummaries.mockReturnValue(['s1', 's2']);
    mocks.transcriptQueries.getTranscriptFrames.mockImplementation((sessionId: string) => {
      if (sessionId === 's1') {
        return { frames: [{ id: 'f1' }] };
      }
      return { frames: [] };
    });
    mocks.summarizer.generateSummary.mockReturnValue({ sessionId: 's1', summaryText: 'ok' });

    const response = await request(app).post('/api/summaries/generate-batch').send({ limit: 5 });
    expect(response.status).toBe(200);
    expect(response.body.generated).toBe(1);
    expect(response.body.errors).toBe(1);
    expect(mocks.summaryQueries.storeSummariesBatch).toHaveBeenCalledTimes(1);
  });
});
