/**
 * Bulk Transcript Importer Service
 *
 * Scans ~/.claude/projects/ for .jsonl transcript files and imports them
 * into the SQLite database for fast querying and playback.
 *
 * Features:
 * - Parallel processing (configurable concurrency)
 * - Progress tracking via parsing_status table
 * - Skip already imported sessions
 * - Graceful error handling
 * - Progress callbacks for monitoring
 *
 * @module transcript-importer
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { parseTranscriptFile } from '../parser/transcript-parser';
import { buildTimeline } from '../parser/timeline-builder';
import {
  initializeTranscriptSchema,
  insertSession,
  insertFrame,
  insertToolExecution,
  updateSessionFrameCount,
  updateParsingStatus,
  getTranscriptSessionById,
} from '../db/transcript-queries';
import type { ImportJobConfig } from '../db/transcript-schema';
import type { SessionMetadata } from '../types/transcript';

/**
 * Default configuration for import jobs
 */
const DEFAULT_CONFIG: Required<ImportJobConfig> = {
  sourcePath: path.join(os.homedir(), '.claude', 'projects'),
  parallel: 10,
  skipExisting: true,
  onProgress: () => {}, // no-op by default
};

/**
 * Import result for a single session
 */
interface ImportResult {
  sessionId: string;
  filePath: string;
  success: boolean;
  framesImported?: number;
  error?: string;
  skipped?: boolean;
}

/**
 * Import summary for bulk operations
 */
interface ImportSummary {
  totalFiles: number;
  successful: number;
  failed: number;
  skipped: number;
  results: ImportResult[];
  duration: number; // milliseconds
}

/**
 * Import a single transcript file into the database
 *
 * Parses the .jsonl file, builds a timeline, and inserts all data
 * into the database. Updates parsing_status table for progress tracking.
 *
 * @param filePath - Absolute path to .jsonl transcript file
 * @returns Promise that resolves when import is complete
 * @throws Error if parsing or database insertion fails
 *
 * @example
 * await importTranscript('/Users/me/.claude/projects/my-project/session-123.jsonl');
 */
