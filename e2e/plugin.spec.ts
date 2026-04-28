import { test, expect } from '@playwright/test';

const H = (scenario: string) => `/e2e/harness.html?scenario=${scenario}`;

test('1. current workspace tab displays active phases', async ({ page }) => {
  await page.goto(H('current-workspace'));
  // Wait for plugin to render (refresh button is present when data loaded)
  await expect(page.locator('#bf-refresh')).toBeVisible();
  // No version tabs when only one current version
  await expect(page.locator('.bf-version-tab')).toHaveCount(0);
  // Phases row is rendered
  await expect(page.locator('text=Design')).toBeVisible();
});

test('2. archived version tab is displayed alongside current', async ({ page }) => {
  await page.goto(H('archived-version'));
  await expect(page.locator('#bf-refresh')).toBeVisible();
  // Two version tabs: Current and v1
  const tabs = page.locator('.bf-version-tab');
  await expect(tabs).toHaveCount(2);
  await expect(tabs.nth(0)).toContainText('Current');
  await expect(tabs.nth(1)).toContainText('v1');
});

test('3. current workspace empty state shows hint', async ({ page }) => {
  await page.goto(H('current-empty'));
  await expect(page.locator('#bf-refresh')).toBeVisible();
  // Empty state card for current iteration
  await expect(page.locator('text=Current iteration not started')).toBeVisible();
  await expect(page.locator('text=/bmad-product-brief/')).toBeVisible();
});

test('4. archiveSuggestion card is visible when enabled', async ({ page }) => {
  await page.goto(H('archive-suggestion'));
  await expect(page.locator('#bf-refresh')).toBeVisible();
  // Archive card header
  await expect(page.locator('text=Current version complete')).toBeVisible();
  // Archive button with target version label
  await expect(page.locator('#bf-archive')).toBeVisible();
  await expect(page.locator('#bf-archive')).toContainText('v1');
});

test('5. archive button: confirm triggers refresh and shows archived tab', async ({ page }) => {
  await page.goto(H('archive-confirm'));
  await expect(page.locator('#bf-archive')).toBeVisible();

  // Accept the confirm dialog
  page.on('dialog', dialog => dialog.accept());
  await page.locator('#bf-archive').click();

  // After archive the response returns current + v1 archived tab
  const tabs = page.locator('.bf-version-tab');
  await expect(tabs).toHaveCount(2);
  await expect(tabs.nth(1)).toContainText('v1');
  // Archive card should be gone (fresh current has no suggestion)
  await expect(page.locator('#bf-archive')).toHaveCount(0);
});
