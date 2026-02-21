/**
 * Git Checkpoint Service
 *
 * Provides git-based storage for checkpoints, storing file states on a dedicated
 * orphan branch. This enables:
 * - Persistent checkpoint storage in the repository
 * - Export to named branches for easy access
 * - Integration with git workflows
 *
 * Architecture:
 * - Storage branch: `recall/checkpoints/v1` (orphan, stores all checkpoints)
 * - Export branches: `recall/checkpoint/<name>` (user-created from any checkpoint)
 * - SQLite remains primary storage; git is secondary
 */

import crypto from 'crypto';
import path from 'path';
import { GitExtractor } from './git-extractor';
import { SecretRedactor, type RedactionStats } from './secret-redactor';

// ============================================================================
// Types
// ============================================================================

export interface GitCheckpointConfig {
  storageBranch: string;
  exportBranchPrefix: string;
}

export const DEFAULT_CONFIG: GitCheckpointConfig = {
  storageBranch: 'recall/checkpoints/v1',
  exportBranchPrefix: 'recall/checkpoint/',
};

export interface GitCheckpointMetadata {
  checkpointId: string;
  sessionId: string;
  name: string;
  frameIndex: number;
  createdAt: string;
  originalBranch: string;
  projectPath: string;
  fileCount: number;
  redactionStats?: RedactionStats;
}

export interface GitCheckpointFile {
  path: string;
  content: string;
}

export interface GitCheckpointResult {
  success: boolean;
  commitSha?: string;
  branchName?: string;
  error?: string;
  redactionStats?: RedactionStats;
}

// ============================================================================
// Service
// ============================================================================

export class GitCheckpointService {
  private static config = DEFAULT_CONFIG;

