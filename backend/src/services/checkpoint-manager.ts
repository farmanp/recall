import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import type { PlaybackFrame } from '../types/transcript';
import type {
  Checkpoint,
  CheckpointFile,
  CheckpointWithFiles,
  CheckpointDiff,
  CheckpointFileDiff,
} from '../db/checkpoint-schema';
import {
  initializeCheckpointSchema,
  insertCheckpoint,
  insertCheckpointFiles,
  getCheckpointById,
  getCheckpointWithFiles,
  getCheckpointFiles,
  getSessionCheckpoints,
  deleteCheckpoint as deleteCheckpointQuery,
  updateCheckpoint as updateCheckpointQuery,
  checkpointExists,
} from '../db/checkpoint-queries';
import { GitCheckpointService, type GitCheckpointResult } from './git-checkpoint-service';
import {
  updateCheckpointGitStorage,
  updateCheckpointExportBranch,
} from '../db/git-checkpoint-queries';

/**
 * File state during reconstruction
 */
interface FileState {
  content: string;
  status: 'created' | 'modified' | 'deleted';
}

/**
 * Options for checkpoint creation
 */
export interface CreateCheckpointOptions {
  /** Sync checkpoint to git branch after creation */
  syncToGit?: boolean;
  /** Working directory for git operations */
  cwd?: string;
}

/**
 * Checkpoint Manager Service
 *
 * Handles checkpoint creation, file state reconstruction, and comparison.
 * Uses SHA-256 hashing for content deduplication.
 */
export class CheckpointManager {
  private static initialized = false;

  /**
   * Ensure the checkpoint schema is initialized
   */
  static ensureInitialized(): void {
    if (!this.initialized) {
      initializeCheckpointSchema();
      this.initialized = true;
    }
  }

  /**
   * Compute SHA-256 hash of content for deduplication
   * @param content - String content to hash
   * @returns Hex-encoded SHA-256 hash
   */
  static computeHash(content: string): string {
    return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
  }

  /**
   * Create a checkpoint from frames up to a given index
   * Reconstructs file state by processing all file operations
   *
   * @param sessionId - Session UUID
   * @param frameIndex - Frame index to checkpoint at
   * @param name - User-provided checkpoint name
   * @param frames - All playback frames for the session
   * @param gitCommit - Optional git commit SHA at checkpoint time
   * @param notes - Optional user notes
   * @param options - Optional settings for git sync
   * @returns Created checkpoint with files
   */
  static async createCheckpoint(
    sessionId: string,
    frameIndex: number,
    name: string,
    frames: PlaybackFrame[],
    gitCommit?: string,
    notes?: string,
    options?: CreateCheckpointOptions
  ): Promise<CheckpointWithFiles> {
    this.ensureInitialized();

    const id = uuidv4();
    const createdAt = new Date().toISOString();

    // Reconstruct file states up to the given frame index
    const fileStates = this.reconstructFileStates(frames, frameIndex);

    // Convert file states to CheckpointFile objects
    const files: Array<Omit<CheckpointFile, 'id'>> = [];
    for (const [path, state] of fileStates.entries()) {
      files.push({
        path,
        content: state.content,
        contentHash: this.computeHash(state.content),
        status: state.status,
      });
    }

    // Insert checkpoint into database
    const checkpoint = insertCheckpoint({
      id,
      sessionId,
      name,
      frameIndex,
      createdAt,
      gitCommit,
      notes,
    });

    // Insert files in a transaction
    if (files.length > 0) {
      insertCheckpointFiles(id, files);
    }

    // Sync to git if requested
    if (options?.syncToGit && options?.cwd) {
      try {
        const gitResult = await GitCheckpointService.storeCheckpoint(
          options.cwd,
          id,
          files.map((f) => ({ path: f.path, content: f.content })),
          {
            checkpointId: id,
            sessionId,
            name,
            frameIndex,
            createdAt,
            originalBranch: '',
            projectPath: options.cwd,
            fileCount: files.length,
          }
        );

        if (gitResult.success && gitResult.commitSha) {
          updateCheckpointGitStorage(id, gitResult.commitSha);
          console.log(`[CheckpointManager] Synced checkpoint ${id} to git: ${gitResult.commitSha}`);
        } else if (gitResult.error) {
          console.warn(`[CheckpointManager] Git sync failed: ${gitResult.error}`);
        }
      } catch (error) {
        console.warn('[CheckpointManager] Git sync failed:', error);
        // Continue - SQLite is primary storage, git is secondary
      }
    }

    return {
      ...checkpoint,
      fileCount: files.length,
      files: files.map((f, idx) => ({ ...f, id: idx + 1 })),
    };
  }

