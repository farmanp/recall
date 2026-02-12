import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Token Manager Service
 *
 * Manages authentication tokens for non-localhost access to the Recall server.
 * Tokens are generated on first run and stored securely in the user's home directory.
 *
 * Features:
 * - 32-character hex token generation
 * - Secure file storage with 0600 permissions
 * - Timing-safe token comparison
 * - Token regeneration support
 */

const TOKEN_LENGTH = 32; // 32 hex characters = 16 bytes of entropy
const CONFIG_DIR = path.join(os.homedir(), '.recall-player');
const TOKEN_FILE = path.join(CONFIG_DIR, 'auth-token');

/**
 * Singleton class for token management
 *
 * @example
 * // Initialize and display token on startup
 * tokenManager.initialize();
 *
 * // Validate incoming token
 * const isValid = tokenManager.validateToken(requestToken);
 */
class TokenManager {
  private token: string | null = null;
  private initialized = false;

  /**
   * Initialize the token manager
   *
   * Loads existing token from disk or generates a new one.
   * Should be called once during server startup.
   *
   * @param regenerate - If true, generates a new token even if one exists
   * @returns Object with token and whether it was newly generated
   */
  initialize(regenerate = false): { token: string; isNew: boolean } {
    if (this.initialized && !regenerate) {
      return { token: this.token!, isNew: false };
    }

    // Ensure config directory exists
    this.ensureConfigDir();

    // Check for existing token
    if (!regenerate && this.tokenFileExists()) {
      const existingToken = this.loadToken();
      if (existingToken && this.isValidTokenFormat(existingToken)) {
        this.token = existingToken;
        this.initialized = true;
        console.log('[TokenManager] Loaded existing auth token');
        return { token: this.token, isNew: false };
      }
    }

    // Generate new token
    this.token = this.generateToken();
    this.saveToken(this.token);
    this.initialized = true;
    console.log('[TokenManager] Generated new auth token');
    return { token: this.token, isNew: true };
  }

  /**
   * Validate a token using timing-safe comparison
   *
   * @param candidateToken - Token to validate
   * @returns True if the token is valid
   */
  validateToken(candidateToken: string): boolean {
    if (!this.initialized || !this.token) {
      console.warn('[TokenManager] Token validation attempted before initialization');
      return false;
    }

    if (!candidateToken || typeof candidateToken !== 'string') {
      return false;
    }

    // Use timing-safe comparison to prevent timing attacks
    try {
      const tokenBuffer = Buffer.from(this.token, 'utf8');
      const candidateBuffer = Buffer.from(candidateToken, 'utf8');

      // If lengths differ, still do comparison to maintain constant time
      if (tokenBuffer.length !== candidateBuffer.length) {
        // Compare with self to maintain timing consistency
        crypto.timingSafeEqual(tokenBuffer, tokenBuffer);
        return false;
      }

      return crypto.timingSafeEqual(tokenBuffer, candidateBuffer);
    } catch {
      return false;
    }
  }

  /**
   * Get the current token
   * Only call after initialization
   *
   * @returns The current token or null if not initialized
   */
  getToken(): string | null {
    return this.token;
  }

  /**
   * Check if token manager is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get the path to the token file
   * Useful for displaying to users
   */
  getTokenFilePath(): string {
    return TOKEN_FILE;
  }

  /**
   * Generate a new cryptographically secure token
   */
  private generateToken(): string {
    return crypto.randomBytes(TOKEN_LENGTH / 2).toString('hex');
  }

  /**
   * Check if token file exists
   */
  private tokenFileExists(): boolean {
    try {
      return fs.existsSync(TOKEN_FILE);
    } catch {
      return false;
    }
  }

  /**
   * Load token from file
   */
  private loadToken(): string | null {
    try {
      const content = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
      return content || null;
    } catch (error) {
      console.warn('[TokenManager] Failed to load token file:', error);
      return null;
    }
  }

  /**
   * Save token to file with secure permissions
   */
  private saveToken(token: string): void {
    try {
      fs.writeFileSync(TOKEN_FILE, token, { mode: 0o600 });
      console.log(`[TokenManager] Token saved to ${TOKEN_FILE}`);
    } catch (error) {
      console.error('[TokenManager] Failed to save token:', error);
      throw error;
    }
  }

  /**
   * Ensure config directory exists
   */
  private ensureConfigDir(): void {
    try {
      if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { mode: 0o700, recursive: true });
        console.log(`[TokenManager] Created config directory: ${CONFIG_DIR}`);
      }
    } catch (error) {
      console.error('[TokenManager] Failed to create config directory:', error);
      throw error;
    }
  }

  /**
   * Validate token format (32 hex characters)
   */
  private isValidTokenFormat(token: string): boolean {
    return /^[a-f0-9]{32}$/i.test(token);
  }

  /**
   * Reset state (for testing)
   */
  _reset(): void {
    this.token = null;
    this.initialized = false;
  }
}

// Export singleton instance
export const tokenManager = new TokenManager();
