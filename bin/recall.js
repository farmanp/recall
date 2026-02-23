#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');

// Capture user's actual working directory BEFORE anything else
// This is where the user ran `npx recall-player` from
const userCwd = process.cwd();

// Determine paths
const backendDir = path.join(__dirname, '..', 'backend');
const serverPath = path.join(backendDir, 'dist', 'index.js');
const cliPath = path.join(backendDir, 'dist', 'scripts', 'recall-cli.js');
const port = process.env.PORT || 3001;

// PID file location (must match backend/src/index.ts)
const RECALL_DIR = path.join(os.homedir(), '.recall');
const PID_FILE = path.join(RECALL_DIR, 'recall.pid');

/**
 * Stop a running Recall server
 */
function stopServer() {
  if (!fs.existsSync(PID_FILE)) {
    console.log('No running Recall server found.');
    console.log('(PID file not found at ' + PID_FILE + ')');
    process.exit(1);
  }

  try {
    const pid = parseInt(fs.readFileSync(PID_FILE, 'utf-8').trim(), 10);

    if (isNaN(pid)) {
      console.error('Invalid PID file contents.');
      fs.unlinkSync(PID_FILE);
      process.exit(1);
    }

    // Check if process is running
    try {
      process.kill(pid, 0); // Signal 0 just checks if process exists
    } catch (err) {
      console.log('Recall server is not running (stale PID file).');
      fs.unlinkSync(PID_FILE);
      process.exit(0);
    }

    // Send SIGTERM for graceful shutdown
    console.log(`Stopping Recall server (PID: ${pid})...`);
    process.kill(pid, 'SIGTERM');

    // Wait for process to exit
    let attempts = 0;
    const maxAttempts = 30; // 3 seconds max
    const checkInterval = setInterval(() => {
      attempts++;
      try {
        process.kill(pid, 0);
        // Process still running
        if (attempts >= maxAttempts) {
          clearInterval(checkInterval);
          console.log('Server is taking too long to stop. Forcing shutdown...');
          process.kill(pid, 'SIGKILL');
          setTimeout(() => {
            if (fs.existsSync(PID_FILE)) {
              fs.unlinkSync(PID_FILE);
            }
            console.log('Server stopped.');
            process.exit(0);
          }, 500);
        }
      } catch (err) {
        // Process has exited
        clearInterval(checkInterval);
        if (fs.existsSync(PID_FILE)) {
          fs.unlinkSync(PID_FILE);
        }
        console.log('Recall server stopped.');
        process.exit(0);
      }
    }, 100);
  } catch (err) {
    console.error('Failed to stop server:', err.message);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0] || '';

// CLI commands that don't start the server
const cliCommands = ['enable', 'disable', 'status', 'list'];
const importCliPath = path.join(backendDir, 'dist', 'services', 'import-cli.js');

if (command === 'stop') {
  // Stop the running server
  stopServer();
} else if (command === 'import') {
  // Run import CLI command
  const importArgs = args.slice(1); // Remove 'import' from args
  const cli = spawn('node', [importCliPath, ...importArgs], {
    stdio: 'inherit',
    cwd: userCwd,
    env: { ...process.env, RECALL_USER_CWD: userCwd },
  });

  cli.on('error', (err) => {
    console.error('Failed to run import:', err.message);
    process.exit(1);
  });

  cli.on('exit', (code) => {
    process.exit(code || 0);
  });
} else if (cliCommands.includes(command)) {
  // Run CLI command
  const cli = spawn('node', [cliPath, ...args], {
    stdio: 'inherit',
    cwd: userCwd,
    env: { ...process.env, RECALL_USER_CWD: userCwd },
  });

  cli.on('error', (err) => {
    console.error('Failed to run CLI:', err.message);
    process.exit(1);
  });

  cli.on('exit', (code) => {
    process.exit(code || 0);
  });
} else if (command === 'help' || command === '--help' || command === '-h') {
  // Show combined help
  console.log(`
Recall - AI Session Replay & Git Tracking
==========================================

USAGE
  recall [command]

SERVER COMMANDS
  recall              Start the Recall web server (default)
  recall start        Same as above - starts the web server
  recall stop         Stop the running Recall server

IMPORT COMMANDS
  recall import       Import all sessions into database (enables analysis, stats)
  recall import --stats         Show import statistics
  recall import --no-skip       Force re-import all sessions
  recall import --help          Show all import options

GIT TRACKING COMMANDS
  recall enable       Enable git tracking for current repository
  recall disable      Disable git tracking for current repository
  recall status       Show tracking status for current repository
  recall list         List all enabled repositories

OPTIONS
  --help, -h          Show this help message

EXAMPLES
  # Start the web server
  recall

  # Stop the running server
  recall stop

  # Import existing sessions (run this first time!)
  recall import

  # Check import stats
  recall import --stats

  # Enable git tracking in your project
  cd /path/to/project
  recall enable

For more info, visit: https://github.com/farmanp/recall
`);
} else {
  // Start the backend server (default behavior)
  const server = spawn('node', [serverPath], {
    stdio: 'inherit',
    cwd: backendDir,
    env: { ...process.env, NODE_ENV: 'production', PORT: String(port), RECALL_USER_CWD: userCwd },
  });

  server.on('error', (err) => {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  });

  // Open browser after short delay to let server start
  setTimeout(async () => {
    const url = `http://localhost:${port}`;
    try {
      const open = (await import('open')).default;
      await open(url);
    } catch (err) {
      // Browser open failed, but server is still running
    }
    console.log(`\nRecall is running at ${url}\n`);
    console.log('Press Ctrl+C to stop\n');
  }, 1500);

  // Handle shutdown
  const shutdown = () => {
    server.kill();
    process.exit();
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
