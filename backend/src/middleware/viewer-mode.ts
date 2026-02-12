import { Request, Response, NextFunction } from 'express';

/**
 * Viewer-Only Mode Middleware
 *
 * When enabled, blocks all write operations to protect shared sessions.
 * This is essential for the live sharing feature where viewers should
 * only be able to read session data, not modify it.
 *
 * Blocked operations when enabled:
 * - POST /api/sessions/:id/rewind/* (file restoration)
 * - POST /api/import/* (transcript import)
 * - PATCH /api/work-units/* (work unit modifications)
 * - DELETE /* (any delete operation)
 * - POST /api/checkpoints/* (checkpoint creation)
 *
 * Always allowed:
 * - All GET requests
 * - POST /api/admin/viewer-mode (toggle endpoint)
 */

// Module-level state for viewer mode
let viewerModeEnabled = process.env.RECALL_VIEWER_MODE === 'true';

/**
 * Check if viewer mode is currently enabled
 */
export function isViewerModeEnabled(): boolean {
  return viewerModeEnabled;
}

/**
 * Set viewer mode state
 * @param enabled - Whether to enable viewer mode
 */
export function setViewerMode(enabled: boolean): void {
  viewerModeEnabled = enabled;
  console.log(`[ViewerMode] ${enabled ? 'Enabled' : 'Disabled'}`);
}

/**
 * Paths that are blocked when viewer mode is enabled
 * Uses path prefixes for matching
 */
const BLOCKED_PATH_PREFIXES = [
  '/api/sessions/', // Covers rewind operations
  '/api/import',
  '/api/work-units',
  '/api/checkpoints',
];

/**
 * Paths that are always allowed, even in viewer mode
 */
const ALWAYS_ALLOWED_PATHS = ['/api/admin/viewer-mode'];

/**
 * Check if a request should be blocked in viewer mode
 */
function shouldBlockRequest(method: string, path: string): boolean {
  // GET requests are always allowed
  if (method === 'GET') {
    return false;
  }

  // Check always-allowed paths first
  for (const allowedPath of ALWAYS_ALLOWED_PATHS) {
    if (path.startsWith(allowedPath)) {
      return false;
    }
  }

  // DELETE is always blocked in viewer mode
  if (method === 'DELETE') {
    return true;
  }

  // POST and PATCH to blocked paths
  if (method === 'POST' || method === 'PATCH') {
    for (const prefix of BLOCKED_PATH_PREFIXES) {
      if (path.startsWith(prefix)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Express middleware that enforces viewer-only mode
 *
 * @returns Express middleware function
 *
 * @example
 * // In server.ts
 * app.use(viewerModeGuard());
 */
export function viewerModeGuard() {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!viewerModeEnabled) {
      next();
      return;
    }

    const path = req.path;
    const method = req.method;

    if (shouldBlockRequest(method, path)) {
      console.log(`[ViewerMode] Blocked ${method} ${path}`);
      res.status(403).json({
        error: 'Viewer mode enabled',
        message: 'Write operations are disabled in viewer mode',
      });
      return;
    }

    next();
  };
}
