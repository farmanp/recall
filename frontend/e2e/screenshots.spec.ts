/**
 * Screenshot capture script for landing page assets
 *
 * Run with: npx playwright test e2e/screenshots.spec.ts
 *
 * Captures key feature screenshots for marketing/docs.
 * Uses the first available session - ensure no sensitive data is visible.
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ASSETS_DIR = path.join(__dirname, '../../docs/assets');

// Ensure assets directory exists
test.beforeAll(async () => {
  if (!fs.existsSync(ASSETS_DIR)) {
    fs.mkdirSync(ASSETS_DIR, { recursive: true });
  }
});

test.describe('Landing Page Screenshots', () => {
  test('capture session list', async ({ page }) => {
    await page.goto('/sessions');
    await page.waitForSelector('[data-testid="session-list"]', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1000); // Let animations settle

    await page.screenshot({
      path: path.join(ASSETS_DIR, 'session-list-new.png'),
      fullPage: false,
    });
  });

  test('capture session player with impact panel', async ({ page }) => {
    // Go to sessions list first
    await page.goto('/sessions');
    await page.waitForTimeout(2000);

    // Click first session
    const firstSession = page.locator('a[href^="/session/"]').first();
    if (await firstSession.isVisible()) {
      await firstSession.click();
      await page.waitForTimeout(2000);

      // Try to open impact panel (press 'i' or click button)
      const impactButton = page
        .locator('button:has-text("Impact"), button[title*="Impact"]')
        .first();
      if (await impactButton.isVisible().catch(() => false)) {
        await impactButton.click();
        await page.waitForTimeout(1000);
      }

      await page.screenshot({
        path: path.join(ASSETS_DIR, 'session-player-impact.png'),
        fullPage: false,
      });
    }
  });

  test('capture context meter', async ({ page }) => {
    await page.goto('/sessions');
    await page.waitForTimeout(2000);

    const firstSession = page.locator('a[href^="/session/"]').first();
    if (await firstSession.isVisible()) {
      await firstSession.click();
      await page.waitForTimeout(2000);

      // Try to show context meter (click gauge button)
      const gaugeButton = page
        .locator('button:has(svg.lucide-gauge), button[title*="Context"]')
        .first();
      if (await gaugeButton.isVisible().catch(() => false)) {
        await gaugeButton.click();
        await page.waitForTimeout(500);
      }

      await page.screenshot({
        path: path.join(ASSETS_DIR, 'context-meter.png'),
        fullPage: false,
      });
    }
  });

  test('capture tree view', async ({ page }) => {
    await page.goto('/sessions');
    await page.waitForTimeout(2000);

    const firstSession = page.locator('a[href^="/session/"]').first();
    if (await firstSession.isVisible()) {
      await firstSession.click();
      await page.waitForTimeout(2000);

      // Try to switch to tree view
      const treeButton = page.locator('button:has-text("Tree"), button[title*="Tree"]').first();
      if (await treeButton.isVisible().catch(() => false)) {
        await treeButton.click();
        await page.waitForTimeout(1000);
      }

      await page.screenshot({
        path: path.join(ASSETS_DIR, 'tree-view.png'),
        fullPage: false,
      });
    }
  });

  test('capture overview page', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: path.join(ASSETS_DIR, 'overview-new.png'),
      fullPage: false,
    });
  });
});
