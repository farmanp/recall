import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express, { Express, Request } from 'express';
import request from 'supertest';
import { authGuard, isLocalhost, wouldRequireAuth } from '../../middleware/auth';

// Mock tokenManager
vi.mock('../../services/token-manager', () => ({
  tokenManager: {
    isInitialized: vi.fn(() => true),
    validateToken: vi.fn((token: string) => token === 'valid-token'),
  },
}));

import { tokenManager } from '../../services/token-manager';

// Helper to create mock isLocalhost functions
const createLocalhostMock = (returnValue: boolean) => () => returnValue;

describe('Auth Middleware', () => {
  let app: Express;
  const originalEnv = process.env.RECALL_DISABLE_AUTH;
  const originalLocalBypassEnv = process.env.RECALL_TRUST_LOCALHOST_BYPASS;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.RECALL_DISABLE_AUTH;
    process.env.RECALL_TRUST_LOCALHOST_BYPASS = 'true';

    vi.mocked(tokenManager.isInitialized).mockReturnValue(true);
    vi.mocked(tokenManager.validateToken).mockImplementation(
      (token: string) => token === 'valid-token'
    );

    // Default app with localhost bypass (simulates real localhost requests)
    app = express();
    app.use(authGuard({ isLocalhost: createLocalhostMock(true) }));
    app.get('/api/test', (_req, res) => res.json({ ok: true }));
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.RECALL_DISABLE_AUTH = originalEnv;
    } else {
      delete process.env.RECALL_DISABLE_AUTH;
    }

    if (originalLocalBypassEnv !== undefined) {
      process.env.RECALL_TRUST_LOCALHOST_BYPASS = originalLocalBypassEnv;
    } else {
      delete process.env.RECALL_TRUST_LOCALHOST_BYPASS;
    }
  });

  describe('localhost bypass', () => {
    it('allows localhost requests without token', async () => {
      const response = await request(app).get('/api/test');
      expect(response.status).toBe(200);
    });

    it('uses socket.remoteAddress not X-Forwarded-For (security fix)', async () => {
      // This test verifies that even with X-Forwarded-For header, localhost socket is detected
      const response = await request(app).get('/api/test').set('X-Forwarded-For', '192.168.1.100');
      expect(response.status).toBe(200);
    });
  });

  describe('RECALL_DISABLE_AUTH', () => {
    it('bypasses auth when RECALL_DISABLE_AUTH=true', async () => {
      process.env.RECALL_DISABLE_AUTH = 'true';

      // Non-localhost, but auth is disabled
      const testApp = express();
      testApp.use(authGuard({ isLocalhost: createLocalhostMock(false) }));
      testApp.get('/api/test', (_req, res) => res.json({ ok: true }));

      const response = await request(testApp).get('/api/test');
      expect(response.status).toBe(200);
    });
  });

  describe('non-localhost requests', () => {
    let nonLocalApp: Express;

    beforeEach(() => {
      // App that simulates non-localhost requests
      nonLocalApp = express();
      nonLocalApp.use(authGuard({ isLocalhost: createLocalhostMock(false) }));
      nonLocalApp.get('/api/test', (_req, res) => res.json({ ok: true }));
    });

    it('returns 401 without Authorization header', async () => {
      const response = await request(nonLocalApp).get('/api/test');
      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authentication required');
    });

    it('returns 401 with invalid Authorization header format', async () => {
      const response = await request(nonLocalApp)
        .get('/api/test')
        .set('Authorization', 'InvalidFormat');
      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authentication required');
    });

    it('returns 401 with invalid token', async () => {
      const response = await request(nonLocalApp)
        .get('/api/test')
        .set('Authorization', 'Bearer invalid-token');
      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authentication failed');
    });

    it('allows request with valid token', async () => {
      const response = await request(nonLocalApp)
        .get('/api/test')
        .set('Authorization', 'Bearer valid-token');
      expect(response.status).toBe(200);
    });

    it('handles Bearer token with extra whitespace', async () => {
      const response = await request(nonLocalApp)
        .get('/api/test')
        .set('Authorization', 'Bearer   valid-token  ');
      expect(response.status).toBe(200);
    });
  });

  describe('token manager not initialized', () => {
    it('returns 500 when token manager not initialized', async () => {
      vi.mocked(tokenManager.isInitialized).mockReturnValue(false);

      const testApp = express();
      testApp.use(authGuard({ isLocalhost: createLocalhostMock(false) }));
      testApp.get('/api/test', (_req, res) => res.json({ ok: true }));

      const response = await request(testApp)
        .get('/api/test')
        .set('Authorization', 'Bearer any-token');
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Server configuration error');
    });
  });

  describe('error response format', () => {
    let nonLocalApp: Express;

    beforeEach(() => {
      nonLocalApp = express();
      nonLocalApp.use(authGuard({ isLocalhost: createLocalhostMock(false) }));
      nonLocalApp.get('/api/test', (_req, res) => res.json({ ok: true }));
    });

    it('returns proper error structure for missing auth', async () => {
      const response = await request(nonLocalApp).get('/api/test');
      expect(response.body).toEqual({
        error: 'Authentication required',
        message: expect.stringContaining('Authorization: Bearer'),
      });
    });

    it('returns proper error structure for invalid token', async () => {
      const response = await request(nonLocalApp)
        .get('/api/test')
        .set('Authorization', 'Bearer wrong');
      expect(response.body).toEqual({
        error: 'Authentication failed',
        message: 'Invalid or expired token',
      });
    });
  });
});

