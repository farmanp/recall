import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

/**
 * Default path to the transcript database
 * Located in user's home directory: ~/.recall-player/transcripts.db
 *
 * Note: Previously used ~/.claude/transcripts.db but moved to a stable
 * location to avoid corruption issues when running via npx (volatile cache).
 */
const TRANSCRIPT_DB_PATH = path.join(process.env.HOME || '', '.recall-player', 'transcripts.db');

/**
 * Initialize a SQLite database with auto-recovery for corrupted files
 *
 * On SQLITE_IOERR* errors (typically from corruption), automatically:
 * 1. Delete the corrupted database file and associated WAL/SHM files
 * 2. Retry initialization once with a fresh database
 *
 * @param dbPath - Path to the database file
 * @param isRetry - Internal flag to prevent infinite retry loops
 * @returns Configured SQLite database instance
 * @throws Error if initialization fails after retry
 */
function initializeDatabase(dbPath: string, isRetry = false): Database.Database {
  try {
    const db = new Database(dbPath, {
      readonly: false,
      fileMustExist: false,
    });

    // Configure database with PRAGMA settings
    // These can throw on corrupted databases
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma('synchronous = NORMAL');
    db.pragma('cache_size = -64000');

    return db;
  } catch (err: unknown) {
    const sqliteErr = err as { code?: string };

    // Check for SQLite corruption indicators:
    // - SQLITE_IOERR*: I/O errors (often from truncated/corrupted files)
    // - SQLITE_NOTADB: File exists but is not a valid SQLite database
    // - SQLITE_CORRUPT: Database disk image is malformed
    const isCorruptionError =
      sqliteErr.code?.startsWith('SQLITE_IOERR') ||
      sqliteErr.code === 'SQLITE_NOTADB' ||
      sqliteErr.code === 'SQLITE_CORRUPT';

    if (!isRetry && isCorruptionError) {
      console.warn(`[DB] Corrupted database detected (${sqliteErr.code}), recreating: ${dbPath}`);

      // Remove corrupted database file
      if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
      }

      // Also remove WAL and SHM files that accompany the database
      const walPath = dbPath + '-wal';
      const shmPath = dbPath + '-shm';
      if (fs.existsSync(walPath)) {
        fs.unlinkSync(walPath);
      }
      if (fs.existsSync(shmPath)) {
        fs.unlinkSync(shmPath);
      }

      // Retry once with fresh database
      return initializeDatabase(dbPath, true);
    }

    // Re-throw non-recoverable errors
    throw err;
  }
}

/**
 * Creates and configures a new SQLite database connection for transcripts
 *
 * Opens the transcript database in read-write mode.
 * Creates the database file if it doesn't exist.
 * Enables WAL mode for better concurrency (reads don't block writes).
 * Includes auto-recovery for corrupted databases.
 *
 * @returns {Database.Database} Configured SQLite database instance
 *
 * @example
 * const db = getTranscriptDatabase();
 * db.prepare('INSERT INTO session_metadata ...').run(...);
 */
export function getTranscriptDatabase(): Database.Database {
  // Ensure .recall-player directory exists
  const recallDir = path.dirname(TRANSCRIPT_DB_PATH);
  if (!fs.existsSync(recallDir)) {
    fs.mkdirSync(recallDir, { recursive: true });
  }

  return initializeDatabase(TRANSCRIPT_DB_PATH);
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
