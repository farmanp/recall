import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'path';
import os from 'os';

// Track handlers separately for Claude, Gemini, and Copilot watchers
const claudeHandlers = new Map<string, (path: string) => void>();
const geminiHandlers = new Map<string, (path: string) => void>();
const copilotHandlers = new Map<string, (path: string) => void>();
const closeMocks: Array<ReturnType<typeof vi.fn>> = [];

let watchCallCount = 0;
const watchMock = vi.fn(() => {
  const currentCall = watchCallCount++;
  // 0 = Claude, 1 = Gemini, 2 = Copilot
  const handlers =
    currentCall === 0 ? claudeHandlers : currentCall === 1 ? geminiHandlers : copilotHandlers;
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
    copilotHandlers.clear();
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
    // Now creates Claude, Gemini, and Copilot watchers
    expect(watchMock).toHaveBeenCalledTimes(3);

    // Test Claude watcher handler
    const claudeAddHandler = claudeHandlers.get('add');
    expect(claudeAddHandler).toBeDefined();

    const claudePath = path.join(
      process.env.HOME!,
      '.claude',
      'projects',
      'my-project/session.jsonl'
    );
    claudeAddHandler?.(claudePath);
    expect(importTranscript).not.toHaveBeenCalled();

    vi.advanceTimersByTime(2000);
    await Promise.resolve();

    expect(importTranscript).toHaveBeenCalledWith(claudePath);

    await stopWatcher();
    expect(isWatcherRunning()).toBe(false);
    // All three watchers should be closed
    expect(closeMocks.length).toBe(3);
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
    const geminiPath = path.join(
      process.env.HOME!,
      '.gemini',
      'tmp',
      'abc123hash/chats/session-001.json'
    );
    geminiAddHandler?.(geminiPath);
    expect(importTranscript).not.toHaveBeenCalled();

    // Verify hash mapper was called with the extracted hash
    expect(geminiHashMapper.onNewSession).toHaveBeenCalledWith('abc123hash');

    vi.advanceTimersByTime(2000);
    await Promise.resolve();

    expect(importTranscript).toHaveBeenCalledWith(geminiPath, {
      agent: 'gemini',
      resolvedProjectPath: '/test/project/path',
    });

    await stopWatcher();
  });
});
