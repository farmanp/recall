import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { PlaybackFrame } from '../types/transcript';
import type {
  RewindFileAction,
  RewindConflict,
  RewindPlan,
  RewindResult,
  RewindOptions,
  RewindHistory,
  RewindUndoResult,
} from '../db/rewind-schema';
import { insertRewindHistory, getLastUndoableRewind, markRewindAsUsed } from '../db/rewind-queries';

/**
 * RewindEngine - Core service for file state restoration
 *
 * This engine handles the rewind functionality that allows users to
 * restore file state from any frame in a session to disk.
 *
 * Key features:
 * - Preview rewind: Show what would change without writing files
 * - Execute rewind: Actually restore files to disk with optional backups
 * - Undo rewind: Restore files from backups
 * - Path security: Ensure files don't escape the cwd
 *
 * Safety measures:
 * - All paths are resolved relative to cwd
 * - Paths that escape cwd are rejected
 * - Backups are created by default before any modification
 * - Dry run mode for preview without changes
 */
export class RewindEngine {
  private static readonly DEFAULT_BACKUP_DIR = '.recall-backup';

  /**
   * Create a rewind plan - preview what would change
   * Does NOT write any files - safe to call for preview
   *
   * @param sessionId - Session UUID
   * @param frameIndex - Frame index to rewind to
   * @param frames - All playback frames for the session
   * @param cwd - Working directory for the session
   * @param checkpointId - Optional checkpoint ID if rewinding from checkpoint
   * @returns RewindPlan with all files and conflicts
   */
  static async previewRewind(
    sessionId: string,
    frameIndex: number,
    frames: PlaybackFrame[],
    cwd: string,
    checkpointId?: string
  ): Promise<RewindPlan> {
    const plan: RewindPlan = {
      sessionId,
      checkpointId,
      frameIndex,
      cwd,
      files: [],
      conflicts: [],
      warnings: [],
      summary: {
        totalFiles: 0,
        filesToCreate: 0,
        filesToModify: 0,
        filesToDelete: 0,
        filesToSkip: 0,
        conflictCount: 0,
      },
    };

    // Validate cwd exists
    if (!fs.existsSync(cwd)) {
      plan.warnings.push(`Working directory does not exist: ${cwd}`);
      return plan;
    }

    // Validate frameIndex is within bounds
    if (frameIndex < 0 || frameIndex >= frames.length) {
      plan.warnings.push(`Frame index ${frameIndex} is out of bounds (0-${frames.length - 1})`);
      return plan;
    }

    // Reconstruct file states from frames up to the target frame
    const fileStates = this.reconstructFileStates(frames, frameIndex);

    for (const [filePath, state] of fileStates) {
      // Resolve the absolute path
      const absolutePath = this.resolveSecurePath(filePath, cwd);

      // Security check: ensure file is within cwd
      if (!absolutePath) {
        plan.conflicts.push({
          path: filePath,
          absolutePath: path.resolve(cwd, filePath),
          reason: 'outside_cwd',
          message: `File path escapes working directory: ${filePath}`,
        });
        continue;
      }

      // Check current disk state
      const currentContent = this.readFileSafe(absolutePath);

      // Determine action based on file state and current disk state
      const action = this.determineFileAction(filePath, absolutePath, state, currentContent);

      // Check for conflicts
      const conflict = this.detectConflict(filePath, absolutePath, state, currentContent);
      if (conflict) {
        plan.conflicts.push(conflict);
        // Still add the action but mark as skip if there's a conflict
        action.action = 'skip';
        action.reason = conflict.message;
      }

      plan.files.push(action);
    }

    // Calculate summary
    plan.summary.totalFiles = plan.files.length;
    plan.summary.filesToCreate = plan.files.filter((f) => f.action === 'create').length;
    plan.summary.filesToModify = plan.files.filter((f) => f.action === 'modify').length;
    plan.summary.filesToDelete = plan.files.filter((f) => f.action === 'delete').length;
    plan.summary.filesToSkip = plan.files.filter((f) => f.action === 'skip').length;
    plan.summary.conflictCount = plan.conflicts.length;

    return plan;
  }

