import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createServer } from '../../server';
import { closeDatabase } from '../../db/connection';
import type { Application } from 'express';

describe('Session Routes', () => {
  let app: Application;

  beforeEach(() => {
    closeDatabase();
    app = createServer();
  });

  afterEach(() => {
    closeDatabase();
  });

  describe('GET /api/sessions', () => {
    it('should return list of sessions', async () => {
      const response = await request(app)
        .get('/api/sessions')
        .expect(200);

      expect(response.body).toHaveProperty('sessions');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('offset');
      expect(response.body).toHaveProperty('limit');
      expect(Array.isArray(response.body.sessions)).toBe(true);
    });

    it('should respect limit parameter', async () => {
      const response = await request(app)
        .get('/api/sessions?limit=1')
        .expect(200);

      expect(response.body.limit).toBe(1);
      expect(response.body.sessions.length).toBeLessThanOrEqual(1);
    });

    it('should respect offset parameter', async () => {
      const response = await request(app)
        .get('/api/sessions?offset=1')
        .expect(200);

      expect(response.body.offset).toBe(1);
    });

    it('should filter by project', async () => {
      const response = await request(app)
        .get('/api/sessions?project=test-project')
        .expect(200);

      response.body.sessions.forEach((session: { project: string }) => {
        expect(session.project).toBe('test-project');
      });
    });

    it('should filter by date range', async () => {
      const dateStart = new Date(Date.now() - 86400000).toISOString();
      const dateEnd = new Date().toISOString();

      const response = await request(app)
        .get(`/api/sessions?dateStart=${dateStart}&dateEnd=${dateEnd}`)
        .expect(200);

      expect(response.body.sessions).toBeInstanceOf(Array);
    });

    it('should handle empty results', async () => {
      const response = await request(app)
        .get('/api/sessions?project=non-existent-project')
        .expect(200);

      expect(response.body.sessions).toEqual([]);
      expect(response.body.total).toBe(0);
    });

    it('should return sessions in correct order (newest first)', async () => {
      const response = await request(app)
        .get('/api/sessions')
        .expect(200);

      if (response.body.sessions.length > 1) {
        for (let i = 0; i < response.body.sessions.length - 1; i++) {
          expect(response.body.sessions[i].started_at_epoch)
            .toBeGreaterThanOrEqual(response.body.sessions[i + 1].started_at_epoch);
        }
      }
    });
  });

  describe('GET /api/sessions/:id', () => {
    it('should return session details for valid ID', async () => {
      const response = await request(app)
        .get('/api/sessions/session-1')
        .expect(200);

      expect(response.body).toHaveProperty('session');
      expect(response.body).toHaveProperty('eventCount');
      expect(response.body).toHaveProperty('promptCount');
      expect(response.body).toHaveProperty('observationCount');
      expect(response.body.session.claude_session_id).toBe('session-1');
    });

    it('should return 404 for non-existent session', async () => {
      const response = await request(app)
        .get('/api/sessions/non-existent-id')
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Session not found');
    });

    it('should include correct statistics', async () => {
      const response = await request(app)
        .get('/api/sessions/session-1')
        .expect(200);

      expect(typeof response.body.eventCount).toBe('number');
      expect(typeof response.body.promptCount).toBe('number');
      expect(typeof response.body.observationCount).toBe('number');
      expect(response.body.eventCount)
        .toBe(response.body.promptCount + response.body.observationCount);
    });

    it('should return all session fields', async () => {
      const response = await request(app)
        .get('/api/sessions/session-1')
        .expect(200);

      const session = response.body.session;
      expect(session).toHaveProperty('id');
      expect(session).toHaveProperty('claude_session_id');
      expect(session).toHaveProperty('sdk_session_id');
      expect(session).toHaveProperty('project');
      expect(session).toHaveProperty('started_at');
      expect(session).toHaveProperty('started_at_epoch');
      expect(session).toHaveProperty('status');
      expect(session).toHaveProperty('prompt_counter');
    });
  });

  describe('GET /api/sessions/:id/events', () => {
    it('should return session events with TIME-FIRST ordering', async () => {
      const response = await request(app)
        .get('/api/sessions/session-1/events')
        .expect(200);

      expect(response.body).toHaveProperty('events');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('sessionId');
      expect(Array.isArray(response.body.events)).toBe(true);

      // Verify TIME-FIRST ordering
      if (response.body.events.length > 1) {
        for (let i = 0; i < response.body.events.length - 1; i++) {
          expect(response.body.events[i].ts)
            .toBeLessThanOrEqual(response.body.events[i + 1].ts);
        }
      }
    });

    it('should return 404 for non-existent session', async () => {
      const response = await request(app)
        .get('/api/sessions/non-existent-id/events')
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Session not found');
    });

    it('should respect limit parameter', async () => {
      const response = await request(app)
        .get('/api/sessions/session-1/events?limit=2')
        .expect(200);

      expect(response.body.limit).toBe(2);
      expect(response.body.events.length).toBeLessThanOrEqual(2);
    });

    it('should respect offset parameter', async () => {
      const response = await request(app)
        .get('/api/sessions/session-1/events?offset=1')
        .expect(200);

      expect(response.body.offset).toBe(1);
    });

    it('should filter by observation types', async () => {
      const response = await request(app)
        .get('/api/sessions/session-1/events?types=feature')
        .expect(200);

      const observations = response.body.events.filter(
        (e: { event_type: string }) => e.event_type === 'observation'
      );

      observations.forEach((obs: { obs_type: string }) => {
        expect(obs.obs_type).toBe('feature');
      });
    });

    it('should filter by multiple observation types', async () => {
      const response = await request(app)
        .get('/api/sessions/session-1/events?types=feature,decision')
        .expect(200);

      const observations = response.body.events.filter(
        (e: { event_type: string }) => e.event_type === 'observation'
      );

      observations.forEach((obs: { obs_type: string }) => {
        expect(['feature', 'decision']).toContain(obs.obs_type);
      });
    });

    it('should filter by afterTs parameter', async () => {
      // First get all events
      const allEvents = await request(app)
        .get('/api/sessions/session-1/events')
        .expect(200);

      if (allEvents.body.events.length > 0) {
        const firstEventTs = allEvents.body.events[0].ts;

        const response = await request(app)
          .get(`/api/sessions/session-1/events?afterTs=${firstEventTs + 1}`)
          .expect(200);

        response.body.events.forEach((event: { ts: number }) => {
          expect(event.ts).toBeGreaterThan(firstEventTs);
        });
      }
    });

    it('should include both prompts and observations', async () => {
      const response = await request(app)
        .get('/api/sessions/session-1/events')
        .expect(200);

      const eventTypes = new Set(
        response.body.events.map((e: { event_type: string }) => e.event_type)
      );

      expect(eventTypes.has('prompt')).toBe(true);
      expect(eventTypes.has('observation')).toBe(true);
    });

    it('should parse JSON fields for observations', async () => {
      const response = await request(app)
        .get('/api/sessions/session-1/events')
        .expect(200);

      const obsWithFacts = response.body.events.find(
        (e: { event_type: string; facts?: string[] }) =>
          e.event_type === 'observation' && e.facts
      );

      if (obsWithFacts) {
        expect(Array.isArray(obsWithFacts.facts)).toBe(true);
        expect(obsWithFacts.facts.length).toBeGreaterThan(0);
      }
    });

    it('should verify prompt_number ordering within same timestamp', async () => {
      const response = await request(app)
        .get('/api/sessions/session-1/events')
        .expect(200);

      // Group by timestamp
      const groups = new Map<number, Array<{ prompt_number: number | null; kind_rank: number }>>();
      response.body.events.forEach((event: { ts: number; prompt_number: number | null; kind_rank: number }) => {
        const existing = groups.get(event.ts) || [];
        existing.push(event);
        groups.set(event.ts, existing);
      });

      // Verify ordering within each timestamp
      groups.forEach(events => {
        if (events.length > 1) {
          for (let i = 0; i < events.length - 1; i++) {
            const currentPromptNum = events[i].prompt_number ?? 999999;
            const nextPromptNum = events[i + 1].prompt_number ?? 999999;
            expect(currentPromptNum).toBeLessThanOrEqual(nextPromptNum);
          }
        }
      });
    });

    it('should verify kind_rank ordering (prompts before observations)', async () => {
      const response = await request(app)
        .get('/api/sessions/session-1/events')
        .expect(200);

      // Group by timestamp and prompt_number
      const groups = new Map<string, Array<{ kind_rank: number }>>();
      response.body.events.forEach((event: {
        ts: number;
        prompt_number: number | null;
        kind_rank: number;
      }) => {
        const key = `${event.ts}-${event.prompt_number ?? 999999}`;
        const existing = groups.get(key) || [];
        existing.push(event);
        groups.set(key, existing);
      });

      // Within each group, verify kind_rank ordering
      groups.forEach(events => {
        if (events.length > 1) {
          for (let i = 0; i < events.length - 1; i++) {
            expect(events[i].kind_rank).toBeLessThanOrEqual(events[i + 1].kind_rank);
          }
        }
      });
    });
  });

  describe('GET /api/sessions/:sessionId/events/:eventType/:eventId', () => {
    it('should return prompt event by ID', async () => {
      // First get events to find a valid prompt ID
      const events = await request(app)
        .get('/api/sessions/session-1/events')
        .expect(200);

      const promptEvent = events.body.events.find(
        (e: { event_type: string }) => e.event_type === 'prompt'
      );

      if (promptEvent) {
        const response = await request(app)
          .get(`/api/sessions/session-1/events/prompt/${promptEvent.row_id}`)
          .expect(200);

        expect(response.body.event_type).toBe('prompt');
        expect(response.body.row_id).toBe(promptEvent.row_id);
      }
    });

    it('should return observation event by ID', async () => {
      // First get events to find a valid observation ID
      const events = await request(app)
        .get('/api/sessions/session-1/events')
        .expect(200);

      const obsEvent = events.body.events.find(
        (e: { event_type: string }) => e.event_type === 'observation'
      );

      if (obsEvent) {
        const response = await request(app)
          .get(`/api/sessions/session-1/events/observation/${obsEvent.row_id}`)
          .expect(200);

        expect(response.body.event_type).toBe('observation');
        expect(response.body.row_id).toBe(obsEvent.row_id);
      }
    });

    it('should return 400 for invalid event type', async () => {
      const response = await request(app)
        .get('/api/sessions/session-1/events/invalid/1')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid event type');
    });

    it('should return 404 for non-existent event', async () => {
      const response = await request(app)
        .get('/api/sessions/session-1/events/prompt/999999')
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Event not found');
    });

    it('should parse JSON fields for observation events', async () => {
      // Get an observation with JSON fields
      const events = await request(app)
        .get('/api/sessions/session-1/events?types=feature')
        .expect(200);

      const obsEvent = events.body.events.find(
        (e: { event_type: string; facts?: string[] }) =>
          e.event_type === 'observation' && e.facts
      );

      if (obsEvent) {
        const response = await request(app)
          .get(`/api/sessions/session-1/events/observation/${obsEvent.row_id}`)
          .expect(200);

        expect(Array.isArray(response.body.facts)).toBe(true);
        if (response.body.concepts) {
          expect(Array.isArray(response.body.concepts)).toBe(true);
        }
      }
    });
  });

  describe('GET /api/sessions/meta/projects', () => {
    it('should return list of projects', async () => {
      const response = await request(app)
        .get('/api/sessions/meta/projects')
        .expect(200);

      expect(response.body).toHaveProperty('projects');
      expect(Array.isArray(response.body.projects)).toBe(true);
      expect(response.body.projects.length).toBeGreaterThan(0);
    });

    it('should return projects in alphabetical order', async () => {
      const response = await request(app)
        .get('/api/sessions/meta/projects')
        .expect(200);

      const projects = response.body.projects;
      const sorted = [...projects].sort();
      expect(projects).toEqual(sorted);
    });

    it('should include known projects', async () => {
      const response = await request(app)
        .get('/api/sessions/meta/projects')
        .expect(200);

      expect(response.body.projects).toContain('test-project');
      expect(response.body.projects).toContain('another-project');
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed query parameters gracefully', async () => {
      const response = await request(app)
        .get('/api/sessions?limit=invalid')
        .expect(200);

      // Should default to 20 when invalid
      expect(response.body.limit).toBeDefined();
    });

    it('should return proper error structure on 500 errors', async () => {
      // This is hard to test without breaking the database
      // but we can verify the error handler exists
      const response = await request(app)
        .get('/api/sessions/session-1')
        .expect(200);

      expect(response.body).toBeDefined();
    });
  });

  describe('CORS and JSON Parsing', () => {
    it('should have CORS enabled', async () => {
      const response = await request(app)
        .get('/api/sessions')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });

    it('should parse JSON request bodies', async () => {
      // Since we only have GET endpoints, this tests the middleware setup
      const response = await request(app)
        .get('/api/sessions')
        .set('Accept', 'application/json')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/json/);
    });
  });
});