  /**
   * Reconstruct file states from frames up to a given frame index
   * This is the core algorithm - tracks Write and Edit operations to build cumulative state
   *
   * @param frames - All playback frames
   * @param maxFrameIndex - Maximum frame index to process (inclusive)
   * @returns Map of file paths to their state (content + status)
   */
  static reconstructFileStates(
    frames: PlaybackFrame[],
    maxFrameIndex: number
  ): Map<string, FileState> {
    const fileStates = new Map<string, FileState>();

    for (let i = 0; i <= maxFrameIndex && i < frames.length; i++) {
      const frame = frames[i];

      // Skip if frame is undefined or not a tool execution
      if (!frame || frame.type !== 'tool_execution' || !frame.toolExecution) {
        continue;
      }

      const { tool, input, fileDiff } = frame.toolExecution;

      // Handle Write tool - creates or overwrites file completely
      if (tool === 'Write' && input.file_path && input.content !== undefined) {
        const filePath = input.file_path as string;
        const content = input.content as string;
        const existed = fileStates.has(filePath);

        fileStates.set(filePath, {
          content,
          status: existed ? 'modified' : 'created',
        });
        continue;
      }

      // Handle Edit tool - applies diff to existing file
      // Priority: use fileDiff.newContent if available (pre-computed by parser)
      // Fallback: apply old_string/new_string replacement manually
      if (tool === 'Edit' && input.file_path) {
        const filePath = input.file_path as string;
        let newContent: string | undefined;

        // First try to use pre-computed newContent from fileDiff
        if (fileDiff?.newContent) {
          newContent = fileDiff.newContent;
        }
        // Fallback: apply the edit manually if we have the current content
        else if (input.old_string !== undefined && input.new_string !== undefined) {
          const currentState = fileStates.get(filePath);
          if (currentState) {
            const oldStr = input.old_string as string;
            const newStr = input.new_string as string;

            // Apply the replacement
            if (input.replace_all) {
              // Replace all occurrences
              newContent = currentState.content.split(oldStr).join(newStr);
            } else {
              // Replace first occurrence
              newContent = currentState.content.replace(oldStr, newStr);
            }
          }
        }

        if (newContent !== undefined) {
          const existed = fileStates.has(filePath);
          fileStates.set(filePath, {
            content: newContent,
            status: existed ? 'modified' : 'created',
          });
        }
        continue;
      }

      // Handle NotebookEdit - Jupyter notebook cell edits
      // For simplicity, we track the whole notebook as a single file
      if (tool === 'NotebookEdit' && input.notebook_path) {
        const filePath = input.notebook_path as string;
        // NotebookEdit modifies cells, but we'd need the full notebook structure
        // For now, just mark as modified if we have any prior state
        const currentState = fileStates.get(filePath);
        if (currentState) {
          fileStates.set(filePath, {
            ...currentState,
            status: 'modified',
          });
        }
        continue;
      }

      // Note: We intentionally do NOT track Read operations
      // Checkpoints only capture files that were written/edited during the session
    }

    return fileStates;
  }

  /**
   * Get all checkpoints for a session
   * @param sessionId - Session UUID
   * @returns Array of checkpoints ordered by frame index
   */
  static getSessionCheckpoints(sessionId: string): Checkpoint[] {
    this.ensureInitialized();
    return getSessionCheckpoints(sessionId);
  }

  /**
   * Get a checkpoint by ID
   * @param id - Checkpoint UUID
   * @returns Checkpoint or null if not found
   */
  static getCheckpointById(id: string): Checkpoint | null {
    this.ensureInitialized();
    return getCheckpointById(id);
  }

  /**
   * Get a checkpoint with all its files
   * @param id - Checkpoint UUID
   * @returns CheckpointWithFiles or null if not found
   */
  static getCheckpointWithFiles(id: string): CheckpointWithFiles | null {
    this.ensureInitialized();
    return getCheckpointWithFiles(id);
  }

  /**
   * Get files for a checkpoint
   * @param checkpointId - Checkpoint UUID
   * @returns Array of checkpoint files
   */
  static getCheckpointFiles(checkpointId: string): CheckpointFile[] {
    this.ensureInitialized();
    return getCheckpointFiles(checkpointId);
  }

  /**
   * Delete a checkpoint
   * @param id - Checkpoint UUID
   * @returns true if deleted, false if not found
   */
  static deleteCheckpoint(id: string): boolean {
    this.ensureInitialized();
    return deleteCheckpointQuery(id);
  }

  /**
   * Update a checkpoint's name or notes
   * @param id - Checkpoint UUID
   * @param updates - Fields to update
   * @returns Updated checkpoint or null if not found
   */
  static updateCheckpoint(
    id: string,
    updates: { name?: string; notes?: string }
  ): Checkpoint | null {
    this.ensureInitialized();
    return updateCheckpointQuery(id, updates);
  }

  /**
   * Check if a checkpoint exists
   * @param id - Checkpoint UUID
   * @returns true if exists
   */
  static checkpointExists(id: string): boolean {
    this.ensureInitialized();
    return checkpointExists(id);
  }

