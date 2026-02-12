import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'path';
import os from 'os';

// Track handlers separately for Claude and Gemini watchers
const claudeHandlers = new Map<string, (path: string) => void>();
const geminiHandlers = new Map<string, (path: string) => void>();
const closeMocks: Array<ReturnType<typeof vi.fn>> = [];

let watchCallCount = 0;
const watchMock = vi.fn(() => {
  const currentCall = watchCallCount++;
  const isClaudeWatcher = currentCall === 0;
  const handlers = isClaudeWatcher ? claudeHandlers : geminiHandlers;
  const closeMock = vi.fn().mockResolvedValue(undefined);
  closeMocks.push(closeMock);

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

const importTranscriptMock = vi.fn().mockResolvedValue(undefined);
const onNewSessionMock = vi.fn().mockReturnValue('/test/project/path');

vi.mock('../../services/transcript-importer', () => ({
  importTranscript: importTranscriptMock,
}));

vi.mock('../../services/gemini-hash-mapper', () => ({
  geminiHashMapper: {
    onNewSession: onNewSessionMock,
  },
}));

describe('file-watcher', () => {
  const originalHome = process.env.HOME;

  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    claudeHandlers.clear();
    geminiHandlers.clear();
    closeMocks.length = 0;
    watchCallCount = 0;
    watchMock.mockClear();
    importTranscriptMock.mockClear();
    onNewSessionMock.mockClear();
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
    // Now creates both Claude and Gemini watchers
    expect(watchMock).toHaveBeenCalledTimes(2);

    // Test Claude watcher handler
    const claudeAddHandler = claudeHandlers.get('add');
    expect(claudeAddHandler).toBeDefined();

    claudeAddHandler?.('my-project/session.jsonl');
    expect(importTranscript).not.toHaveBeenCalled();

    vi.advanceTimersByTime(2000);
    await Promise.resolve();

    expect(importTranscript).toHaveBeenCalledWith(
      path.join(process.env.HOME!, '.claude', 'projects', 'my-project/session.jsonl')
    );

    await stopWatcher();
    expect(isWatcherRunning()).toBe(false);
    // Both watchers should be closed
    expect(closeMocks.length).toBe(2);
    closeMocks.forEach((mock) => {
      expect(mock).toHaveBeenCalledTimes(1);
    });
  });

  it('handles Gemini sessions with hash extraction', async () => {
    const { startWatcher, stopWatcher, isWatcherRunning } =
      await import('../../services/file-watcher');
    const { importTranscript } = await import('../../services/transcript-importer');
    const { geminiHashMapper } = await import('../../services/gemini-hash-mapper');

    startWatcher();
    expect(isWatcherRunning()).toBe(true);

    // Test Gemini watcher handler
    const geminiAddHandler = geminiHandlers.get('add');
    expect(geminiAddHandler).toBeDefined();

    // Simulate a new Gemini session file
    geminiAddHandler?.('abc123hash/chats/session-001.json');
    expect(importTranscript).not.toHaveBeenCalled();

    // Verify hash mapper was called with the extracted hash
    expect(geminiHashMapper.onNewSession).toHaveBeenCalledWith('abc123hash');

    vi.advanceTimersByTime(2000);
    await Promise.resolve();

    expect(importTranscript).toHaveBeenCalledWith(
      path.join(process.env.HOME!, '.gemini', 'tmp', 'abc123hash/chats/session-001.json'),
      {
        agent: 'gemini',
        resolvedProjectPath: '/test/project/path',
      }
    );

    await stopWatcher();
  });
});
