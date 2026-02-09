import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import type { Application } from 'express';

vi.mock('../../services/transcript-importer', () => ({
  bulkImportTranscripts: vi.fn(async () => ({
    totalFiles: 0,
    successful: 0,
    failed: 0,
    skipped: 0,
    results: [],
    duration: 0,
  })),
  importTranscript: vi.fn(async () => undefined),
}));

vi.mock('../../db/transcript-queries', () => ({
  initializeTranscriptSchema: vi.fn(),
  getImportStats: vi.fn(() => ({
    total: 0,
    pending: 0,
    completed: 0,
    failed: 0,
  })),
}));

describe('Import Routes', () => {
  let app: Application;

  beforeEach(async () => {
    vi.resetModules();
    const { createServer } = await import('../../server');
    app = createServer();
  });

  it('rejects invalid parallel values for bulk import', async () => {
    const response = await request(app).post('/api/import/start').send({ parallel: 0 }).expect(400);
    expect(response.body.error).toBe('Validation failed');
  });

  it('rejects missing filePath for single import', async () => {
    const response = await request(app).post('/api/import/single').send({}).expect(400);
    expect(response.body.error).toBe('Validation failed');
  });
});
