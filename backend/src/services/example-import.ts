/**
 * Example usage of the transcript-importer service
 *
 * This demonstrates how to use both single-file imports
 * and bulk imports with progress tracking.
 */

import { importTranscript, bulkImportTranscripts, getImportProgress } from './transcript-importer';
import { initializeTranscriptSchema } from '../db/transcript-queries';

/**
 * Example 1: Import a single transcript file
 */
async function exampleSingleImport() {
  console.log('=== Example 1: Single Import ===\n');

  // Initialize database schema first
  initializeTranscriptSchema();

  try {
    const filePath = '/Users/fpirzada/.claude/projects/my-project/session-123.jsonl';
    await importTranscript(filePath);
    console.log('✓ Successfully imported session');
  } catch (error) {
    console.error('✗ Import failed:', error);
  }
}

/**
 * Example 2: Bulk import all transcripts with progress tracking
 */
async function exampleBulkImport() {
  console.log('\n=== Example 2: Bulk Import ===\n');

  const summary = await bulkImportTranscripts({
    sourcePath: '/Users/fpirzada/.claude/projects',
    parallel: 10,
    skipExisting: true,
    onProgress: (completed, total) => {
      const percent = Math.round((completed / total) * 100);
      process.stdout.write(`\rProgress: ${completed}/${total} (${percent}%)`);
    },
  });

  console.log('\n\nImport Summary:');
  console.log(`  Total files: ${summary.totalFiles}`);
  console.log(`  Successful: ${summary.successful}`);
  console.log(`  Failed: ${summary.failed}`);
  console.log(`  Skipped: ${summary.skipped}`);
  console.log(`  Duration: ${(summary.duration / 1000).toFixed(2)}s`);

  // Show failed imports
  if (summary.failed > 0) {
    console.log('\nFailed imports:');
    summary.results
      .filter((r) => !r.success)
      .forEach((r) => {
        console.log(`  - ${r.filePath}`);
        console.log(`    Error: ${r.error}`);
      });
  }
}

/**
 * Example 3: Check import progress
 */
function exampleCheckProgress() {
  console.log('\n=== Example 3: Check Progress ===\n');

  const stats = getImportProgress();
  console.log('Import Statistics:');
  console.log(`  Total: ${stats.total}`);
  console.log(`  Pending: ${stats.pending}`);
  console.log(`  Completed: ${stats.completed}`);
  console.log(`  Failed: ${stats.failed}`);
}

/**
 * Run all examples
 */
async function main() {
  try {
    // Uncomment the example you want to run:

    // await exampleSingleImport();
    // await exampleBulkImport();
    // exampleCheckProgress();

    console.log('\nNote: Uncomment the examples in main() to run them.');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}
