import { test, expect } from '@playwright/test';

/**
 * E2E tests for the Session List page
 *
 * These tests verify that:
 * 1. Sessions are fetched and rendered (prevents regression where source defaulted to empty db)
 * 2. CWD filter banner appears when filtering is active
 * 3. "Show all sessions" link works
 *
 * Prerequisites:
 * - Backend running on localhost:3001
 * - At least one session exists in ~/.claude/projects/
 */

test.describe('Session List Page', () => {
  test('renders sessions from filesystem', async ({ page }) => {
    await page.goto('/');

    // Wait for the page to load - look for the header
    await expect(page.locator('h1:has-text("Recall")')).toBeVisible({ timeout: 10000 });

    // Wait for loading to complete (spinner disappears or sessions appear)
    await page.waitForLoadState('networkidle');

    // Verify we're not showing 0 of 0 sessions (the bug we fixed)
    // The count is shown in the header subtitle (p tag under h1)
    const headerCount = page.locator('h1:has-text("Recall") + p');
    await expect(headerCount).toBeVisible({ timeout: 5000 });

    const countText = await headerCount.textContent();

    // This test catches the regression where source=db returned 0 sessions
    // If sessions exist in the filesystem, total should not be 0
    expect(countText).not.toMatch(/0 of 0/);
    expect(countText).toMatch(/\d+ of \d+ sessions?/);
  });

  test('CWD filter banner shows when filtering is active', async ({ page }) => {
    await page.goto('/');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Look for CWD filter banner (only visible when CWD filter is active and there are more sessions elsewhere)
    const cwdBanner = page.locator('text=/Filtered to:/');
    const showAllButton = page.locator('text=/Show all sessions/');

    // Check if the banner is visible (depends on actual CWD filter state)
    const isBannerVisible = await cwdBanner.isVisible().catch(() => false);

    if (isBannerVisible) {
      // Banner should show the path and count
      await expect(cwdBanner).toBeVisible();
      await expect(page.locator('text=/Showing \\d+ of \\d+ sessions/')).toBeVisible();
      await expect(showAllButton).toBeVisible();

      // Click "Show all sessions" and verify it works
      await showAllButton.click();

      // Banner should disappear after clicking
      await expect(cwdBanner).not.toBeVisible({ timeout: 3000 });

      // "All Projects" button should now be active
      await expect(page.locator('button:has-text("All Projects")')).toHaveClass(/cyan-600/);
    }
  });

  test('filter controls are functional', async ({ page }) => {
    await page.goto('/');

    // Wait for page to fully load
    await expect(page.locator('h1:has-text("Recall")')).toBeVisible({ timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Test agent filter tabs - find the Claude button (exact match, not CLAUDE.md)
    const claudeButton = page.getByRole('button', { name: 'Claude', exact: true });
    await expect(claudeButton).toBeVisible({ timeout: 5000 });
    await claudeButton.click();

    // Button should now have orange background (active state)
    await expect(claudeButton).toHaveClass(/bg-orange-600/);

    // Test "All" button to reset - it's the first button with just "All" text
    const allButton = page.getByRole('button', { name: 'All', exact: true });
    await allButton.click();
    await expect(allButton).toHaveClass(/bg-blue-600/);
  });

  test('search input is functional', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Find and interact with search input
    const searchInput = page.locator('input[placeholder*="Search"]');
    await expect(searchInput).toBeVisible();

    // Type a search query
    await searchInput.fill('test');

    // Clear button should appear
    const clearButton = page.locator('button:has-text("×")');
    await expect(clearButton).toBeVisible();

    // Clear the search
    await clearButton.click();
    await expect(searchInput).toHaveValue('');
  });
});
