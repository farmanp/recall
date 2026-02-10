import dotenv from 'dotenv';
import { createServer } from './server';
import { getDbInstance, closeDatabase, isClaudeMemAvailable } from './db/connection';
import {
  getTranscriptDbInstance,
  closeTranscriptDatabase,
  getTranscriptDbPath,
} from './db/transcript-connection';
import { initializeTranscriptSchema } from './db/transcript-queries';
import { startWatcher, stopWatcher } from './services/file-watcher';
import { getSessionIndexer } from './parser/session-indexer';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '127.0.0.1';
const AUTO_WATCH = process.env.AUTO_WATCH !== 'false'; // Default: enabled
const FILTER_BY_CWD = process.env.RECALL_FILTER_CWD !== 'false'; // Default: enabled

// Get the actual project root where the user ran the command
// RECALL_USER_CWD is set by bin/recall.js when running via npx
// Falls back to process.cwd() and strips common server subdirectories
function getProjectRoot(): string {
  // Prefer the explicitly passed user CWD (set by bin/recall.js for npx usage)
  if (process.env.RECALL_USER_CWD) {
    return process.env.RECALL_USER_CWD;
  }

  // Fallback: strip common server subdirectories from process.cwd()
  let cwd = process.cwd();
  const subdirs = ['/backend', '/server', '/api', '/src'];
  for (const subdir of subdirs) {
    if (cwd.endsWith(subdir)) {
      cwd = cwd.slice(0, -subdir.length);
      break;
    }
  }
  return cwd;
}

const STARTUP_CWD = getProjectRoot();

/**
 * Start the server
 */
function start(): void {
  try {
    // Test claude-mem database connection (optional)
    if (isClaudeMemAvailable()) {
      console.log('Testing claude-mem database connection...');
      const db = getDbInstance();
      if (db) {
        const result = db.prepare('SELECT COUNT(*) as count FROM sdk_sessions').get() as {
          count: number;
        };
        console.log(`✅ Claude-mem database: ${result.count} sessions found`);
      }
    } else {
      console.log('⚠️  Claude-mem database not found - commentary features disabled');
    }

    // Initialize transcript database
    console.log('Initializing transcript database...');
    initializeTranscriptSchema();
    const transcriptDb = getTranscriptDbInstance();
    const transcriptResult = transcriptDb
      .prepare('SELECT COUNT(*) as count FROM session_metadata')
      .get() as { count: number };
    console.log(`✅ Transcript database: ${transcriptResult.count} sessions imported`);
    console.log(`   Location: ${getTranscriptDbPath()}`);

    // Configure CWD filter for session indexer
    const indexer = getSessionIndexer();
    if (FILTER_BY_CWD) {
      indexer.setCwdFilter(STARTUP_CWD);
      console.log(`✅ CWD filter: enabled (${STARTUP_CWD})`);
    } else {
      indexer.setCwdFilter(null);
      console.log(`⏸️  CWD filter disabled (RECALL_FILTER_CWD=false)`);
    }

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
    const server = app.listen(Number(PORT), HOST, () => {
      console.log(`\n🚀 Recall Server`);
      console.log(`📡 Server running on http://${HOST}:${PORT}`);
      if (isClaudeMemAvailable()) {
        console.log(`💾 Claude-mem DB: ~/.claude-mem/claude-mem.db`);
      } else {
        console.log(`💾 Claude-mem DB: not available (commentary disabled)`);
      }
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
        if (isClaudeMemAvailable()) {
          closeDatabase();
          console.log('✅ Claude-mem database closed');
        }

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
