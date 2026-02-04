/**
 * Test setup file
 * Runs before all tests to configure the test environment
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { beforeAll, afterAll } from 'vitest';

const TEST_HOME = path.join(__dirname, `.vitest-${process.pid}`);
const TEST_MEM_DIR = path.join(TEST_HOME, '.claude-mem');
const TEST_DB_PATH = path.join(TEST_MEM_DIR, 'claude-mem.db');

// Override the DB path for tests
process.env.HOME = TEST_HOME;

/**
 * Create a test database with sample data
 */
export function createTestDatabase(): Database.Database {
  if (fs.existsSync(TEST_MEM_DIR)) {
    fs.rmSync(TEST_MEM_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(TEST_MEM_DIR, { recursive: true });

  const db = new Database(TEST_DB_PATH);

  // Create schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS sdk_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      claude_session_id TEXT NOT NULL UNIQUE,
      sdk_session_id TEXT NOT NULL UNIQUE,
      project TEXT NOT NULL,
      user_prompt TEXT,
      started_at TEXT NOT NULL,
      started_at_epoch INTEGER NOT NULL,
      completed_at TEXT,
      completed_at_epoch INTEGER,
      status TEXT NOT NULL CHECK(status IN ('active', 'completed', 'failed')),
      prompt_counter INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS observations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sdk_session_id TEXT NOT NULL,
      project TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('decision', 'bugfix', 'feature', 'refactor', 'discovery', 'change')),
      title TEXT NOT NULL,
      subtitle TEXT NOT NULL,
      text TEXT NOT NULL,
      facts TEXT,
      narrative TEXT NOT NULL,
      concepts TEXT,
      files_read TEXT,
      files_modified TEXT,
      prompt_number INTEGER,
      created_at TEXT NOT NULL,
      created_at_epoch INTEGER NOT NULL,
      discovery_tokens INTEGER NOT NULL,
      FOREIGN KEY (sdk_session_id) REFERENCES sdk_sessions(sdk_session_id)
    );

    CREATE TABLE IF NOT EXISTS user_prompts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      claude_session_id TEXT NOT NULL,
      prompt_number INTEGER NOT NULL,
      prompt_text TEXT NOT NULL,
      created_at TEXT NOT NULL,
      created_at_epoch INTEGER NOT NULL,
      FOREIGN KEY (claude_session_id) REFERENCES sdk_sessions(claude_session_id)
    );
  `);

  // Insert test data
  const now = Date.now();
  const nowISO = new Date(now).toISOString();

  // Insert sessions
  db.prepare(
    `
    INSERT INTO sdk_sessions (
      claude_session_id, sdk_session_id, project, user_prompt,
      started_at, started_at_epoch, completed_at, completed_at_epoch,
      status, prompt_counter
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
  ).run(
    'session-1',
    'session-1',
    'test-project',
    'Test initial prompt',
    nowISO,
    now,
    null,
    null,
    'active',
    2
  );

  db.prepare(
    `
    INSERT INTO sdk_sessions (
      claude_session_id, sdk_session_id, project, user_prompt,
      started_at, started_at_epoch, completed_at, completed_at_epoch,
      status, prompt_counter
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
  ).run(
    'session-2',
    'session-2',
    'another-project',
    'Another test prompt',
    new Date(now - 3600000).toISOString(),
    now - 3600000,
    nowISO,
    now,
    'completed',
    1
  );

  // Insert prompts
  db.prepare(
    `
    INSERT INTO user_prompts (
      claude_session_id, prompt_number, prompt_text,
      created_at, created_at_epoch
    ) VALUES (?, ?, ?, ?, ?)
  `
  ).run('session-1', 1, 'Create a test suite', new Date(now + 1000).toISOString(), now + 1000);

  db.prepare(
    `
    INSERT INTO user_prompts (
      claude_session_id, prompt_number, prompt_text,
      created_at, created_at_epoch
    ) VALUES (?, ?, ?, ?, ?)
  `
  ).run('session-1', 2, 'Add more tests', new Date(now + 3000).toISOString(), now + 3000);

  // Insert observations with JSON fields
  db.prepare(
    `
    INSERT INTO observations (
      sdk_session_id, project, type, title, subtitle, text,
      facts, narrative, concepts, files_read, files_modified,
      prompt_number, created_at, created_at_epoch, discovery_tokens
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
  ).run(
    'session-1',
    'test-project',
    'feature',
    'Test Feature',
    'Testing subtitle',
    'Test observation text',
    JSON.stringify(['fact1', 'fact2']),
    'Test narrative',
    JSON.stringify(['concept1', 'concept2']),
    JSON.stringify(['file1.ts', 'file2.ts']),
    JSON.stringify(['file1.ts']),
    1,
    new Date(now + 2000).toISOString(),
    now + 2000,
    100
  );

  db.prepare(
    `
    INSERT INTO observations (
      sdk_session_id, project, type, title, subtitle, text,
      facts, narrative, concepts, files_read, files_modified,
      prompt_number, created_at, created_at_epoch, discovery_tokens
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
  ).run(
    'session-1',
    'test-project',
    'decision',
    'Test Decision',
    'Decision subtitle',
    'Test decision text',
    null,
    'Decision narrative',
    null,
    null,
    null,
    2,
    new Date(now + 4000).toISOString(),
    now + 4000,
    50
  );

  return db;
}

/**
 * Global setup - create test database
 */
beforeAll(() => {
  createTestDatabase();
});

/**
 * Global teardown - cleanup
 */
afterAll(() => {
  if (fs.existsSync(TEST_HOME)) {
    fs.rmSync(TEST_HOME, { recursive: true, force: true });
  }
});
