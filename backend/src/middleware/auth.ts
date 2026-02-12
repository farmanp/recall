import { Request, Response, NextFunction } from 'express';
import { tokenManager } from '../services/token-manager';

/**
 * Authentication Middleware
 *
 * Enforces token-based authentication for non-localhost access.
 * Localhost requests (127.0.0.1, ::1) always bypass authentication.
 *
 * Authentication methods:
 * - Authorization: Bearer <token> header
 *
 * Configuration:
 * - RECALL_DISABLE_AUTH=true: Disables auth (dev only)
 */

/**
 * Localhost IP addresses that bypass authentication
 */
const LOCALHOST_IPS = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];

/**
 * Check if a request originates from localhost
 *
 * Uses req.socket.remoteAddress directly to prevent X-Forwarded-For header spoofing.
 * Do NOT use req.ip as it can be influenced by proxy headers.
 *
 * Exported for testing purposes.
 */
export function isLocalhost(req: Request): boolean {
  // Use socket.remoteAddress as it cannot be spoofed via headers
  const ip = req.socket.remoteAddress || '';
  return LOCALHOST_IPS.includes(ip);
}

/**
 * Extract bearer token from Authorization header
 */
function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7).trim();
}

/**
 * Check if authentication is disabled via environment variable
 */
function isAuthDisabled(): boolean {
  return process.env.RECALL_DISABLE_AUTH === 'true';
}

/**
 * Dependencies that can be injected for testing
 */
interface AuthGuardDeps {
  isLocalhost?: (req: Request) => boolean;
  allowLocalhostBypass?: boolean;
}

/**
 * Express middleware that enforces authentication for non-localhost requests
 *
 * @param deps - Optional dependencies for testing
 * @returns Express middleware function
 *
 * @example
 * // In server.ts
 * app.use(authGuard());
 */
export function authGuard(deps?: AuthGuardDeps) {
  const checkLocalhost = deps?.isLocalhost ?? isLocalhost;
  // Localhost bypass is enabled by default for local-first tools
  // Can be disabled via RECALL_LOCALHOST_BYPASS=false for proxy deployments
  const envLocalhostBypass = process.env.RECALL_LOCALHOST_BYPASS !== 'false';
  const allowLocalhostBypass = deps?.allowLocalhostBypass ?? envLocalhostBypass;

  return (req: Request, res: Response, next: NextFunction): void => {
    // Public shared-session reads are authenticated with share-scoped tokens.
    if (req.method === 'GET' && req.path.startsWith('/api/shared/')) {
      next();
      return;
    }

    // Check if auth is disabled (dev mode)
    if (isAuthDisabled()) {
      next();
      return;
    }

    // Localhost bypass is opt-in to avoid accidental proxy misconfiguration exposure.
    if (allowLocalhostBypass && checkLocalhost(req)) {
      next();
      return;
    }

    // Check if token manager is initialized
    if (!tokenManager.isInitialized()) {
      console.error('[Auth] Token manager not initialized');
      res.status(500).json({
        error: 'Server configuration error',
        message: 'Authentication system not initialized',
      });
      return;
    }

    // Extract and validate token
    const token = extractBearerToken(req);

    if (!token) {
      res.status(401).json({
        error: 'Authentication required',
        message:
          'Non-localhost requests require authentication. Include Authorization: Bearer <token> header.',
      });
      return;
    }

    if (!tokenManager.validateToken(token)) {
      // Don't reveal whether token format was wrong or just didn't match
      res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid or expired token',
      });
      return;
    }

    // Token is valid
    next();
  };
}

/**
 * Check if current request would require authentication
 * Useful for testing and debugging
 *
 * @param req - Express request
 * @param deps - Optional dependencies for testing
 */
export function wouldRequireAuth(
  req: Request,
  deps?: { isLocalhost?: (req: Request) => boolean; allowLocalhostBypass?: boolean }
): boolean {
  const checkLocalhost = deps?.isLocalhost ?? isLocalhost;
  const defaultLocalhostBypass = process.env.NODE_ENV === 'test';
  const envLocalhostBypass = process.env.RECALL_TRUST_LOCALHOST_BYPASS === 'true';
  const allowLocalhostBypass =
    deps?.allowLocalhostBypass ?? (envLocalhostBypass || defaultLocalhostBypass);

  if (req.method === 'GET' && req.path.startsWith('/api/shared/')) {
    return false;
  }
  if (isAuthDisabled()) {
    return false;
  }
  if (allowLocalhostBypass && checkLocalhost(req)) {
    return false;
  }
  return true;
}
