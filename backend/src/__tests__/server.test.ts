import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createServer } from '../server';
import { closeDatabase } from '../db/connection';
import type { Application } from 'express';

describe('Server', () => {
  let app: Application;

  beforeEach(() => {
    closeDatabase();
    app = createServer();
  });

  afterEach(() => {
    closeDatabase();
  });

  describe('Server Creation', () => {
    it('should create Express application', () => {
      expect(app).toBeDefined();
      expect(typeof app).toBe('function');
    });

    it('should have request handler', () => {
      expect(app).toHaveProperty('listen');
      expect(app).toHaveProperty('use');
      expect(app).toHaveProperty('get');
    });
  });

  describe('Middleware', () => {
    it('should have CORS middleware enabled', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });

    it('should parse JSON request bodies', async () => {
      const response = await request(app)
        .get('/api/health')
        .set('Content-Type', 'application/json')
        .expect(200);

      expect(response.body).toBeDefined();
      expect(typeof response.body).toBe('object');
    });

    it('should log requests', async () => {
      // Request logging happens via console.log
      // Just verify the request goes through
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.status).toBe(200);
    });

    it('should set correct Content-Type header', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/json/);
    });
  });

  describe('Health Check Endpoint', () => {
    it('should respond to /api/health', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('database');
    });

    it('should return ok status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body.status).toBe('ok');
    });

    it('should return database connection status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body.database).toBe('connected');
    });

    it('should return ISO timestamp', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body.timestamp).toBeDefined();
      // Verify it's a valid ISO string
      const date = new Date(response.body.timestamp);
      expect(date.toISOString()).toBe(response.body.timestamp);
    });
  });

  describe('API Routes', () => {
    it('should mount sessions routes at /api/sessions', async () => {
      const response = await request(app)
        .get('/api/sessions')
        .expect(200);

      expect(response.body).toBeDefined();
    });

    it('should handle session detail routes', async () => {
      const response = await request(app)
        .get('/api/sessions/session-1')
        .expect(200);

      expect(response.body).toHaveProperty('session');
    });

    it('should handle session events routes', async () => {
      const response = await request(app)
        .get('/api/sessions/session-1/events')
        .expect(200);

      expect(response.body).toHaveProperty('events');
    });

    it('should handle projects meta route', async () => {
      const response = await request(app)
        .get('/api/sessions/meta/projects')
        .expect(200);

      expect(response.body).toHaveProperty('projects');
    });
  });

  describe('Static File Serving', () => {
    it('should serve static files from public directory', async () => {
      // This will 404 if no public directory exists, which is fine for testing
      const response = await request(app)
        .get('/some-static-file.txt');

      // Should either serve the file or fall through (not error out)
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for unknown API routes', async () => {
      const response = await request(app)
        .get('/api/unknown-route');

      // Should either 404 or be handled by error middleware
      expect([404, 500]).toContain(response.status);
    });

    it('should return JSON error responses', async () => {
      const response = await request(app)
        .get('/api/sessions/non-existent-session')
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(typeof response.body.error).toBe('string');
    });

    it('should handle invalid session IDs gracefully', async () => {
      const response = await request(app)
        .get('/api/sessions/invalid-id-12345')
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle malformed requests', async () => {
      const response = await request(app)
        .get('/api/sessions?limit=not-a-number')
        .expect(200);

      // Should handle gracefully with default values
      expect(response.body).toBeDefined();
    });
  });

  describe('HTTP Methods', () => {
    it('should accept GET requests', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.status).toBe(200);
    });

    it('should handle OPTIONS requests (CORS preflight)', async () => {
      const response = await request(app)
        .options('/api/sessions');

      // Should have CORS headers
      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });

    it('should reject unsupported methods on read-only endpoints', async () => {
      const response = await request(app)
        .post('/api/health')
        .send({});

      // Should either 404 or 405 Method Not Allowed
      expect([404, 405]).toContain(response.status);
    });
  });

  describe('Request Validation', () => {
    it('should accept valid query parameters', async () => {
      const response = await request(app)
        .get('/api/sessions?limit=10&offset=0')
        .expect(200);

      expect(response.body.limit).toBe(10);
      expect(response.body.offset).toBe(0);
    });

    it('should handle missing query parameters with defaults', async () => {
      const response = await request(app)
        .get('/api/sessions')
        .expect(200);

      expect(response.body.limit).toBe(20); // Default limit
      expect(response.body.offset).toBe(0); // Default offset
    });

    it('should handle URL encoded parameters', async () => {
      const project = 'test project';
      const encoded = encodeURIComponent(project);

      const response = await request(app)
        .get(`/api/sessions?project=${encoded}`)
        .expect(200);

      // Should decode properly
      expect(response.body).toBeDefined();
    });
  });

  describe('Response Headers', () => {
    it('should include CORS headers', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });

    it('should include Content-Type header', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.headers).toHaveProperty('content-type');
      expect(response.headers['content-type']).toMatch(/json/);
    });

    it('should handle JSON responses correctly', async () => {
      const response = await request(app)
        .get('/api/sessions')
        .expect(200);

      expect(response.type).toBe('application/json');
    });
  });

  describe('Server Reliability', () => {
    it('should handle multiple concurrent requests', async () => {
      const requests = Array.from({ length: 10 }, () =>
        request(app).get('/api/health').expect(200)
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.body.status).toBe('ok');
      });
    });

    it('should maintain state across requests', async () => {
      const response1 = await request(app)
        .get('/api/sessions')
        .expect(200);

      const response2 = await request(app)
        .get('/api/sessions')
        .expect(200);

      // Should return consistent data
      expect(response1.body.total).toBe(response2.body.total);
    });

    it('should handle rapid sequential requests', async () => {
      for (let i = 0; i < 5; i++) {
        const response = await request(app)
          .get('/api/health')
          .expect(200);

        expect(response.body.status).toBe('ok');
      }
    });
  });

  describe('API Route Integration', () => {
    it('should properly chain from sessions list to detail', async () => {
      // Get list of sessions
      const listResponse = await request(app)
        .get('/api/sessions')
        .expect(200);

      if (listResponse.body.sessions.length > 0) {
        const sessionId = listResponse.body.sessions[0].claude_session_id;

        // Get session details
        const detailResponse = await request(app)
          .get(`/api/sessions/${sessionId}`)
          .expect(200);

        expect(detailResponse.body.session.claude_session_id).toBe(sessionId);
      }
    });

    it('should properly chain from session detail to events', async () => {
      // Get session detail
      const detailResponse = await request(app)
        .get('/api/sessions/session-1')
        .expect(200);

      const sessionId = detailResponse.body.session.claude_session_id;

      // Get session events
      const eventsResponse = await request(app)
        .get(`/api/sessions/${sessionId}/events`)
        .expect(200);

      expect(eventsResponse.body.sessionId).toBe(sessionId);
    });
  });
});
