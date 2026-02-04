import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Allowed base directories for CLAUDE.md file access
 * Only files within these directories can be read
 */
const ALLOWED_BASE_DIRS = [
  path.join(os.homedir(), '.claude', 'projects'),
  path.join(os.homedir(), 'Documents'),
  path.join(os.homedir(), 'projects'),
];

/**
 * Result type for path validation
 */
export interface PathValidationResult {
  isValid: boolean;
  error?: string;
  resolvedPath?: string;
}

/**
 * Validates that a file path is safe to read
 *
 * Security checks:
 * 1. Basename must be exactly 'CLAUDE.md'
 * 2. Resolved real path must be within allowed directories
 * 3. Symlinks are resolved to detect escapes
 *
 * @param filePath - The file path to validate
 * @returns Object with isValid, error message, and resolved path
 */
export function validateClaudeMdPath(filePath: string): PathValidationResult {
  // Check 1: Basename must be exactly 'CLAUDE.md'
  const basename = path.basename(filePath);
  if (basename !== 'CLAUDE.md') {
    return { isValid: false, error: 'File must be named CLAUDE.md' };
  }

  // Check 2: Normalize path and resolve any '..' segments
  const normalizedPath = path.resolve(filePath);

  // Check 3: If file exists, resolve symlinks
  let resolvedPath = normalizedPath;
  try {
    if (fs.existsSync(normalizedPath)) {
      resolvedPath = fs.realpathSync(normalizedPath);
    }
  } catch {
    // File doesn't exist or can't resolve - use normalized path
  }

  // Check 4: Verify the resolved path is within allowed directories
  const isInAllowedDir = ALLOWED_BASE_DIRS.some(
    (baseDir) => resolvedPath.startsWith(baseDir + path.sep) || resolvedPath === baseDir
  );

  if (!isInAllowedDir) {
    return {
      isValid: false,
      error: 'Path outside allowed directories',
    };
  }

  // Check 5: Double-check basename after resolution (symlink could point elsewhere)
  if (path.basename(resolvedPath) !== 'CLAUDE.md') {
    return { isValid: false, error: 'Resolved file must be named CLAUDE.md' };
  }

  return { isValid: true, resolvedPath };
}

/**
 * Get the list of allowed base directories
 * Useful for documentation and testing
 */
export function getAllowedBaseDirs(): string[] {
  return [...ALLOWED_BASE_DIRS];
}
