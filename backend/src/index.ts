import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createServer } from './server';
import { getDbInstance, closeDatabase, isClaudeMemAvailable } from './db/connection';
import { getTranscriptDbInstance, closeTranscriptDatabase } from './db/transcript-connection';
import { initializeTranscriptSchema } from './db/transcript-queries';
import { startWatcher, stopWatcher } from './services/file-watcher';
import { getSessionIndexer } from './parser/session-indexer';
import { geminiHashMapper } from './services/gemini-hash-mapper';
import { tokenManager } from './services/token-manager';
import { isViewerModeEnabled } from './middleware/viewer-mode';
import {
  printBanner,
  printStatus,
  printDivider,
  printShutdownHint,
  printNewAuthToken,
  printShutdownMessage,
  printShutdownComplete,
  printError,
  printWarning,
  printProgress,
} from './utils/cli-ui';

// Read package.json for version
const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf-8')
);

// PID file for graceful shutdown via CLI
const RECALL_DIR = path.join(os.homedir(), '.recall');
const PID_FILE = path.join(RECALL_DIR, 'recall.pid');

function writePidFile(): void {
  try {
    if (!fs.existsSync(RECALL_DIR)) {
      fs.mkdirSync(RECALL_DIR, { recursive: true });
    }
    fs.writeFileSync(PID_FILE, String(process.pid));
  } catch (err) {
    printWarning(`Could not write PID file: ${err}`);
  }
}

function removePidFile(): void {
  try {
    if (fs.existsSync(PID_FILE)) {
      fs.unlinkSync(PID_FILE);
    }
  } catch (err) {
    // Ignore errors during cleanup
  }
}

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
    let claudeMemSessionCount = 0;
    if (isClaudeMemAvailable()) {
      printProgress('Testing claude-mem database connection...');
      const db = getDbInstance();
      if (db) {
        const result = db.prepare('SELECT COUNT(*) as count FROM sdk_sessions').get() as {
          count: number;
        };
        claudeMemSessionCount = result.count;
      }
    }

    // Initialize transcript database
    printProgress('Initializing transcript database...');
    initializeTranscriptSchema();
    const transcriptDb = getTranscriptDbInstance();
    const transcriptResult = transcriptDb
      .prepare('SELECT COUNT(*) as count FROM session_metadata')
      .get() as { count: number };

    // Configure CWD filter for session indexer
    const indexer = getSessionIndexer();
    if (FILTER_BY_CWD) {
      indexer.setCwdFilter(STARTUP_CWD);
    } else {
      indexer.setCwdFilter(null);
    }

    // Initialize Gemini hash mapper with current working directory
    geminiHashMapper.setCwd(STARTUP_CWD);

    // Initialize authentication token
    const shouldRegenerateToken = process.argv.includes('--regenerate-token');
    const { token, isNew } = tokenManager.initialize(shouldRegenerateToken);

    // Start file watcher (monitors both Claude and Gemini sessions)
    if (AUTO_WATCH) {
      printProgress('Starting file watchers...');
      startWatcher();
    }

    // Create Express app
    const app = createServer();

    // Start listening
    const server = app.listen(Number(PORT), HOST, () => {
      // Write PID file for CLI stop command
      writePidFile();

      // Print the styled banner
      printBanner(packageJson.version);

      // Print status items
      const authEnabled = process.env.RECALL_DISABLE_AUTH !== 'true';
      const viewerModeOn = isViewerModeEnabled();
      const claudeMemAvailable = isClaudeMemAvailable();

      printStatus([
        { label: 'Server ready', value: `http://${HOST}:${PORT}`, ok: true },
        { label: 'Sessions loaded', value: `${transcriptResult.count} indexed`, ok: true },
        {
          label: 'File watcher',
          value: AUTO_WATCH ? 'enabled' : 'disabled',
          ok: AUTO_WATCH,
        },
        {
          label: 'Claude-mem',
          value: claudeMemAvailable
            ? `connected (${claudeMemSessionCount} sessions)`
            : 'not available',
          ok: claudeMemAvailable,
        },
        {
          label: 'Security',
          value: `auth=${authEnabled ? 'on' : 'off'}, viewer=${viewerModeOn ? 'on' : 'off'}`,
          ok: authEnabled,
        },
      ]);

      // Show new auth token if generated
      if (isNew || shouldRegenerateToken) {
        printNewAuthToken(token, tokenManager.getTokenFilePath());
      }

      printDivider();
      printShutdownHint();
    });

    // Graceful shutdown
    const shutdown = () => {
      server.close(() => {
        printShutdownComplete('HTTP server closed');

        // Remove PID file
        removePidFile();

        // Stop file watcher
        if (AUTO_WATCH) {
          stopWatcher();
          printShutdownComplete('File watcher stopped');
        }

        // Close database connections
        if (isClaudeMemAvailable()) {
          closeDatabase();
          printShutdownComplete('Claude-mem database closed');
        }

        closeTranscriptDatabase();
        printShutdownComplete('Transcript database closed');

        process.exit(0);
      });
    };

    process.on('SIGTERM', () => {
      printShutdownMessage('SIGTERM');
      shutdown();
    });

    process.on('SIGINT', () => {
      printShutdownMessage('SIGINT');
      shutdown();
    });
  } catch (error) {
    printError('Failed to start server', error);
    process.exit(1);
  }
}

// Start the server
start();
