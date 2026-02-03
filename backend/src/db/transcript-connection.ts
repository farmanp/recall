import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

/**
 * Default path to the transcript database
 * Located in user's home directory: ~/.claude/transcripts.db
 */
const TRANSCRIPT_DB_PATH = path.join(process.env.HOME || '', '.claude', 'transcripts.db');

/**
 * Creates and configures a new SQLite database connection for transcripts
 *
 * Opens the transcript database in read-write mode.
 * Creates the database file if it doesn't exist.
 * Enables WAL mode for better concurrency (reads don't block writes).
 *
 * @returns {Database.Database} Configured SQLite database instance
 *
 * @example
 * const db = getTranscriptDatabase();
 * db.prepare('INSERT INTO session_metadata ...').run(...);
 */
export function getTranscriptDatabase(): Database.Database {
  // Ensure .claude directory exists
  const claudeDir = path.dirname(TRANSCRIPT_DB_PATH);
  if (!fs.existsSync(claudeDir)) {
    fs.mkdirSync(claudeDir, { recursive: true });
  }

  const db = new Database(TRANSCRIPT_DB_PATH, {
    // Read-write mode - we need to insert/update transcript data
    readonly: false,
    fileMustExist: false  // Create file if it doesn't exist
  });

  // Enable WAL mode for better concurrency
  // Allows multiple readers while a writer is active
  db.pragma('journal_mode = WAL');

  // Enable foreign key constraints
  db.pragma('foreign_keys = ON');

  // Optimize performance
  db.pragma('synchronous = NORMAL');  // Faster than FULL, still safe with WAL
  db.pragma('cache_size = -64000');   // Use 64MB cache

  return db;
}

/**
 * Global transcript database instance (singleton)
 * Reused across all requests to avoid connection overhead
 */
let transcriptDbInstance: Database.Database | null = null;

/**
 * Get the singleton transcript database instance
 *
 * Creates a new connection on first call, then reuses it for subsequent calls.
 * Safe for concurrent reads and writes thanks to WAL mode.
 *
 * @returns {Database.Database} Singleton database instance
 *
 * @example
 * import { getTranscriptDbInstance } from './transcript-connection';
 *
 * const db = getTranscriptDbInstance();
 * const sessions = db.prepare('SELECT * FROM session_metadata LIMIT 10').all();
 */
export function getTranscriptDbInstance(): Database.Database {
  if (!transcriptDbInstance) {
    transcriptDbInstance = getTranscriptDatabase();
  }
  return transcriptDbInstance;
}

/**
 * Close the transcript database connection and clear the singleton
 *
 * Should be called during graceful shutdown (SIGTERM, SIGINT).
 * Ensures the database file is properly closed and WAL is checkpointed.
 *
 * @example
 * process.on('SIGTERM', () => {
 *   server.close(() => {
 *     closeTranscriptDatabase();
 *     process.exit(0);
 *   });
 * });
 */
export function closeTranscriptDatabase(): void {
  if (transcriptDbInstance) {
    // Checkpoint WAL before closing
    transcriptDbInstance.pragma('wal_checkpoint(TRUNCATE)');
    transcriptDbInstance.close();
    transcriptDbInstance = null;
  }
}

/**
 * Get the path to the transcript database
 * Useful for diagnostic messages and testing
 *
 * @returns {string} Full path to transcripts.db
 *
 * @example
 * console.log(`Transcript database: ${getTranscriptDbPath()}`);
 * // Output: Transcript database: /Users/fpirzada/.claude/transcripts.db
 */
export function getTranscriptDbPath(): string {
  return TRANSCRIPT_DB_PATH;
}
