#!/usr/bin/env tsx
/**
 * Token Backfill Script
 *
 * Re-parses existing session files to extract and persist token usage data.
 * Run this after upgrading to populate token stats for historical sessions.
 *
 * Usage:
 *   npx tsx backend/src/scripts/backfill-tokens.ts
 *   npx tsx backend/src/scripts/backfill-tokens.ts --dry-run
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import readline from 'readline';
import { getTranscriptDbInstance } from '../db/transcript-connection';
import { initializeTranscriptSchema } from '../db/transcript-queries';
import {
  initializeTokenSchema,
  updateSessionTokens,
  calculateEstimatedCost,
} from '../db/token-queries';
import type { TokenUsage } from '../types/transcript';

interface SessionToBackfill {
  sessionId: string;
  project: string;
  filePath: string | null;
}

interface BackfillStats {
  total: number;
  updated: number;
  skipped: number;
  failed: number;
  totalTokensFound: number;
}

/**
 * Find the transcript file path for a session
 */
function findTranscriptFile(sessionId: string, project: string): string | null {
  // Convert project path to Claude's encoded format
  const encodedProject = project.replace(/^\//, '-').replace(/\//g, '-');
  const claudeDir = path.join(os.homedir(), '.claude', 'projects', encodedProject);

  const jsonlPath = path.join(claudeDir, `${sessionId}.jsonl`);
  if (fs.existsSync(jsonlPath)) {
    return jsonlPath;
  }

  return null;
}

/**
 * Parse token usage from a session file
 */
async function parseTokenUsage(filePath: string): Promise<{
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
}> {
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheCreationTokens = 0;
  let cacheReadTokens = 0;

  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) continue;

    try {
      const entry = JSON.parse(line);

      // Look for usage in message.usage (Claude format)
      const usage: TokenUsage | undefined = entry.message?.usage;

      if (usage) {
        inputTokens += usage.input_tokens || 0;
        outputTokens += usage.output_tokens || 0;
        cacheCreationTokens += usage.cache_creation_input_tokens || 0;
        cacheReadTokens += usage.cache_read_input_tokens || 0;
      }
    } catch {
      // Skip malformed lines
      continue;
    }
  }

  return { inputTokens, outputTokens, cacheCreationTokens, cacheReadTokens };
}

/**
 * Get all sessions that need token backfill
 */
function getSessionsToBackfill(): SessionToBackfill[] {
  const db = getTranscriptDbInstance();

  // Get all sessions where tokens are still 0 or null
  const sessions = db
    .prepare(
      `
    SELECT session_id, project
    FROM session_metadata
    WHERE agent_type = 'claude'
      AND (total_input_tokens IS NULL OR total_input_tokens = 0)
    ORDER BY start_time DESC
  `
    )
    .all() as Array<{ session_id: string; project: string }>;

  return sessions.map((s) => ({
    sessionId: s.session_id,
    project: s.project,
    filePath: findTranscriptFile(s.session_id, s.project),
  }));
}

/**
 * Main backfill function
 */
async function backfillTokens(dryRun: boolean = false): Promise<BackfillStats> {
  console.log('\n📊 Token Usage Backfill\n');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE'}\n`);

  // Initialize schemas
  initializeTranscriptSchema();
  initializeTokenSchema();

  const sessions = getSessionsToBackfill();
  console.log(`Found ${sessions.length} sessions to process\n`);

  const stats: BackfillStats = {
    total: sessions.length,
    updated: 0,
    skipped: 0,
    failed: 0,
    totalTokensFound: 0,
  };

  for (let i = 0; i < sessions.length; i++) {
    const session = sessions[i];
    const progress = `[${i + 1}/${sessions.length}]`;

    if (!session) continue;

    if (!session.filePath) {
      console.log(`${progress} ⏭️  ${session.sessionId.slice(0, 8)}... (file not found)`);
      stats.skipped++;
      continue;
    }

    try {
      const tokens = await parseTokenUsage(session.filePath);
      const totalTokens = tokens.inputTokens + tokens.outputTokens;

      if (totalTokens === 0) {
        console.log(`${progress} ⏭️  ${session.sessionId.slice(0, 8)}... (no tokens)`);
        stats.skipped++;
        continue;
      }

      const estimatedCostCents = calculateEstimatedCost(tokens.inputTokens, tokens.outputTokens);

      if (!dryRun) {
        updateSessionTokens(session.sessionId, {
          inputTokens: tokens.inputTokens,
          outputTokens: tokens.outputTokens,
          cacheCreationTokens: tokens.cacheCreationTokens,
          cacheReadTokens: tokens.cacheReadTokens,
          estimatedCostCents,
        });
      }

      const costDisplay = (estimatedCostCents / 100).toFixed(2);
      console.log(
        `${progress} ✅ ${session.sessionId.slice(0, 8)}... ` +
          `${tokens.inputTokens.toLocaleString()} in / ${tokens.outputTokens.toLocaleString()} out ` +
          `($${costDisplay})`
      );

      stats.updated++;
      stats.totalTokensFound += totalTokens;
    } catch (error) {
      console.log(
        `${progress} ❌ ${session.sessionId.slice(0, 8)}... ` +
          `(${error instanceof Error ? error.message : 'unknown error'})`
      );
      stats.failed++;
    }
  }

  return stats;
}

/**
 * Print summary
 */
function printSummary(stats: BackfillStats, dryRun: boolean): void {
  console.log('\n' + '='.repeat(50));
  console.log('Summary');
  console.log('='.repeat(50));
  console.log(`Total sessions:    ${stats.total}`);
  console.log(`Updated:           ${stats.updated}`);
  console.log(`Skipped:           ${stats.skipped}`);
  console.log(`Failed:            ${stats.failed}`);
  console.log(`Total tokens:      ${stats.totalTokensFound.toLocaleString()}`);

  if (dryRun) {
    console.log('\n⚠️  DRY RUN - No changes were made');
    console.log('Run without --dry-run to apply changes');
  } else {
    console.log('\n✅ Backfill complete!');
  }
}

// Main execution
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run') || args.includes('-n');

backfillTokens(dryRun)
  .then((stats) => {
    printSummary(stats, dryRun);
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Backfill failed:', error);
    process.exit(1);
  });
