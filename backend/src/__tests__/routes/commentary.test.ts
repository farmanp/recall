import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import type { Application } from 'express';

// Mock the connection module to control claude-mem availability
vi.mock('../../db/connection', () => ({
  isClaudeMemAvailable: vi.fn(),
  getDbInstance: vi.fn(),
}));

describe('Commentary Routes', () => {
  let app: Application;

  beforeEach(async () => {
    vi.resetModules();

    // Default: claude-mem is not available
    const connectionMock = await import('../../db/connection');
    vi.mocked(connectionMock.isClaudeMemAvailable).mockReturnValue(false);
    vi.mocked(connectionMock.getDbInstance).mockReturnValue(null);

    const { createServer } = await import('../../server');
    app = createServer();
  });

  it('returns empty commentary when claude-mem is unavailable', async () => {
    const sessionId = 'test-session-123';
    const response = await request(app).get(`/api/sessions/${sessionId}/commentary`).expect(200);

    expect(response.body.total).toBe(0);
    expect(response.body.commentary).toEqual([]);
    expect(response.body.sessionId).toBe(sessionId);
  });

  it('handles special characters in session ID safely', async () => {
    // This tests that session IDs with special characters don't cause issues
    // Since we're using parameterized queries, this should be safe
    const sessionId = "session-1'; DROP TABLE observations;--";
    const response = await request(app)
      .get(`/api/sessions/${encodeURIComponent(sessionId)}/commentary`)
      .expect(200);

    // Should return empty results (not crash or execute SQL injection)
    expect(response.body.total).toBe(0);
    expect(response.body.commentary).toEqual([]);
  });
});
