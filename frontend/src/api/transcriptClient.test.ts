import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as client from './transcriptClient';

describe('transcriptClient', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true }),
    } as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchSessions', () => {
    it('defaults to filesystem source', async () => {
      await client.fetchSessions({});
      expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('source=filesystem'));
    });
  });

  describe('fetchCheckpoints', () => {
    it('calls correct URL', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ checkpoints: [] }),
      } as Response);
      await client.fetchCheckpoints('s1');
      expect(fetchSpy).toHaveBeenCalledWith('/api/sessions/s1/checkpoints');
    });
  });

  describe('createCheckpoint', () => {
    it('sends POST request with data', async () => {
      const data = { name: 'CP1', frameIndex: 5 };
      await client.createCheckpoint('s1', data);
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/sessions/s1/checkpoints',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(data),
        })
      );
    });
  });

  describe('previewRewind', () => {
    it('sends POST request with frameIndex', async () => {
      await client.previewRewind('s1', 10);
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/sessions/s1/rewind/preview',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ frameIndex: 10 }),
        })
      );
    });
  });

  describe('executeRewind', () => {
    it('sends POST request with options', async () => {
      const options = { createBackups: true, skipConflicts: false };
      await client.executeRewind('s1', 10, options);
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/sessions/s1/rewind/execute',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ frameIndex: 10, ...options }),
        })
      );
    });
  });

  describe('fetchSessionSummary', () => {
    it('calls correct URL', async () => {
      await client.fetchSessionSummary('s1');
      expect(fetchSpy).toHaveBeenCalledWith('/api/sessions/s1/summary');
    });
  });

  describe('regenerateSummary', () => {
    it('sends POST request', async () => {
      await client.regenerateSummary('s1');
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/sessions/s1/summary/regenerate',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });

  describe('fetchSessionGit', () => {
    it('calls correct URL', async () => {
      await client.fetchSessionGit('s1');
      expect(fetchSpy).toHaveBeenCalledWith('/api/sessions/s1/git');
    });
  });

  describe('createShareLink', () => {
    it('sends POST request with options', async () => {
      const options = {
        enableRedaction: true,
        expiresIn: '24h' as const,
      };
      await client.createShareLink('s1', options);
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/sessions/s1/share',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(options),
        })
      );
    });
  });

  describe('getSharedSession', () => {
    it('calls correct URL', async () => {
      await client.getSharedSession('share-1');
      expect(fetchSpy).toHaveBeenCalledWith('/api/shared/share-1');
    });

    it('sends share token in request header when provided', async () => {
      await client.getSharedSession('share-1', 'token-123');
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/shared/share-1',
        expect.objectContaining({
          headers: { 'X-Share-Token': 'token-123' },
        })
      );
    });
  });

  describe('revokeShareLink', () => {
    it('sends DELETE request', async () => {
      await client.revokeShareLink('share-1');
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/shares/share-1',
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });
  });
});
