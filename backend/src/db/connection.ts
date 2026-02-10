import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

/**
 * Default path to the claude-mem database
 * Located in user's home directory: ~/.claude-mem/claude-mem.db
 */
const DB_PATH = path.join(process.env.HOME || '', '.claude-mem', 'claude-mem.db');

/**
 * Track if we've already logged the unavailability warning
 */
let hasLoggedUnavailableWarning = false;

/**
 * Check if claude-mem database is available
 *
 * Can be forced to false via RECALL_DISABLE_CLAUDE_MEM=true for testing.
 *
 * @returns {boolean} True if database file exists and not disabled, false otherwise
 */
export function isClaudeMemAvailable(): boolean {
  if (process.env.RECALL_DISABLE_CLAUDE_MEM === 'true') {
    return false;
  }
  return fs.existsSync(DB_PATH);
}

/**
 * Creates and configures a new SQLite database connection
 *
 * Opens the claude-mem database in read-write mode to support CLAUDE.md
 * snapshot storage. The database is still opened with caution flags to
 * prevent data corruption.
 *
 * @returns {Database.Database | null} Configured SQLite database instance, or null if unavailable
 *
 * @example
 * const db = getDatabase();
 * if (db) {
 *   const result = db.prepare('SELECT COUNT(*) as count FROM sdk_sessions').get();
 *   console.log(`Found ${result.count} sessions`);
 * }
 */
export function getDatabase(): Database.Database | null {
  if (!fs.existsSync(DB_PATH)) {
    if (!hasLoggedUnavailableWarning) {
      console.warn(
        `⚠️  Claude-mem database not found at ${DB_PATH}. Claude-mem features will be disabled.`
      );
      hasLoggedUnavailableWarning = true;
    }
    return null;
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
 * Returns null if claude-mem database is not available.
 * This is safe because SQLite handles concurrent reads well.
 *
 * @returns {Database.Database | null} Singleton database instance, or null if unavailable
 *
 * @example
 * import { getDbInstance } from './connection';
 *
 * const db = getDbInstance();
 * if (db) {
 *   const sessions = db.prepare('SELECT * FROM sdk_sessions LIMIT 10').all();
 * }
 */
export function getDbInstance(): Database.Database | null {
  if (dbInstance === null && !isClaudeMemAvailable()) {
    return null;
  }
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