  /**
   * Configure the service (optional, uses defaults otherwise)
   */
  static configure(config: Partial<GitCheckpointConfig>): void {
    GitCheckpointService.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get the project hash for directory organization
   * Uses SHA-256 of the absolute project path
   */
  private static getProjectHash(projectPath: string): string {
    return crypto.createHash('sha256').update(projectPath).digest('hex').slice(0, 12);
  }

  /**
   * Get the relative path from repo root
   */
  private static getRelativePath(cwd: string, filePath: string): string {
    const repoRoot = GitExtractor.getRepoRoot(cwd);
    if (!repoRoot) return filePath;

    // If the file path is absolute and within the repo, make it relative
    if (path.isAbsolute(filePath)) {
      const relative = path.relative(repoRoot, filePath);
      // Ensure we don't go outside the repo
      if (!relative.startsWith('..')) {
        return relative;
      }
    }
    return filePath;
  }

  /**
   * Redact secrets from files before storing in git
   */
  private static redactFiles(files: GitCheckpointFile[]): {
    redacted: GitCheckpointFile[];
    stats: RedactionStats;
  } {
    const aggregateStats: RedactionStats = {
      totalRedactions: 0,
      byPattern: {},
    };

    const redacted = files.map((file) => {
      const redactedContent = SecretRedactor.redact(file.content);
      const fileStats = SecretRedactor.getLastRedactionStats();

      // Aggregate stats
      aggregateStats.totalRedactions += fileStats.totalRedactions;
      for (const [pattern, count] of Object.entries(fileStats.byPattern)) {
        aggregateStats.byPattern[pattern] = (aggregateStats.byPattern[pattern] || 0) + count;
      }

      return { path: file.path, content: redactedContent };
    });

    return { redacted, stats: aggregateStats };
  }

  /**
   * Store a checkpoint to the git storage branch
   *
   * @param cwd - Working directory (must be in a git repo)
   * @param checkpointId - Unique checkpoint identifier
   * @param files - Array of files with their content
   * @param metadata - Checkpoint metadata
   * @returns Result with commit SHA if successful
   */
  static async storeCheckpoint(
    cwd: string,
    checkpointId: string,
    files: GitCheckpointFile[],
    metadata: Omit<GitCheckpointMetadata, 'redactionStats'>
  ): Promise<GitCheckpointResult> {
    // Verify we're in a git repo
    if (!GitExtractor.isGitRepo(cwd)) {
      return { success: false, error: 'Not a git repository' };
    }

    const repoRoot = GitExtractor.getRepoRoot(cwd);
    if (!repoRoot) {
      return { success: false, error: 'Could not determine repository root' };
    }

    // Save current state
    const originalBranch = GitExtractor.getCurrentBranch(cwd);
    if (!originalBranch) {
      return { success: false, error: 'Could not determine current branch' };
    }

    let stashId: string | null = null;

    try {
      // Stash any current changes
      stashId = GitExtractor.stashChanges(cwd, `recall-pre-checkpoint-${checkpointId}`);

      // Check if storage branch exists, create if not
      const { storageBranch } = GitCheckpointService.config;
      const branchExists = GitExtractor.branchExists(cwd, storageBranch);

      if (!branchExists) {
        // Create orphan branch
        if (!GitExtractor.createOrphanBranch(repoRoot, storageBranch)) {
          throw new Error(`Failed to create storage branch: ${storageBranch}`);
        }
      } else {
        // Switch to existing storage branch
        if (!GitExtractor.switchBranch(repoRoot, storageBranch)) {
          throw new Error(`Failed to switch to storage branch: ${storageBranch}`);
        }
      }

      // Calculate project hash for directory organization
      const projectHash = GitCheckpointService.getProjectHash(metadata.projectPath);
      const checkpointDir = `${projectHash}/${checkpointId}`;

      // Redact secrets from files
      const { redacted: redactedFiles, stats: redactionStats } =
        GitCheckpointService.redactFiles(files);

      // Prepare files to commit
      const filesToCommit = new Map<string, string>();

      // Add metadata.json
      const fullMetadata: GitCheckpointMetadata = {
        ...metadata,
        originalBranch: originalBranch.replace('HEAD:', ''),
        redactionStats,
      };
      filesToCommit.set(`${checkpointDir}/metadata.json`, JSON.stringify(fullMetadata, null, 2));

      // Add checkpoint files
      for (const file of redactedFiles) {
        const relativePath = GitCheckpointService.getRelativePath(cwd, file.path);
        filesToCommit.set(`${checkpointDir}/files/${relativePath}`, file.content);
      }

      // Commit files
      const commitMessage = `checkpoint: ${metadata.name} (${checkpointId.slice(0, 8)})

Session: ${metadata.sessionId}
Frame: ${metadata.frameIndex}
Files: ${files.length}
${redactionStats.totalRedactions > 0 ? `Redacted: ${redactionStats.totalRedactions} secrets` : ''}`;

      const commitSha = GitExtractor.commitFiles(repoRoot, filesToCommit, commitMessage);
      if (!commitSha) {
        throw new Error('Failed to create checkpoint commit');
      }

      // Switch back to original branch
      GitExtractor.switchBranch(repoRoot, originalBranch.replace('HEAD:', ''));

      // Restore stash if needed
      if (stashId && stashId !== 'no-changes') {
        GitExtractor.popStash(cwd, stashId);
      }

      return {
        success: true,
        commitSha,
        branchName: storageBranch,
        redactionStats,
      };
    } catch (error) {
      // Attempt to restore original state
      try {
        GitExtractor.switchBranch(repoRoot!, originalBranch!);
        if (stashId && stashId !== 'no-changes') {
          GitExtractor.popStash(cwd, stashId);
        }
      } catch {
        console.error('[GitCheckpointService] Failed to restore original state');
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Export a checkpoint to a named branch
   *
   * Creates a branch like `recall/checkpoint/<name>` with the actual file
   * structure (not nested in checkpoint directories) so it can be checked out
   * and used directly.
   *
   * @param cwd - Working directory
   * @param checkpointId - Checkpoint identifier
   * @param branchName - User-provided branch name (will be prefixed)
   * @param files - Checkpoint files to export
   * @param metadata - Checkpoint metadata
   * @returns Result with branch name if successful
   */
  static async exportToBranch(
    cwd: string,
    checkpointId: string,
    branchName: string,
    files: GitCheckpointFile[],
    metadata: { name: string; sessionId: string; frameIndex: number; createdAt: string }
  ): Promise<GitCheckpointResult> {
    // Verify we're in a git repo
    if (!GitExtractor.isGitRepo(cwd)) {
      return { success: false, error: 'Not a git repository' };
    }

    const repoRoot = GitExtractor.getRepoRoot(cwd);
    if (!repoRoot) {
      return { success: false, error: 'Could not determine repository root' };
    }

    // Save current state
    const originalBranch = GitExtractor.getCurrentBranch(cwd);
    if (!originalBranch) {
      return { success: false, error: 'Could not determine current branch' };
    }

    const { exportBranchPrefix } = GitCheckpointService.config;
    const fullBranchName = `${exportBranchPrefix}${branchName}`;

    // Check if branch already exists
    if (GitExtractor.branchExists(cwd, fullBranchName)) {
      return { success: false, error: `Branch already exists: ${fullBranchName}` };
    }

    let stashId: string | null = null;

    try {
      // Stash any current changes
      stashId = GitExtractor.stashChanges(cwd, `recall-pre-export-${checkpointId}`);

      // Create orphan branch for clean export
      if (!GitExtractor.createOrphanBranch(repoRoot, fullBranchName)) {
        throw new Error(`Failed to create export branch: ${fullBranchName}`);
      }

      // Redact secrets from files
      const { redacted: redactedFiles, stats: redactionStats } =
        GitCheckpointService.redactFiles(files);

      // Prepare files to commit (actual file paths, not nested)
      const filesToCommit = new Map<string, string>();

      // Add checkpoint metadata file
      const checkpointMetadata = {
        checkpointId,
        ...metadata,
        exportedAt: new Date().toISOString(),
        redactionStats,
      };
      filesToCommit.set('.recall-checkpoint.json', JSON.stringify(checkpointMetadata, null, 2));

      // Add files at their actual relative paths
      for (const file of redactedFiles) {
        const relativePath = GitCheckpointService.getRelativePath(cwd, file.path);
        filesToCommit.set(relativePath, file.content);
      }

      // Commit files
      const commitMessage = `recall checkpoint: ${metadata.name}

Exported from checkpoint: ${checkpointId}
Session: ${metadata.sessionId}
Frame: ${metadata.frameIndex}
Files: ${files.length}
${redactionStats.totalRedactions > 0 ? `Redacted: ${redactionStats.totalRedactions} secrets` : ''}

This branch was created by Recall checkpoint export.`;

      const commitSha = GitExtractor.commitFiles(repoRoot, filesToCommit, commitMessage);
      if (!commitSha) {
        throw new Error('Failed to create export commit');
      }

      // Switch back to original branch
      GitExtractor.switchBranch(repoRoot, originalBranch.replace('HEAD:', ''));

      // Restore stash if needed
      if (stashId && stashId !== 'no-changes') {
        GitExtractor.popStash(cwd, stashId);
      }

      return {
        success: true,
        commitSha,
        branchName: fullBranchName,
        redactionStats,
      };
    } catch (error) {
      // Attempt to restore original state and clean up
      try {
        GitExtractor.switchBranch(repoRoot!, originalBranch!);
        // Delete the failed branch if it was created
        GitExtractor.deleteBranch(repoRoot!, fullBranchName, true);
        if (stashId && stashId !== 'no-changes') {
          GitExtractor.popStash(cwd, stashId);
        }
      } catch {
        console.error('[GitCheckpointService] Failed to restore original state');
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * List checkpoints stored on the git branch
   * Returns metadata for all checkpoints found
   */
  static async listGitCheckpoints(cwd: string): Promise<GitCheckpointMetadata[]> {
    if (!GitExtractor.isGitRepo(cwd)) {
      return [];
    }

    const { storageBranch } = GitCheckpointService.config;

    // Check if storage branch exists
    if (!GitExtractor.branchExists(cwd, storageBranch)) {
      return [];
    }

    const repoRoot = GitExtractor.getRepoRoot(cwd);
    if (!repoRoot) {
      return [];
    }

    const checkpoints: GitCheckpointMetadata[] = [];

    try {
      // List all files in the storage branch
      const files = GitExtractor.listFilesInCommit(repoRoot, storageBranch);

      // Find all metadata.json files
      const metadataFiles = files.filter((f) => f.endsWith('/metadata.json'));

      for (const metadataPath of metadataFiles) {
        const content = GitExtractor.getFileAtCommit(repoRoot, storageBranch, metadataPath);
        if (content) {
          try {
            const metadata = JSON.parse(content) as GitCheckpointMetadata;
            checkpoints.push(metadata);
          } catch {
            console.warn(`[GitCheckpointService] Failed to parse metadata: ${metadataPath}`);
          }
        }
      }
    } catch (error) {
      console.error('[GitCheckpointService] Failed to list checkpoints:', error);
    }

    return checkpoints;
  }

  /**
   * Restore files from a git checkpoint
   */
  static async restoreFromGit(
    cwd: string,
    checkpointId: string
  ): Promise<GitCheckpointFile[] | null> {
    if (!GitExtractor.isGitRepo(cwd)) {
      return null;
    }

    const { storageBranch } = GitCheckpointService.config;
    const repoRoot = GitExtractor.getRepoRoot(cwd);

    if (!repoRoot || !GitExtractor.branchExists(cwd, storageBranch)) {
      return null;
    }

    try {
      // List all files in the storage branch to find the checkpoint
      const allFiles = GitExtractor.listFilesInCommit(repoRoot, storageBranch);

      // Find files for this checkpoint
      const checkpointPrefix = allFiles.find((f) => f.includes(`/${checkpointId}/metadata.json`));

      if (!checkpointPrefix) {
        return null;
      }

      // Extract the checkpoint directory prefix
      const prefix = checkpointPrefix.replace('/metadata.json', '/files/');

      // Get all checkpoint files
      const checkpointFiles = allFiles.filter((f) => f.startsWith(prefix));
      const files: GitCheckpointFile[] = [];

      for (const filePath of checkpointFiles) {
        const content = GitExtractor.getFileAtCommit(repoRoot, storageBranch, filePath);
        if (content !== null) {
          // Remove the prefix to get the original relative path
          const originalPath = filePath.slice(prefix.length);
          files.push({ path: originalPath, content });
        }
      }

      return files;
    } catch (error) {
      console.error('[GitCheckpointService] Failed to restore from git:', error);
      return null;
    }
  }

  /**
   * Check if git checkpoint storage is available for a directory
   */
  static isAvailable(cwd: string): boolean {
    return GitExtractor.isGitRepo(cwd);
  }

  /**
   * Get the status of git checkpoint storage for a repository
   */
  static getStatus(cwd: string): {
    available: boolean;
    storageBranchExists: boolean;
    checkpointCount: number;
  } {
    if (!GitExtractor.isGitRepo(cwd)) {
      return { available: false, storageBranchExists: false, checkpointCount: 0 };
    }

    const { storageBranch } = GitCheckpointService.config;
    const storageBranchExists = GitExtractor.branchExists(cwd, storageBranch);

    let checkpointCount = 0;
    if (storageBranchExists) {
      const repoRoot = GitExtractor.getRepoRoot(cwd);
      if (repoRoot) {
        const files = GitExtractor.listFilesInCommit(repoRoot, storageBranch);
        checkpointCount = files.filter((f) => f.endsWith('/metadata.json')).length;
      }
    }

    return {
      available: true,
      storageBranchExists,
      checkpointCount,
    };
  }
}
