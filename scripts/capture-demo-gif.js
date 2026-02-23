#!/usr/bin/env node

/**
 * Demo GIF Capture Script for Recall
 *
 * Captures the TranscriptView UI - scrollable transcript with expandable tool cards.
 *
 * Usage:
 *   1. Start Recall: npm start
 *   2. Run this script: node scripts/capture-demo-gif.js
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const BASE_URL = 'http://localhost:3001';
const OUTPUT_DIR = path.join(__dirname, '..', 'docs', 'assets');
const FRAMES_DIR = path.join(OUTPUT_DIR, 'gif-frames');

async function captureGif() {
  console.log('🎬 Starting demo GIF capture (TranscriptView)...\n');

  // Ensure output directories exist
  if (!fs.existsSync(FRAMES_DIR)) {
    fs.mkdirSync(FRAMES_DIR, { recursive: true });
  }

  // Clean old frames
  const oldFrames = fs.readdirSync(FRAMES_DIR).filter((f) => f.endsWith('.png'));
  oldFrames.forEach((f) => fs.unlinkSync(path.join(FRAMES_DIR, f)));

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  let frameCount = 0;

  async function captureFrame() {
    const framePath = path.join(FRAMES_DIR, `frame-${String(frameCount).padStart(4, '0')}.png`);
    await page.screenshot({ path: framePath });
    frameCount++;
  }

  try {
    // 1. Navigate directly to a session (skip session list)
    console.log('📋 Loading session list to find a session...');
    await page.goto(`${BASE_URL}/sessions`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // Find a session to click - works in both list and grid views
    console.log('🔍 Finding a session to open...');

    // Try multiple selectors: data-testid for grid view, or button with session-like text for list view
    let sessionElement = page.locator('[data-testid="session-card"]').first();

    if (!(await sessionElement.isVisible({ timeout: 2000 }).catch(() => false))) {
      // List view: sessions are buttons with session names (contain '-' like "velvet-humming-spring")
      sessionElement = page.locator('button:has-text("-")').first();
    }

    if (!(await sessionElement.isVisible({ timeout: 2000 }).catch(() => false))) {
      // Fallback: any clickable element with session-like class
      sessionElement = page.locator('.bg-forensic-bg-secondary.border').first();
    }

    if (!(await sessionElement.isVisible({ timeout: 5000 }))) {
      throw new Error('No session elements found on the page');
    }

    // Click the session
    console.log('▶️ Clicking session...');
    await sessionElement.click();

    // Wait for navigation to session player
    console.log('⏳ Waiting for session player to load...');
    await page.waitForURL(/\/session\//, { timeout: 10000 });
    await page.waitForTimeout(2000);

    // Verify we're on the session player page
    const currentUrl = page.url();
    console.log(`📍 Current URL: ${currentUrl}`);

    if (!currentUrl.includes('/session/')) {
      throw new Error('Navigation to session player failed');
    }

    // Wait for TranscriptView to render
    console.log('⏳ Waiting for TranscriptView to render...');
    await page.waitForTimeout(2000);

    // Capture initial view of TranscriptView
    console.log('📸 Capturing TranscriptView...');
    for (let i = 0; i < 15; i++) {
      await captureFrame();
      await page.waitForTimeout(80);
    }

    // Find the main scroll container - TranscriptView uses overflow-y-auto
    // Look for the main content area that contains the transcript
    const scrollContainer = page.locator('main').first();

    // Scroll through the transcript
    console.log('📜 Scrolling through transcript...');

    // Smooth scroll down
    for (let i = 0; i < 30; i++) {
      await page.mouse.wheel(0, 120);
      await captureFrame();
      await page.waitForTimeout(80);
    }

    // Hold at current position
    for (let i = 0; i < 8; i++) {
      await captureFrame();
      await page.waitForTimeout(60);
    }

    // Try to find and click an expandable tool card (they have chevron icons)
    console.log('🔧 Looking for expandable tool cards...');
    const toolCardHeader = page
      .locator('[class*="tool-execution"], [class*="ToolCard"], button:has(svg)')
      .first();
    if (await toolCardHeader.isVisible({ timeout: 1000 }).catch(() => false)) {
      await toolCardHeader.click();
      await page.waitForTimeout(500);
      for (let i = 0; i < 10; i++) {
        await captureFrame();
        await page.waitForTimeout(80);
      }
    }

    // Scroll down a bit more to show more content
    for (let i = 0; i < 15; i++) {
      await page.mouse.wheel(0, 100);
      await captureFrame();
      await page.waitForTimeout(80);
    }

    // Scroll back up
    console.log('⬆️ Scrolling back up...');
    for (let i = 0; i < 20; i++) {
      await page.mouse.wheel(0, -150);
      await captureFrame();
      await page.waitForTimeout(80);
    }

    // Final hold
    for (let i = 0; i < 10; i++) {
      await captureFrame();
      await page.waitForTimeout(60);
    }

    console.log(`\n✅ Captured ${frameCount} frames\n`);

    // Convert to GIF using ffmpeg
    console.log('🔄 Converting to GIF with ffmpeg...');
    const gifPath = path.join(OUTPUT_DIR, 'demo.gif');
    const palettePath = path.join(FRAMES_DIR, 'palette.png');

    // Generate palette
    execSync(
      `ffmpeg -y -framerate 12 -i "${FRAMES_DIR}/frame-%04d.png" -vf "fps=12,scale=900:-1:flags=lanczos,palettegen=stats_mode=diff" "${palettePath}"`,
      { stdio: 'inherit' }
    );

    // Generate GIF
    execSync(
      `ffmpeg -y -framerate 12 -i "${FRAMES_DIR}/frame-%04d.png" -i "${palettePath}" -lavfi "fps=12,scale=900:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" "${gifPath}"`,
      { stdio: 'inherit' }
    );

    const stats = fs.statSync(gifPath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

    console.log(`\n🎉 GIF created successfully!`);
    console.log(`📁 Output: ${gifPath}`);
    console.log(`📊 Size: ${sizeMB} MB`);
    console.log(`🖼️ Frames: ${frameCount}`);

    // Clean up
    console.log('\n🧹 Cleaning up frames...');
    fs.readdirSync(FRAMES_DIR).forEach((f) => fs.unlinkSync(path.join(FRAMES_DIR, f)));
    fs.rmdirSync(FRAMES_DIR);

    return gifPath;
  } catch (error) {
    console.error('❌ Error capturing GIF:', error.message);

    // Take a debug screenshot
    const debugPath = path.join(OUTPUT_DIR, 'debug-screenshot.png');
    await page.screenshot({ path: debugPath });
    console.log(`📸 Debug screenshot saved to: ${debugPath}`);

    throw error;
  } finally {
    await browser.close();
  }
}

// Check requirements
async function checkServer() {
  try {
    const response = await fetch(`${BASE_URL}/api/health`);
    return response.ok;
  } catch {
    return false;
  }
}

function checkFfmpeg() {
  try {
    execSync('which ffmpeg', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

(async () => {
  console.log('🔍 Checking requirements...\n');

  if (!checkFfmpeg()) {
    console.error('❌ ffmpeg not found! Install with: brew install ffmpeg\n');
    process.exit(1);
  }
  console.log('✅ ffmpeg found');

  const isRunning = await checkServer();
  if (!isRunning) {
    console.error('❌ Server not running! Start with: npm start\n');
    process.exit(1);
  }
  console.log('✅ Server is running\n');

  await captureGif();
})();
