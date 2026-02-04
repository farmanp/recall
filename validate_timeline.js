#!/usr/bin/env node
/**
 * Timeline Validation Script
 * Purpose: Validate session reconstruction logic before building the app
 * Usage: node validate_timeline.js [session_id]
 * Output: validation_report.json + console output + exit code
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(process.env.HOME, '.claude-mem', 'claude-mem.db');
const db = new Database(DB_PATH, { readonly: true });

// Get session ID from args or use most recent
let sessionId = process.argv[2];
if (!sessionId) {
  const result = db
    .prepare(
      `
    SELECT claude_session_id
    FROM sdk_sessions
    ORDER BY started_at_epoch DESC
    LIMIT 1
  `
    )
    .get();
  sessionId = result.claude_session_id;
}

console.log(`\n📊 Validating Session: ${sessionId}\n`);

const report = {
  sessionId,
  timestamp: new Date().toISOString(),
  checks: [],
  failures: [],
  summary: {
    totalEvents: 0,
    prompts: 0,
    observations: 0,
    passed: 0,
    failed: 0,
  },
};

// ============================================================================
// CHECK 1: Global ID Mapping Verification
// ============================================================================
console.log('🔍 Check 1: Verifying session ID mapping...');
const idCheck = db
  .prepare(
    `
  SELECT
    COUNT(*) as total,
    SUM(CASE WHEN claude_session_id = sdk_session_id THEN 1 ELSE 0 END) as matches,
    SUM(CASE WHEN claude_session_id != sdk_session_id THEN 1 ELSE 0 END) as mismatches
  FROM sdk_sessions
`
  )
  .get();

const check1 = {
  name: 'Global ID Mapping',
  passed: idCheck.mismatches === 0,
  details: {
    totalSessions: idCheck.total,
    matches: idCheck.matches,
    mismatches: idCheck.mismatches,
  },
};
report.checks.push(check1);

if (check1.passed) {
  console.log(`✅ PASS: All ${idCheck.total} sessions have matching IDs`);
  report.summary.passed++;
} else {
  console.log(`❌ FAIL: Found ${idCheck.mismatches} ID mismatches`);
  report.failures.push(
    `ID Mapping: ${idCheck.mismatches} sessions have different claude_session_id and sdk_session_id`
  );
  report.summary.failed++;

  // List offenders
  const offenders = db
    .prepare(
      `
    SELECT claude_session_id, sdk_session_id, project
    FROM sdk_sessions
    WHERE claude_session_id != sdk_session_id
    LIMIT 5
  `
    )
    .all();
  console.log('  Sample mismatches:', offenders);
}

// ============================================================================
// CHECK 2: Timeline Ordering (TIME-FIRST)
// ============================================================================
console.log('\n🔍 Check 2: Validating timeline ordering...');

// Fetch events using TIME-FIRST ordering
const events = db
  .prepare(
    `
  SELECT * FROM (
    SELECT
      'prompt' as event_type,
      p.id as row_id,
      p.prompt_number,
      p.created_at_epoch as ts,
      p.prompt_text as text,
      0 as kind_rank
    FROM user_prompts p
    WHERE p.claude_session_id = ?

    UNION ALL

    SELECT
      'observation' as event_type,
      o.id as row_id,
      o.prompt_number,
      o.created_at_epoch as ts,
      COALESCE(o.title, o.narrative, o.text) as text,
      1 as kind_rank
    FROM observations o
    INNER JOIN sdk_sessions s ON o.sdk_session_id = s.sdk_session_id
    WHERE s.claude_session_id = ?
  ) combined
  ORDER BY
    ts ASC,
    COALESCE(prompt_number, 999999) ASC,
    kind_rank ASC,
    row_id ASC
`
  )
  .all(sessionId, sessionId);

report.summary.totalEvents = events.length;
report.summary.prompts = events.filter((e) => e.event_type === 'prompt').length;
report.summary.observations = events.filter((e) => e.event_type === 'observation').length;

console.log(
  `📝 Fetched ${events.length} events (${report.summary.prompts} prompts, ${report.summary.observations} observations)`
);

// Sub-check 2a: Timestamps are monotonically increasing
let timestampCheck = { passed: true, violations: [] };
for (let i = 0; i < events.length - 1; i++) {
  if (events[i].ts > events[i + 1].ts) {
    timestampCheck.passed = false;
    timestampCheck.violations.push({
      index: i,
      current: { id: events[i].row_id, ts: events[i].ts },
      next: { id: events[i + 1].row_id, ts: events[i + 1].ts },
    });
  }
}

const check2a = {
  name: 'Monotonic Timestamps',
  passed: timestampCheck.passed,
  details: {
    violations: timestampCheck.violations.length,
    samples: timestampCheck.violations.slice(0, 3),
  },
};
report.checks.push(check2a);

if (check2a.passed) {
  console.log('✅ PASS: Timestamps are chronologically ordered');
  report.summary.passed++;
} else {
  console.log(`❌ FAIL: Found ${timestampCheck.violations.length} timestamp violations`);
  report.failures.push(
    `Timeline Ordering: ${timestampCheck.violations.length} events have decreasing timestamps`
  );
  report.summary.failed++;
}

// Sub-check 2b: Prompts appear before observations for same prompt_number
let promptOrderCheck = { passed: true, violations: [] };
for (let i = 0; i < events.length - 1; i++) {
  const curr = events[i];
  const next = events[i + 1];

  // If same prompt_number and same timestamp, prompt should come first
  if (
    curr.prompt_number === next.prompt_number &&
    curr.ts === next.ts &&
    curr.event_type === 'observation' &&
    next.event_type === 'prompt'
  ) {
    promptOrderCheck.passed = false;
    promptOrderCheck.violations.push({
      index: i,
      current: curr,
      next: next,
    });
  }
}

const check2b = {
  name: 'Prompt-Before-Observation Order',
  passed: promptOrderCheck.passed,
  details: {
    violations: promptOrderCheck.violations.length,
  },
};
report.checks.push(check2b);

if (check2b.passed) {
  console.log('✅ PASS: Prompts appear before observations (for same timestamp)');
  report.summary.passed++;
} else {
  console.log(`❌ FAIL: Found ${promptOrderCheck.violations.length} prompt/obs ordering issues`);
  report.failures.push(
    `Prompt Ordering: ${promptOrderCheck.violations.length} observations appear before prompts`
  );
  report.summary.failed++;
}

// Sub-check 2c: No duplicate row IDs
const rowIdSet = new Set();
const duplicates = [];
events.forEach((e, i) => {
  const key = `${e.event_type}:${e.row_id}`;
  if (rowIdSet.has(key)) {
    duplicates.push({ index: i, event: e });
  }
  rowIdSet.add(key);
});

const check2c = {
  name: 'No Duplicate Row IDs',
  passed: duplicates.length === 0,
  details: {
    duplicateCount: duplicates.length,
  },
};
report.checks.push(check2c);

if (check2c.passed) {
  console.log('✅ PASS: No duplicate row IDs');
  report.summary.passed++;
} else {
  console.log(`❌ FAIL: Found ${duplicates.length} duplicate row IDs`);
  report.failures.push(`Duplicate IDs: ${duplicates.length} events have duplicate row IDs`);
  report.summary.failed++;
}

// ============================================================================
// CHECK 3: NULL Prompt Number Distribution
// ============================================================================
console.log('\n🔍 Check 3: Analyzing NULL prompt_number distribution...');

const nullPromptCheck = db
  .prepare(
    `
  SELECT
    COUNT(*) as total_obs,
    SUM(CASE WHEN prompt_number IS NULL THEN 1 ELSE 0 END) as null_count,
    SUM(CASE WHEN prompt_number IS NOT NULL THEN 1 ELSE 0 END) as non_null_count
  FROM observations
`
  )
  .get();

const check3 = {
  name: 'NULL Prompt Number Analysis',
  passed: true, // Informational check, always passes
  details: {
    totalObservations: nullPromptCheck.total_obs,
    nullCount: nullPromptCheck.null_count,
    nonNullCount: nullPromptCheck.non_null_count,
    nullPercentage: ((nullPromptCheck.null_count / nullPromptCheck.total_obs) * 100).toFixed(2),
  },
};
report.checks.push(check3);
report.summary.passed++;

console.log(
  `✅ INFO: ${nullPromptCheck.null_count} observations (${check3.details.nullPercentage}%) have NULL prompt_number`
);
if (nullPromptCheck.null_count > 0) {
  console.log('  → UI should show these as "unattributed events"');
}

// ============================================================================
// Print Sample Timeline
// ============================================================================
console.log('\n📜 Sample Timeline (first 10 events):');
console.log('─'.repeat(80));

events.slice(0, 10).forEach((event, i) => {
  const icon = event.event_type === 'prompt' ? '🟢' : '🔵';
  const date = new Date(event.ts);
  const time = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const preview = (event.text || '').substring(0, 60).replace(/\n/g, ' ');

  console.log(
    `${i.toString().padStart(3)}. ${icon} [pn:${event.prompt_number || '?'}] ${time} | ${preview}...`
  );
});

if (events.length > 10) {
  console.log(`... (${events.length - 10} more events)`);
}

// ============================================================================
// Final Report
// ============================================================================
console.log('\n' + '='.repeat(80));
console.log('📋 VALIDATION SUMMARY');
console.log('='.repeat(80));
console.log(`Session: ${sessionId}`);
console.log(
  `Events: ${report.summary.totalEvents} (${report.summary.prompts} prompts, ${report.summary.observations} observations)`
);
console.log(`Checks: ${report.summary.passed} passed, ${report.summary.failed} failed`);

if (report.summary.failed > 0) {
  console.log('\n❌ FAILURES:');
  report.failures.forEach((failure, i) => {
    console.log(`  ${i + 1}. ${failure}`);
  });
}

// Write machine-readable report
const reportPath =
  process.env.VALIDATION_REPORT_PATH || path.join(__dirname, 'validation_report.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(`\n📄 Report written to: ${reportPath}`);

// Exit with appropriate code
const exitCode = report.summary.failed > 0 ? 1 : 0;
console.log(`\n${exitCode === 0 ? '✅ All checks passed!' : '❌ Validation failed!'}\n`);

db.close();
process.exit(exitCode);
