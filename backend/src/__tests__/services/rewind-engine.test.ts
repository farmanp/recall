import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rewindQueries: {
    insertRewindHistory: vi.fn(),
    getLastUndoableRewind: vi.fn(),
    markRewindAsUsed: vi.fn(),
  },
}));

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'rewind-uuid'),
}));

vi.mock('../../db/rewind-queries', () => mocks.rewindQueries);

describe('rewind-engine', () => {
  let cwd: string;

  beforeEach(() => {
    vi.clearAllMocks();
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'recall-rewind-'));
  });

  afterEach(() => {
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  it('returns warning when cwd does not exist', async () => {
    const { RewindEngine } = await import('../../services/rewind-engine');
    const plan = await RewindEngine.previewRewind('s1', 0, [], path.join(cwd, 'missing'));
    expect(plan.warnings[0]).toContain('Working directory does not exist');
  });

  it('returns warning for out-of-bounds frame index', async () => {
    const { RewindEngine } = await import('../../services/rewind-engine');
    const plan = await RewindEngine.previewRewind('s1', 3, [{ type: 'user_message' } as any], cwd);
    expect(plan.warnings[0]).toContain('out of bounds');
  });

  it('creates rewind preview with create/modify/skip/conflict actions', async () => {
    const { RewindEngine } = await import('../../services/rewind-engine');
    const existingPath = path.join(cwd, 'existing.ts');
    const samePath = path.join(cwd, 'same.ts');
    fs.writeFileSync(existingPath, 'old', 'utf8');
    fs.writeFileSync(samePath, 'same', 'utf8');

    const frames: any[] = [
      {
        type: 'tool_execution',
        toolExecution: { tool: 'Write', input: { file_path: 'new.ts', content: 'new-content' } },
      },
      {
        type: 'tool_execution',
        toolExecution: { tool: 'Write', input: { file_path: 'existing.ts', content: 'newer' } },
      },
      {
        type: 'tool_execution',
        toolExecution: { tool: 'Write', input: { file_path: 'same.ts', content: 'same' } },
      },
      {
        type: 'tool_execution',
        toolExecution: { tool: 'Write', input: { file_path: '../outside.ts', content: 'x' } },
      },
    ];

    const plan = await RewindEngine.previewRewind('s1', 3, frames, cwd);
    expect(plan.summary.totalFiles).toBe(3);
    expect(plan.summary.conflictCount).toBe(1);
    expect(plan.files.find((f) => f.path === 'new.ts')?.action).toBe('create');
    expect(plan.files.find((f) => f.path === 'existing.ts')?.action).toBe('modify');
    expect(plan.files.find((f) => f.path === 'same.ts')?.action).toBe('skip');
  });

  it('supports dry-run execution', async () => {
    const { RewindEngine } = await import('../../services/rewind-engine');
    const result = await RewindEngine.executeRewind(
      {
        sessionId: 's1',
        frameIndex: 0,
        cwd,
        files: [
          { path: 'a.ts', absolutePath: path.join(cwd, 'a.ts'), action: 'create', content: 'a' },
          {
            path: 'b.ts',
            absolutePath: path.join(cwd, 'b.ts'),
            action: 'skip',
            reason: 'noop',
            currentContent: 'x',
          },
        ],
        conflicts: [],
        warnings: [],
        summary: {
          totalFiles: 2,
          filesToCreate: 1,
          filesToModify: 0,
          filesToDelete: 0,
          filesToSkip: 1,
          conflictCount: 0,
        },
      } as any,
      { dryRun: true, createBackups: true, skipConflicts: false }
    );

    expect(result.success).toBe(true);
    expect(result.filesRestored).toBe(1);
    expect(result.filesSkipped).toBe(1);
    expect(result.message).toContain('Dry run');
  });

  it('aborts execution when conflicts exist and skipConflicts is false', async () => {
    const { RewindEngine } = await import('../../services/rewind-engine');
    const result = await RewindEngine.executeRewind(
      {
        sessionId: 's1',
        frameIndex: 0,
        cwd,
        files: [],
        conflicts: [{ path: 'a.ts' }],
        warnings: [],
        summary: {
          totalFiles: 0,
          filesToCreate: 0,
          filesToModify: 0,
          filesToDelete: 0,
          filesToSkip: 0,
          conflictCount: 1,
        },
      } as any,
      { dryRun: false, createBackups: true, skipConflicts: false }
    );
    expect(result.success).toBe(false);
    expect(result.message).toContain('aborted');
  });

  it('executes create/modify/delete and stores history', async () => {
    const { RewindEngine } = await import('../../services/rewind-engine');
    const existing = path.join(cwd, 'mod.ts');
    const delDir = path.join(cwd, 'x', 'y');
    const deleting = path.join(delDir, 'del.ts');
    fs.mkdirSync(delDir, { recursive: true });
    fs.writeFileSync(existing, 'old', 'utf8');
    fs.writeFileSync(deleting, 'to-delete', 'utf8');

    const result = await RewindEngine.executeRewind(
      {
        sessionId: 's1',
        checkpointId: 'cp1',
        frameIndex: 7,
        cwd,
        files: [
          {
            path: 'new.ts',
            absolutePath: path.join(cwd, 'new.ts'),
            action: 'create',
            content: 'new',
          },
          {
            path: 'mod.ts',
            absolutePath: existing,
            action: 'modify',
            content: 'updated',
            currentContent: 'old',
          },
          {
            path: 'x/y/del.ts',
            absolutePath: deleting,
            action: 'delete',
            currentContent: 'to-delete',
          },
          {
            path: 'skip.ts',
            absolutePath: path.join(cwd, 'skip.ts'),
            action: 'skip',
            reason: 'conflict',
          },
        ],
        conflicts: [],
        warnings: [],
        summary: {
          totalFiles: 4,
          filesToCreate: 1,
          filesToModify: 1,
          filesToDelete: 1,
          filesToSkip: 1,
          conflictCount: 0,
        },
      } as any,
      { dryRun: false, createBackups: true, skipConflicts: true }
    );

    expect(result.success).toBe(true);
    expect(result.filesRestored).toBe(3);
    expect(result.filesSkipped).toBe(1);
    expect(fs.readFileSync(path.join(cwd, 'new.ts'), 'utf8')).toBe('new');
    expect(fs.readFileSync(existing, 'utf8')).toBe('updated');
    expect(fs.existsSync(deleting)).toBe(false);
    expect(result.backupsCreated.length).toBeGreaterThan(0);
    expect(mocks.rewindQueries.insertRewindHistory).toHaveBeenCalledTimes(1);
  });

  it('handles write errors during execution', async () => {
    const { RewindEngine } = await import('../../services/rewind-engine');
    const spy = vi.spyOn(fs, 'writeFileSync').mockImplementationOnce(() => {
      throw new Error('disk full');
    });

    const result = await RewindEngine.executeRewind(
      {
        sessionId: 's1',
        frameIndex: 0,
        cwd,
        files: [
          {
            path: 'a.ts',
            absolutePath: path.join(cwd, 'a.ts'),
            action: 'create',
            content: 'x',
          },
        ],
        conflicts: [],
        warnings: [],
        summary: {
          totalFiles: 1,
          filesToCreate: 1,
          filesToModify: 0,
          filesToDelete: 0,
          filesToSkip: 0,
          conflictCount: 0,
        },
      } as any,
      { dryRun: false, createBackups: false, skipConflicts: true }
    );

    spy.mockRestore();
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('disk full');
  });

  it('returns no-op undo when there is no undoable rewind', async () => {
    const { RewindEngine } = await import('../../services/rewind-engine');
    mocks.rewindQueries.getLastUndoableRewind.mockReturnValue(null);
    const result = await RewindEngine.undoLastRewind('s1');
    expect(result.success).toBe(false);
    expect(result.message).toContain('No undoable rewind');
  });

  it('marks rewind used when undo has no backups', async () => {
    const { RewindEngine } = await import('../../services/rewind-engine');
    mocks.rewindQueries.getLastUndoableRewind.mockReturnValue({
      id: 'r1',
      backupsCreated: {},
      cwd,
    });
    const result = await RewindEngine.undoLastRewind('s1');
    expect(result.message).toContain('No backups available');
    expect(mocks.rewindQueries.markRewindAsUsed).toHaveBeenCalledWith('r1');
  });

  it('restores backups on undo and reports missing backups', async () => {
    const { RewindEngine } = await import('../../services/rewind-engine');
    const backupGood = path.join(cwd, 'good.bak');
    const backupMissing = path.join(cwd, 'missing.bak');
    fs.writeFileSync(backupGood, 'restored', 'utf8');
    mocks.rewindQueries.getLastUndoableRewind.mockReturnValue({
      id: 'r2',
      cwd,
      backupsCreated: {
        'dir/file.ts': backupGood,
        'dir/missing.ts': backupMissing,
      },
    });

    const result = await RewindEngine.undoLastRewind('s1');
    expect(result.success).toBe(false);
    expect(result.filesRestored).toBe(1);
    expect(result.errors.length).toBe(1);
    expect(fs.readFileSync(path.join(cwd, 'dir/file.ts'), 'utf8')).toBe('restored');
    expect(mocks.rewindQueries.markRewindAsUsed).toHaveBeenCalledWith('r2');
  });

  it('returns undo info from last rewind entry', async () => {
    const { RewindEngine } = await import('../../services/rewind-engine');
    mocks.rewindQueries.getLastUndoableRewind.mockReturnValueOnce(null);
    expect(RewindEngine.getUndoInfo('s1')).toEqual({ canUndo: false });

    mocks.rewindQueries.getLastUndoableRewind.mockReturnValueOnce({
      id: 'r3',
      executedAt: '2026-01-01T00:00:00.000Z',
      filesModified: ['a.ts', 'b.ts'],
    });
    const info = RewindEngine.getUndoInfo('s1');
    expect(info.canUndo).toBe(true);
    expect(info.lastRewindId).toBe('r3');
    expect(info.filesCount).toBe(2);
  });
});
