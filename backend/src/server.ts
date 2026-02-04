import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import sessionsRouter from './routes/sessions';
import commentaryRouter from './routes/commentary';
import importRouter from './routes/import';

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

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Request logging
  app.use((req: Request, _res: Response, next: NextFunction) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
    next();
  });

  // API Routes
  app.use('/api/sessions', sessionsRouter);
  app.use('/api/sessions', commentaryRouter);
  app.use('/api/import', importRouter);
  // Mount sessions router at /api for /api/agents endpoint
  app.use('/api', sessionsRouter);

  // Health check with DB status
  app.get('/api/health', (_req: Request, res: Response) => {
    try {
      const { getDbInstance } = require('./db/connection');
      const { getTranscriptDbInstance } = require('./db/transcript-connection');

      const db = getDbInstance();
      const transcriptDb = getTranscriptDbInstance();

      // Test queries to ensure actual connectivity
      db.prepare('SELECT 1').get();
      transcriptDb.prepare('SELECT 1').get();

      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        databases: {
          claude_mem: 'connected',
          transcripts: 'connected'
        }
      });
    } catch (err) {
      console.error('Health check failed:', err);
      res.status(500).json({
        status: 'error',
        message: err instanceof Error ? err.message : 'Database connection failed',
        stack: err instanceof Error ? err.stack : undefined
      });
    }
  });

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
      stack: err.stack
    });
  });

  return app;
}
