import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  checkpointQueries: {
    initializeCheckpointSchema: vi.fn(),
    insertCheckpoint: vi.fn(),
    insertCheckpointFiles: vi.fn(),
    getCheckpointById: vi.fn(),
    getCheckpointWithFiles: vi.fn(),
    getCheckpointFiles: vi.fn(),
    getSessionCheckpoints: vi.fn(),
    deleteCheckpoint: vi.fn(),
    updateCheckpoint: vi.fn(),
    checkpointExists: vi.fn(),
  },
}));

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'checkpoint-uuid'),
}));

vi.mock('../../db/checkpoint-queries', () => mocks.checkpointQueries);

describe('checkpoint-manager', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('computes deterministic hashes', async () => {
    const { CheckpointManager } = await import('../../services/checkpoint-manager');
    expect(CheckpointManager.computeHash('abc')).toBe(CheckpointManager.computeHash('abc'));
    expect(CheckpointManager.computeHash('abc')).not.toBe(CheckpointManager.computeHash('abcd'));
  });

  it('reconstructs file states from write/edit tools', async () => {
    const { CheckpointManager } = await import('../../services/checkpoint-manager');
    const frames: any[] = [
      {
        type: 'tool_execution',
        toolExecution: { tool: 'Write', input: { file_path: 'a.ts', content: 'one' } },
      },
      {
        type: 'tool_execution',
        toolExecution: {
          tool: 'Edit',
          input: { file_path: 'a.ts', old_string: 'one', new_string: 'two' },
        },
      },
      {
        type: 'tool_execution',
        toolExecution: {
          tool: 'Write',
          input: { file_path: 'b.ts', content: 'x' },
        },
      },
      {
        type: 'tool_execution',
        toolExecution: {
          tool: 'Edit',
          input: { file_path: 'b.ts' },
          fileDiff: { newContent: 'y' },
        },
      },
      {
        type: 'tool_execution',
        toolExecution: {
          tool: 'NotebookEdit',
          input: { notebook_path: 'notebook.ipynb' },
        },
      },
    ];

    const states = CheckpointManager.reconstructFileStates(frames, 4);
    expect(states.get('a.ts')).toEqual({ content: 'two', status: 'modified' });
    expect(states.get('b.ts')).toEqual({ content: 'y', status: 'modified' });
    expect(states.has('notebook.ipynb')).toBe(false);
  });

  it('creates checkpoint and persists files', async () => {
    const { CheckpointManager } = await import('../../services/checkpoint-manager');
    mocks.checkpointQueries.insertCheckpoint.mockReturnValue({
      id: 'checkpoint-uuid',
      sessionId: 'session-1',
      name: 'before',
      frameIndex: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    const frames: any[] = [
      {
        type: 'tool_execution',
        toolExecution: {
          tool: 'Write',
          input: { file_path: 'src/index.ts', content: 'console.log(1);' },
        },
      },
    ];

    const checkpoint = await CheckpointManager.createCheckpoint('session-1', 0, 'before', frames);

    expect(mocks.checkpointQueries.initializeCheckpointSchema).toHaveBeenCalledTimes(1);
    expect(mocks.checkpointQueries.insertCheckpoint).toHaveBeenCalledTimes(1);
    expect(mocks.checkpointQueries.insertCheckpointFiles).toHaveBeenCalledTimes(1);
    expect(checkpoint.id).toBe('checkpoint-uuid');
    expect(checkpoint.fileCount).toBe(1);
    expect(checkpoint.files[0].path).toBe('src/index.ts');
    expect(checkpoint.files[0].contentHash).toHaveLength(64);
  });

  it('returns null when comparing missing checkpoints', async () => {
    const { CheckpointManager } = await import('../../services/checkpoint-manager');
    mocks.checkpointQueries.getCheckpointById.mockReturnValueOnce(null);
    expect(CheckpointManager.compareCheckpoints('a', 'b')).toBeNull();
  });

  it('compares checkpoints and classifies file changes', async () => {
    const { CheckpointManager } = await import('../../services/checkpoint-manager');
    mocks.checkpointQueries.getCheckpointById
      .mockReturnValueOnce({ id: 'a' })
      .mockReturnValueOnce({ id: 'b' });
    mocks.checkpointQueries.getCheckpointFiles
      .mockReturnValueOnce([
        { path: 'same.ts', contentHash: '1' },
        { path: 'removed.ts', contentHash: '2' },
        { path: 'changed.ts', contentHash: '3' },
      ])
      .mockReturnValueOnce([
        { path: 'same.ts', contentHash: '1' },
        { path: 'added.ts', contentHash: '4' },
        { path: 'changed.ts', contentHash: '5' },
      ]);

    const diff = CheckpointManager.compareCheckpoints('a', 'b');
    expect(diff?.addedFiles).toEqual(['added.ts']);
    expect(diff?.removedFiles).toEqual(['removed.ts']);
    expect(diff?.modifiedFiles).toEqual(['changed.ts']);
    expect(diff?.unchangedFiles).toEqual(['same.ts']);
  });

  it('returns detailed file diff statuses', async () => {
    const { CheckpointManager } = await import('../../services/checkpoint-manager');
    mocks.checkpointQueries.getCheckpointFiles
      .mockReturnValueOnce([{ path: 'x.ts', content: 'old', contentHash: 'h1' }])
      .mockReturnValueOnce([{ path: 'x.ts', content: 'new', contentHash: 'h2' }]);
    expect(CheckpointManager.getFileDiff('a', 'b', 'x.ts')?.status).toBe('modified');

    mocks.checkpointQueries.getCheckpointFiles
      .mockReturnValueOnce([])
      .mockReturnValueOnce([{ path: 'x.ts', content: 'new', contentHash: 'h2' }]);
    expect(CheckpointManager.getFileDiff('a', 'b', 'x.ts')?.status).toBe('added');

    mocks.checkpointQueries.getCheckpointFiles
      .mockReturnValueOnce([{ path: 'x.ts', content: 'old', contentHash: 'h1' }])
      .mockReturnValueOnce([]);
    expect(CheckpointManager.getFileDiff('a', 'b', 'x.ts')?.status).toBe('removed');
  });

  it('finds single checkpoint file by path', async () => {
    const { CheckpointManager } = await import('../../services/checkpoint-manager');
    mocks.checkpointQueries.getCheckpointFiles.mockReturnValue([{ path: 'a.ts', content: 'x' }]);
    expect(CheckpointManager.getCheckpointFile('id', 'a.ts')).toEqual({
      path: 'a.ts',
      content: 'x',
    });
    expect(CheckpointManager.getCheckpointFile('id', 'missing.ts')).toBeNull();
  });
});
