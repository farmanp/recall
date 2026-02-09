import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import type { Application } from 'express';

const mockSessions = [
  {
    sessionId: 'session-1',
    slug: 'session-one',
    project: 'test-project',
    agent: 'claude',
    startTime: '2024-01-01T00:00:00.000Z',
    endTime: '2024-01-01T00:10:00.000Z',
    duration: 600,
    eventCount: 2,
    cwd: '/tmp/project',
    firstUserMessage: 'Hi',
  },
  {
    sessionId: 'session-2',
    slug: 'session-two',
    project: 'another-project',
    agent: 'codex',
    startTime: '2024-01-01T01:00:00.000Z',
    endTime: '2024-01-01T01:02:00.000Z',
    duration: 120,
    eventCount: 1,
    cwd: '/tmp/another',
    firstUserMessage: 'Hello',
  },
];

const mockTimeline = {
  sessionId: 'session-1',
  slug: 'session-one',
  project: 'test-project',
  agent: 'claude',
  startedAt: 1704067200000,
  completedAt: 1704067800000,
  frames: [
    {
      id: 'frame-1',
      type: 'user_message',
      timestamp: 1704067200000,
      userMessage: { text: 'Hi' },
      context: { cwd: '/tmp/project' },
    },
    {
      id: 'frame-2',
      type: 'claude_response',
      timestamp: 1704067201000,
      claudeResponse: { text: 'Hello there' },
      context: { cwd: '/tmp/project' },
    },
  ],
  totalFrames: 2,
  metadata: { cwd: '/tmp/project' },
};

const indexer = {
  getAllSessions: vi.fn(async () => mockSessions),
  getSessionMetadata: vi.fn(async (id: string) => mockSessions.find((s) => s.sessionId === id)),
  findSessionFile: vi.fn(async (id: string) =>
    id === 'session-1' ? '/tmp/session-1.jsonl' : undefined
  ),
  getAvailableAgents: vi.fn(async () => ({
    agents: ['claude', 'codex'],
    counts: { claude: 1, codex: 1, gemini: 0, unknown: 0 },
  })),
  getCwdFilter: vi.fn(() => null), // No CWD filter in tests by default
  setCwdFilter: vi.fn(),
};

vi.mock('../../parser/session-indexer', () => ({
  getSessionIndexer: () => indexer,
}));

vi.mock('../../parser/parser-factory', () => ({
  ParserFactory: {
    parseFile: vi.fn(async () => ({
      sessionId: 'session-1',
      entries: [],
      metadata: { startTime: '', totalEntries: 0, cwd: '/tmp/project' },
    })),
    buildTimeline: vi.fn(async () => mockTimeline),
  },
}));

describe('Session Routes', () => {
  let app: Application;

  beforeEach(async () => {
    vi.resetModules();
    const { createServer } = await import('../../server');
    app = createServer();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/sessions', () => {
    it('defaults to filesystem source when no source specified', async () => {
      const response = await request(app).get('/api/sessions').expect(200);

      // This test prevents regression of the bug where source defaulted to 'db'
      // which returned 0 sessions when the database was empty
      expect(response.body.source).toBe('filesystem');
      expect(response.body.sessions.length).toBeGreaterThan(0);
    });

    it('returns session list with pagination', async () => {
      const response = await request(app)
        .get('/api/sessions?source=filesystem&limit=1&offset=0')
        .expect(200);

      expect(response.body.sessions.length).toBe(1);
      expect(response.body.total).toBe(mockSessions.length);
      expect(response.body.source).toBe('filesystem');
    });

    it('filters by project', async () => {
      const response = await request(app)
        .get('/api/sessions?source=filesystem&project=test-project')
        .expect(200);

      expect(response.body.sessions.length).toBe(1);
      expect(response.body.sessions[0].project).toBe('test-project');
    });

    it('filters by agent', async () => {
      const response = await request(app)
        .get('/api/sessions?source=filesystem&agent=codex')
        .expect(200);

      expect(response.body.sessions.length).toBe(1);
      expect(response.body.sessions[0].agent).toBe('codex');
    });

    it('returns totalUnfiltered when CWD filter is active', async () => {
      // Set up CWD filter to match only session-1
      indexer.getCwdFilter.mockReturnValue('/tmp/project');

      const response = await request(app).get('/api/sessions?source=filesystem').expect(200);

      // Should return filtered count and total unfiltered count
      expect(response.body.total).toBe(1); // Only session-1 matches /tmp/project
      expect(response.body.totalUnfiltered).toBe(2); // Both sessions before CWD filter
      expect(response.body.cwdFilter).toBe('/tmp/project');
      expect(response.body.sessions[0].cwd).toBe('/tmp/project');

      // Reset mock
      indexer.getCwdFilter.mockReturnValue(null);
    });

    it('returns all sessions when showAll=true bypasses CWD filter', async () => {
      // Set up CWD filter
      indexer.getCwdFilter.mockReturnValue('/tmp/project');

      const response = await request(app)
        .get('/api/sessions?source=filesystem&showAll=true')
        .expect(200);

      // showAll=true should bypass CWD filter
      expect(response.body.total).toBe(2); // All sessions
      expect(response.body.cwdFilter).toBeNull(); // Filter not applied
      expect(response.body.sessions.length).toBe(2);

      // Reset mock
      indexer.getCwdFilter.mockReturnValue(null);
    });
  });

  describe('GET /api/sessions/:id', () => {
    it('returns timeline metadata without frames', async () => {
      const response = await request(app).get('/api/sessions/session-1').expect(200);

      expect(response.body.sessionId).toBe('session-1');
      expect(response.body.totalFrames).toBe(2);
      expect(response.body.frames).toBeUndefined();
    });

    it('returns 404 for unknown session', async () => {
      await request(app).get('/api/sessions/unknown').expect(404);
    });
  });

  describe('GET /api/sessions/:id/frames', () => {
    it('returns frames with pagination', async () => {
      const response = await request(app)
        .get('/api/sessions/session-1/frames?source=filesystem&limit=1')
        .expect(200);

      expect(response.body.frames.length).toBe(1);
      expect(response.body.total).toBe(2);
    });
  });

  describe('GET /api/sessions/:id/frames/:frameId', () => {
    it('returns a single frame', async () => {
      const response = await request(app).get('/api/sessions/session-1/frames/frame-2').expect(200);

      expect(response.body.id).toBe('frame-2');
      expect(response.body.type).toBe('claude_response');
    });

    it('returns 404 for unknown frame', async () => {
      await request(app).get('/api/sessions/session-1/frames/unknown').expect(404);
    });
  });

  describe('GET /api/agents', () => {
    it('returns agent availability', async () => {
      const response = await request(app).get('/api/agents').expect(200);

      expect(response.body.agents).toEqual(['claude', 'codex']);
      expect(response.body.counts.claude).toBe(1);
    });
  });
});
