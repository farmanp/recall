import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies
const mockGitExtractor = {
  isGitRepo: vi.fn(),
  getRepoRoot: vi.fn(),
  getCurrentBranch: vi.fn(),
  branchExists: vi.fn(),
  createOrphanBranch: vi.fn(),
  switchBranch: vi.fn(),
  stashChanges: vi.fn(),
  popStash: vi.fn(),
  commitFiles: vi.fn(),
  listFilesInCommit: vi.fn(),
  getFileAtCommit: vi.fn(),
  deleteBranch: vi.fn(),
};

const mockSecretRedactor = {
  redact: vi.fn((content: string) => content),
  getLastRedactionStats: vi.fn(() => ({ totalRedactions: 0, byPattern: {} })),
};

vi.mock('../../services/git-extractor', () => ({
  GitExtractor: mockGitExtractor,
}));

vi.mock('../../services/secret-redactor', () => ({
  SecretRedactor: mockSecretRedactor,
}));

describe('GitCheckpointService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('storeCheckpoint', () => {
    it('stores checkpoint to git branch successfully', async () => {
      const { GitCheckpointService } = await import('../../services/git-checkpoint-service');

      mockGitExtractor.isGitRepo.mockReturnValue(true);
      mockGitExtractor.getRepoRoot.mockReturnValue('/test/repo');
      mockGitExtractor.getCurrentBranch.mockReturnValue('main');
      mockGitExtractor.branchExists.mockReturnValue(false);
      mockGitExtractor.createOrphanBranch.mockReturnValue(true);
      mockGitExtractor.stashChanges.mockReturnValue('no-changes');
      mockGitExtractor.commitFiles.mockReturnValue('abc1234567890');
      mockGitExtractor.switchBranch.mockReturnValue(true);

      const result = await GitCheckpointService.storeCheckpoint(
        '/test/repo',
        'checkpoint-123',
        [{ path: '/test/repo/src/file.ts', content: 'console.log(1);' }],
        {
          checkpointId: 'checkpoint-123',
          sessionId: 'session-456',
          name: 'Before refactor',
          frameIndex: 42,
          createdAt: '2026-02-20T12:00:00Z',
          originalBranch: 'main',
          projectPath: '/test/repo',
          fileCount: 1,
        }
      );

      expect(result.success).toBe(true);
      expect(result.commitSha).toBe('abc1234567890');
      expect(result.branchName).toBe('recall/checkpoints/v1');
      expect(mockGitExtractor.createOrphanBranch).toHaveBeenCalledWith(
        '/test/repo',
        'recall/checkpoints/v1'
      );
    });

    it('uses existing storage branch if it exists', async () => {
      const { GitCheckpointService } = await import('../../services/git-checkpoint-service');

      mockGitExtractor.isGitRepo.mockReturnValue(true);
      mockGitExtractor.getRepoRoot.mockReturnValue('/test/repo');
      mockGitExtractor.getCurrentBranch.mockReturnValue('main');
      mockGitExtractor.branchExists.mockReturnValue(true); // Branch exists
      mockGitExtractor.switchBranch.mockReturnValue(true);
      mockGitExtractor.stashChanges.mockReturnValue('no-changes');
      mockGitExtractor.commitFiles.mockReturnValue('def5678');

      const result = await GitCheckpointService.storeCheckpoint(
        '/test/repo',
        'checkpoint-123',
        [{ path: 'file.ts', content: 'code' }],
        {
          checkpointId: 'checkpoint-123',
          sessionId: 'session-456',
          name: 'Test',
          frameIndex: 0,
          createdAt: '2026-02-20T12:00:00Z',
          originalBranch: 'main',
          projectPath: '/test/repo',
          fileCount: 1,
        }
      );

      expect(result.success).toBe(true);
      expect(mockGitExtractor.createOrphanBranch).not.toHaveBeenCalled();
      expect(mockGitExtractor.switchBranch).toHaveBeenCalledWith(
        '/test/repo',
        'recall/checkpoints/v1'
      );
    });

    it('returns error for non-git repository', async () => {
      const { GitCheckpointService } = await import('../../services/git-checkpoint-service');

      mockGitExtractor.isGitRepo.mockReturnValue(false);

      const result = await GitCheckpointService.storeCheckpoint(
        '/not/a/repo',
        'checkpoint-123',
        [],
        {
          checkpointId: 'checkpoint-123',
          sessionId: 'session-456',
          name: 'Test',
          frameIndex: 0,
          createdAt: '2026-02-20T12:00:00Z',
          originalBranch: '',
          projectPath: '/not/a/repo',
          fileCount: 0,
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Not a git repository');
    });

    it('restores original state on failure', async () => {
      const { GitCheckpointService } = await import('../../services/git-checkpoint-service');

      mockGitExtractor.isGitRepo.mockReturnValue(true);
      mockGitExtractor.getRepoRoot.mockReturnValue('/test/repo');
      mockGitExtractor.getCurrentBranch.mockReturnValue('main');
      mockGitExtractor.branchExists.mockReturnValue(false);
      mockGitExtractor.createOrphanBranch.mockReturnValue(false); // Fails
      mockGitExtractor.stashChanges.mockReturnValue('stash@{0}');
      mockGitExtractor.switchBranch.mockReturnValue(true);
      mockGitExtractor.popStash.mockReturnValue(true);

      const result = await GitCheckpointService.storeCheckpoint(
        '/test/repo',
        'checkpoint-123',
        [],
        {
          checkpointId: 'checkpoint-123',
          sessionId: 'session-456',
          name: 'Test',
          frameIndex: 0,
          createdAt: '2026-02-20T12:00:00Z',
          originalBranch: '',
          projectPath: '/test/repo',
          fileCount: 0,
        }
      );

      expect(result.success).toBe(false);
      expect(mockGitExtractor.switchBranch).toHaveBeenCalledWith('/test/repo', 'main');
      expect(mockGitExtractor.popStash).toHaveBeenCalled();
    });

    it('redacts secrets before committing', async () => {
      const { GitCheckpointService } = await import('../../services/git-checkpoint-service');

      mockGitExtractor.isGitRepo.mockReturnValue(true);
      mockGitExtractor.getRepoRoot.mockReturnValue('/test/repo');
      mockGitExtractor.getCurrentBranch.mockReturnValue('main');
      mockGitExtractor.branchExists.mockReturnValue(true);
      mockGitExtractor.switchBranch.mockReturnValue(true);
      mockGitExtractor.stashChanges.mockReturnValue('no-changes');
      mockGitExtractor.commitFiles.mockReturnValue('abc123');

      mockSecretRedactor.redact.mockReturnValue('[REDACTED:API_KEY]');
      mockSecretRedactor.getLastRedactionStats.mockReturnValue({
        totalRedactions: 1,
        byPattern: { openai_key: 1 },
      });

      const result = await GitCheckpointService.storeCheckpoint(
        '/test/repo',
        'checkpoint-123',
        [{ path: 'config.ts', content: 'sk-1234567890' }],
        {
          checkpointId: 'checkpoint-123',
          sessionId: 'session-456',
          name: 'Test',
          frameIndex: 0,
          createdAt: '2026-02-20T12:00:00Z',
          originalBranch: 'main',
          projectPath: '/test/repo',
          fileCount: 1,
        }
      );

      expect(result.success).toBe(true);
      expect(result.redactionStats?.totalRedactions).toBe(1);
      expect(mockSecretRedactor.redact).toHaveBeenCalledWith('sk-1234567890');
    });
  });

  describe('exportToBranch', () => {
    it('exports checkpoint to named branch', async () => {
      const { GitCheckpointService } = await import('../../services/git-checkpoint-service');

      mockGitExtractor.isGitRepo.mockReturnValue(true);
      mockGitExtractor.getRepoRoot.mockReturnValue('/test/repo');
      mockGitExtractor.getCurrentBranch.mockReturnValue('main');
      mockGitExtractor.branchExists.mockReturnValue(false);
      mockGitExtractor.createOrphanBranch.mockReturnValue(true);
      mockGitExtractor.stashChanges.mockReturnValue('no-changes');
      mockGitExtractor.commitFiles.mockReturnValue('xyz789');
      mockGitExtractor.switchBranch.mockReturnValue(true);

      const result = await GitCheckpointService.exportToBranch(
        '/test/repo',
        'checkpoint-123',
        'before-refactor',
        [{ path: 'src/index.ts', content: 'code' }],
        {
          name: 'Before refactor',
          sessionId: 'session-456',
          frameIndex: 42,
          createdAt: '2026-02-20T12:00:00Z',
        }
      );

      expect(result.success).toBe(true);
      expect(result.branchName).toBe('recall/checkpoint/before-refactor');
      expect(result.commitSha).toBe('xyz789');
    });

    it('returns error if branch already exists', async () => {
      const { GitCheckpointService } = await import('../../services/git-checkpoint-service');

      mockGitExtractor.isGitRepo.mockReturnValue(true);
      mockGitExtractor.getRepoRoot.mockReturnValue('/test/repo');
      mockGitExtractor.getCurrentBranch.mockReturnValue('main');
      mockGitExtractor.branchExists.mockReturnValue(true); // Branch exists

      const result = await GitCheckpointService.exportToBranch(
        '/test/repo',
        'checkpoint-123',
        'existing-branch',
        [],
        {
          name: 'Test',
          sessionId: 'session-456',
          frameIndex: 0,
          createdAt: '2026-02-20T12:00:00Z',
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Branch already exists');
    });

    it('cleans up on export failure', async () => {
      const { GitCheckpointService } = await import('../../services/git-checkpoint-service');

      mockGitExtractor.isGitRepo.mockReturnValue(true);
      mockGitExtractor.getRepoRoot.mockReturnValue('/test/repo');
      mockGitExtractor.getCurrentBranch.mockReturnValue('main');
      mockGitExtractor.branchExists.mockReturnValue(false);
      mockGitExtractor.createOrphanBranch.mockReturnValue(true);
      mockGitExtractor.stashChanges.mockReturnValue('stash@{0}');
      mockGitExtractor.commitFiles.mockReturnValue(null); // Commit fails
      mockGitExtractor.switchBranch.mockReturnValue(true);
      mockGitExtractor.deleteBranch.mockReturnValue(true);
      mockGitExtractor.popStash.mockReturnValue(true);

      const result = await GitCheckpointService.exportToBranch(
        '/test/repo',
        'checkpoint-123',
        'test-branch',
        [{ path: 'file.ts', content: 'code' }],
        {
          name: 'Test',
          sessionId: 'session-456',
          frameIndex: 0,
          createdAt: '2026-02-20T12:00:00Z',
        }
      );

      expect(result.success).toBe(false);
      expect(mockGitExtractor.switchBranch).toHaveBeenCalledWith('/test/repo', 'main');
      expect(mockGitExtractor.deleteBranch).toHaveBeenCalledWith(
        '/test/repo',
        'recall/checkpoint/test-branch',
        true
      );
      expect(mockGitExtractor.popStash).toHaveBeenCalled();
    });
  });

  describe('listGitCheckpoints', () => {
    it('lists checkpoints from storage branch', async () => {
      const { GitCheckpointService } = await import('../../services/git-checkpoint-service');

      mockGitExtractor.isGitRepo.mockReturnValue(true);
      mockGitExtractor.branchExists.mockReturnValue(true);
      mockGitExtractor.getRepoRoot.mockReturnValue('/test/repo');
      mockGitExtractor.listFilesInCommit.mockReturnValue([
        'abc123/checkpoint-1/metadata.json',
        'abc123/checkpoint-1/files/src/index.ts',
        'def456/checkpoint-2/metadata.json',
      ]);
      mockGitExtractor.getFileAtCommit
        .mockReturnValueOnce(
          JSON.stringify({
            checkpointId: 'checkpoint-1',
            sessionId: 'session-1',
            name: 'First checkpoint',
            frameIndex: 10,
            createdAt: '2026-02-20T12:00:00Z',
            originalBranch: 'main',
            projectPath: '/test/repo',
            fileCount: 1,
          })
        )
        .mockReturnValueOnce(
          JSON.stringify({
            checkpointId: 'checkpoint-2',
            sessionId: 'session-2',
            name: 'Second checkpoint',
            frameIndex: 20,
            createdAt: '2026-02-20T13:00:00Z',
            originalBranch: 'develop',
            projectPath: '/test/repo',
            fileCount: 2,
          })
        );

      const checkpoints = await GitCheckpointService.listGitCheckpoints('/test/repo');

      expect(checkpoints).toHaveLength(2);
      expect(checkpoints[0].name).toBe('First checkpoint');
      expect(checkpoints[1].name).toBe('Second checkpoint');
    });

    it('returns empty array for non-git repo', async () => {
      const { GitCheckpointService } = await import('../../services/git-checkpoint-service');

      mockGitExtractor.isGitRepo.mockReturnValue(false);

      const checkpoints = await GitCheckpointService.listGitCheckpoints('/not/a/repo');

      expect(checkpoints).toEqual([]);
    });

    it('returns empty array when storage branch does not exist', async () => {
      const { GitCheckpointService } = await import('../../services/git-checkpoint-service');

      mockGitExtractor.isGitRepo.mockReturnValue(true);
      mockGitExtractor.branchExists.mockReturnValue(false);

      const checkpoints = await GitCheckpointService.listGitCheckpoints('/test/repo');

      expect(checkpoints).toEqual([]);
    });
  });

  describe('isAvailable', () => {
    it('returns true for git repository', async () => {
      const { GitCheckpointService } = await import('../../services/git-checkpoint-service');

      mockGitExtractor.isGitRepo.mockReturnValue(true);

      expect(GitCheckpointService.isAvailable('/test/repo')).toBe(true);
    });

    it('returns false for non-git directory', async () => {
      const { GitCheckpointService } = await import('../../services/git-checkpoint-service');

      mockGitExtractor.isGitRepo.mockReturnValue(false);

      expect(GitCheckpointService.isAvailable('/not/a/repo')).toBe(false);
    });
  });

  describe('getStatus', () => {
    it('returns full status for repository with checkpoints', async () => {
      const { GitCheckpointService } = await import('../../services/git-checkpoint-service');

      mockGitExtractor.isGitRepo.mockReturnValue(true);
      mockGitExtractor.branchExists.mockReturnValue(true);
      mockGitExtractor.getRepoRoot.mockReturnValue('/test/repo');
      mockGitExtractor.listFilesInCommit.mockReturnValue([
        'abc/cp1/metadata.json',
        'def/cp2/metadata.json',
        'ghi/cp3/metadata.json',
      ]);

      const status = GitCheckpointService.getStatus('/test/repo');

      expect(status).toEqual({
        available: true,
        storageBranchExists: true,
        checkpointCount: 3,
      });
    });

    it('returns unavailable status for non-git directory', async () => {
      const { GitCheckpointService } = await import('../../services/git-checkpoint-service');

      mockGitExtractor.isGitRepo.mockReturnValue(false);

      const status = GitCheckpointService.getStatus('/not/a/repo');

      expect(status).toEqual({
        available: false,
        storageBranchExists: false,
        checkpointCount: 0,
      });
    });
  });
});
