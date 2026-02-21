import { beforeEach, describe, expect, it, vi } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';

// Mock child_process and fs
vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
  },
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

const mockExecSync = vi.mocked(execSync);
const mockFs = vi.mocked(fs);

describe('GitExtractor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('read operations', () => {
    it('detects git repository', async () => {
      const { GitExtractor } = await import('../../services/git-extractor');
      mockFs.existsSync.mockReturnValue(true);
      mockExecSync.mockReturnValue('.git\n');

      expect(GitExtractor.isGitRepo('/test/repo')).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith(
        'git rev-parse --git-dir',
        expect.objectContaining({ cwd: '/test/repo' })
      );
    });

    it('returns false for non-git directory', async () => {
      const { GitExtractor } = await import('../../services/git-extractor');
      mockFs.existsSync.mockReturnValue(true);
      mockExecSync.mockImplementation(() => {
        throw new Error('not a git repo');
      });

      expect(GitExtractor.isGitRepo('/not/a/repo')).toBe(false);
    });

    it('returns false for non-existent directory', async () => {
      const { GitExtractor } = await import('../../services/git-extractor');
      mockFs.existsSync.mockReturnValue(false);

      expect(GitExtractor.isGitRepo('/nonexistent')).toBe(false);
    });

    it('extracts git context', async () => {
      const { GitExtractor } = await import('../../services/git-extractor');
      mockFs.existsSync.mockReturnValue(true);

      mockExecSync
        .mockReturnValueOnce('.git\n') // rev-parse --git-dir
        .mockReturnValueOnce('main\n') // branch --show-current
        .mockReturnValueOnce('abc1234\n') // rev-parse --short HEAD
        .mockReturnValueOnce('Initial commit\n') // log -1 --format=%s
        .mockReturnValueOnce('def5678\n') // rev-parse --short HEAD^
        .mockReturnValueOnce('M file.ts\n') // status --porcelain
        .mockReturnValueOnce('staged.ts\n') // diff --cached --name-only
        .mockReturnValueOnce('modified.ts\n') // diff --name-only
        .mockReturnValueOnce('untracked.ts\n'); // ls-files --others

      const context = GitExtractor.extractGitContext('/test/repo');

      expect(context).toEqual({
        branch: 'main',
        headCommit: 'abc1234',
        commitMessage: 'Initial commit',
        parentCommit: 'def5678',
        isDirty: true,
        stagedFiles: ['staged.ts'],
        modifiedFiles: ['modified.ts'],
        untrackedCount: 1,
      });
    });

    it('returns null for non-git directory', async () => {
      const { GitExtractor } = await import('../../services/git-extractor');
      mockFs.existsSync.mockReturnValue(true);
      mockExecSync.mockImplementation(() => {
        throw new Error('not a git repo');
      });

      expect(GitExtractor.extractGitContext('/not/a/repo')).toBeNull();
    });
  });

  describe('write operations', () => {
    it('gets repository root', async () => {
      const { GitExtractor } = await import('../../services/git-extractor');
      mockExecSync.mockReturnValue('/home/user/project\n');

      expect(GitExtractor.getRepoRoot('/home/user/project/src')).toBe('/home/user/project');
    });

    it('gets current branch', async () => {
      const { GitExtractor } = await import('../../services/git-extractor');
      mockExecSync.mockReturnValue('feature/test\n');

      expect(GitExtractor.getCurrentBranch('/test')).toBe('feature/test');
    });

    it('returns detached HEAD state', async () => {
      const { GitExtractor } = await import('../../services/git-extractor');
      mockExecSync
        .mockReturnValueOnce('') // branch --show-current returns empty
        .mockReturnValueOnce('abc1234\n'); // rev-parse --short HEAD

      expect(GitExtractor.getCurrentBranch('/test')).toBe('HEAD:abc1234');
    });

    it('checks if branch exists', async () => {
      const { GitExtractor } = await import('../../services/git-extractor');
      mockExecSync.mockReturnValue('abc1234\n');

      expect(GitExtractor.branchExists('/test', 'main')).toBe(true);
    });

    it('returns false for non-existent branch', async () => {
      const { GitExtractor } = await import('../../services/git-extractor');
      mockExecSync.mockImplementation(() => {
        throw new Error('branch not found');
      });

      expect(GitExtractor.branchExists('/test', 'nonexistent')).toBe(false);
    });

    it('creates orphan branch', async () => {
      const { GitExtractor } = await import('../../services/git-extractor');
      mockExecSync
        .mockReturnValueOnce('Switched to a new branch\n') // checkout --orphan
        .mockReturnValueOnce(''); // rm -rf .

      expect(GitExtractor.createOrphanBranch('/test', 'recall/checkpoints/v1')).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith(
        'git checkout --orphan recall/checkpoints/v1',
        expect.any(Object)
      );
    });

    it('returns false when orphan branch creation fails', async () => {
      const { GitExtractor } = await import('../../services/git-extractor');
      mockExecSync.mockImplementation(() => {
        throw new Error('checkout failed');
      });

      expect(GitExtractor.createOrphanBranch('/test', 'bad-branch')).toBe(false);
    });

    it('switches branch', async () => {
      const { GitExtractor } = await import('../../services/git-extractor');
      mockExecSync.mockReturnValue('Switched to branch\n');

      expect(GitExtractor.switchBranch('/test', 'main')).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith('git checkout  main', expect.any(Object));
    });

    it('switches branch with create flag', async () => {
      const { GitExtractor } = await import('../../services/git-extractor');
      mockExecSync.mockReturnValue('Switched to branch\n');

      expect(GitExtractor.switchBranch('/test', 'new-branch', true)).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith('git checkout -B new-branch', expect.any(Object));
    });

    it('stashes changes', async () => {
      const { GitExtractor } = await import('../../services/git-extractor');
      mockExecSync
        .mockReturnValueOnce('M file.ts\n') // status --porcelain
        .mockReturnValueOnce('Saved working directory\n') // stash push
        .mockReturnValueOnce('stash@{0}: my-stash\n'); // stash list

      const result = GitExtractor.stashChanges('/test', 'my-stash');
      expect(result).toBe('stash@{0}');
    });

    it('returns no-changes when nothing to stash', async () => {
      const { GitExtractor } = await import('../../services/git-extractor');
      mockExecSync.mockReturnValueOnce(''); // status --porcelain (empty)

      expect(GitExtractor.stashChanges('/test')).toBe('no-changes');
    });

    it('pops stash', async () => {
      const { GitExtractor } = await import('../../services/git-extractor');
      mockExecSync.mockReturnValue('Dropped stash\n');

      expect(GitExtractor.popStash('/test', 'stash@{0}')).toBe(true);
    });

    it('returns true for no-changes stash', async () => {
      const { GitExtractor } = await import('../../services/git-extractor');

      expect(GitExtractor.popStash('/test', 'no-changes')).toBe(true);
      expect(mockExecSync).not.toHaveBeenCalled();
    });

    it('commits files', async () => {
      const { GitExtractor } = await import('../../services/git-extractor');
      mockFs.existsSync.mockReturnValue(true);
      mockExecSync
        .mockReturnValueOnce('') // git add file1
        .mockReturnValueOnce('') // git add file2
        .mockReturnValueOnce('[main abc1234] commit message\n') // git commit
        .mockReturnValueOnce('abc1234567890\n'); // rev-parse HEAD

      const files = new Map([
        ['src/index.ts', 'console.log("hello");'],
        ['src/utils.ts', 'export const util = 1;'],
      ]);

      const result = GitExtractor.commitFiles('/test', files, 'Test commit');

      expect(result).toBe('abc1234567890');
      expect(mockFs.writeFileSync).toHaveBeenCalledTimes(2);
    });

    it('returns null when commit fails', async () => {
      const { GitExtractor } = await import('../../services/git-extractor');
      mockFs.existsSync.mockReturnValue(true);
      mockExecSync.mockImplementation(() => {
        throw new Error('commit failed');
      });

      const files = new Map([['file.ts', 'content']]);
      expect(GitExtractor.commitFiles('/test', files, 'message')).toBeNull();
    });

    it('gets file at commit', async () => {
      const { GitExtractor } = await import('../../services/git-extractor');
      mockExecSync.mockReturnValue('file content here\n');

      const result = GitExtractor.getFileAtCommit('/test', 'abc1234', 'src/file.ts');
      expect(result).toBe('file content here');
      expect(mockExecSync).toHaveBeenCalledWith('git show abc1234:src/file.ts', expect.any(Object));
    });

    it('lists files in commit', async () => {
      const { GitExtractor } = await import('../../services/git-extractor');
      mockExecSync.mockReturnValue('file1.ts\nfile2.ts\nfile3.ts\n');

      const result = GitExtractor.listFilesInCommit('/test', 'abc1234');
      expect(result).toEqual(['file1.ts', 'file2.ts', 'file3.ts']);
    });

    it('checks if working directory is clean', async () => {
      const { GitExtractor } = await import('../../services/git-extractor');
      mockExecSync.mockReturnValue('');

      expect(GitExtractor.isClean('/test')).toBe(true);
    });

    it('detects dirty working directory', async () => {
      const { GitExtractor } = await import('../../services/git-extractor');
      mockExecSync.mockReturnValue('M file.ts\n');

      expect(GitExtractor.isClean('/test')).toBe(false);
    });

    it('deletes branch', async () => {
      const { GitExtractor } = await import('../../services/git-extractor');
      mockExecSync.mockReturnValue('Deleted branch\n');

      expect(GitExtractor.deleteBranch('/test', 'old-branch')).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith('git branch -d old-branch', expect.any(Object));
    });

    it('force deletes branch', async () => {
      const { GitExtractor } = await import('../../services/git-extractor');
      mockExecSync.mockReturnValue('Deleted branch\n');

      expect(GitExtractor.deleteBranch('/test', 'old-branch', true)).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith('git branch -D old-branch', expect.any(Object));
    });
  });
});
