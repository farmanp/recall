#!/usr/bin/env node

const path = require('path');
const { spawn } = require('child_process');

// Capture user's actual working directory BEFORE anything else
// This is where the user ran `npx recall-player` from
const userCwd = process.cwd();

// Determine paths
const backendDir = path.join(__dirname, '..', 'backend');
const serverPath = path.join(backendDir, 'dist', 'index.js');
const port = process.env.PORT || 3001;

// Start the backend server
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
