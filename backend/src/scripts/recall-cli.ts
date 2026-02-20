#!/usr/bin/env node
/**
 * Recall CLI - Git Tracking Management
 *
 * Usage:
 *   npx recall enable          # Enable git tracking for current directory
 *   npx recall status          # Show tracking status and statistics
 *   npx recall disable         # Disable git tracking for current directory
 *   npx recall list            # List all enabled repositories
 *
 * This is inspired by Entire CLI's simple approach to repo management.
 */

import { execSync } from 'child_process';
import path from 'path';
import {
  initializeEnabledReposSchema,
  enableRepo,
  disableRepo,
  isRepoEnabled,
  getEnabledRepos,
  getEnabledRepo,
  getTrackingStats,
} from '../db/enabled-repos-queries';
import { initializeTranscriptSchema } from '../db/transcript-queries';
import { initializeGitActivitySchema } from '../db/git-queries';
import { hasGitIntegration, getRelaysStatus } from '../db/relays-queries';

const args = process.argv.slice(2);
const command = args[0] || 'help';

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
};

function printHelp(): void {
  console.log(`
${colors.bold}Recall - Git Tracking CLI${colors.reset}
${colors.dim}Track your AI coding sessions and link them to git commits${colors.reset}

${colors.bold}USAGE${colors.reset}
  recall <command> [options]

${colors.bold}COMMANDS${colors.reset}
  ${colors.cyan}enable${colors.reset}      Enable git tracking for the current repository
  ${colors.cyan}disable${colors.reset}     Disable git tracking for the current repository
  ${colors.cyan}status${colors.reset}      Show tracking status for the current repository
  ${colors.cyan}list${colors.reset}        List all enabled repositories
  ${colors.cyan}help${colors.reset}        Show this help message

${colors.bold}EXAMPLES${colors.reset}
  ${colors.dim}# Enable tracking for your project${colors.reset}
  cd /path/to/your/project
  recall enable

  ${colors.dim}# Check tracking status${colors.reset}
  recall status

  ${colors.dim}# View all tracked repositories${colors.reset}
  recall list

${colors.bold}HOW IT WORKS${colors.reset}
  1. Run 'recall enable' in your git repository
  2. Use Claude Code (or other AI agents) to work on your project
  3. Sessions are automatically imported with git context
  4. View sessions organized by commits at http://localhost:3001/relays
`);
}

/**
 * Check if current directory is a git repository
 */
