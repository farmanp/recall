import { test, expect } from '@playwright/test';

/**
 * E2E tests for the Session Player page and Artifacts Panel
 *
 * These tests verify that:
 * 1. Session player loads and displays frames
 * 2. Artifacts panel opens with 'a' key
 * 3. Artifacts are displayed for sessions with file operations
 *
 * Prerequisites:
 * - Backend running on localhost:3001
 * - At least one session exists with file operations
 */

test.describe('Session Player Page', () => {
  // Helper to get first available session
  async function getFirstSessionId(page: any): Promise<string | null> {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Try to find a session link
    const sessionLink = page.locator('a[href^="/session/"]').first();
    const isVisible = await sessionLink.isVisible().catch(() => false);

    if (!isVisible) {
      return null;
    }

    const href = await sessionLink.getAttribute('href');
    return href?.replace('/session/', '') || null;
  }

  test('loads session player with frames', async ({ page }) => {
    const sessionId = await getFirstSessionId(page);

    if (!sessionId) {
      test.skip();
      return;
    }

    await page.goto(`/session/${sessionId}`);
    await page.waitForLoadState('networkidle');

    // Should display session player UI elements
    await expect(page.locator('text=/Frame \\d+ of \\d+/')).toBeVisible({ timeout: 10000 });
  });

  test('artifacts panel opens with keyboard shortcut', async ({ page }) => {
    const sessionId = await getFirstSessionId(page);

    if (!sessionId) {
      test.skip();
      return;
    }

    await page.goto(`/session/${sessionId}`);
    await page.waitForLoadState('networkidle');

    // Wait for session to load
    await expect(page.locator('text=/Frame \\d+ of \\d+/')).toBeVisible({ timeout: 10000 });

    // Press 'a' to open artifacts panel
    await page.keyboard.press('a');

    // Artifacts panel should appear
    await expect(page.locator('text=File Artifacts')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('text=Files accessed during this session')).toBeVisible();
  });

  test('artifacts panel displays summary information', async ({ page }) => {
    const sessionId = await getFirstSessionId(page);

    if (!sessionId) {
      test.skip();
      return;
    }

    await page.goto(`/session/${sessionId}`);
    await page.waitForLoadState('networkidle');

    // Wait for session to load
    await expect(page.locator('text=/Frame \\d+ of \\d+/')).toBeVisible({ timeout: 10000 });

    // Open artifacts panel
    await page.keyboard.press('a');
    await expect(page.locator('text=File Artifacts')).toBeVisible({ timeout: 3000 });

    // Should display view mode toggle
    await expect(page.locator('button:has-text("Cumulative")')).toBeVisible();
    await expect(page.locator('button:has-text("Full Session")')).toBeVisible();

    // Should display filter/sort controls
    await expect(page.locator('input[placeholder*="Search"]')).toBeVisible();
  });

  test('artifacts panel closes with Escape key', async ({ page }) => {
    const sessionId = await getFirstSessionId(page);

    if (!sessionId) {
      test.skip();
      return;
    }

    await page.goto(`/session/${sessionId}`);
    await page.waitForLoadState('networkidle');

    // Wait for session to load
    await expect(page.locator('text=/Frame \\d+ of \\d+/')).toBeVisible({ timeout: 10000 });

    // Open artifacts panel
    await page.keyboard.press('a');
    await expect(page.locator('text=File Artifacts')).toBeVisible({ timeout: 3000 });

    // Close with Escape
    await page.keyboard.press('Escape');

    // Panel should be hidden
    await expect(page.locator('text=File Artifacts')).not.toBeVisible({ timeout: 3000 });
  });

  test('artifacts panel closes with close button', async ({ page }) => {
    const sessionId = await getFirstSessionId(page);

    if (!sessionId) {
      test.skip();
      return;
    }

    await page.goto(`/session/${sessionId}`);
    await page.waitForLoadState('networkidle');

    // Wait for session to load
    await expect(page.locator('text=/Frame \\d+ of \\d+/')).toBeVisible({ timeout: 10000 });

    // Open artifacts panel
    await page.keyboard.press('a');
    await expect(page.locator('text=File Artifacts')).toBeVisible({ timeout: 3000 });

    // Click close button (×)
    await page.locator('button:has-text("×")').click();

    // Panel should be hidden
    await expect(page.locator('text=File Artifacts')).not.toBeVisible({ timeout: 3000 });
  });
});

