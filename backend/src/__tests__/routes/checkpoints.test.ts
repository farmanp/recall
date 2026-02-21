import { beforeEach, describe, expect, it, vi } from 'vitest';
import express, { type Application } from 'express';
import request from 'supertest';

const CHECKPOINT_ID = '550e8400-e29b-41d4-a716-446655440000';
const OTHER_CHECKPOINT_ID = '550e8400-e29b-41d4-a716-446655440001';

const mocks = vi.hoisted(() => ({
  checkpointManager: {
    createCheckpoint: vi.fn(),
    getSessionCheckpoints: vi.fn(),
    getCheckpointById: vi.fn(),
    getCheckpointWithFiles: vi.fn(),
    checkpointExists: vi.fn(),
    getCheckpointFiles: vi.fn(),
    getCheckpointFile: vi.fn(),
    updateCheckpoint: vi.fn(),
    deleteCheckpoint: vi.fn(),
    compareCheckpoints: vi.fn(),
    getFileDiff: vi.fn(),
    isGitAvailable: vi.fn(),
    exportToGitBranch: vi.fn(),
  },
  sessionIndexer: {
    findSessionFile: vi.fn(),
  },
  parserFactory: {
    parseFile: vi.fn(),
    buildTimeline: vi.fn(),
  },
  getTranscriptSessionById: vi.fn(),
  importTranscript: vi.fn(),
}));

