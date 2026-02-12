import { execSync } from 'child_process';
import fs from 'fs';

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
}
