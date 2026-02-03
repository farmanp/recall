import chokidar, { FSWatcher } from 'chokidar';
import path from 'path';
import os from 'os';
import { importTranscript } from './transcript-importer';

/**
 * File watcher instance
 */
let watcher: FSWatcher | null = null;

/**
 * Debounce timers for file changes
 * Maps file path to timeout ID
 */
const debounceTimers: Map<string, NodeJS.Timeout> = new Map();

/**
 * Debounce delay in milliseconds
 */
const DEBOUNCE_DELAY = 2000;

/**
 * Directory to watch for Claude project files
 */
const WATCH_DIR = path.join(os.homedir(), '.claude', 'projects');

/**
 * Handles a file change event with debouncing
 *
 * @param filePath - Absolute path to the changed file
 */
function handleFileChange(filePath: string): void {
  // Clear existing timer for this file
  const existingTimer = debounceTimers.get(filePath);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  // Set new timer
  const timer = setTimeout(async () => {
    try {
      console.log(`[FileWatcher] Importing transcript from: ${filePath}`);
      await importTranscript(filePath);
      console.log(`[FileWatcher] Successfully imported: ${filePath}`);
      debounceTimers.delete(filePath);
    } catch (error) {
      console.error(`[FileWatcher] Error importing ${filePath}:`, error);
      debounceTimers.delete(filePath);
    }
  }, DEBOUNCE_DELAY);

  debounceTimers.set(filePath, timer);
}

/**
 * Starts watching the Claude projects directory for new .jsonl files
 *
 * When a .jsonl file is added or modified, it will be automatically
 * imported after a 2-second debounce period.
 *
 * @throws Error if watcher is already running
 */
export function startWatcher(): void {
  if (watcher) {
    console.warn('[FileWatcher] Watcher is already running');
    return;
  }

  console.log(`[FileWatcher] Starting file watcher on: ${WATCH_DIR}`);

  try {
    watcher = chokidar.watch('*.jsonl', {
      cwd: WATCH_DIR,
      persistent: true,
      ignoreInitial: false,
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100
      },
      depth: 0, // Only watch the projects directory, not subdirectories
    });

    watcher
      .on('add', (relativePath: string) => {
        const absolutePath = path.join(WATCH_DIR, relativePath);
        console.log(`[FileWatcher] New file detected: ${relativePath}`);
        handleFileChange(absolutePath);
      })
      .on('change', (relativePath: string) => {
        const absolutePath = path.join(WATCH_DIR, relativePath);
        console.log(`[FileWatcher] File changed: ${relativePath}`);
        handleFileChange(absolutePath);
      })
      .on('error', (error: unknown) => {
        console.error('[FileWatcher] Watcher error:', error);
      })
      .on('ready', () => {
        console.log('[FileWatcher] Initial scan complete. Ready for changes.');
      });

  } catch (error) {
    console.error('[FileWatcher] Failed to start watcher:', error);
    watcher = null;
    throw error;
  }
}

/**
 * Stops the file watcher and cleans up resources
 *
 * Clears all pending debounce timers and closes the watcher instance.
 */
export async function stopWatcher(): Promise<void> {
  if (!watcher) {
    console.warn('[FileWatcher] No watcher running');
    return;
  }

  console.log('[FileWatcher] Stopping file watcher...');

  // Clear all debounce timers
  for (const timer of debounceTimers.values()) {
    clearTimeout(timer);
  }
  debounceTimers.clear();

  // Close the watcher
  try {
    await watcher.close();
    watcher = null;
    console.log('[FileWatcher] File watcher stopped');
  } catch (error) {
    console.error('[FileWatcher] Error stopping watcher:', error);
    watcher = null;
    throw error;
  }
}

/**
 * Returns whether the watcher is currently running
 *
 * @returns True if watcher is active, false otherwise
 */
export function isWatcherRunning(): boolean {
  return watcher !== null;
}