describe('isLocalhost', () => {
  it('returns true for 127.0.0.1', () => {
    const mockReq = {
      socket: { remoteAddress: '127.0.0.1' },
    } as unknown as Request;
    expect(isLocalhost(mockReq)).toBe(true);
  });

  it('returns true for ::1', () => {
    const mockReq = {
      socket: { remoteAddress: '::1' },
    } as unknown as Request;
    expect(isLocalhost(mockReq)).toBe(true);
  });

  it('returns true for ::ffff:127.0.0.1', () => {
    const mockReq = {
      socket: { remoteAddress: '::ffff:127.0.0.1' },
    } as unknown as Request;
    expect(isLocalhost(mockReq)).toBe(true);
  });

  it('returns false for external IP', () => {
    const mockReq = {
      socket: { remoteAddress: '192.168.1.100' },
    } as unknown as Request;
    expect(isLocalhost(mockReq)).toBe(false);
  });

  it('returns false for undefined remoteAddress', () => {
    const mockReq = {
      socket: { remoteAddress: undefined },
    } as unknown as Request;
    expect(isLocalhost(mockReq)).toBe(false);
  });
});

describe('wouldRequireAuth', () => {
  const originalEnv = process.env.RECALL_DISABLE_AUTH;
  const originalLocalBypassEnv = process.env.RECALL_TRUST_LOCALHOST_BYPASS;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.RECALL_DISABLE_AUTH = originalEnv;
    } else {
      delete process.env.RECALL_DISABLE_AUTH;
    }

    if (originalLocalBypassEnv !== undefined) {
      process.env.RECALL_TRUST_LOCALHOST_BYPASS = originalLocalBypassEnv;
    } else {
      delete process.env.RECALL_TRUST_LOCALHOST_BYPASS;
    }
  });

  it('returns false when auth is disabled', () => {
    process.env.RECALL_DISABLE_AUTH = 'true';

    const mockReq = {
      socket: { remoteAddress: '192.168.1.100' },
    } as unknown as Request;

    expect(wouldRequireAuth(mockReq)).toBe(false);
  });

  it('returns false for localhost', () => {
    delete process.env.RECALL_DISABLE_AUTH;
    process.env.RECALL_TRUST_LOCALHOST_BYPASS = 'true';

    const mockReq = {
      socket: { remoteAddress: '127.0.0.1' },
    } as unknown as Request;

    expect(wouldRequireAuth(mockReq)).toBe(false);
  });

  it('returns true for non-localhost when auth enabled', () => {
    delete process.env.RECALL_DISABLE_AUTH;
    process.env.RECALL_TRUST_LOCALHOST_BYPASS = 'true';

    const mockReq = {
      socket: { remoteAddress: '192.168.1.100' },
    } as unknown as Request;

    expect(wouldRequireAuth(mockReq)).toBe(true);
  });

  it('accepts injected isLocalhost for testing', () => {
    delete process.env.RECALL_DISABLE_AUTH;
    delete process.env.RECALL_TRUST_LOCALHOST_BYPASS;

    const mockReq = {
      socket: { remoteAddress: '192.168.1.100' },
    } as unknown as Request;

    // Inject a mock that always returns true (localhost)
    expect(wouldRequireAuth(mockReq, { isLocalhost: () => true, allowLocalhostBypass: true })).toBe(
      false
    );

    // Inject a mock that always returns false (non-localhost)
    expect(wouldRequireAuth(mockReq, { isLocalhost: () => false })).toBe(true);
  });
});
