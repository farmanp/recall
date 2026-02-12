import { describe, it, expect, beforeEach, vi } from 'vitest';
import express, { type Application } from 'express';
import request from 'supertest';

const mocks = vi.hoisted(() => ({
  transcriptQueries: {
    getTranscriptSessionById: vi.fn(),
  },
  shareLinks: {
    createShareLink: vi.fn(),
    getSharedSessionData: vi.fn(),
    revokeShareLink: vi.fn(),
  },
}));

vi.mock('../../db/transcript-queries', () => ({
  getTranscriptSessionById: mocks.transcriptQueries.getTranscriptSessionById,
}));

vi.mock('../../services/share-links', () => ({
  createShareLink: mocks.shareLinks.createShareLink,
  getSharedSessionData: mocks.shareLinks.getSharedSessionData,
  revokeShareLink: mocks.shareLinks.revokeShareLink,
}));

import sharesRouter from '../../routes/shares';

describe('Share Routes', () => {
  let app: Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api', sharesRouter);
    vi.resetAllMocks();
    delete process.env.RECALL_ALLOW_UNREDACTED_SHARES;
  });

  it('creates a share link for an existing session', async () => {
    mocks.transcriptQueries.getTranscriptSessionById.mockReturnValue({ sessionId: 's1' });
    mocks.shareLinks.createShareLink.mockReturnValue({
      shareId: 'abc123',
      token: 'signed-token',
      expiresAt: null,
    });

    const response = await request(app)
      .post('/api/sessions/s1/share')
      .send({ enableRedaction: true, expiresIn: '24h' })
      .expect(200);

    expect(response.body.shareId).toBe('abc123');
    expect(response.body.url).toContain('/shared/abc123#token=');
    expect(mocks.shareLinks.createShareLink).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({ enableRedaction: true, expiresIn: '24h' })
    );
  });

  it('forces redaction when unredacted shares are disabled', async () => {
    mocks.transcriptQueries.getTranscriptSessionById.mockReturnValue({ sessionId: 's1' });
    mocks.shareLinks.createShareLink.mockReturnValue({
      shareId: 'abc123',
      token: 'signed-token',
      expiresAt: null,
    });

    await request(app)
      .post('/api/sessions/s1/share')
      .send({ enableRedaction: false, expiresIn: '24h' })
      .expect(200);

    expect(mocks.shareLinks.createShareLink).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({ enableRedaction: true })
    );
  });

  it('reads a shared session when token is valid', async () => {
    mocks.shareLinks.getSharedSessionData.mockReturnValue({
      session: { slug: 'slug', project: 'proj', startedAt: '2026-01-01T00:00:00.000Z' },
      frames: [],
      expiresAt: null,
      redactionEnabled: true,
    });

    const response = await request(app).get('/api/shared/abc123?token=tok').expect(200);
    expect(response.body.session.slug).toBe('slug');
  });

  it('reads a shared session when token is supplied in header', async () => {
    mocks.shareLinks.getSharedSessionData.mockReturnValue({
      session: { slug: 'slug', project: 'proj', startedAt: '2026-01-01T00:00:00.000Z' },
      frames: [],
      expiresAt: null,
      redactionEnabled: true,
    });

    await request(app).get('/api/shared/abc123').set('x-share-token', 'tok').expect(200);
    expect(mocks.shareLinks.getSharedSessionData).toHaveBeenCalledWith('abc123', 'tok');
  });

  it('rejects missing share token', async () => {
    await request(app).get('/api/shared/abc123').expect(401);
  });

  it('revokes share links', async () => {
    mocks.shareLinks.revokeShareLink.mockReturnValue(true);
    await request(app).delete('/api/shares/abc123').expect(204);
  });
});
