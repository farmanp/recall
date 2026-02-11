import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  connection: {
    getDbInstance: vi.fn(),
  },
  claudemdQueries: {
    getClaudeMdSnapshotByHash: vi.fn(),
    createClaudeMdSnapshot: vi.fn(),
    linkSessionToClaudeMd: vi.fn(),
  },
  transactionFn: vi.fn(),
}));

vi.mock('../../db/connection', () => mocks.connection);
vi.mock('../../db/claudemd-queries', () => mocks.claudemdQueries);

describe('claudemd-storage', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('computes deterministic sha256 hashes', async () => {
    const { ClaudeMdStorage } = await import('../../services/claudemd-storage');
    expect(ClaudeMdStorage.computeHash('abc')).toBe(ClaudeMdStorage.computeHash('abc'));
    expect(ClaudeMdStorage.computeHash('abc')).not.toBe(ClaudeMdStorage.computeHash('abcd'));
  });

  it('no-ops on empty input or missing db', async () => {
    const { ClaudeMdStorage } = await import('../../services/claudemd-storage');
    mocks.connection.getDbInstance.mockReturnValue(null);
    ClaudeMdStorage.storeClaudeMdFiles('s1', []);
    ClaudeMdStorage.storeClaudeMdFiles('s1', [
      { path: '/tmp/CLAUDE.md', loadedAt: '2026-01-01T00:00:00.000Z', content: 'x' },
    ]);
    expect(mocks.claudemdQueries.getClaudeMdSnapshotByHash).not.toHaveBeenCalled();
  });

  it('stores new snapshots and links sessions', async () => {
    const { ClaudeMdStorage } = await import('../../services/claudemd-storage');
    mocks.connection.getDbInstance.mockReturnValue({
      transaction: (fn: (files: any[]) => void) => (files: any[]) => fn(files),
    });
    mocks.claudemdQueries.getClaudeMdSnapshotByHash.mockReturnValue(null);
    mocks.claudemdQueries.createClaudeMdSnapshot.mockReturnValue({ id: 123 });

    ClaudeMdStorage.storeClaudeMdFiles('s1', [
      {
        path: '/tmp/CLAUDE.md',
        loadedAt: '2026-01-01T00:00:00.000Z',
        content: 'hello',
      },
    ] as any);

    expect(mocks.claudemdQueries.createClaudeMdSnapshot).toHaveBeenCalledTimes(1);
    expect(mocks.claudemdQueries.linkSessionToClaudeMd).toHaveBeenCalledWith(
      's1',
      123,
      '/tmp/CLAUDE.md',
      '2026-01-01T00:00:00.000Z'
    );
  });

  it('uses existing snapshots and skips files without content', async () => {
    const { ClaudeMdStorage } = await import('../../services/claudemd-storage');
    mocks.connection.getDbInstance.mockReturnValue({
      transaction: (fn: (files: any[]) => void) => (files: any[]) => fn(files),
    });
    mocks.claudemdQueries.getClaudeMdSnapshotByHash.mockReturnValue({ id: 77 });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    ClaudeMdStorage.storeClaudeMdFiles('s1', [
      { path: '/tmp/empty.md', loadedAt: '2026-01-01T00:00:00.000Z', content: '' },
      {
        path: '/tmp/CLAUDE.md',
        loadedAt: '2026-01-01T00:00:00.000Z',
        content: 'ok',
        contentHash: 'provided-hash',
      },
    ] as any);

    expect(mocks.claudemdQueries.createClaudeMdSnapshot).not.toHaveBeenCalled();
    expect(mocks.claudemdQueries.getClaudeMdSnapshotByHash).toHaveBeenCalledWith('provided-hash');
    expect(mocks.claudemdQueries.linkSessionToClaudeMd).toHaveBeenCalledWith(
      's1',
      77,
      '/tmp/CLAUDE.md',
      '2026-01-01T00:00:00.000Z'
    );
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('supports single-file convenience method', async () => {
    const { ClaudeMdStorage } = await import('../../services/claudemd-storage');
    mocks.connection.getDbInstance.mockReturnValue({
      transaction: (fn: (files: any[]) => void) => (files: any[]) => fn(files),
    });
    mocks.claudemdQueries.getClaudeMdSnapshotByHash.mockReturnValue({ id: 5 });

    ClaudeMdStorage.storeClaudeMdFile('s1', {
      path: '/tmp/CLAUDE.md',
      loadedAt: '2026-01-01T00:00:00.000Z',
      content: 'x',
    } as any);

    expect(mocks.claudemdQueries.linkSessionToClaudeMd).toHaveBeenCalledWith(
      's1',
      5,
      '/tmp/CLAUDE.md',
      '2026-01-01T00:00:00.000Z'
    );
  });
});
