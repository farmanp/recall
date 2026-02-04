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
 * Opens the claude-mem database in read-write mode to support CLAUDE.md
 * snapshot storage. The database is still opened with caution flags to
 * prevent data corruption.
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
    readonly: false, // Allow writes for CLAUDE.md snapshots
    fileMustExist: true, // Fail if file doesn't exist
  });

  // Enable better error messages for foreign key violations
  db.pragma('foreign_keys = ON');

  // Run migrations
  runMigrations(db);

  return db;
}

/**
 * Run database migrations if needed
 * Applies migration files in order to ensure schema is up-to-date
 */
function runMigrations(db: Database.Database): void {
  // Check if migrations table exists
  const tableExists = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='schema_versions'`)
    .get();

  if (!tableExists) {
    // Create migrations tracking table
    db.exec(`
      CREATE TABLE schema_versions (
        id INTEGER PRIMARY KEY,
        version INTEGER UNIQUE NOT NULL,
        applied_at TEXT NOT NULL
      );
    `);
  }

  // Get current version
  const currentVersion =
    (
      db.prepare('SELECT MAX(version) as version FROM schema_versions').get() as {
        version: number | null;
      }
    )?.version || 0;

  // Apply migrations
  const migrationsDir = path.join(__dirname, 'migrations');
  const migrationFiles = fs.existsSync(migrationsDir)
    ? fs
        .readdirSync(migrationsDir)
        .filter((f) => f.endsWith('.sql'))
        .sort()
    : [];

  for (const file of migrationFiles) {
    const versionStr = file.split('_')[0];
    if (!versionStr) continue; // Skip files without version prefix

    const version = parseInt(versionStr, 10);
    if (isNaN(version) || version <= currentVersion) continue;

    console.log(`Applying migration ${file}...`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    db.exec(sql);
    db.prepare('INSERT INTO schema_versions (version, applied_at) VALUES (?, ?)').run(
      version,
      new Date().toISOString()
    );
    console.log(`Migration ${file} applied successfully`);
  }
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
 * This is safe because SQLite handles concurrent reads well.
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