function isGitRepo(dir: string): boolean {
  try {
    execSync('git rev-parse --is-inside-work-tree', {
      cwd: dir,
      stdio: 'pipe',
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the git repository root
 */
function getGitRoot(dir: string): string | null {
  try {
    const result = execSync('git rev-parse --show-toplevel', {
      cwd: dir,
      stdio: 'pipe',
      encoding: 'utf8',
    });
    return result.trim();
  } catch {
    return null;
  }
}

/**
 * Get current branch name
 */
function getCurrentBranch(dir: string): string | null {
  try {
    const result = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: dir,
      stdio: 'pipe',
      encoding: 'utf8',
    });
    return result.trim();
  } catch {
    return null;
  }
}

/**
 * Get repo name from git remote or directory name
 */
function getRepoName(repoPath: string): string {
  try {
    const remote = execSync('git remote get-url origin', {
      cwd: repoPath,
      stdio: 'pipe',
      encoding: 'utf8',
    }).trim();

    // Extract name from git URL
    const match = remote.match(/\/([^/]+?)(?:\.git)?$/);
    if (match && match[1]) {
      return match[1];
    }
  } catch {
    // Fall back to directory name
  }
  return path.basename(repoPath);
}

/**
 * Enable command - register current repo for tracking
 */
function handleEnable(): void {
  const cwd = process.cwd();

  // Check if in a git repo
  if (!isGitRepo(cwd)) {
    console.log(`${colors.red}✗${colors.reset} Not a git repository`);
    console.log(`${colors.dim}  Run this command from inside a git repository${colors.reset}`);
    process.exit(1);
  }

  const repoPath = getGitRoot(cwd);
  if (!repoPath) {
    console.log(`${colors.red}✗${colors.reset} Could not determine git root`);
    process.exit(1);
  }

  // Check if already enabled
  if (isRepoEnabled(repoPath)) {
    console.log(
      `${colors.yellow}!${colors.reset} Already enabled: ${colors.cyan}${repoPath}${colors.reset}`
    );
    console.log(`${colors.dim}  Run 'recall status' to see tracking info${colors.reset}`);
    return;
  }

  // Enable the repo
  const repoName = getRepoName(repoPath);
  const repo = enableRepo(repoPath, repoName);

  console.log(
    `${colors.green}✓${colors.reset} Git tracking enabled for ${colors.cyan}${repo.repoName}${colors.reset}`
  );
  console.log(`${colors.dim}  Path: ${repoPath}${colors.reset}`);
  console.log('');
  console.log(`${colors.bold}Next steps:${colors.reset}`);
  console.log('  1. Use Claude Code (or other AI agents) to work on this project');
  console.log('  2. Sessions will be imported with git context automatically');
  console.log('  3. View sessions by commit: http://localhost:3001/relays');
  console.log('');
  console.log(`${colors.dim}Tip: Run 'recall import' to import existing sessions${colors.reset}`);
}

/**
 * Disable command - unregister current repo
 */
function handleDisable(): void {
  const cwd = process.cwd();
  const repoPath = getGitRoot(cwd) || cwd;

  if (!isRepoEnabled(repoPath)) {
    console.log(`${colors.yellow}!${colors.reset} Git tracking not enabled for this directory`);
    return;
  }

  const removed = disableRepo(repoPath);
  if (removed) {
    console.log(
      `${colors.green}✓${colors.reset} Git tracking disabled for ${colors.cyan}${repoPath}${colors.reset}`
    );
    console.log(`${colors.dim}  Existing session data is preserved${colors.reset}`);
  } else {
    console.log(`${colors.red}✗${colors.reset} Failed to disable tracking`);
    process.exit(1);
  }
}

/**
 * Status command - show tracking info for current repo
 */
function handleStatus(): void {
  const cwd = process.cwd();
  const repoPath = getGitRoot(cwd) || cwd;
  const isGit = isGitRepo(cwd);
  const branch = isGit ? getCurrentBranch(cwd) : null;

  console.log(`${colors.bold}Recall Status${colors.reset}`);
  console.log('');

  // Current directory info
  console.log(`${colors.bold}Current Directory${colors.reset}`);
  console.log(`  Path:       ${colors.cyan}${repoPath}${colors.reset}`);
  console.log(
    `  Git repo:   ${isGit ? `${colors.green}Yes${colors.reset}` : `${colors.red}No${colors.reset}`}`
  );
  if (branch) {
    console.log(`  Branch:     ${colors.cyan}${branch}${colors.reset}`);
  }

  const repo = getEnabledRepo(repoPath);
  if (repo) {
    console.log(
      `  Tracking:   ${colors.green}Enabled${colors.reset} ${colors.dim}(since ${new Date(repo.enabledAt).toLocaleDateString()})${colors.reset}`
    );
    if (repo.sessionCount > 0) {
      console.log(`  Sessions:   ${repo.sessionCount}`);
    }
    if (repo.commitCount > 0) {
      console.log(`  Commits:    ${repo.commitCount}`);
    }
  } else {
    console.log(`  Tracking:   ${colors.dim}Not enabled${colors.reset}`);
    if (isGit) {
      console.log(`${colors.dim}  Run 'recall enable' to start tracking${colors.reset}`);
    }
  }

  console.log('');

  // Global stats
  const hasData = hasGitIntegration();
  if (hasData) {
    const relaysStatus = getRelaysStatus();
    console.log(`${colors.bold}Global Statistics${colors.reset}`);
    console.log(`  Total commits:   ${relaysStatus.totalCommits}`);
    console.log(`  Total branches:  ${relaysStatus.uniqueBranches}`);
  } else {
    console.log(
      `${colors.dim}No git tracking data yet. Enable a repo and import sessions to get started.${colors.reset}`
    );
  }
}

/**
 * List command - show all enabled repos
 */
function handleList(): void {
  const repos = getEnabledRepos();

  console.log(`${colors.bold}Enabled Repositories${colors.reset}`);
  console.log('');

  if (repos.length === 0) {
    console.log(`${colors.dim}No repositories enabled for git tracking.${colors.reset}`);
    console.log('');
    console.log('To enable tracking:');
    console.log('  1. cd /path/to/your/repo');
    console.log('  2. recall enable');
    return;
  }

  for (const repo of repos) {
    const enabledDate = new Date(repo.enabledAt).toLocaleDateString();
    console.log(
      `${colors.green}●${colors.reset} ${colors.bold}${repo.repoName || path.basename(repo.repoPath)}${colors.reset}`
    );
    console.log(`  ${colors.dim}${repo.repoPath}${colors.reset}`);
    console.log(
      `  ${colors.dim}Enabled: ${enabledDate} · Sessions: ${repo.sessionCount} · Commits: ${repo.commitCount}${colors.reset}`
    );
    console.log('');
  }

  const stats = getTrackingStats();
  console.log(
    `${colors.dim}Total: ${stats.enabledRepos} repos · ${stats.totalCommits} commits tracked${colors.reset}`
  );
}

// Main execution
async function main(): Promise<void> {
  // Initialize database schemas
  initializeTranscriptSchema();
  initializeGitActivitySchema();
  initializeEnabledReposSchema();

  switch (command) {
    case 'enable':
      handleEnable();
      break;

    case 'disable':
      handleDisable();
      break;

    case 'status':
      handleStatus();
      break;

    case 'list':
      handleList();
      break;

    case 'help':
    case '--help':
    case '-h':
      printHelp();
      break;

    default:
      console.log(`${colors.red}Unknown command: ${command}${colors.reset}`);
      console.log(`Run 'recall help' for usage information`);
      process.exit(1);
  }
}

main().catch((error) => {
  console.error(`${colors.red}Error:${colors.reset}`, error.message);
  process.exit(1);
});
