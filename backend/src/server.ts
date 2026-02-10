import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import sessionsRouter from './routes/sessions';
import commentaryRouter from './routes/commentary';
import importRouter from './routes/import';
import workUnitsRouter, { getSessionWorkUnit } from './routes/work-units';
import { getDbInstance, isClaudeMemAvailable } from './db/connection';
import { getTranscriptDbInstance } from './db/transcript-connection';
import { initializeTranscriptSchema } from './db/transcript-queries';

/**
 * Create and configure Express application
 *
 * Sets up the Express server with:
 * - CORS middleware (allows cross-origin requests from frontend)
 * - JSON body parsing
 * - Request logging
 * - API routes
 * - Static file serving (for production frontend)
 * - SPA fallback (serves index.html for non-API routes)
 * - Global error handler
 *
 * @returns {Application} Configured Express application
 *
 * @example
 * import { createServer } from './server';
 *
 * const app = createServer();
 * app.listen(3001, () => {
 *   console.log('Server running on http://localhost:3001');
 * });
 */
export function createServer(): Application {
  const app = express();
  initializeTranscriptSchema();
  const allowedOrigins = (
    process.env.RECALL_CORS_ORIGINS ||
    'http://localhost:3001,http://127.0.0.1:3001,http://localhost:5174,http://127.0.0.1:5174'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  // Middleware
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error('CORS origin not allowed'));
      },
    })
  );
  app.use(express.json());

  // Request logging
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const safePath = req.originalUrl.split('?')[0];
    console.log(`${new Date().toISOString()} ${req.method} ${safePath}`);
    next();
  });

  // Health check with DB status
  app.get('/api/health', (_req: Request, res: Response) => {
    try {
      const transcriptDb = getTranscriptDbInstance();

      // Test transcript DB connectivity (required)
      transcriptDb.prepare('SELECT 1').get();

      // Test claude-mem DB connectivity (optional)
      let claudeMemStatus: 'connected' | 'unavailable' = 'unavailable';
      if (isClaudeMemAvailable()) {
        const db = getDbInstance();
        if (db) {
          db.prepare('SELECT 1').get();
          claudeMemStatus = 'connected';
        }
      }

      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        databases: {
          claude_mem: claudeMemStatus,
          transcripts: 'connected',
        },
      });
    } catch (err) {
      console.error('Health check failed:', err);
      res.status(500).json({
        status: 'error',
        message: err instanceof Error ? err.message : 'Database connection failed',
      });
    }
  });

  // API Routes
  app.use('/api/sessions', sessionsRouter);
  app.use('/api/sessions', commentaryRouter);
  app.use('/api/import', importRouter);
  app.use('/api/work-units', workUnitsRouter);
  // Mount sessions router at /api for /api/agents endpoint
  app.use('/api', sessionsRouter);
  // Add work unit lookup for sessions
  app.get('/api/sessions/:id/work-unit', getSessionWorkUnit);

  // Serve built frontend (for production)
  const publicDir = path.join(__dirname, '..', 'public');
  app.use(express.static(publicDir));

  // SPA fallback - serve index.html for all non-API routes
  // Note: This will only work when frontend is built and deployed
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (!req.url.startsWith('/api')) {
      const indexPath = path.join(publicDir, 'index.html');
      // Only serve index.html if it exists (frontend is built)
      if (require('fs').existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        next();
      }
    } else {
      next();
    }
  });

  // Error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
      error: 'Internal server error',
      message: err.message,
    });
  });

  return app;
}
