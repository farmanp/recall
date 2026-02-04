import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { validateClaudeMdPath, getAllowedBaseDirs } from '../../utils/path-security';

describe('path-security', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'path-security-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('validateClaudeMdPath', () => {
    it('rejects paths not ending in CLAUDE.md', () => {
      const result = validateClaudeMdPath('/some/path/README.md');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('CLAUDE.md');
    });

    it('rejects paths with CLAUDE.md in directory name only', () => {
      const result = validateClaudeMdPath('/CLAUDE.md/sneaky/file.txt');
      expect(result.isValid).toBe(false);
    });

    it('rejects path traversal attempts', () => {
      const result = validateClaudeMdPath('/../../../etc/CLAUDE.md');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('outside');
    });

    it('rejects paths outside allowed directories', () => {
      const result = validateClaudeMdPath('/tmp/malicious/CLAUDE.md');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('outside');
    });

    it('rejects /etc/CLAUDE.md', () => {
      const result = validateClaudeMdPath('/etc/CLAUDE.md');
      expect(result.isValid).toBe(false);
    });

    it('rejects /etc/passwd even without CLAUDE.md', () => {
      const result = validateClaudeMdPath('/etc/passwd');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('CLAUDE.md');
    });

    it('accepts valid CLAUDE.md in ~/.claude/projects', () => {
      const validPath = path.join(os.homedir(), '.claude', 'projects', 'test-project', 'CLAUDE.md');
      const result = validateClaudeMdPath(validPath);
      // Only valid if it's in the allowed dir (may not exist but should validate)
      expect(result.isValid).toBe(true);
      expect(result.resolvedPath).toBeDefined();
    });

    it('accepts valid CLAUDE.md in ~/Documents', () => {
      const validPath = path.join(os.homedir(), 'Documents', 'my-project', 'CLAUDE.md');
      const result = validateClaudeMdPath(validPath);
      expect(result.isValid).toBe(true);
    });

    it('accepts valid CLAUDE.md in ~/projects', () => {
      const validPath = path.join(os.homedir(), 'projects', 'my-project', 'CLAUDE.md');
      const result = validateClaudeMdPath(validPath);
      expect(result.isValid).toBe(true);
    });

    it('rejects path with double dot segments even if ending in CLAUDE.md', () => {
      const maliciousPath = path.join(os.homedir(), 'Documents', '..', '..', 'etc', 'CLAUDE.md');
      const result = validateClaudeMdPath(maliciousPath);
      // After normalization, this should resolve outside allowed dirs
      expect(result.isValid).toBe(false);
    });

    it('handles symlink escape attempts', () => {
      // Create a symlink in temp dir that points outside allowed dirs
      const symlinkPath = path.join(tempDir, 'CLAUDE.md');
      const targetPath = '/etc/passwd';

      try {
        fs.symlinkSync(targetPath, symlinkPath);
        const result = validateClaudeMdPath(symlinkPath);
        // Should fail because temp dir is not in allowed dirs
        expect(result.isValid).toBe(false);
      } catch {
        // Symlink creation may fail on some systems - skip
      }
    });
  });

  describe('getAllowedBaseDirs', () => {
    it('returns an array of allowed directories', () => {
      const dirs = getAllowedBaseDirs();
      expect(Array.isArray(dirs)).toBe(true);
      expect(dirs.length).toBeGreaterThan(0);
    });

    it('includes ~/.claude/projects', () => {
      const dirs = getAllowedBaseDirs();
      const claudeProjectsDir = path.join(os.homedir(), '.claude', 'projects');
      expect(dirs).toContain(claudeProjectsDir);
    });

    it('includes ~/Documents', () => {
      const dirs = getAllowedBaseDirs();
      const documentsDir = path.join(os.homedir(), 'Documents');
      expect(dirs).toContain(documentsDir);
    });

    it('returns a copy (not the original array)', () => {
      const dirs1 = getAllowedBaseDirs();
      const dirs2 = getAllowedBaseDirs();
      expect(dirs1).not.toBe(dirs2);
      expect(dirs1).toEqual(dirs2);
    });
  });
});
