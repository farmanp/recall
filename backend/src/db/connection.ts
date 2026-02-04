import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

/**
 * Default path to the claude-mem database
 * Located in user's home directory: ~/.claude-mem/claude-mem.db
 */
const DB_PATH = path.join(process.env.HOME || '', '.claude-mem', 'claude-mem.db');

/**
 * Creates and configures a new SQLite database connection
 *
 * Opens the claude-mem database in read-only mode for safety.
 * This prevents accidental modifications to the user's session history.
 *
 * @returns {Database.Database} Configured SQLite database instance
 * @throws {Error} If database file doesn't exist at DB_PATH
 *
 * @example
 * const db = getDatabase();
 * const result = db.prepare('SELECT COUNT(*) as count FROM sdk_sessions').get();
 * console.log(`Found ${result.count} sessions`);
 */
export function getDatabase(): Database.Database {
  if (!fs.existsSync(DB_PATH)) {
    throw new Error(
      `Database not found at ${DB_PATH}. Make sure claude-mem is installed and has recorded sessions.`
    );
  }

  const db = new Database(DB_PATH, {
    readonly: true, // Prevent accidental writes
    fileMustExist: true, // Fail if file doesn't exist
  });

  // Enable better error messages for foreign key violations
  db.pragma('foreign_keys = ON');

  return db;
}

/**
 * Global database instance (singleton)
 * Reused across all requests to avoid connection overhead
 */
let dbInstance: Database.Database | null = null;

/**
 * Get the singleton database instance
 *
 * Creates a new connection on first call, then reuses it for subsequent calls.
 * This is safe because SQLite handles concurrent reads well in read-only mode.
 *
 * @returns {Database.Database} Singleton database instance
 *
 * @example
 * import { getDbInstance } from './connection';
 *
 * const db = getDbInstance();
 * const sessions = db.prepare('SELECT * FROM sdk_sessions LIMIT 10').all();
 */
export function getDbInstance(): Database.Database {
  if (!dbInstance) {
    dbInstance = getDatabase();
  }
  return dbInstance;
}

/**
 * Close the database connection and clear the singleton
 *
 * Should be called during graceful shutdown (SIGTERM, SIGINT).
 * Ensures the database file is properly closed.
 *
 * @example
 * process.on('SIGTERM', () => {
 *   server.close(() => {
 *     closeDatabase();
 *     process.exit(0);
 *   });
 * });
 */
export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
