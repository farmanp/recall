import * as crypto from 'crypto';
import {
  saveGeminiMapping,
  getGeminiMapping,
  initializeGeminiMappingSchema,
} from '../db/gemini-mapping-queries';

/**
 * GeminiHashMapper - Maps Gemini project hashes to actual project paths
 *
 * Gemini CLI uses SHA-256(project_path) to create the hash directories
 * where sessions are stored (e.g., ~/.gemini/tmp/{hash}/).
 *
 * This service:
 * 1. Computes hashes matching Gemini CLI's algorithm
 * 2. Captures hash->project mappings when sessions are created
 * 3. Looks up project paths for existing session hashes
 *
 * Usage:
 * ```typescript
 * import { geminiHashMapper } from './services/gemini-hash-mapper';
 *
 * // At startup, capture the current working directory mapping
 * geminiHashMapper.setCwd(process.env.STARTUP_CWD || process.cwd());
 *
 * // Later, resolve a hash to its project path
 * const projectPath = geminiHashMapper.lookupHash('a1b2c3...');
 * ```
 */
export class GeminiHashMapper {
  private initialized = false;

  /**
   * Ensure the database schema is initialized
   * Called lazily on first database access
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      try {
        initializeGeminiMappingSchema();
        this.initialized = true;
        console.log('[GeminiHashMapper] Database schema initialized');
      } catch (error) {
        console.error('[GeminiHashMapper] Failed to initialize schema:', error);
        throw error;
      }
    }
  }

  /**
   * Compute SHA-256 hash of a path (matches Gemini CLI's algorithm)
   *
   * Gemini CLI uses: crypto.createHash('sha256').update(path).digest('hex')
   *
   * @param projectPath - The absolute path to hash
   * @returns 64-character lowercase hex string
   *
   * @example
   * const hash = geminiHashMapper.computeHash('/Users/me/projects/myapp');
   * // Returns: 'a1b2c3d4e5f6...' (64 hex chars)
   */
  computeHash(projectPath: string): string {
    return crypto.createHash('sha256').update(projectPath).digest('hex');
  }

  /**
   * Set current working directory and save its hash mapping
   *
   * Call this at startup with STARTUP_CWD to capture the mapping
   * between the current directory and its Gemini hash.
   *
   * @param cwd - The current working directory path
   *
   * @example
   * // At server startup
   * geminiHashMapper.setCwd(process.env.STARTUP_CWD || process.cwd());
   */
  setCwd(cwd: string): void {
    this.ensureInitialized();

    const hash = this.computeHash(cwd);

    console.log(`[GeminiHashMapper] Saving CWD mapping: ${cwd}`);
    console.log(`[GeminiHashMapper]   Hash: ${hash}`);

    try {
      saveGeminiMapping(hash, cwd, 'realtime', 1.0);
      console.log('[GeminiHashMapper] Mapping saved successfully');
    } catch (error) {
      console.error('[GeminiHashMapper] Failed to save mapping:', error);
    }
  }

  /**
   * Look up project path for a given hash
   *
   * Queries the database for a stored mapping.
   * Returns undefined if no mapping exists.
   *
   * @param hash - The SHA-256 hash to look up (64 hex chars)
   * @returns The project path if found, undefined otherwise
   *
   * @example
   * const projectPath = geminiHashMapper.lookupHash('a1b2c3...');
   * if (projectPath) {
   *   console.log(`Hash resolves to: ${projectPath}`);
   * }
   */
  lookupHash(hash: string): string | undefined {
    this.ensureInitialized();

    try {
      const mapping = getGeminiMapping(hash);
      return mapping?.projectPath;
    } catch (error) {
      console.error(`[GeminiHashMapper] Failed to lookup hash ${hash}:`, error);
      return undefined;
    }
  }

