import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createServer } from '../server';
import { closeDatabase } from '../db/connection';
import { closeTranscriptDatabase } from '../db/transcript-connection';
import type { Application } from 'express';

describe('Server', () => {
  let app: Application;

  beforeEach(() => {
    closeDatabase();
    closeTranscriptDatabase();
    app = createServer();
  });

  afterEach(() => {
    closeDatabase();
    closeTranscriptDatabase();
  });

  it('creates an Express application', () => {
    expect(app).toBeDefined();
    expect(typeof app).toBe('function');
  });

  it('responds to /api/health', async () => {
    const response = await request(app).get('/api/health').expect(200);

    expect(response.body.status).toBe('ok');
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('databases');
  });

  it('includes CORS headers', async () => {
    const response = await request(app).get('/api/health').expect(200);

    expect(response.headers['access-control-allow-origin']).toBeDefined();
  });

  it('serves sessions list (even if empty)', async () => {
    const response = await request(app).get('/api/sessions').expect(200);

    expect(Array.isArray(response.body.sessions)).toBe(true);
    expect(typeof response.body.total).toBe('number');
  });

  it('serves agent availability', async () => {
    const response = await request(app).get('/api/agents').expect(200);

    expect(response.body).toHaveProperty('agents');
    expect(response.body).toHaveProperty('counts');
  });

  it('returns 404 for unknown session IDs', async () => {
    await request(app).get('/api/sessions/unknown').expect(404);
  });

  it('returns 404 for unknown frames', async () => {
    await request(app).get('/api/sessions/unknown/frames').expect(404);
  });
});
