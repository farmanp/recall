import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export interface GitContext {
  branch: string;
  headCommit: string | null;
  commitMessage: string | null;
  parentCommit: string | null;
  isDirty: boolean;
  stagedFiles: string[];
  modifiedFiles: string[];
  untrackedCount: number;
}

export interface GitCommit {
  hash: string;
  message: string;
  authorName: string;
  authorEmail: string;
  committedAt: string;
  committedAtEpoch: number;
}

export class GitExtractor {
  private static execGit(command: string, cwd: string): string | null {
    try {
      const result = execSync(`git ${command}`, {
        cwd,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 5000,
      });
      return result.trim();
    } catch {
      return null;
    }
  }

  static isGitRepo(cwd: string): boolean {
    if (!cwd || !fs.existsSync(cwd)) {
      return false;
    }
    const result = GitExtractor.execGit('rev-parse --git-dir', cwd);
    return result !== null;
  }

  static extractGitContext(cwd: string): GitContext | null {
    if (!GitExtractor.isGitRepo(cwd)) {
      return null;
    }
    try {
      let branch = GitExtractor.execGit('branch --show-current', cwd);
      if (!branch) {
        branch = 'HEAD detached';
      }
      const headCommit = GitExtractor.execGit('rev-parse --short HEAD', cwd);
      let commitMessage: string | null = null;
      if (headCommit) {
        commitMessage = GitExtractor.execGit('log -1 --format=%s', cwd);
      }
      let parentCommit: string | null = null;
      if (headCommit) {
        parentCommit = GitExtractor.execGit('rev-parse --short HEAD^', cwd);
      }
      const statusOutput = GitExtractor.execGit('status --porcelain', cwd);
      const isDirty = statusOutput !== null && statusOutput.length > 0;
      const stagedOutput = GitExtractor.execGit('diff --cached --name-only', cwd);
      const stagedFiles = stagedOutput ? stagedOutput.split('\n').filter(Boolean) : [];
      const modifiedOutput = GitExtractor.execGit('diff --name-only', cwd);
      const modifiedFiles = modifiedOutput ? modifiedOutput.split('\n').filter(Boolean) : [];
      const untrackedOutput = GitExtractor.execGit('ls-files --others --exclude-standard', cwd);
      const untrackedCount = untrackedOutput
        ? untrackedOutput.split('\n').filter(Boolean).length
        : 0;
      return {
        branch,
        headCommit,
        commitMessage,
        parentCommit,
        isDirty,
        stagedFiles,
        modifiedFiles,
        untrackedCount,
      };
    } catch (error) {
      console.warn('[GitExtractor] Failed to extract git context:', error);
      return null;
    }
  }

  static getCommitsInTimeRange(cwd: string, startTime: number, endTime: number): GitCommit[] {
    if (!GitExtractor.isGitRepo(cwd)) {
      return [];
    }
    try {
      const startDate = new Date(startTime).toISOString();
      const endDate = new Date(endTime).toISOString();
      const logOutput = GitExtractor.execGit(
        `log --after="${startDate}" --before="${endDate}" --format="%H|%s|%an|%ae|%aI"`,
        cwd
      );
      if (!logOutput) {
        return [];
      }
      const commits: GitCommit[] = [];
      const lines = logOutput.split('\n').filter(Boolean);
      for (const line of lines) {
        const parts = line.split('|');
        if (parts.length >= 5) {
          const hash = parts[0] || '';
          const message = parts[1] || '';
          const authorName = parts[2] || '';
          const authorEmail = parts[3] || '';
          const timestamp = parts[4] || new Date().toISOString();
          commits.push({
            hash,
            message,
            authorName,
            authorEmail,
            committedAt: timestamp,
            committedAtEpoch: new Date(timestamp).getTime(),
          });
        }
      }
      return commits;
    } catch (error) {
      console.warn('[GitExtractor] Failed to get commits in time range:', error);
      return [];
    }
  }

  // ============================================================================
  // Write Operations (for git checkpoint storage)
  // ============================================================================

  /**
   * Execute a git write command with longer timeout
   * Unlike read operations, write operations may take longer
   */
  private static execGitWrite(command: string, cwd: string, timeout = 30000): string | null {
    try {
      const result = execSync(`git ${command}`, {
        cwd,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout,
      });
      return result.trim();
    } catch {
      return null;
    }
  }

  /**
   * Get the root directory of a git repository
   */
  static getRepoRoot(cwd: string): string | null {
    return GitExtractor.execGit('rev-parse --show-toplevel', cwd);
  }

