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
import { ParserFactory } from '../parser/parser-factory';
import { detectAgentFromPath, AgentType } from '../parser/agent-detector';
import {
  initializeTranscriptSchema,
  deleteTranscriptSessionData,
  insertSession,
  insertFrame,
  insertToolExecution,
  updateSessionFrameCount,
  updateParsingStatus,
  getTranscriptSessionById,
} from '../db/transcript-queries';
import { getTranscriptDbInstance } from '../db/transcript-connection';
import { ClaudeMdStorage } from './claudemd-storage';
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
 * Options for importing a transcript
 */
export interface ImportTranscriptOptions {
  /**
   * Optional agent type override. If not specified, auto-detected from path.
   */
  agent?: AgentType;

  /**
   * For Gemini sessions, the resolved project path to use as cwd.
   * Gemini session files don't store the working directory, so this
   * allows callers to provide it when they have resolved it from the
   * project hash mapping.
   */
  resolvedProjectPath?: string;
}

/**
 * Import a single transcript file into the database
 *
 * Parses the .jsonl file, builds a timeline, and inserts all data
 * into the database. Updates parsing_status table for progress tracking.
 *
 * @param filePath - Absolute path to .jsonl transcript file
 * @param agentOrOptions - Optional agent type override or options object.
 *                         If not specified, auto-detected from path.
 * @returns Promise that resolves when import is complete
 * @throws Error if parsing or database insertion fails
 *
 * @example
 * // Basic import with auto-detection
 * await importTranscript('/Users/me/.claude/projects/my-project/session-123.jsonl');
 *
 * @example
 * // Import with agent type override (legacy signature)
 * await importTranscript('/custom/path/session.jsonl', 'codex');
 *
 * @example
 * // Import Gemini session with resolved project path
 * await importTranscript('/Users/me/.gemini/tmp/abc123/chats/session-1.json', {
 *   agent: 'gemini',
 *   resolvedProjectPath: '/Users/me/projects/my-app'
 * });
 */