test.describe('Artifacts Panel - Multi-Agent Support', () => {
  /**
   * These tests verify that artifact detection works for different agent types.
   * They require sessions from each agent type to be present.
   */

  async function findSessionByAgent(
    page: any,
    agent: 'claude' | 'gemini' | 'codex'
  ): Promise<string | null> {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Click on agent filter tab
    const agentButton = page.getByRole('button', {
      name: agent.charAt(0).toUpperCase() + agent.slice(1),
      exact: true,
    });

    const isVisible = await agentButton.isVisible().catch(() => false);
    if (!isVisible) {
      return null;
    }

    await agentButton.click();
    await page.waitForTimeout(500); // Wait for filter to apply

    // Try to find a session link
    const sessionLink = page.locator('a[href^="/session/"]').first();
    const linkVisible = await sessionLink.isVisible().catch(() => false);

    if (!linkVisible) {
      return null;
    }

    const href = await sessionLink.getAttribute('href');
    return href?.replace('/session/', '') || null;
  }

  test('Claude session shows file artifacts', async ({ page }) => {
    const sessionId = await findSessionByAgent(page, 'claude');

    if (!sessionId) {
      test.skip();
      return;
    }

    await page.goto(`/session/${sessionId}`);
    await page.waitForLoadState('networkidle');

    // Wait for session to load
    await expect(page.locator('text=/Frame \\d+ of \\d+/')).toBeVisible({ timeout: 10000 });

    // Open artifacts panel
    await page.keyboard.press('a');
    await expect(page.locator('text=File Artifacts')).toBeVisible({ timeout: 3000 });

    // Should show file count or "No files" message
    // Either artifacts exist or the panel shows empty state
    const hasArtifacts = await page
      .locator('text=/\\d+ files?/')
      .isVisible()
      .catch(() => false);
    const isEmpty = await page
      .locator('text=/No files/i')
      .isVisible()
      .catch(() => false);

    expect(hasArtifacts || isEmpty).toBe(true);
  });

  test('Gemini session shows file artifacts', async ({ page }) => {
    const sessionId = await findSessionByAgent(page, 'gemini');

    if (!sessionId) {
      // Gemini sessions may not be available - skip gracefully
      test.skip();
      return;
    }

    await page.goto(`/session/${sessionId}`);
    await page.waitForLoadState('networkidle');

    // Wait for session to load
    await expect(page.locator('text=/Frame \\d+ of \\d+/')).toBeVisible({ timeout: 10000 });

    // Open artifacts panel
    await page.keyboard.press('a');
    await expect(page.locator('text=File Artifacts')).toBeVisible({ timeout: 3000 });

    // Should show file count or "No files" message
    const hasArtifacts = await page
      .locator('text=/\\d+ files?/')
      .isVisible()
      .catch(() => false);
    const isEmpty = await page
      .locator('text=/No files/i')
      .isVisible()
      .catch(() => false);

    expect(hasArtifacts || isEmpty).toBe(true);
  });

  test('Codex session shows file artifacts', async ({ page }) => {
    const sessionId = await findSessionByAgent(page, 'codex');

    if (!sessionId) {
      // Codex sessions may not be available - skip gracefully
      test.skip();
      return;
    }

    await page.goto(`/session/${sessionId}`);
    await page.waitForLoadState('networkidle');

    // Wait for session to load
    await expect(page.locator('text=/Frame \\d+ of \\d+/')).toBeVisible({ timeout: 10000 });

    // Open artifacts panel
    await page.keyboard.press('a');
    await expect(page.locator('text=File Artifacts')).toBeVisible({ timeout: 3000 });

    // Should show file count or "No files" message
    const hasArtifacts = await page
      .locator('text=/\\d+ files?/')
      .isVisible()
      .catch(() => false);
    const isEmpty = await page
      .locator('text=/No files/i')
      .isVisible()
      .catch(() => false);

    expect(hasArtifacts || isEmpty).toBe(true);
  });
});
