#!/usr/bin/env node

/**
 * Screenshot Capture Script for Recall
 *
 * This script uses Playwright to automatically capture screenshots
 * of the Recall application for documentation purposes.
 *
 * Usage:
 *   1. Start Recall: npm start
 *   2. Run this script: node scripts/capture-screenshots.js
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:3001';
const OUTPUT_DIR = path.join(__dirname, '..', 'docs', 'assets');

async function captureScreenshots() {
  console.log('🚀 Starting screenshot capture...\n');

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    deviceScaleFactor: 2, // Retina display
  });
  const page = await context.newPage();

  try {
    // 1. Session List Screenshot
    console.log('📸 Capturing Session List...');
    await page.goto(BASE_URL);
    await page.waitForTimeout(2000); // Wait for sessions to load
    await page.screenshot({
      path: path.join(OUTPUT_DIR, 'session-list.png'),
      fullPage: false,
    });
    console.log('✅ Saved: session-list.png\n');

    // 2. Session Player Screenshot
    console.log('📸 Capturing Session Player...');
    // Click first session (if available)
    const firstSession = await page.locator('[data-testid="session-card"]').first();
    if (await firstSession.isVisible()) {
      await firstSession.click();
      await page.waitForTimeout(2000); // Wait for player to load
      await page.screenshot({
        path: path.join(OUTPUT_DIR, 'session-player.png'),
        fullPage: false,
      });
      console.log('✅ Saved: session-player.png\n');

      // 3. Chat View Screenshot
      console.log('📸 Capturing Chat View...');
      const chatToggle = await page.locator('button:has-text("Chat")');
      if (await chatToggle.isVisible()) {
        await chatToggle.click();
        await page.waitForTimeout(1000);
        await page.screenshot({
          path: path.join(OUTPUT_DIR, 'chat-view.png'),
          fullPage: false,
        });
        console.log('✅ Saved: chat-view.png\n');
      }

      // Navigate back to home
      await page.goto(BASE_URL);
      await page.waitForTimeout(1000);
    }

    // 4. Work Units Screenshot
    console.log('📸 Capturing Work Units...');
    await page.goto(`${BASE_URL}/work-units`);
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: path.join(OUTPUT_DIR, 'work-units.png'),
      fullPage: false,
    });
    console.log('✅ Saved: work-units.png\n');

    console.log('🎉 All screenshots captured successfully!');
    console.log(`📁 Output directory: ${OUTPUT_DIR}`);
  } catch (error) {
    console.error('❌ Error capturing screenshots:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

// Check if server is running
async function checkServer() {
  try {
    const response = await fetch(`${BASE_URL}/api/health`);
    if (response.ok) {
      return true;
    }
  } catch (error) {
    return false;
  }
  return false;
}

(async () => {
  console.log('🔍 Checking if Recall server is running...\n');
  const isRunning = await checkServer();

  if (!isRunning) {
    console.error('❌ Recall server is not running!');
    console.error('Please start the server first:');
    console.error('  npm start\n');
    process.exit(1);
  }

  console.log('✅ Server is running\n');
  await captureScreenshots();
})();