export async function importTranscript(
  filePath: string,
  agentOrOptions?: AgentType | ImportTranscriptOptions
): Promise<void> {
  // Handle both legacy (agent string) and new (options object) signatures
  const options: ImportTranscriptOptions =
    typeof agentOrOptions === 'string' ? { agent: agentOrOptions } : agentOrOptions || {};

  console.log(`[Import] Starting import: ${filePath}`);

  let sessionId: string | undefined;

  try {
    // Use provided agent type or auto-detect from file path
    const agentType: AgentType = options.agent || detectAgentFromPath(filePath);
    console.log(
      `[Import] Agent type: ${agentType}${options.agent ? ' (specified)' : ' (auto-detected)'}`
    );

    // Parse transcript file using ParserFactory
    // Pass resolved project path for Gemini sessions
    const parsed = await ParserFactory.parseFile(filePath, {
      resolvedProjectPath: options.resolvedProjectPath,
    });
    sessionId = parsed.sessionId;
    if (!sessionId) {
      throw new Error(`Parser did not return a session ID for file: ${filePath}`);
    }
    const safeSessionId = sessionId;

    console.log(`[Import] Parsed session: ${sessionId} (${parsed.entries.length} entries)`);

    // Create parsing status entry
    updateParsingStatus(sessionId, {
      transcript_file_path: filePath,
      total_entries: parsed.entries.length,
      frames_created: 0,
      status: 'pending',
      started_at: new Date().toISOString(),
    });

    // Build timeline from parsed transcript using ParserFactory
    const timeline = await ParserFactory.buildTimeline(parsed, agentType);

    console.log(`[Import] Built timeline: ${timeline.frames.length} frames`);

    // Create session metadata
    const sessionMetadata: SessionMetadata = {
      sessionId: timeline.sessionId,
      slug: timeline.slug,
      project: timeline.project,
      agent: timeline.agent,
      startTime: new Date(timeline.startedAt).toISOString(),
      endTime: timeline.completedAt ? new Date(timeline.completedAt).toISOString() : undefined,
      duration: timeline.completedAt
        ? Math.floor((timeline.completedAt - timeline.startedAt) / 1000)
        : undefined,
      eventCount: parsed.entries.length,
      cwd: timeline.metadata.cwd,
      firstUserMessage: extractFirstUserMessage(timeline.frames),
    };

    // Persist transcript rows atomically so partial imports don't leak stale data.
    const db = getTranscriptDbInstance();
    const persistImport = db.transaction(() => {
      deleteTranscriptSessionData(safeSessionId);
      insertSession(sessionMetadata);

      for (const frame of timeline.frames) {
        insertFrame(safeSessionId, frame);

        if (frame.toolExecution) {
          insertToolExecution(frame.id, frame.toolExecution);
        }
      }

      updateSessionFrameCount(safeSessionId);
    });

    persistImport();

    // Store CLAUDE.md snapshots if present (best-effort, separate DB)
    if (timeline.metadata.claudeMdFiles && timeline.metadata.claudeMdFiles.length > 0) {
      try {
        ClaudeMdStorage.storeClaudeMdFiles(sessionId, timeline.metadata.claudeMdFiles);
        console.log(
          `[Import] Stored ${timeline.metadata.claudeMdFiles.length} CLAUDE.md snapshot(s)`
        );
      } catch (error) {
        // Log but don't fail the import if CLAUDE.md storage fails
        console.warn(`[Import] Failed to store CLAUDE.md snapshots:`, error);
      }
    }

    // Extract and store git context (best-effort, don't fail import)
    if (timeline.metadata.cwd) {
      try {
        const { GitExtractor } = await import('./git-extractor');
        const { saveGitActivity, saveSessionCommits, initializeGitActivitySchema } =
          await import('../db/git-queries');

        // Ensure git activity schema exists
        initializeGitActivitySchema();

        const gitContext = GitExtractor.extractGitContext(timeline.metadata.cwd);
        if (gitContext) {
          saveGitActivity({
            sessionId,
            commitHash: gitContext.headCommit,
            commitMessage: gitContext.commitMessage,
            branchName: gitContext.branch,
            parentCommit: gitContext.parentCommit,
            isDirty: gitContext.isDirty,
            filesStaged:
              gitContext.stagedFiles.length > 0 ? JSON.stringify(gitContext.stagedFiles) : null,
            filesModified:
              gitContext.modifiedFiles.length > 0 ? JSON.stringify(gitContext.modifiedFiles) : null,
            untrackedCount: gitContext.untrackedCount,
          });
          console.log(
            `[Import] Stored git context: ${gitContext.branch}@${gitContext.headCommit?.slice(0, 7) || 'no-commit'}`
          );

          // If we have session timing, look for commits made during the session
          if (timeline.startedAt && timeline.completedAt) {
            const commits = GitExtractor.getCommitsInTimeRange(
              timeline.metadata.cwd,
              timeline.startedAt,
              timeline.completedAt
            );
            if (commits.length > 0) {
              saveSessionCommits(
                commits.map((c) => ({
                  sessionId: safeSessionId,
                  commitHash: c.hash,
                  commitMessage: c.message,
                  authorName: c.authorName,
                  authorEmail: c.authorEmail,
                  committedAt: c.committedAt,
                  committedAtEpoch: c.committedAtEpoch,
                }))
              );
              console.log(`[Import] Found ${commits.length} commit(s) during session`);
            }
          }
        }
      } catch (error) {
        // Log but don't fail the import if git extraction fails
        console.warn(`[Import] Failed to extract git context:`, error);
      }
    }

    const framesInserted = timeline.frames.length;

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
export async function bulkImportTranscripts(config?: ImportJobConfig): Promise<ImportSummary> {
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
async function importSingleFile(filePath: string, skipExisting: boolean): Promise<ImportResult> {
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
 * Check if a directory path should be excluded based on patterns
 * Uses RECALL_EXCLUDE_PATTERNS env var (comma-separated)
 */
function shouldExcludeDirectory(dirPath: string): boolean {
  const excludeEnv = process.env.RECALL_EXCLUDE_PATTERNS;
  if (!excludeEnv) return false;

  const patterns = excludeEnv
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  return patterns.some((pattern) => {
    // Simple glob matching: **/pattern/** matches any path containing "pattern"
    if (pattern.includes('**')) {
      const searchTerm = pattern.replace(/\*\*/g, '').replace(/\//g, '');
      return dirPath.includes(searchTerm);
    }
    // Direct match: check if path contains the pattern
    return dirPath.includes(pattern);
  });
}

/**
 * Recursively find all .jsonl files in a directory
 *
 * @param dirPath - Directory to search
 * @returns Array of absolute file paths
 */
async function findTranscriptFiles(dirPath: string): Promise<string[]> {
  const files: string[] = [];
  let skippedDirs = 0;
  let excludedDirs = 0;

  // Check if directory exists
  if (!fs.existsSync(dirPath)) {
    console.warn(`[Import] Directory does not exist: ${dirPath}`);
    return files;
  }

  // Read directory recursively with error handling
  async function scanDir(dir: string): Promise<void> {
    // Check exclusion patterns
    if (shouldExcludeDirectory(dir)) {
      excludedDirs++;
      return;
    }

    let entries;
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch (error) {
      // Log warning but continue - don't let one directory failure stop the scan
      console.warn(
        `[Import] Cannot read directory ${dir}:`,
        error instanceof Error ? error.message : error
      );
      skippedDirs++;
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      try {
        if (entry.isDirectory()) {
          // Recurse into subdirectories
          await scanDir(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
          // Add .jsonl files
          files.push(fullPath);
        }
      } catch (error) {
        // Log warning but continue to next entry
        console.warn(
          `[Import] Skipping ${fullPath}:`,
          error instanceof Error ? error.message : error
        );
        continue;
      }
    }
  }

  await scanDir(dirPath);

  // Log summary of issues if any occurred
  if (skippedDirs > 0) {
    console.warn(`[Import] Skipped ${skippedDirs} directories due to errors`);
  }
  if (excludedDirs > 0) {
    console.log(`[Import] Excluded ${excludedDirs} directories based on RECALL_EXCLUDE_PATTERNS`);
  }

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
