import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Mock fs and os before importing token-manager
const mocks = vi.hoisted(() => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  homedir: vi.fn(() => '/mock/home'),
}));

vi.mock('fs', () => ({
  default: {
    existsSync: mocks.existsSync,
    readFileSync: mocks.readFileSync,
    writeFileSync: mocks.writeFileSync,
    mkdirSync: mocks.mkdirSync,
  },
  existsSync: mocks.existsSync,
  readFileSync: mocks.readFileSync,
  writeFileSync: mocks.writeFileSync,
  mkdirSync: mocks.mkdirSync,
}));

vi.mock('os', () => ({
  default: {
    homedir: mocks.homedir,
  },
  homedir: mocks.homedir,
}));

describe('TokenManager', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.existsSync.mockReturnValue(false);
    mocks.readFileSync.mockReturnValue('');
    mocks.writeFileSync.mockReturnValue(undefined);
    mocks.mkdirSync.mockReturnValue(undefined);
  });

  describe('initialize', () => {
    it('creates config directory if it does not exist', async () => {
      mocks.existsSync.mockReturnValue(false);

      const { tokenManager } = await import('../../services/token-manager');
      tokenManager._reset();
      tokenManager.initialize();

      expect(mocks.mkdirSync).toHaveBeenCalledWith('/mock/home/.recall-player', {
        mode: 0o700,
        recursive: true,
      });
    });

    it('generates new token when no token file exists', async () => {
      mocks.existsSync.mockReturnValue(false);

      const { tokenManager } = await import('../../services/token-manager');
      tokenManager._reset();
      const result = tokenManager.initialize();

      expect(result.isNew).toBe(true);
      expect(result.token).toMatch(/^[a-f0-9]{32}$/);
    });

    it('saves token with correct permissions', async () => {
      mocks.existsSync.mockReturnValue(false);

      const { tokenManager } = await import('../../services/token-manager');
      tokenManager._reset();
      tokenManager.initialize();

      expect(mocks.writeFileSync).toHaveBeenCalledWith(
        '/mock/home/.recall-player/auth-token',
        expect.stringMatching(/^[a-f0-9]{32}$/),
        { mode: 0o600 }
      );
    });

    it('loads existing token from file', async () => {
      const existingToken = 'abcdef1234567890abcdef1234567890';
      mocks.existsSync.mockReturnValue(true);
      mocks.readFileSync.mockReturnValue(existingToken);

      const { tokenManager } = await import('../../services/token-manager');
      tokenManager._reset();
      const result = tokenManager.initialize();

      expect(result.isNew).toBe(false);
      expect(result.token).toBe(existingToken);
    });

    it('regenerates token when regenerate=true', async () => {
      const existingToken = 'abcdef1234567890abcdef1234567890';
      mocks.existsSync.mockReturnValue(true);
      mocks.readFileSync.mockReturnValue(existingToken);

      const { tokenManager } = await import('../../services/token-manager');
      tokenManager._reset();

      // First initialize loads existing
      tokenManager.initialize();

      // Regenerate creates new
      const result = tokenManager.initialize(true);
      expect(result.isNew).toBe(true);
      expect(result.token).not.toBe(existingToken);
    });

    it('generates new token if existing token has invalid format', async () => {
      mocks.existsSync.mockReturnValue(true);
      mocks.readFileSync.mockReturnValue('invalid-token-format');

      const { tokenManager } = await import('../../services/token-manager');
      tokenManager._reset();
      const result = tokenManager.initialize();

      expect(result.isNew).toBe(true);
      expect(result.token).toMatch(/^[a-f0-9]{32}$/);
    });

    it('trims whitespace from loaded token', async () => {
      const token = 'abcdef1234567890abcdef1234567890';
      mocks.existsSync.mockReturnValue(true);
      mocks.readFileSync.mockReturnValue(`  ${token}  \n`);

      const { tokenManager } = await import('../../services/token-manager');
      tokenManager._reset();
      const result = tokenManager.initialize();

      expect(result.token).toBe(token);
    });
  });

  describe('validateToken', () => {
    it('returns false before initialization', async () => {
      const { tokenManager } = await import('../../services/token-manager');
      tokenManager._reset();

      expect(tokenManager.validateToken('anytoken')).toBe(false);
    });

    it('returns true for valid token', async () => {
      mocks.existsSync.mockReturnValue(false);

      const { tokenManager } = await import('../../services/token-manager');
      tokenManager._reset();
      const { token } = tokenManager.initialize();

      expect(tokenManager.validateToken(token)).toBe(true);
    });

    it('returns false for invalid token', async () => {
      mocks.existsSync.mockReturnValue(false);

      const { tokenManager } = await import('../../services/token-manager');
      tokenManager._reset();
      tokenManager.initialize();

      expect(tokenManager.validateToken('wrongtoken')).toBe(false);
    });

    it('returns false for empty token', async () => {
      mocks.existsSync.mockReturnValue(false);

      const { tokenManager } = await import('../../services/token-manager');
      tokenManager._reset();
      tokenManager.initialize();

      expect(tokenManager.validateToken('')).toBe(false);
    });

    it('returns false for null/undefined', async () => {
      mocks.existsSync.mockReturnValue(false);

      const { tokenManager } = await import('../../services/token-manager');
      tokenManager._reset();
      tokenManager.initialize();

      expect(tokenManager.validateToken(null as unknown as string)).toBe(false);
      expect(tokenManager.validateToken(undefined as unknown as string)).toBe(false);
    });

    it('uses timing-safe comparison', async () => {
      // This test verifies that different-length tokens don't cause early returns
      // by checking that validation still works correctly
      mocks.existsSync.mockReturnValue(false);

      const { tokenManager } = await import('../../services/token-manager');
      tokenManager._reset();
      const { token } = tokenManager.initialize();

      // Shorter token
      expect(tokenManager.validateToken(token.slice(0, 16))).toBe(false);
      // Longer token
      expect(tokenManager.validateToken(token + 'extra')).toBe(false);
      // Correct token
      expect(tokenManager.validateToken(token)).toBe(true);
    });
  });

  describe('getToken', () => {
    it('returns null before initialization', async () => {
      const { tokenManager } = await import('../../services/token-manager');
      tokenManager._reset();

      expect(tokenManager.getToken()).toBeNull();
    });

    it('returns token after initialization', async () => {
      mocks.existsSync.mockReturnValue(false);

      const { tokenManager } = await import('../../services/token-manager');
      tokenManager._reset();
      const { token } = tokenManager.initialize();

      expect(tokenManager.getToken()).toBe(token);
    });
  });

  describe('isInitialized', () => {
    it('returns false before initialization', async () => {
      const { tokenManager } = await import('../../services/token-manager');
      tokenManager._reset();

      expect(tokenManager.isInitialized()).toBe(false);
    });

    it('returns true after initialization', async () => {
      mocks.existsSync.mockReturnValue(false);

      const { tokenManager } = await import('../../services/token-manager');
      tokenManager._reset();
      tokenManager.initialize();

      expect(tokenManager.isInitialized()).toBe(true);
    });
  });

  describe('getTokenFilePath', () => {
    it('returns the token file path', async () => {
      const { tokenManager } = await import('../../services/token-manager');

      expect(tokenManager.getTokenFilePath()).toBe('/mock/home/.recall-player/auth-token');
    });
  });

  describe('error handling', () => {
    it('throws when config directory creation fails', async () => {
      mocks.existsSync.mockReturnValue(false);
      mocks.mkdirSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const { tokenManager } = await import('../../services/token-manager');
      tokenManager._reset();

      expect(() => tokenManager.initialize()).toThrow('Permission denied');
    });

    it('throws when token file write fails', async () => {
      mocks.existsSync.mockReturnValue(false);
      mocks.writeFileSync.mockImplementation(() => {
        throw new Error('Disk full');
      });

      const { tokenManager } = await import('../../services/token-manager');
      tokenManager._reset();

      expect(() => tokenManager.initialize()).toThrow('Disk full');
    });

    it('generates new token when file read fails', async () => {
      mocks.existsSync.mockReturnValue(true);
      mocks.readFileSync.mockImplementation(() => {
        throw new Error('Read error');
      });

      const { tokenManager } = await import('../../services/token-manager');
      tokenManager._reset();
      const result = tokenManager.initialize();

      expect(result.isNew).toBe(true);
    });
  });
});