  /**
   * Get the current branch name
   */
  static getCurrentBranch(cwd: string): string | null {
    const branch = GitExtractor.execGit('branch --show-current', cwd);
    if (branch) return branch;

    // If in detached HEAD state, return the commit hash
    const head = GitExtractor.execGit('rev-parse --short HEAD', cwd);
    return head ? `HEAD:${head}` : null;
  }

  /**
   * Check if a branch exists
   */
  static branchExists(cwd: string, branchName: string): boolean {
    const result = GitExtractor.execGit(`rev-parse --verify ${branchName}`, cwd);
    return result !== null;
  }

  /**
   * Create an orphan branch (no history)
   * Returns true if successful
   */
  static createOrphanBranch(cwd: string, branchName: string): boolean {
    // Create an orphan branch with an initial empty commit
    const checkoutResult = GitExtractor.execGitWrite(`checkout --orphan ${branchName}`, cwd);
    if (checkoutResult === null) return false;

    // Remove all files from the index (we'll add our own)
    GitExtractor.execGitWrite('rm -rf .', cwd);

    return true;
  }

  /**
   * Switch to a branch
   * @param create - If true, create the branch if it doesn't exist
   */
  static switchBranch(cwd: string, branchName: string, create = false): boolean {
    const flag = create ? '-B' : '';
    const result = GitExtractor.execGitWrite(`checkout ${flag} ${branchName}`, cwd);
    return result !== null;
  }

  /**
   * Stash current changes (including untracked files)
   * Returns stash reference if successful, null otherwise
   */
  static stashChanges(cwd: string, message = 'recall-checkpoint-stash'): string | null {
    // Check if there are changes to stash
    const status = GitExtractor.execGit('status --porcelain', cwd);
    if (!status || status.length === 0) {
      return 'no-changes'; // Nothing to stash
    }

    const result = GitExtractor.execGitWrite(`stash push -u -m "${message}"`, cwd);
    if (result === null) return null;

    // Get the stash reference
    const stashList = GitExtractor.execGit('stash list', cwd);
    if (stashList && stashList.includes(message)) {
      return 'stash@{0}';
    }
    return 'stash@{0}';
  }

  /**
   * Pop stash to restore changes
   * @param stashId - Specific stash ID or undefined for most recent
   */
  static popStash(cwd: string, stashId?: string): boolean {
    if (stashId === 'no-changes') return true; // Nothing was stashed

    const ref = stashId || 'stash@{0}';
    const result = GitExtractor.execGitWrite(`stash pop ${ref}`, cwd);
    return result !== null;
  }

  /**
   * Commit files to the current branch
   * @param files - Map of file path (relative to cwd) -> content
   * @param message - Commit message
   * @returns Commit SHA if successful, null otherwise
   */
  static commitFiles(cwd: string, files: Map<string, string>, message: string): string | null {
    try {
      // Write files to disk
      for (const [filePath, content] of files.entries()) {
        const fullPath = path.join(cwd, filePath);
        const dir = path.dirname(fullPath);

        // Create directory if it doesn't exist
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(fullPath, content, 'utf8');
      }

      // Stage all files
      const filePaths = Array.from(files.keys());
      for (const filePath of filePaths) {
        const addResult = GitExtractor.execGitWrite(`add "${filePath}"`, cwd);
        if (addResult === null) {
          console.warn(`[GitExtractor] Failed to stage file: ${filePath}`);
        }
      }

      // Create commit
      const commitResult = GitExtractor.execGitWrite(
        `commit -m "${message.replace(/"/g, '\\"')}"`,
        cwd
      );
      if (commitResult === null) return null;

      // Get the commit SHA
      return GitExtractor.execGit('rev-parse HEAD', cwd);
    } catch (error) {
      console.error('[GitExtractor] Failed to commit files:', error);
      return null;
    }
  }

  /**
   * Get file content at a specific commit
   */
  static getFileAtCommit(cwd: string, commitSha: string, filePath: string): string | null {
    return GitExtractor.execGit(`show ${commitSha}:${filePath}`, cwd);
  }

  /**
   * List all files in a commit
   */
  static listFilesInCommit(cwd: string, commitSha: string): string[] {
    const result = GitExtractor.execGit(`ls-tree -r --name-only ${commitSha}`, cwd);
    if (!result) return [];
    return result.split('\n').filter(Boolean);
  }

  /**
   * Check if the working directory is clean (no uncommitted changes)
   */
  static isClean(cwd: string): boolean {
    const status = GitExtractor.execGit('status --porcelain', cwd);
    return status === null || status.length === 0;
  }

  /**
   * Delete a local branch
   */
  static deleteBranch(cwd: string, branchName: string, force = false): boolean {
    const flag = force ? '-D' : '-d';
    const result = GitExtractor.execGitWrite(`branch ${flag} ${branchName}`, cwd);
    return result !== null;
  }
}
