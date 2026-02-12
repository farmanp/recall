import { beforeEach, describe, expect, it, vi } from 'vitest';
import express, { type Application } from 'express';
import request from 'supertest';

const mocks = vi.hoisted(() => ({
  gitQueries: {
    getGitActivity: vi.fn(),
    getSessionCommits: vi.fn(),
    findSessionsByCommit: vi.fn(),
    getBranchesWithCounts: vi.fn(),
    findSessionsByBranch: vi.fn(),
  },
  transcriptQueries: {
    getTranscriptSessionById: vi.fn(),
  },
}));

vi.mock('../../db/git-queries', () => ({
  getGitActivity: mocks.gitQueries.getGitActivity,
  getSessionCommits: mocks.gitQueries.getSessionCommits,
  findSessionsByCommit: mocks.gitQueries.findSessionsByCommit,
  getBranchesWithCounts: mocks.gitQueries.getBranchesWithCounts,
  findSessionsByBranch: mocks.gitQueries.findSessionsByBranch,
}));

vi.mock('../../db/transcript-queries', () => ({
  getTranscriptSessionById: mocks.transcriptQueries.getTranscriptSessionById,
}));

describe('Git Routes', () => {
  let app: Application;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    const router = (await import('../../routes/git')).default;
    app = express();
    app.use(express.json());
    app.use('/api', router);
  });

  it('returns session git context', async () => {
    mocks.transcriptQueries.getTranscriptSessionById.mockReturnValue({ id: 'session-1' });
    mocks.gitQueries.getGitActivity.mockReturnValue({
      session_id: 'session-1',
      branch_name: 'main',
      commit_hash: 'abc1234',
      commit_message: 'feat: add api',
      parent_commit: 'fff0000',
      is_dirty: 1,
      files_staged: '["a.ts"]',
      files_modified: '["b.ts"]',
      untracked_count: 2,
      captured_at: '2026-01-01T00:00:00.000Z',
    });
    mocks.gitQueries.getSessionCommits.mockReturnValue([
      {
        commit_hash: 'abc1234',
        commit_message: 'feat: add api',
        author_name: 'Test',
        author_email: 'test@example.com',
        committed_at: '2026-01-01T00:00:00.000Z',
      },
    ]);

    const response = await request(app).get('/api/sessions/session-1/git').expect(200);
    expect(response.body.session_id).toBe('session-1');
    expect(response.body.branch).toBe('main');
    expect(response.body.is_dirty).toBe(true);
    expect(response.body.staged_files).toEqual(['a.ts']);
    expect(response.body.commits).toHaveLength(1);
  });

  it('returns 404 when session does not exist', async () => {
    mocks.transcriptQueries.getTranscriptSessionById.mockReturnValue(null);
    await request(app).get('/api/sessions/missing/git').expect(404);
  });

  it('returns 404 when git context is unavailable', async () => {
    mocks.transcriptQueries.getTranscriptSessionById.mockReturnValue({ id: 'session-1' });
    mocks.gitQueries.getGitActivity.mockReturnValue(null);
    await request(app).get('/api/sessions/session-1/git').expect(404);
  });

  it('validates commit hash query for commit search', async () => {
    await request(app).get('/api/commits?hash=abc').expect(400);
  });

  it('returns sessions by commit hash', async () => {
    mocks.gitQueries.findSessionsByCommit.mockReturnValue(['session-1', 'session-2']);
    const response = await request(app).get('/api/commits?hash=abcd').expect(200);
    expect(response.body.hash).toBe('abcd');
    expect(response.body.count).toBe(2);
  });

  it('returns branches with counts', async () => {
    mocks.gitQueries.getBranchesWithCounts.mockReturnValue([
      { branch: 'main', sessionCount: 3 },
      { branch: 'feature/x', sessionCount: 1 },
    ]);
    const response = await request(app).get('/api/branches').expect(200);
    expect(response.body.total).toBe(2);
    expect(response.body.branches[0].branch).toBe('main');
  });

  it('returns sessions on a branch using decoded name and capped limit', async () => {
    mocks.gitQueries.findSessionsByBranch.mockReturnValue(['session-1']);
    const response = await request(app)
      .get('/api/branches/feature%2Fnew/sessions?limit=10000')
      .expect(200);

    expect(response.body.branch).toBe('feature/new');
    expect(response.body.sessions).toEqual(['session-1']);
    expect(mocks.gitQueries.findSessionsByBranch).toHaveBeenCalledWith('feature/new', 500);
  });
});