  /**
   * Called when a new Gemini session is detected
   *
   * Attempts to resolve the project path from the hash.
   * Logs the detection for debugging purposes.
   *
   * @param hash - The hash from the session directory path
   * @returns The project path if found, undefined otherwise
   *
   * @example
   * // When file watcher detects a new Gemini session
   * const projectPath = geminiHashMapper.onNewSession('a1b2c3...');
   * if (projectPath) {
   *   console.log(`New session for project: ${projectPath}`);
   * } else {
   *   console.log('Unknown project - hash not yet mapped');
   * }
   */
  onNewSession(hash: string): string | undefined {
    console.log(`[GeminiHashMapper] New Gemini session detected with hash: ${hash}`);

    const projectPath = this.lookupHash(hash);

    if (projectPath) {
      console.log(`[GeminiHashMapper] Resolved to project: ${projectPath}`);
    } else {
      console.log(`[GeminiHashMapper] No mapping found for hash: ${hash}`);
    }

    return projectPath;
  }

  /**
   * Get the hash for a known project path (for testing/verification)
   *
   * Computes the hash without saving to database.
   * Useful for verifying mappings or testing.
   *
   * @param projectPath - The project path to hash
   * @returns The SHA-256 hash (64 hex chars)
   *
   * @example
   * const hash = geminiHashMapper.getHashForProject('/Users/me/projects/myapp');
   * console.log(`Project hash: ${hash}`);
   */
  getHashForProject(projectPath: string): string {
    return this.computeHash(projectPath);
  }

  /**
   * Manually register a hash->project mapping
   *
   * Useful for manually adding mappings that weren't captured at startup.
   *
   * @param hash - The SHA-256 hash
   * @param projectPath - The project path
   * @param source - How the mapping was determined (default: 'manual')
   * @param confidence - Confidence score 0.0-1.0 (default: 1.0)
   *
   * @example
   * // Manually add a mapping discovered through other means
   * geminiHashMapper.registerMapping('a1b2c3...', '/Users/me/old-project', 'inferred', 0.8);
   */
  registerMapping(
    hash: string,
    projectPath: string,
    source: 'realtime' | 'manual' | 'inferred' = 'manual',
    confidence: number = 1.0
  ): void {
    this.ensureInitialized();

    console.log(`[GeminiHashMapper] Registering mapping (source: ${source}):`);
    console.log(`[GeminiHashMapper]   Hash: ${hash}`);
    console.log(`[GeminiHashMapper]   Project: ${projectPath}`);
    console.log(`[GeminiHashMapper]   Confidence: ${confidence}`);

    try {
      saveGeminiMapping(hash, projectPath, source, confidence);
      console.log('[GeminiHashMapper] Mapping registered successfully');
    } catch (error) {
      console.error('[GeminiHashMapper] Failed to register mapping:', error);
    }
  }

  /**
   * Verify that a hash matches a project path
   *
   * Computes the hash of the project path and compares it.
   * Useful for validating manually-provided mappings.
   *
   * @param hash - The hash to verify
   * @param projectPath - The expected project path
   * @returns true if the hash matches, false otherwise
   *
   * @example
   * if (geminiHashMapper.verifyMapping('a1b2c3...', '/Users/me/projects/myapp')) {
   *   console.log('Mapping is valid');
   * }
   */
  verifyMapping(hash: string, projectPath: string): boolean {
    const computedHash = this.computeHash(projectPath);
    const matches = computedHash === hash;

    if (!matches) {
      console.log(`[GeminiHashMapper] Hash mismatch:`);
      console.log(`[GeminiHashMapper]   Provided:  ${hash}`);
      console.log(`[GeminiHashMapper]   Computed:  ${computedHash}`);
    }

    return matches;
  }
}

/**
 * Singleton instance of GeminiHashMapper
 *
 * Use this instance throughout the application:
 * ```typescript
 * import { geminiHashMapper } from './services/gemini-hash-mapper';
 * geminiHashMapper.setCwd(startupCwd);
 * ```
 */
export const geminiHashMapper = new GeminiHashMapper();