vi.mock('../../services/checkpoint-manager', () => ({
  CheckpointManager: mocks.checkpointManager,
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
vi.mock('../../db/transcript-queries', () => ({
  getTranscriptSessionById: mocks.getTranscriptSessionById,
}));
vi.mock('../../services/transcript-importer', () => ({
  importTranscript: mocks.importTranscript,
}));

describe('Checkpoint Routes', () => {
  let app: Application;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    const router = (await import('../../routes/checkpoints')).default;
    app = express();
    app.use(express.json());
    app.use('/api', router);
  });

  it('returns 404 when creating checkpoint for missing session', async () => {
    mocks.sessionIndexer.findSessionFile.mockResolvedValue(null);
    await request(app)
      .post('/api/sessions/s1/checkpoints')
      .send({ name: 'before', frameIndex: 0 })
      .expect(404);
  });

  it('returns 400 for out-of-range frame index during checkpoint creation', async () => {
    mocks.sessionIndexer.findSessionFile.mockResolvedValue('/tmp/session.jsonl');
    mocks.parserFactory.parseFile.mockResolvedValue({});
    mocks.parserFactory.buildTimeline.mockResolvedValue({ frames: [{ id: 'f1' }] });

    const response = await request(app)
      .post('/api/sessions/s1/checkpoints')
      .send({ name: 'before', frameIndex: 99 });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid frame index');
  });

  it('creates checkpoint successfully', async () => {
    mocks.sessionIndexer.findSessionFile.mockResolvedValue('/tmp/session.jsonl');
    mocks.parserFactory.parseFile.mockResolvedValue({});
    mocks.parserFactory.buildTimeline.mockResolvedValue({ frames: [{ id: 'f1' }] });
    mocks.checkpointManager.createCheckpoint.mockReturnValue({ id: CHECKPOINT_ID, fileCount: 1 });
    // Mock session exists in DB (no auto-import needed)
    mocks.getTranscriptSessionById.mockReturnValue({ session_id: 's1' });

    const response = await request(app)
      .post('/api/sessions/s1/checkpoints')
      .send({ name: 'before', frameIndex: 0 })
      .expect(201);

    expect(response.body.id).toBe(CHECKPOINT_ID);
  });

  it('lists checkpoints for a session', async () => {
    mocks.checkpointManager.getSessionCheckpoints.mockReturnValue([{ id: CHECKPOINT_ID }]);
    const response = await request(app).get('/api/sessions/s1/checkpoints').expect(200);
    expect(response.body.total).toBe(1);
    expect(response.body.checkpoints[0].id).toBe(CHECKPOINT_ID);
  });

  it('returns 404 for missing checkpoint', async () => {
    mocks.checkpointManager.getCheckpointById.mockReturnValue(null);
    await request(app).get(`/api/checkpoints/${CHECKPOINT_ID}`).expect(404);
  });

  it('returns files list for checkpoint', async () => {
    mocks.checkpointManager.checkpointExists.mockReturnValue(true);
    mocks.checkpointManager.getCheckpointFiles.mockReturnValue([{ id: 1, path: 'src/index.ts' }]);
    const response = await request(app).get(`/api/checkpoints/${CHECKPOINT_ID}/files`).expect(200);
    expect(response.body.total).toBe(1);
  });

  it('validates checkpoint id format for wildcard file endpoint', async () => {
    await request(app).get('/api/checkpoints/not-a-uuid/files/src/index.ts').expect(400);
  });

  it('returns 400 when patch payload has no updatable fields', async () => {
    const response = await request(app).patch(`/api/checkpoints/${CHECKPOINT_ID}`).send({});
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('No updates provided');
  });

  it('deletes checkpoint', async () => {
    mocks.checkpointManager.deleteCheckpoint.mockReturnValue(true);
    const response = await request(app).delete(`/api/checkpoints/${CHECKPOINT_ID}`).expect(200);
    expect(response.body.success).toBe(true);
  });

  it('validates checkpoint ids for compare endpoint', async () => {
    const response = await request(app).get('/api/checkpoints/not-a-uuid/diff/also-bad');
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid checkpoint ID format');
  });

  it('returns checkpoint diff when ids are valid', async () => {
    mocks.checkpointManager.compareCheckpoints.mockReturnValue({
      from: { id: CHECKPOINT_ID },
      to: { id: OTHER_CHECKPOINT_ID },
      addedFiles: ['a.ts'],
      removedFiles: [],
      modifiedFiles: [],
      unchangedFiles: [],
    });

    const response = await request(app)
      .get(`/api/checkpoints/${CHECKPOINT_ID}/diff/${OTHER_CHECKPOINT_ID}`)
      .expect(200);
    expect(response.body.addedFiles).toEqual(['a.ts']);
  });

  it('validates query params for file diff endpoint', async () => {
    await request(app)
      .get(`/api/checkpoints/${CHECKPOINT_ID}/diff/${OTHER_CHECKPOINT_ID}/file`)
      .expect(400);
  });

  // ============================================================================
  // Export Endpoint Tests
  // ============================================================================

  describe('POST /api/checkpoints/:id/export', () => {
    it('returns 404 when checkpoint not found', async () => {
      mocks.checkpointManager.getCheckpointById.mockReturnValue(null);

      const response = await request(app)
        .post(`/api/checkpoints/${CHECKPOINT_ID}/export`)
        .send({ branchName: 'my-branch' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Checkpoint not found');
    });

    it('returns 400 when session has no cwd', async () => {
      mocks.checkpointManager.getCheckpointById.mockReturnValue({
        id: CHECKPOINT_ID,
        sessionId: 'session-1',
      });
      mocks.getTranscriptSessionById.mockReturnValue({ session_id: 'session-1', cwd: null });

      const response = await request(app)
        .post(`/api/checkpoints/${CHECKPOINT_ID}/export`)
        .send({ branchName: 'my-branch' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Cannot export checkpoint');
    });

    it('returns 400 when directory is not a git repo', async () => {
      mocks.checkpointManager.getCheckpointById.mockReturnValue({
        id: CHECKPOINT_ID,
        sessionId: 'session-1',
      });
      mocks.getTranscriptSessionById.mockReturnValue({
        session_id: 'session-1',
        cwd: '/test/repo',
      });
      mocks.checkpointManager.isGitAvailable.mockReturnValue(false);

      const response = await request(app)
        .post(`/api/checkpoints/${CHECKPOINT_ID}/export`)
        .send({ branchName: 'my-branch' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Cannot export checkpoint');
      expect(response.body.message).toContain('not a git repository');
    });

    it('exports checkpoint to git branch successfully', async () => {
      mocks.checkpointManager.getCheckpointById.mockReturnValue({
        id: CHECKPOINT_ID,
        sessionId: 'session-1',
      });
      mocks.getTranscriptSessionById.mockReturnValue({
        session_id: 'session-1',
        cwd: '/test/repo',
      });
      mocks.checkpointManager.isGitAvailable.mockReturnValue(true);
      mocks.checkpointManager.exportToGitBranch.mockResolvedValue({
        success: true,
        branchName: 'recall/checkpoint/my-branch',
        commitSha: 'abc1234567890',
        redactionStats: { totalRedactions: 0, byPattern: {} },
      });

      const response = await request(app)
        .post(`/api/checkpoints/${CHECKPOINT_ID}/export`)
        .send({ branchName: 'my-branch' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.branchName).toBe('recall/checkpoint/my-branch');
      expect(response.body.commitSha).toBe('abc1234567890');
      expect(mocks.checkpointManager.exportToGitBranch).toHaveBeenCalledWith(
        CHECKPOINT_ID,
        'my-branch',
        '/test/repo'
      );
    });

    it('returns 400 when export fails', async () => {
      mocks.checkpointManager.getCheckpointById.mockReturnValue({
        id: CHECKPOINT_ID,
        sessionId: 'session-1',
      });
      mocks.getTranscriptSessionById.mockReturnValue({
        session_id: 'session-1',
        cwd: '/test/repo',
      });
      mocks.checkpointManager.isGitAvailable.mockReturnValue(true);
      mocks.checkpointManager.exportToGitBranch.mockResolvedValue({
        success: false,
        error: 'Branch already exists',
      });

      const response = await request(app)
        .post(`/api/checkpoints/${CHECKPOINT_ID}/export`)
        .send({ branchName: 'existing-branch' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Branch already exists');
    });

    it('validates branch name format', async () => {
      const response = await request(app)
        .post(`/api/checkpoints/${CHECKPOINT_ID}/export`)
        .send({ branchName: 'invalid/branch/name!' });

      expect(response.status).toBe(400);
    });

    it('rejects empty branch name', async () => {
      const response = await request(app)
        .post(`/api/checkpoints/${CHECKPOINT_ID}/export`)
        .send({ branchName: '' });

      expect(response.status).toBe(400);
    });

    it('includes redaction stats in successful response', async () => {
      mocks.checkpointManager.getCheckpointById.mockReturnValue({
        id: CHECKPOINT_ID,
        sessionId: 'session-1',
      });
      mocks.getTranscriptSessionById.mockReturnValue({
        session_id: 'session-1',
        cwd: '/test/repo',
      });
      mocks.checkpointManager.isGitAvailable.mockReturnValue(true);
      mocks.checkpointManager.exportToGitBranch.mockResolvedValue({
        success: true,
        branchName: 'recall/checkpoint/secure-branch',
        commitSha: 'def5678',
        redactionStats: {
          totalRedactions: 3,
          byPattern: { openai_key: 2, github_token: 1 },
        },
      });

      const response = await request(app)
        .post(`/api/checkpoints/${CHECKPOINT_ID}/export`)
        .send({ branchName: 'secure-branch' })
        .expect(200);

      expect(response.body.redactionStats.totalRedactions).toBe(3);
      expect(response.body.redactionStats.byPattern.openai_key).toBe(2);
    });
  });

  // ============================================================================
  // Checkpoint Creation with syncToGit Option
  // ============================================================================

  describe('POST /api/sessions/:sessionId/checkpoints with syncToGit', () => {
    it('creates checkpoint with syncToGit option', async () => {
      mocks.sessionIndexer.findSessionFile.mockResolvedValue('/tmp/session.jsonl');
      mocks.parserFactory.parseFile.mockResolvedValue({});
      mocks.parserFactory.buildTimeline.mockResolvedValue({
        frames: [{ id: 'f1' }],
        metadata: { cwd: '/test/repo' },
      });
      mocks.checkpointManager.createCheckpoint.mockResolvedValue({
        id: CHECKPOINT_ID,
        fileCount: 1,
      });
      mocks.getTranscriptSessionById.mockReturnValue({
        session_id: 's1',
        cwd: '/test/repo',
      });

      const response = await request(app)
        .post('/api/sessions/s1/checkpoints')
        .send({ name: 'before', frameIndex: 0, syncToGit: true })
        .expect(201);

      expect(response.body.id).toBe(CHECKPOINT_ID);
      expect(mocks.checkpointManager.createCheckpoint).toHaveBeenCalledWith(
        's1',
        0,
        'before',
        expect.any(Array),
        undefined,
        undefined,
        { syncToGit: true, cwd: '/test/repo' }
      );
    });
  });
});