export async function importTranscript(filePath: string): Promise<void> {
  console.log(`[Import] Starting import: ${filePath}`);

  let sessionId: string | undefined;

  try {
    // Parse transcript file
    const parsed = await parseTranscriptFile(filePath);
    sessionId = parsed.sessionId;

    console.log(`[Import] Parsed session: ${sessionId} (${parsed.entries.length} entries)`);

    // Create parsing status entry
    updateParsingStatus(sessionId, {
      transcript_file_path: filePath,
      total_entries: parsed.entries.length,
      frames_created: 0,
      status: 'pending',
      started_at: new Date().toISOString(),
    });

    // Build timeline from parsed transcript
    const timeline = await buildTimeline(parsed);

    console.log(`[Import] Built timeline: ${timeline.frames.length} frames`);

    // Create session metadata
    const sessionMetadata: SessionMetadata = {
      sessionId: timeline.sessionId,
      slug: timeline.slug,
      project: timeline.project,
      startTime: new Date(timeline.startedAt).toISOString(),
      endTime: timeline.completedAt
        ? new Date(timeline.completedAt).toISOString()
        : undefined,
      duration: timeline.completedAt
        ? Math.floor((timeline.completedAt - timeline.startedAt) / 1000)
        : undefined,
      eventCount: parsed.entries.length,
      cwd: timeline.metadata.cwd,
      firstUserMessage: extractFirstUserMessage(timeline.frames),
    };

    // Insert session
    insertSession(sessionMetadata);

    // Insert frames
    let framesInserted = 0;
    for (const frame of timeline.frames) {
      insertFrame(sessionId, frame);

      // Insert tool execution if present
      if (frame.toolExecution) {
        insertToolExecution(frame.id, frame.toolExecution);
      }

      framesInserted++;

      // Update progress every 100 frames
      if (framesInserted % 100 === 0) {
        updateParsingStatus(sessionId, {
          frames_created: framesInserted,
        });
      }
    }

    // Update frame count
    updateSessionFrameCount(sessionId);

    // Mark as completed
    updateParsingStatus(sessionId, {
      frames_created: framesInserted,
      status: 'completed',
      completed_at: new Date().toISOString(),
    });

    console.log(`[Import] Completed: ${sessionId} (${framesInserted} frames)`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Import] Failed: ${filePath}`, errorMessage);

    // Mark as failed if we have a sessionId
    if (sessionId) {
      updateParsingStatus(sessionId, {
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: errorMessage,
      });
    }

    throw error;
  }
}

/**
 * Bulk import all transcript files from a directory
 *
 * Scans the source directory recursively for .jsonl files and imports
 * them in parallel (respecting concurrency limit). Skips already imported
 * sessions by default.
 *
 * @param config - Import job configuration
 * @returns Promise resolving to import summary
 *
 * @example
 * const summary = await bulkImportTranscripts({
 *   sourcePath: '~/.claude/projects',
 *   parallel: 10,
 *   onProgress: (completed, total) => {
 *     console.log(`Progress: ${completed}/${total}`);
 *   }
 * });
 *
 * console.log(`Imported ${summary.successful} sessions`);
 */
export async function bulkImportTranscripts(
  config?: ImportJobConfig
): Promise<ImportSummary> {
  const startTime = Date.now();

  // Merge with defaults
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  // Ensure database schema is initialized
  initializeTranscriptSchema();

  console.log('[BulkImport] Starting bulk import...');
  console.log(`[BulkImport] Source: ${finalConfig.sourcePath}`);
  console.log(`[BulkImport] Parallel: ${finalConfig.parallel}`);
  console.log(`[BulkImport] Skip existing: ${finalConfig.skipExisting}`);

  // Find all .jsonl files
  const files = await findTranscriptFiles(finalConfig.sourcePath);
  console.log(`[BulkImport] Found ${files.length} transcript files`);

  if (files.length === 0) {
    return {
      totalFiles: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      results: [],
      duration: Date.now() - startTime,
    };
  }

  // Process files in parallel batches
  const results: ImportResult[] = [];
  const batches = chunkArray(files, finalConfig.parallel);

  let completed = 0;

  for (const batch of batches) {
    const batchResults = await Promise.all(
      batch.map(async (filePath) => {
        try {
          return await importSingleFile(filePath, finalConfig.skipExisting);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return {
            sessionId: path.basename(filePath, '.jsonl'),
            filePath,
            success: false,
            error: errorMessage,
          };
        } finally {
          completed++;
          finalConfig.onProgress(completed, files.length);
        }
      })
    );

    results.push(...batchResults);
  }

  // Calculate summary
  const successful = results.filter((r) => r.success && !r.skipped).length;
  const failed = results.filter((r) => !r.success).length;
  const skipped = results.filter((r) => r.skipped).length;
  const duration = Date.now() - startTime;

  console.log('[BulkImport] Completed!');
  console.log(`  Total: ${files.length}`);
  console.log(`  Successful: ${successful}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Duration: ${(duration / 1000).toFixed(2)}s`);

  return {
    totalFiles: files.length,
    successful,
    failed,
    skipped,
    results,
    duration,
  };
}

/**
 * Import a single file with skip logic
 *
 * @param filePath - Path to .jsonl file
 * @param skipExisting - Whether to skip already imported sessions
 * @returns Import result
 */
async function importSingleFile(
  filePath: string,
  skipExisting: boolean
): Promise<ImportResult> {
  const sessionId = path.basename(filePath, '.jsonl');

  // Check if already imported
  if (skipExisting) {
    const existing = getTranscriptSessionById(sessionId);
    if (existing) {
      console.log(`[Import] Skipping existing session: ${sessionId}`);
      return {
        sessionId,
        filePath,
        success: true,
        skipped: true,
      };
    }
  }

  // Import the file
  try {
    await importTranscript(filePath);

    return {
      sessionId,
      filePath,
      success: true,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      sessionId,
      filePath,
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Recursively find all .jsonl files in a directory
 *
 * @param dirPath - Directory to search
 * @returns Array of absolute file paths
 */
async function findTranscriptFiles(dirPath: string): Promise<string[]> {
  const files: string[] = [];

  // Check if directory exists
  if (!fs.existsSync(dirPath)) {
    console.warn(`[Import] Directory does not exist: ${dirPath}`);
    return files;
  }

  // Read directory recursively
  async function scanDir(dir: string): Promise<void> {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Recurse into subdirectories
        await scanDir(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
        // Add .jsonl files
        files.push(fullPath);
      }
    }
  }

  await scanDir(dirPath);

  return files;
}

/**
 * Extract first user message from frames for session preview
 *
 * @param frames - Playback frames
 * @returns First user message text or undefined
 */
function extractFirstUserMessage(
  frames: Array<{ type: string; userMessage?: { text: string } }>
): string | undefined {
  const userFrame = frames.find((f) => f.type === 'user_message');
  if (userFrame && userFrame.userMessage) {
    // Truncate long messages
    const text = userFrame.userMessage.text;
    return text.length > 200 ? text.slice(0, 197) + '...' : text;
  }
  return undefined;
}

/**
 * Split array into chunks for parallel processing
 *
 * @param array - Array to chunk
 * @param size - Chunk size
 * @returns Array of chunks
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Get import progress statistics
 *
 * Returns current state of all import jobs tracked in parsing_status table.
 *
 * @returns Import statistics
 *
 * @example
 * const stats = getImportProgress();
 * console.log(`Pending: ${stats.pending}, Completed: ${stats.completed}`);
 */
export function getImportProgress(): {
  total: number;
  pending: number;
  completed: number;
  failed: number;
} {
  const { getImportStats } = require('../db/transcript-queries');
  return getImportStats();
}