  /**
   * Compare two checkpoints and return the diff
   * @param fromId - Source checkpoint UUID
   * @param toId - Target checkpoint UUID
   * @returns Diff between checkpoints or null if either not found
   */
  static compareCheckpoints(fromId: string, toId: string): CheckpointDiff | null {
    this.ensureInitialized();

    const fromCheckpoint = getCheckpointById(fromId);
    const toCheckpoint = getCheckpointById(toId);

    if (!fromCheckpoint || !toCheckpoint) {
      return null;
    }

    const fromFiles = getCheckpointFiles(fromId);
    const toFiles = getCheckpointFiles(toId);

    // Build maps for comparison
    const fromMap = new Map<string, CheckpointFile>();
    for (const file of fromFiles) {
      fromMap.set(file.path, file);
    }

    const toMap = new Map<string, CheckpointFile>();
    for (const file of toFiles) {
      toMap.set(file.path, file);
    }

    const addedFiles: string[] = [];
    const removedFiles: string[] = [];
    const modifiedFiles: string[] = [];
    const unchangedFiles: string[] = [];

    // Find added and modified files
    for (const [path, toFile] of toMap.entries()) {
      const fromFile = fromMap.get(path);
      if (!fromFile) {
        addedFiles.push(path);
      } else if (fromFile.contentHash !== toFile.contentHash) {
        modifiedFiles.push(path);
      } else {
        unchangedFiles.push(path);
      }
    }

    // Find removed files
    for (const path of fromMap.keys()) {
      if (!toMap.has(path)) {
        removedFiles.push(path);
      }
    }

    return {
      from: fromCheckpoint,
      to: toCheckpoint,
      addedFiles,
      removedFiles,
      modifiedFiles,
      unchangedFiles,
    };
  }

  /**
   * Get detailed file diff between two checkpoints for a specific file
   * @param fromId - Source checkpoint UUID
   * @param toId - Target checkpoint UUID
   * @param filePath - File path to compare
   * @returns File diff or null if either checkpoint not found
   */
  static getFileDiff(fromId: string, toId: string, filePath: string): CheckpointFileDiff | null {
    this.ensureInitialized();

    const fromFiles = getCheckpointFiles(fromId);
    const toFiles = getCheckpointFiles(toId);

    const fromFile = fromFiles.find((f) => f.path === filePath);
    const toFile = toFiles.find((f) => f.path === filePath);

    if (!fromFile && !toFile) {
      return null;
    }

    if (!fromFile) {
      return {
        path: filePath,
        fromContent: undefined,
        toContent: toFile!.content,
        status: 'added',
      };
    }

    if (!toFile) {
      return {
        path: filePath,
        fromContent: fromFile.content,
        toContent: undefined,
        status: 'removed',
      };
    }

    return {
      path: filePath,
      fromContent: fromFile.content,
      toContent: toFile.content,
      status: fromFile.contentHash === toFile.contentHash ? 'unchanged' : 'modified',
    };
  }

  /**
   * Get a single file from a checkpoint
   * @param checkpointId - Checkpoint UUID
   * @param filePath - File path to retrieve
   * @returns File content or null if not found
   */
  static getCheckpointFile(checkpointId: string, filePath: string): CheckpointFile | null {
    this.ensureInitialized();

    const files = getCheckpointFiles(checkpointId);
    return files.find((f) => f.path === filePath) || null;
  }

  /**
   * Export a checkpoint to a named git branch
   *
   * Creates a branch like `recall/checkpoint/<name>` with the checkpoint files
   * at their actual file paths, ready for checkout and use.
   *
   * @param checkpointId - Checkpoint UUID
   * @param branchName - Branch name (will be prefixed with recall/checkpoint/)
   * @param cwd - Working directory for git operations
   * @returns Result with branch name if successful
   */
  static async exportToGitBranch(
    checkpointId: string,
    branchName: string,
    cwd: string
  ): Promise<GitCheckpointResult> {
    this.ensureInitialized();

    // Get checkpoint with files
    const checkpoint = getCheckpointWithFiles(checkpointId);
    if (!checkpoint) {
      return { success: false, error: 'Checkpoint not found' };
    }

    // Export to git
    const result = await GitCheckpointService.exportToBranch(
      cwd,
      checkpointId,
      branchName,
      checkpoint.files.map((f) => ({ path: f.path, content: f.content })),
      {
        name: checkpoint.name,
        sessionId: checkpoint.sessionId,
        frameIndex: checkpoint.frameIndex,
        createdAt: checkpoint.createdAt,
      }
    );

    // Update database with export branch
    if (result.success && result.branchName) {
      updateCheckpointExportBranch(checkpointId, result.branchName);
    }

    return result;
  }

  /**
   * Check if git checkpoint storage is available for a directory
   */
  static isGitAvailable(cwd: string): boolean {
    return GitCheckpointService.isAvailable(cwd);
  }

  /**
   * Get git checkpoint storage status for a repository
   */
  static getGitStatus(cwd: string): {
    available: boolean;
    storageBranchExists: boolean;
    checkpointCount: number;
  } {
    return GitCheckpointService.getStatus(cwd);
  }
}
