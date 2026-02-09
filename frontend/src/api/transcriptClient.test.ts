import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchSessions } from './transcriptClient';

/**
 * Unit tests for transcriptClient API functions
 *
 * These tests verify the API client constructs correct URLs and defaults.
 * The key test here prevents regression of the bug where source defaulted
 * to 'db' instead of 'filesystem', causing 0 sessions to be returned.
 */

describe('transcriptClient', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Mock global fetch
    fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          sessions: [],
          total: 0,
          offset: 0,
          limit: 20,
          source: 'filesystem',
        }),
    } as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchSessions', () => {
    it('defaults to filesystem source when no source specified', async () => {
      await fetchSessions({});

      // Verify fetch was called with filesystem source
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const calledUrl = fetchSpy.mock.calls[0][0] as string;

      // This test prevents regression: source MUST default to 'filesystem'
      // Previously defaulted to 'db' which returned 0 sessions when DB was empty
      expect(calledUrl).toContain('source=filesystem');
      expect(calledUrl).not.toContain('source=db');
    });

    it('respects explicit source=db when specified', async () => {
      await fetchSessions({ source: 'db' });

      const calledUrl = fetchSpy.mock.calls[0][0] as string;
      expect(calledUrl).toContain('source=db');
    });

    it('respects explicit source=filesystem when specified', async () => {
      await fetchSessions({ source: 'filesystem' });

      const calledUrl = fetchSpy.mock.calls[0][0] as string;
      expect(calledUrl).toContain('source=filesystem');
    });

    it('includes pagination parameters', async () => {
      await fetchSessions({ offset: 10, limit: 50 });

      const calledUrl = fetchSpy.mock.calls[0][0] as string;
      expect(calledUrl).toContain('offset=10');
      expect(calledUrl).toContain('limit=50');
    });

    it('includes agent filter when specified', async () => {
      await fetchSessions({ agent: 'claude' });

      const calledUrl = fetchSpy.mock.calls[0][0] as string;
      expect(calledUrl).toContain('agent=claude');
    });

    it('includes hasClaudeMd filter when specified', async () => {
      await fetchSessions({ hasClaudeMd: true });

      const calledUrl = fetchSpy.mock.calls[0][0] as string;
      expect(calledUrl).toContain('hasClaudeMd=true');
    });

    it('includes showAll flag when specified', async () => {
      await fetchSessions({ showAll: true });

      const calledUrl = fetchSpy.mock.calls[0][0] as string;
      expect(calledUrl).toContain('showAll=true');
    });

    it('throws error when response is not ok', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
      } as Response);

      await expect(fetchSessions({})).rejects.toThrow('Failed to fetch sessions');
    });
  });
});
