import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the database connection
const mockDb = {
  prepare: vi.fn(),
};

const mockStatement = {
  run: vi.fn(),
  get: vi.fn(),
  all: vi.fn(),
};

vi.mock('../../db/transcript-connection', () => ({
  getTranscriptDatabase: vi.fn(() => mockDb),
}));

describe('git-checkpoint-queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockDb.prepare.mockReturnValue(mockStatement);
  });

  describe('updateCheckpointGitStorage', () => {
    it('updates checkpoint with git commit reference', async () => {
      const { updateCheckpointGitStorage } = await import('../../db/git-checkpoint-queries');

      mockStatement.run.mockReturnValue({ changes: 1 });

      const result = updateCheckpointGitStorage('checkpoint-123', 'abc1234567890');

      expect(result).toBe(true);
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('UPDATE checkpoints'));
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('git_storage_commit'));
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('git_storage_synced = 1')
      );
      expect(mockStatement.run).toHaveBeenCalledWith('abc1234567890', 'checkpoint-123');
    });

    it('returns false when checkpoint not found', async () => {
      const { updateCheckpointGitStorage } = await import('../../db/git-checkpoint-queries');

      mockStatement.run.mockReturnValue({ changes: 0 });

      const result = updateCheckpointGitStorage('nonexistent', 'abc123');

      expect(result).toBe(false);
    });

    it('returns false on database error', async () => {
      const { updateCheckpointGitStorage } = await import('../../db/git-checkpoint-queries');

      mockStatement.run.mockImplementation(() => {
        throw new Error('DB error');
      });

      const result = updateCheckpointGitStorage('checkpoint-123', 'abc123');

      expect(result).toBe(false);
    });
  });

  describe('updateCheckpointExportBranch', () => {
    it('updates checkpoint with export branch name', async () => {
      const { updateCheckpointExportBranch } = await import('../../db/git-checkpoint-queries');

      mockStatement.run.mockReturnValue({ changes: 1 });

      const result = updateCheckpointExportBranch('checkpoint-123', 'recall/checkpoint/my-branch');

      expect(result).toBe(true);
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('git_export_branch'));
      expect(mockStatement.run).toHaveBeenCalledWith(
        'recall/checkpoint/my-branch',
        'checkpoint-123'
      );
    });

    it('returns false when checkpoint not found', async () => {
      const { updateCheckpointExportBranch } = await import('../../db/git-checkpoint-queries');

      mockStatement.run.mockReturnValue({ changes: 0 });

      const result = updateCheckpointExportBranch('nonexistent', 'branch');

      expect(result).toBe(false);
    });
  });

  describe('getUnsyncedCheckpoints', () => {
    it('returns checkpoints not synced to git', async () => {
      const { getUnsyncedCheckpoints } = await import('../../db/git-checkpoint-queries');

      mockStatement.all.mockReturnValue([
        { id: 'cp1', name: 'First', frameIndex: 10, createdAt: '2026-02-20T12:00:00Z' },
        { id: 'cp2', name: 'Second', frameIndex: 20, createdAt: '2026-02-20T13:00:00Z' },
      ]);

      const result = getUnsyncedCheckpoints('session-123');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('cp1');
      expect(result[1].id).toBe('cp2');
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('git_storage_synced = 0')
      );
      expect(mockStatement.all).toHaveBeenCalledWith('session-123');
    });

    it('returns empty array on error', async () => {
      const { getUnsyncedCheckpoints } = await import('../../db/git-checkpoint-queries');

      mockStatement.all.mockImplementation(() => {
        throw new Error('DB error');
      });

      const result = getUnsyncedCheckpoints('session-123');

      expect(result).toEqual([]);
    });
  });

  describe('getCheckpointGitStatus', () => {
    it('returns git status for checkpoint', async () => {
      const { getCheckpointGitStatus } = await import('../../db/git-checkpoint-queries');

      mockStatement.get.mockReturnValue({
        synced: 1,
        storageCommit: 'abc1234',
        exportBranch: 'recall/checkpoint/test',
      });

      const result = getCheckpointGitStatus('checkpoint-123');

      expect(result).toEqual({
        synced: true,
        storageCommit: 'abc1234',
        exportBranch: 'recall/checkpoint/test',
      });
    });

    it('returns unsynced status', async () => {
      const { getCheckpointGitStatus } = await import('../../db/git-checkpoint-queries');

      mockStatement.get.mockReturnValue({
        synced: 0,
        storageCommit: null,
        exportBranch: null,
      });

      const result = getCheckpointGitStatus('checkpoint-123');

      expect(result).toEqual({
        synced: false,
        storageCommit: null,
        exportBranch: null,
      });
    });

    it('returns null when checkpoint not found', async () => {
      const { getCheckpointGitStatus } = await import('../../db/git-checkpoint-queries');

      mockStatement.get.mockReturnValue(undefined);

      const result = getCheckpointGitStatus('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('markCheckpointSynced', () => {
    it('marks checkpoint as synced', async () => {
      const { markCheckpointSynced } = await import('../../db/git-checkpoint-queries');

      mockStatement.run.mockReturnValue({ changes: 1 });

      const result = markCheckpointSynced('checkpoint-123');

      expect(result).toBe(true);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('git_storage_synced = 1')
      );
    });

    it('returns false when checkpoint not found', async () => {
      const { markCheckpointSynced } = await import('../../db/git-checkpoint-queries');

      mockStatement.run.mockReturnValue({ changes: 0 });

      const result = markCheckpointSynced('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('getAllCheckpointsWithGitInfo', () => {
    it('returns all checkpoints with git info', async () => {
      const { getAllCheckpointsWithGitInfo } = await import('../../db/git-checkpoint-queries');

      mockStatement.all.mockReturnValue([
        {
          id: 'cp1',
          sessionId: 'session-1',
          name: 'First',
          frameIndex: 10,
          createdAt: '2026-02-20T12:00:00Z',
          gitStorageCommit: 'abc123',
          gitExportBranch: null,
          gitStorageSynced: 1,
        },
        {
          id: 'cp2',
          sessionId: 'session-2',
          name: 'Second',
          frameIndex: 20,
          createdAt: '2026-02-20T13:00:00Z',
          gitStorageCommit: null,
          gitExportBranch: null,
          gitStorageSynced: 0,
        },
      ]);

      const result = getAllCheckpointsWithGitInfo();

      expect(result).toHaveLength(2);
      expect(result[0].gitStorageSynced).toBe(true);
      expect(result[1].gitStorageSynced).toBe(false);
    });

    it('returns empty array on error', async () => {
      const { getAllCheckpointsWithGitInfo } = await import('../../db/git-checkpoint-queries');

      mockStatement.all.mockImplementation(() => {
        throw new Error('DB error');
      });

      const result = getAllCheckpointsWithGitInfo();

      expect(result).toEqual([]);
    });
  });
});