  /**
   * Execute rewind - write files to disk
   *
   * @param plan - RewindPlan from previewRewind
   * @param options - Execution options
   * @returns RewindResult with details of what was done
   */
  static async executeRewind(
    plan: RewindPlan,
    options: RewindOptions = { createBackups: true, skipConflicts: false, dryRun: false }
  ): Promise<RewindResult> {
    const rewindId = uuidv4();
    const result: RewindResult = {
      success: false,
      rewindId,
      filesRestored: 0,
      filesSkipped: 0,
      backupsCreated: [],
      errors: [],
      canUndo: options.createBackups,
      message: '',
    };

    // Dry run - just return preview results
    if (options.dryRun) {
      result.success = true;
      result.filesRestored = plan.files.filter((f) => f.action !== 'skip').length;
      result.filesSkipped = plan.files.filter((f) => f.action === 'skip').length;
      result.message = `Dry run: would restore ${result.filesRestored} files`;
      return result;
    }

    // Check for conflicts if not skipping
    if (!options.skipConflicts && plan.conflicts.length > 0) {
      result.errors.push(
        `${plan.conflicts.length} conflicts detected. Use skipConflicts option to proceed.`
      );
      result.message = 'Rewind aborted due to conflicts';
      return result;
    }

    const backupsMap: Record<string, string> = {};
    const backupTimestamp = new Date().toISOString().replace(/[:.]/g, '-');

    for (const file of plan.files) {
      // Skip files marked as skip
      if (file.action === 'skip') {
        result.filesSkipped++;
        continue;
      }

      try {
        // Create backup if enabled and file exists
        if (
          options.createBackups &&
          file.currentContent !== null &&
          file.currentContent !== undefined
        ) {
          const backupPath = await this.createBackup(
            file.absolutePath,
            plan.cwd,
            backupTimestamp,
            options.backupDir
          );
          if (backupPath) {
            backupsMap[file.path] = backupPath;
            result.backupsCreated.push(backupPath);
          }
        }

        // Apply the change
        if (file.action === 'delete') {
          if (fs.existsSync(file.absolutePath)) {
            fs.unlinkSync(file.absolutePath);
            // Try to clean up empty parent directories
            this.cleanupEmptyDirs(path.dirname(file.absolutePath), plan.cwd);
          }
        } else {
          // Create or modify file
          const dir = path.dirname(file.absolutePath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          fs.writeFileSync(file.absolutePath, file.content || '', 'utf8');
        }

        result.filesRestored++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`${file.path}: ${errorMessage}`);
      }
    }

    result.success = result.errors.length === 0;
    result.canUndo = options.createBackups && result.backupsCreated.length > 0;

    // Store in rewind_history for undo capability
    if (!options.dryRun) {
      const historyEntry: RewindHistory = {
        id: rewindId,
        sessionId: plan.sessionId,
        checkpointId: plan.checkpointId,
        frameIndex: plan.frameIndex,
        cwd: plan.cwd,
        executedAt: new Date().toISOString(),
        filesModified: plan.files.filter((f) => f.action !== 'skip').map((f) => f.path),
        backupsCreated: Object.keys(backupsMap).length > 0 ? backupsMap : undefined,
        canUndo: result.canUndo,
      };

      try {
        insertRewindHistory(historyEntry);
      } catch (error) {
        console.warn('[RewindEngine] Failed to store rewind history:', error);
      }
    }

    if (result.success) {
      result.message = `Successfully restored ${result.filesRestored} files`;
      if (result.filesSkipped > 0) {
        result.message += ` (${result.filesSkipped} skipped)`;
      }
    } else {
      result.message = `Restored ${result.filesRestored} files with ${result.errors.length} errors`;
    }

    return result;
  }

