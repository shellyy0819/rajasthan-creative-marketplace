import { test, expect } from '@playwright/test';
import { FIX } from './helpers/fixtures';

test.describe('flow: browse shop', () => {
  test('home page renders brand and primary nav', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('banner').getByRole('link', { name: 'Craftofy home' })).toBeVisible();
    const nav = page.getByRole('navigation', { name: 'Primary' });
    await expect(nav.getByRole('link', { name: 'Shop handmade' })).toBeVisible();
    await expect(nav.getByRole('link', { name: /Workshops/ })).toBeVisible();
  });

  test('shop lists published products only', async ({ page }) => {
    await page.goto('/shop');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Handmade finds');
    await expect(page.getByRole('link', { name: FIX.products.udaipur })).toBeVisible();
    await expect(page.getByRole('link', { name: FIX.products.jaipur })).toBeVisible();
    await expect(page.getByText('E2E Hidden Draft')).toHaveCount(0);
  });

  test('city filter narrows results and Clear restores them', async ({ page }) => {
    await page.goto('/shop');
    await page.getByLabel('Filter by city').selectOption('udaipur');
    await expect(page.getByRole('link', { name: FIX.products.jaipur })).toHaveCount(0);
    await expect(page.getByRole('link', { name: FIX.products.udaipur })).toBeVisible();
    await expect(page).toHaveURL(/city=udaipur/);
    await page.getByRole('button', { name: 'Clear' }).click();
    await expect(page.getByRole('link', { name: FIX.products.jaipur })).toBeVisible();
  });

  test('category filter works', async ({ page }) => {
    await page.goto('/shop');
    await page.getByLabel('Filter by category').selectOption('Accessories');
    await expect(page.getByRole('link', { name: FIX.products.jaipur })).toBeVisible();
    await expect(page.getByRole('link', { name: FIX.products.udaipur })).toHaveCount(0);
  });

  test('text search filters live', async ({ page }) => {
    await page.goto('/shop');
    await page.getByLabel('Search products').fill('Lake Mug');
    await expect(page.getByRole('link', { name: FIX.products.jaipur })).toHaveCount(0);
    await expect(page.getByRole('link', { name: FIX.products.udaipur })).toBeVisible();
  });

  test('no-match search shows zero results summary', async ({ page }) => {
    await page.goto('/shop?q=zzzz-no-such-craft');
    await expect(page.locator('main p[role=status]')).toContainText('0 finds');
  });

  test('product card opens detail page', async ({ page }) => {
    await page.goto('/shop');
    await page.getByRole('link', { name: FIX.products.udaipur }).click();
    await expect(page).toHaveURL(/\/products\/e2e-lake-mug-p9001$/);
    await expect(page.getByRole('heading', { level: 1, name: FIX.products.udaipur })).toBeVisible();
  });

  test('unknown product slug is a 404', async ({ page }) => {
    await page.goto('/products/does-not-exist-p999999');
    await expect(page.getByRole('heading', { level: 1, name: /couldn.t find that page/i })).toBeVisible();
  });
});
