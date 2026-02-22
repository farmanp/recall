/**
 * Screenshot capture script for landing page assets
 *
 * Run with: npx playwright test e2e/screenshots.spec.ts
 *
 * Captures key feature screenshots for marketing/docs.
 */

import { test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ASSETS_DIR = path.join(__dirname, '../../docs/assets');

test.beforeAll(async () => {
  if (!fs.existsSync(ASSETS_DIR)) {
    fs.mkdirSync(ASSETS_DIR, { recursive: true });
  }
});

test.describe('Landing Page Screenshots', () => {
  test('capture session list', async ({ page }) => {
    await page.goto('/sessions?showAll=true');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: path.join(ASSETS_DIR, 'feature-session-list.png'),
      fullPage: false,
    });
  });

  test('capture session player', async ({ page }) => {
    await page.goto('/sessions?showAll=true');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Click on a session row (skip the first one if it's live)
    const sessionRow = page.locator('button:has-text("recall")').nth(1);
    await sessionRow.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: path.join(ASSETS_DIR, 'feature-player.png'),
      fullPage: false,
    });
  });

  test('capture impact panel', async ({ page }) => {
    await page.goto('/sessions?showAll=true');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const sessionRow = page.locator('button:has-text("recall")').nth(1);
    await sessionRow.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Press 'i' to open impact panel
    await page.keyboard.press('i');
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: path.join(ASSETS_DIR, 'feature-impact.png'),
      fullPage: false,
    });
  });

  test('capture context panel', async ({ page }) => {
    await page.goto('/sessions?showAll=true');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const sessionRow = page.locator('button:has-text("recall")').nth(1);
    await sessionRow.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Press 'c' to open context panel
    await page.keyboard.press('c');
    await page.waitForTimeout(1500);

    await page.screenshot({
      path: path.join(ASSETS_DIR, 'feature-context.png'),
      fullPage: false,
    });
  });

  test('capture tree view', async ({ page }) => {
    await page.goto('/sessions?showAll=true');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const sessionRow = page.locator('button:has-text("recall")').nth(1);
    await sessionRow.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Click tree view button
    const treeButton = page.locator('button[title*="Tree View"]');
    if (await treeButton.isVisible().catch(() => false)) {
      await treeButton.click();
      await page.waitForTimeout(1500);
    }

    await page.screenshot({
      path: path.join(ASSETS_DIR, 'feature-tree.png'),
      fullPage: false,
    });
  });

  test('capture overview dashboard', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: path.join(ASSETS_DIR, 'feature-overview.png'),
      fullPage: false,
    });
  });

  test('capture artifacts panel', async ({ page }) => {
    await page.goto('/sessions?showAll=true');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const sessionRow = page.locator('button:has-text("recall")').nth(1);
    await sessionRow.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Press 'a' to open artifacts
    await page.keyboard.press('a');
    await page.waitForTimeout(1500);

    await page.screenshot({
      path: path.join(ASSETS_DIR, 'feature-artifacts.png'),
      fullPage: false,
    });
  });
});
