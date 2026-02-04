#!/usr/bin/env node
/**
 * CLI tool for importing Claude Code transcripts
 *
 * Usage:
 *   npm run import              # Import all from ~/.claude/projects/
 *   npm run import -- --single <file>  # Import a single file
 *   npm run import -- --help    # Show help
 */

import { bulkImportTranscripts, importTranscript, getImportProgress } from './transcript-importer';
import { initializeTranscriptSchema } from '../db/transcript-queries';

const args = process.argv.slice(2);

function printHelp() {
  console.log(`
Claude Code Transcript Importer
================================

Usage:
  npm run import                       # Bulk import all transcripts
  npm run import -- --single <file>    # Import a single file
  npm run import -- --stats            # Show import statistics
  npm run import -- --help             # Show this help

Options:
  --source <path>     Source directory (default: ~/.claude/projects/)
  --parallel <n>      Number of parallel imports (default: 10)
  --skip-existing     Skip already imported sessions (default: true)
  --no-skip           Force re-import existing sessions

Examples:
  # Import all transcripts from default location
  npm run import

  # Import from a specific directory
  npm run import -- --source /path/to/transcripts

  # Import a single file
  npm run import -- --single ~/.claude/projects/my-project/session-123.jsonl

  # Import with 20 parallel workers
  npm run import -- --parallel 20

  # Force re-import of all sessions
  npm run import -- --no-skip
`);
}

async function main() {
  // Parse arguments
  const options: any = {
    sourcePath: undefined,
    parallel: 10,
    skipExisting: true,
  };

  let mode: 'bulk' | 'single' | 'stats' | 'help' = 'bulk';
  let singleFile: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--help':
      case '-h':
        mode = 'help';
        break;

      case '--stats':
        mode = 'stats';
        break;

      case '--single':
        mode = 'single';
        singleFile = args[++i];
        break;

      case '--source':
        options.sourcePath = args[++i];
        break;

      case '--parallel':
        options.parallel = parseInt(args[++i] || '10', 10);
        break;

      case '--skip-existing':
        options.skipExisting = true;
        break;

      case '--no-skip':
        options.skipExisting = false;
        break;

      default:
        console.error(`Unknown option: ${arg}`);
        console.error('Run with --help for usage information');
        process.exit(1);
    }
  }

  // Initialize database
  initializeTranscriptSchema();

  // Execute based on mode
  switch (mode) {
    case 'help':
      printHelp();
      break;

    case 'stats':
      console.log('Import Statistics:\n');
      const stats = getImportProgress();
      console.log(`  Total sessions: ${stats.total}`);
      console.log(`  Pending:        ${stats.pending}`);
      console.log(`  Completed:      ${stats.completed}`);
      console.log(`  Failed:         ${stats.failed}`);
      break;

    case 'single':
      if (!singleFile) {
        console.error('Error: --single requires a file path');
        process.exit(1);
      }

      console.log(`Importing single file: ${singleFile}\n`);
      try {
        await importTranscript(singleFile);
        console.log('\n✓ Import completed successfully');
      } catch (error) {
        console.error('\n✗ Import failed:', error);
        process.exit(1);
      }
      break;

    case 'bulk':
      console.log('Starting bulk import...\n');

      // Add progress callback
      options.onProgress = (completed: number, total: number) => {
        const percent = Math.round((completed / total) * 100);
        const bar = createProgressBar(percent, 40);
        process.stdout.write(`\r${bar} ${completed}/${total} (${percent}%)`);
      };

      try {
        const summary = await bulkImportTranscripts(options);

        console.log('\n\nImport Summary:');
        console.log('===============');
        console.log(`  Total files:  ${summary.totalFiles}`);
        console.log(`  Successful:   ${summary.successful}`);
        console.log(`  Failed:       ${summary.failed}`);
        console.log(`  Skipped:      ${summary.skipped}`);
        console.log(`  Duration:     ${(summary.duration / 1000).toFixed(2)}s`);

        if (summary.failed > 0) {
          console.log('\nFailed imports:');
          summary.results
            .filter((r) => !r.success)
            .forEach((r) => {
              console.log(`  × ${r.sessionId}`);
              console.log(`    File: ${r.filePath}`);
              console.log(`    Error: ${r.error}`);
            });
        }

        if (summary.failed > 0) {
          process.exit(1);
        }
      } catch (error) {
        console.error('\n✗ Bulk import failed:', error);
        process.exit(1);
      }
      break;
  }
}

/**
 * Create a simple progress bar
 */
function createProgressBar(percent: number, width: number): string {
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;
  return `[${'█'.repeat(filled)}${' '.repeat(empty)}]`;
}

// Run CLI
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