  /**
   * Undo the most recent rewind for a session
   * Restores files from backups
   *
   * @param sessionId - Session UUID
   * @returns RewindUndoResult
   */
  static async undoLastRewind(sessionId: string): Promise<RewindUndoResult> {
    const result: RewindUndoResult = {
      success: false,
      rewindId: '',
      filesRestored: 0,
      errors: [],
      message: '',
    };

    const lastRewind = getLastUndoableRewind(sessionId);
    if (!lastRewind) {
      result.message = 'No undoable rewind found for this session';
      return result;
    }

    result.rewindId = lastRewind.id;

    if (!lastRewind.backupsCreated || Object.keys(lastRewind.backupsCreated).length === 0) {
      result.message = 'No backups available for this rewind';
      markRewindAsUsed(lastRewind.id);
      return result;
    }

    // Restore each file from its backup
    for (const [originalPath, backupPath] of Object.entries(lastRewind.backupsCreated)) {
      try {
        const absoluteOriginal = path.resolve(lastRewind.cwd, originalPath);

        if (fs.existsSync(backupPath)) {
          const backupContent = fs.readFileSync(backupPath, 'utf8');

          // Ensure parent directory exists
          const dir = path.dirname(absoluteOriginal);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }

          fs.writeFileSync(absoluteOriginal, backupContent, 'utf8');
          result.filesRestored++;
        } else {
          result.errors.push(`Backup not found: ${backupPath}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`${originalPath}: ${errorMessage}`);
      }
    }

    // Mark as no longer undoable
    markRewindAsUsed(lastRewind.id);

    result.success = result.errors.length === 0;
    if (result.success) {
      result.message = `Successfully restored ${result.filesRestored} files from backup`;
    } else {
      result.message = `Restored ${result.filesRestored} files with ${result.errors.length} errors`;
    }

    return result;
  }

  /**
   * Get information about whether undo is available for a session
   *
   * @param sessionId - Session UUID
   * @returns Object with undo availability info
   */
  static getUndoInfo(sessionId: string): {
    canUndo: boolean;
    lastRewindId?: string;
    lastRewindAt?: string;
    filesCount?: number;
  } {
    const lastRewind = getLastUndoableRewind(sessionId);
    if (!lastRewind) {
      return { canUndo: false };
    }

    return {
      canUndo: true,
      lastRewindId: lastRewind.id,
      lastRewindAt: lastRewind.executedAt,
      filesCount: lastRewind.filesModified.length,
    };
  }

  /**
   * Reconstruct file states from frames up to the target frame index
   * Tracks file content at each Write/Edit operation
   *
   * @param frames - All playback frames
   * @param maxFrameIndex - Maximum frame index to process (inclusive)
   * @returns Map of file path to content and status
   */
  private static reconstructFileStates(
    frames: PlaybackFrame[],
    maxFrameIndex: number
  ): Map<string, { content: string; status: 'created' | 'modified' | 'deleted' }> {
    const fileStates = new Map<
      string,
      { content: string; status: 'created' | 'modified' | 'deleted' }
    >();

    for (let i = 0; i <= maxFrameIndex && i < frames.length; i++) {
      const frame = frames[i];
      if (!frame || frame.type !== 'tool_execution' || !frame.toolExecution) continue;

      const { tool, input, fileDiff, output } = frame.toolExecution;

      // Skip if the tool execution was an error
      if (output?.isError) continue;

      // Get file path from various possible locations
      const filePath = input?.file_path || input?.path;
      if (!filePath) continue;

      // Handle Write tool - full file content
      if (this.isWriteTool(tool) && input?.content !== undefined) {
        fileStates.set(filePath, {
          content: input.content,
          status: fileStates.has(filePath) ? 'modified' : 'created',
        });
      }

      // Handle Edit tool - use the resulting content from fileDiff
      if (this.isEditTool(tool) && fileDiff?.newContent !== undefined) {
        fileStates.set(filePath, {
          content: fileDiff.newContent,
          status: fileStates.has(filePath) ? 'modified' : 'created',
        });
      }

      // Note: We don't track deletes from the session since Claude Code
      // doesn't have a dedicated delete tool - files are deleted via Bash
      // which would require parsing shell commands (too complex/risky)
    }

    return fileStates;
  }

  /**
   * Check if a tool name is a write-like tool
   */
  private static isWriteTool(tool: string): boolean {
    const writeTools = ['Write', 'write_file', 'create_file', 'NotebookEdit'];
    return writeTools.includes(tool);
  }

  /**
   * Check if a tool name is an edit-like tool
   */
  private static isEditTool(tool: string): boolean {
    const editTools = ['Edit', 'replace'];
    return editTools.includes(tool);
  }

  /**
   * Resolve a file path securely within the cwd
   * Returns null if the path would escape the cwd
   *
   * @param filePath - Relative or absolute file path
   * @param cwd - Working directory
   * @returns Resolved absolute path or null if insecure
   */
  private static resolveSecurePath(filePath: string, cwd: string): string | null {
    // Resolve the path
    const absolutePath = path.resolve(cwd, filePath);
    const resolvedCwd = path.resolve(cwd);

    // Check if the resolved path starts with the cwd
    if (!absolutePath.startsWith(resolvedCwd + path.sep) && absolutePath !== resolvedCwd) {
      return null;
    }

    return absolutePath;
  }

  /**
   * Read file content safely, returning null if file doesn't exist
   */
  private static readFileSafe(filePath: string): string | null {
    try {
      return fs.readFileSync(filePath, 'utf8');
    } catch {
      return null;
    }
  }

  /**
   * Determine what action to take for a file
   */
  private static determineFileAction(
    relativePath: string,
    absolutePath: string,
    state: { content: string; status: 'created' | 'modified' | 'deleted' },
    currentContent: string | null
  ): RewindFileAction {
    if (state.status === 'deleted') {
      return {
        path: relativePath,
        absolutePath,
        action: currentContent !== null ? 'delete' : 'skip',
        currentContent: currentContent ?? undefined,
        reason: currentContent === null ? 'File already deleted' : undefined,
      };
    }

    if (currentContent === null) {
      // File doesn't exist on disk - create it
      return {
        path: relativePath,
        absolutePath,
        action: 'create',
        content: state.content,
      };
    }

    if (currentContent === state.content) {
      // File content matches - skip
      return {
        path: relativePath,
        absolutePath,
        action: 'skip',
        content: state.content,
        currentContent,
        reason: 'File content already matches target state',
      };
    }

    // File exists but content differs - modify
    return {
      path: relativePath,
      absolutePath,
      action: 'modify',
      content: state.content,
      currentContent,
    };
  }

  /**
   * Detect conflicts between expected and current state
   * Returns conflict info or null if no conflict
   */
  private static detectConflict(
    relativePath: string,
    absolutePath: string,
    _state: { content: string; status: 'created' | 'modified' | 'deleted' },
    _currentContent: string | null
  ): RewindConflict | null {
    // Check file permissions
    try {
      const dir = path.dirname(absolutePath);
      if (fs.existsSync(absolutePath)) {
        fs.accessSync(absolutePath, fs.constants.W_OK);
      } else if (fs.existsSync(dir)) {
        fs.accessSync(dir, fs.constants.W_OK);
      }
    } catch {
      return {
        path: relativePath,
        absolutePath,
        reason: 'permission_denied',
        message: `Permission denied: cannot write to ${relativePath}`,
      };
    }

    // No conflict detected
    return null;
  }

  /**
   * Create a backup of a file before modifying
   *
   * @param filePath - Absolute path to the file
   * @param cwd - Working directory
   * @param timestamp - Timestamp string for backup directory
   * @param backupDir - Optional custom backup directory name
   * @returns Backup file path or null if backup failed
   */
  private static async createBackup(
    filePath: string,
    cwd: string,
    timestamp: string,
    backupDir?: string
  ): Promise<string | null> {
    const dir = backupDir || path.join(cwd, this.DEFAULT_BACKUP_DIR);
    const relativePath = path.relative(cwd, filePath);
    const backupPath = path.join(dir, timestamp, relativePath);

    try {
      // Create backup directory structure
      fs.mkdirSync(path.dirname(backupPath), { recursive: true });

      // Copy the file
      fs.copyFileSync(filePath, backupPath);

      return backupPath;
    } catch (error) {
      console.warn(`[RewindEngine] Failed to create backup for ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Clean up empty directories after file deletion
   * Stops at cwd to avoid deleting important directories
   */
  private static cleanupEmptyDirs(dirPath: string, cwd: string): void {
    const resolvedCwd = path.resolve(cwd);

    let currentDir = path.resolve(dirPath);

    // Don't go above cwd
    while (currentDir !== resolvedCwd && currentDir.startsWith(resolvedCwd)) {
      try {
        const entries = fs.readdirSync(currentDir);
        if (entries.length === 0) {
          fs.rmdirSync(currentDir);
          currentDir = path.dirname(currentDir);
        } else {
          break;
        }
      } catch {
        break;
      }
    }
  }
}
