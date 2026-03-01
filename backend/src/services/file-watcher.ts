import chokidar, { FSWatcher } from 'chokidar';
import path from 'path';
import os from 'os';
import { importTranscript } from './transcript-importer';
import { geminiHashMapper } from './gemini-hash-mapper';
import { getSessionIndexer } from '../parser/session-indexer';

/**
 * File watcher instances
 */
let claudeWatcher: FSWatcher | null = null;
let geminiWatcher: FSWatcher | null = null;
let copilotWatcher: FSWatcher | null = null;

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
const CLAUDE_WATCH_DIR = path.join(os.homedir(), '.claude', 'projects');

/**
 * Directory to watch for Gemini session files
 */
const GEMINI_WATCH_DIR = path.join(os.homedir(), '.gemini', 'tmp');

/**
 * Directory to watch for Copilot session files
 */
const COPILOT_WATCH_DIR = path.join(os.homedir(), '.copilot', 'session-state');

/**
 * Handles a file change event with debouncing
 *
 * @param filePath - Absolute path to the changed file
 */
function handleFileChange(filePath: string): void {
  // Invalidate session indexer cache so new sessions appear immediately
  getSessionIndexer().invalidateCache();

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
 * Handles a Gemini file change event with debouncing
 *
 * Extracts the hash from the file path, resolves the project path
 * via the hash mapper, and imports the transcript.
 *
 * @param filePath - Absolute path to the changed Gemini session file
 */
function handleGeminiFileChange(filePath: string): void {
  // Invalidate session indexer cache so new sessions appear immediately
  getSessionIndexer().invalidateCache();

  // Extract hash from path like: ~/.gemini/tmp/{hash}/chats/session-001.json
  const parts = filePath.split(path.sep);
  const tmpIndex = parts.lastIndexOf('tmp');
  const hash = tmpIndex >= 0 && tmpIndex + 1 < parts.length ? parts[tmpIndex + 1] : undefined;

  if (!hash) {
    console.warn('[FileWatcher] Could not extract hash from Gemini path:', filePath);
    return;
  }

  // Get resolved project path from the hash mapper
  const resolvedProjectPath = geminiHashMapper.onNewSession(hash);

  if (resolvedProjectPath) {
    console.log(`[FileWatcher] Gemini session resolved to project: ${resolvedProjectPath}`);
  } else {
    console.log(`[FileWatcher] Gemini session hash not yet mapped: ${hash}`);
  }

  // Clear existing timer for this file
  const existingTimer = debounceTimers.get(filePath);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  // Set new timer
  const timer = setTimeout(async () => {
    try {
      console.log(`[FileWatcher] Importing Gemini transcript from: ${filePath}`);
      await importTranscript(filePath, {
        agent: 'gemini',
        resolvedProjectPath,
      });
      console.log(`[FileWatcher] Successfully imported Gemini session: ${filePath}`);
      debounceTimers.delete(filePath);
    } catch (error) {
      console.error(`[FileWatcher] Error importing Gemini session ${filePath}:`, error);
      debounceTimers.delete(filePath);
    }
  }, DEBOUNCE_DELAY);

  debounceTimers.set(filePath, timer);
}

/**
 * Starts the Claude watcher for .jsonl files in ~/.claude/projects/
 */
function startClaudeWatcher(): void {
  if (claudeWatcher) {
    console.warn('[FileWatcher] Claude watcher is already running');
    return;
  }

  console.log(`[FileWatcher] Starting Claude watcher on: ${CLAUDE_WATCH_DIR}`);

  try {
    // Watch the directory itself, filter for .jsonl in handlers
    // This is more reliable than glob patterns on macOS
    claudeWatcher = chokidar.watch(CLAUDE_WATCH_DIR, {
      persistent: true,
      ignoreInitial: false,
      // Use polling on macOS for reliability with new file detection
      usePolling: process.platform === 'darwin',
      interval: 1000,
      awaitWriteFinish: {
        stabilityThreshold: 1000,
        pollInterval: 200,
      },
      // Claude sessions are stored under ~/.claude/projects/{project}/<session>.jsonl
      depth: 5,
    });

    claudeWatcher
      .on('add', (filePath: string) => {
        // Only process .jsonl files, skip subagent files
        if (!filePath.endsWith('.jsonl')) return;
        if (filePath.includes('/subagents/')) return;
        const relativePath = path.relative(CLAUDE_WATCH_DIR, filePath);
        console.log(`[FileWatcher] New Claude file detected: ${relativePath}`);
        handleFileChange(filePath);
      })
      .on('change', (filePath: string) => {
        // Only process .jsonl files, skip subagent files
        if (!filePath.endsWith('.jsonl')) return;
        if (filePath.includes('/subagents/')) return;
        const relativePath = path.relative(CLAUDE_WATCH_DIR, filePath);
        console.log(`[FileWatcher] Claude file changed: ${relativePath}`);
        handleFileChange(filePath);
      })
      .on('error', (error: unknown) => {
        console.error('[FileWatcher] Claude watcher error:', error);
      })
      .on('ready', () => {
        console.log('[FileWatcher] Claude watcher initial scan complete. Ready for changes.');
      });
  } catch (error) {
    console.error('[FileWatcher] Failed to start Claude watcher:', error);
    claudeWatcher = null;
    throw error;
  }
}

/**
 * Starts the Gemini watcher for session-*.json files in ~/.gemini/tmp/
 */
function startGeminiWatcher(): void {
  if (geminiWatcher) {
    console.warn('[FileWatcher] Gemini watcher is already running');
    return;
  }

  console.log(`[FileWatcher] Starting Gemini watcher on: ${GEMINI_WATCH_DIR}`);

  try {
    // Watch the directory itself, filter for session-*.json in handlers
    // This is more reliable than glob patterns on macOS
    geminiWatcher = chokidar.watch(GEMINI_WATCH_DIR, {
      persistent: true,
      ignoreInitial: false,
      // Use polling on macOS for reliability with new file detection
      usePolling: process.platform === 'darwin',
      interval: 1000,
      awaitWriteFinish: {
        stabilityThreshold: 1000,
        pollInterval: 200,
      },
      // Gemini sessions are stored under ~/.gemini/tmp/{hash}/chats/session-*.json
      depth: 5,
    });

    geminiWatcher
      .on('add', (filePath: string) => {
        // Only process session-*.json files in chats directories
        if (!filePath.includes('/chats/') || !filePath.match(/session-.*\.json$/)) return;
        const relativePath = path.relative(GEMINI_WATCH_DIR, filePath);
        console.log(`[FileWatcher] New Gemini session detected: ${relativePath}`);
        handleGeminiFileChange(filePath);
      })
      .on('change', (filePath: string) => {
        // Only process session-*.json files in chats directories
        if (!filePath.includes('/chats/') || !filePath.match(/session-.*\.json$/)) return;
        const relativePath = path.relative(GEMINI_WATCH_DIR, filePath);
        console.log(`[FileWatcher] Gemini session changed: ${relativePath}`);
        handleGeminiFileChange(filePath);
      })
      .on('error', (error: unknown) => {
        console.error('[FileWatcher] Gemini watcher error:', error);
      })
      .on('ready', () => {
        console.log('[FileWatcher] Gemini watcher initial scan complete. Ready for changes.');
      });
  } catch (error) {
    console.error('[FileWatcher] Failed to start Gemini watcher:', error);
    geminiWatcher = null;
    throw error;
  }
}

/**
 * Starts the Copilot watcher for events.jsonl files in ~/.copilot/session-state/
 */
function startCopilotWatcher(): void {
  if (copilotWatcher) {
    console.warn('[FileWatcher] Copilot watcher is already running');
    return;
  }

  console.log(`[FileWatcher] Starting Copilot watcher on: ${COPILOT_WATCH_DIR}`);

  try {
    // Watch the directory itself, filter for events.jsonl in session subdirectories
    copilotWatcher = chokidar.watch(COPILOT_WATCH_DIR, {
      persistent: true,
      ignoreInitial: false,
      // Use polling on macOS for reliability with new file detection
      usePolling: process.platform === 'darwin',
      interval: 1000,
      awaitWriteFinish: {
        stabilityThreshold: 1000,
        pollInterval: 200,
      },
      // Copilot sessions are stored under ~/.copilot/session-state/{sessionId}/events.jsonl
      depth: 2,
    });

    copilotWatcher
      .on('add', (filePath: string) => {
        // Only process events.jsonl files
        if (!filePath.endsWith('events.jsonl')) return;
        const relativePath = path.relative(COPILOT_WATCH_DIR, filePath);
        console.log(`[FileWatcher] New Copilot session detected: ${relativePath}`);
        handleFileChange(filePath);
      })
      .on('change', (filePath: string) => {
        // Only process events.jsonl files
        if (!filePath.endsWith('events.jsonl')) return;
        const relativePath = path.relative(COPILOT_WATCH_DIR, filePath);
        console.log(`[FileWatcher] Copilot session changed: ${relativePath}`);
        handleFileChange(filePath);
      })
      .on('error', (error: unknown) => {
        console.error('[FileWatcher] Copilot watcher error:', error);
      })
      .on('ready', () => {
        console.log('[FileWatcher] Copilot watcher initial scan complete. Ready for changes.');
      });
  } catch (error) {
    console.error('[FileWatcher] Failed to start Copilot watcher:', error);
    copilotWatcher = null;
    throw error;
  }
}

/**
 * Starts watching directories for Claude, Gemini, and Copilot session files
 *
 * Claude: ~/.claude/projects/ for .jsonl files
 * Gemini: ~/.gemini/tmp/ for session-*.json files
 * Copilot: ~/.copilot/session-state/ for events.jsonl files
 *
 * When files are added or modified, they will be automatically
 * imported after a 2-second debounce period.
 *
 * @throws Error if watchers are already running
 */
export function startWatcher(): void {
  if (claudeWatcher || geminiWatcher || copilotWatcher) {
    console.warn('[FileWatcher] One or more watchers are already running');
    return;
  }

  console.log('[FileWatcher] Starting file watchers for Claude, Gemini, and Copilot sessions...');

  startClaudeWatcher();
  startGeminiWatcher();
  startCopilotWatcher();

  console.log('[FileWatcher] All file watchers started');
}

/**
 * Stops all file watchers and cleans up resources
 *
 * Clears all pending debounce timers and closes all watcher instances.
 */
export async function stopWatcher(): Promise<void> {
  if (!claudeWatcher && !geminiWatcher && !copilotWatcher) {
    console.warn('[FileWatcher] No watchers running');
    return;
  }

  console.log('[FileWatcher] Stopping file watchers...');

  // Clear all debounce timers
  for (const timer of debounceTimers.values()) {
    clearTimeout(timer);
  }
  debounceTimers.clear();

  const errors: Error[] = [];

  // Close Claude watcher
  if (claudeWatcher) {
    try {
      await claudeWatcher.close();
      claudeWatcher = null;
      console.log('[FileWatcher] Claude watcher stopped');
    } catch (error) {
      console.error('[FileWatcher] Error stopping Claude watcher:', error);
      claudeWatcher = null;
      if (error instanceof Error) {
        errors.push(error);
      }
    }
  }

  // Close Gemini watcher
  if (geminiWatcher) {
    try {
      await geminiWatcher.close();
      geminiWatcher = null;
      console.log('[FileWatcher] Gemini watcher stopped');
    } catch (error) {
      console.error('[FileWatcher] Error stopping Gemini watcher:', error);
      geminiWatcher = null;
      if (error instanceof Error) {
        errors.push(error);
      }
    }
  }

  // Close Copilot watcher
  if (copilotWatcher) {
    try {
      await copilotWatcher.close();
      copilotWatcher = null;
      console.log('[FileWatcher] Copilot watcher stopped');
    } catch (error) {
      console.error('[FileWatcher] Error stopping Copilot watcher:', error);
      copilotWatcher = null;
      if (error instanceof Error) {
        errors.push(error);
      }
    }
  }

  console.log('[FileWatcher] All file watchers stopped');

  if (errors.length > 0) {
    throw new Error(`Failed to stop watchers: ${errors.map((e) => e.message).join(', ')}`);
  }
}

/**
 * Returns whether any watcher is currently running
 *
 * @returns True if at least one watcher is active, false otherwise
 */
export function isWatcherRunning(): boolean {
  return claudeWatcher !== null || geminiWatcher !== null || copilotWatcher !== null;
}

/**
 * Returns whether the Claude watcher is currently running
 *
 * @returns True if Claude watcher is active, false otherwise
 */
export function isClaudeWatcherRunning(): boolean {
  return claudeWatcher !== null;
}

/**
 * Returns whether the Gemini watcher is currently running
 *
 * @returns True if Gemini watcher is active, false otherwise
 */
export function isGeminiWatcherRunning(): boolean {
  return geminiWatcher !== null;
}

/**
 * Returns whether the Copilot watcher is currently running
 *
 * @returns True if Copilot watcher is active, false otherwise
 */
export function isCopilotWatcherRunning(): boolean {
  return copilotWatcher !== null;
}
