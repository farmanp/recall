// @ts-nocheck - Functions used in closure confuse TS strict mode
import dotenv from 'dotenv';
import { createServer } from './server';
import { getDbInstance, closeDatabase } from './db/connection';
import {
  getTranscriptDbInstance,
  closeTranscriptDatabase,
  getTranscriptDbPath,
} from './db/transcript-connection';
import { initializeTranscriptSchema } from './db/transcript-queries';
import { startWatcher, stopWatcher } from './services/file-watcher';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3001;
const AUTO_WATCH = process.env.AUTO_WATCH !== 'false'; // Default: enabled

/**
 * Start the server
 */
function start(): void {
  try {
    // Test claude-mem database connection
    console.log('Testing claude-mem database connection...');
    const db = getDbInstance();
    const result = db.prepare('SELECT COUNT(*) as count FROM sdk_sessions').get() as { count: number };
    console.log(`✅ Claude-mem database: ${result.count} sessions found`);

    // Initialize transcript database
    console.log('Initializing transcript database...');
    initializeTranscriptSchema();
    const transcriptDb = getTranscriptDbInstance();
    const transcriptResult = transcriptDb.prepare('SELECT COUNT(*) as count FROM session_metadata').get() as { count: number };
    console.log(`✅ Transcript database: ${transcriptResult.count} sessions imported`);
    console.log(`   Location: ${getTranscriptDbPath()}`);

    // Start file watcher
    if (AUTO_WATCH) {
      console.log('Starting file watcher for auto-import...');
      startWatcher();
      console.log(`✅ File watcher: monitoring ~/.claude/projects/`);
    } else {
      console.log('⏸️  File watcher disabled (AUTO_WATCH=false)');
    }

    // Create Express app
    const app = createServer();

    // Start listening
    const server = app.listen(PORT, () => {
      console.log(`\n🚀 Recall Server`);
      console.log(`📡 Server running on http://localhost:${PORT}`);
      console.log(`💾 Claude-mem DB: ~/.claude-mem/claude-mem.db`);
      console.log(`💾 Transcript DB: ${getTranscriptDbPath()}`);
      console.log(`\nAPI Endpoints:`);
      console.log(`  GET  /api/health`);
      console.log(`  GET  /api/sessions?source=filesystem|db`);
      console.log(`  GET  /api/sessions/:id`);
      console.log(`  GET  /api/sessions/:id/frames?source=filesystem|db`);
      console.log(`  GET  /api/sessions/:id/events`);
      console.log(`  POST /api/import/start`);
      console.log(`  GET  /api/import/status`);
      console.log(`  GET  /api/import/stats`);
      console.log(`  POST /api/import/single`);
      console.log(`\nPress Ctrl+C to stop\n`);
    });

    // Graceful shutdown
    const shutdown = () => {
      server.close(() => {
        console.log('✅ HTTP server closed');

        // Stop file watcher
        if (AUTO_WATCH) {
          stopWatcher();
          console.log('✅ File watcher stopped');
        }

        // Close database connections
        closeDatabase();
        console.log('✅ Claude-mem database closed');

        closeTranscriptDatabase();
        console.log('✅ Transcript database closed');

        process.exit(0);
      });
    };

    process.on('SIGTERM', () => {
      console.log('\n⏹️  SIGTERM received, shutting down gracefully...');
      shutdown();
    });

    process.on('SIGINT', () => {
      console.log('\n⏹️  SIGINT received, shutting down gracefully...');
      shutdown();
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
start();
