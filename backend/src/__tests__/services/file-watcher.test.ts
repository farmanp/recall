import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'path';
import os from 'os';

const handlers = new Map<string, (path: string) => void>();
const closeMock = vi.fn().mockResolvedValue(undefined);
const watchMock = vi.fn(() => {
  const watcher = {
    on: (event: string, callback: (relativePath: string) => void) => {
      handlers.set(event, callback);
      return watcher;
    },
    close: closeMock,
  };
  return watcher;
});

vi.mock('chokidar', () => ({
  default: { watch: watchMock },
  watch: watchMock,
}));

vi.mock('../../services/transcript-importer', () => ({
  importTranscript: vi.fn().mockResolvedValue(undefined),
}));

describe('file-watcher', () => {
  const originalHome = process.env.HOME;

  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    handlers.clear();
    watchMock.mockClear();
    closeMock.mockClear();
    process.env.HOME = path.join(os.tmpdir(), 'recall-watcher-home');
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env.HOME = originalHome;
  });

  it('starts and stops the watcher, handling debounced imports', async () => {
    const { startWatcher, stopWatcher, isWatcherRunning } =
      await import('../../services/file-watcher');
    const { importTranscript } = await import('../../services/transcript-importer');

    expect(isWatcherRunning()).toBe(false);
    startWatcher();
    expect(isWatcherRunning()).toBe(true);
    expect(watchMock).toHaveBeenCalledTimes(1);

    const addHandler = handlers.get('add');
    expect(addHandler).toBeDefined();

    addHandler?.('session.jsonl');
    expect(importTranscript).not.toHaveBeenCalled();

    vi.advanceTimersByTime(2000);
    await Promise.resolve();

    expect(importTranscript).toHaveBeenCalledWith(
      path.join(process.env.HOME!, '.claude', 'projects', 'session.jsonl')
    );

    await stopWatcher();
    expect(isWatcherRunning()).toBe(false);
    expect(closeMock).toHaveBeenCalledTimes(1);
  });
});
