import { test, expect } from '@playwright/test';
import { loginAsAdmin, getApiToken, TEST_ACCOUNTS, API_BASE_URL } from './utils';
import process from 'node:process';

// API base URL for direct API calls
const baseURL = API_BASE_URL.endsWith('/') ? API_BASE_URL : `${API_BASE_URL}/`;

/**
 * Admin Reports Management E2E Tests
 */
test.describe('Admin Reports Management', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('should display reports list page', async ({ page }) => {
    await page.goto('/report-manage');

    await expect(page.locator('h2:has-text("举报管理")')).toBeVisible();
    await expect(page.locator('th:has-text("举报人")')).toBeVisible();
    await expect(page.locator('th:has-text("举报类型")')).toBeVisible();
    await expect(page.locator('th:has-text("举报时间")')).toBeVisible();
    await expect(page.locator('th:has-text("状态")')).toBeVisible();
    await expect(page.locator('th:has-text("操作")')).toBeVisible();
  });

  test('should filter reports', async ({ page }) => {
    await page.goto('/report-manage');
    
    // Check filter elements
    const selects = page.locator('select');
    await expect(selects.first()).toBeVisible(); // Status filter
    await expect(selects.nth(1)).toBeVisible(); // Type filter
    
    // Verify we can select 'pending' in status filter
    await selects.first().selectOption('pending');
    
    // Verify we can select 'review' in type filter
    await selects.nth(1).selectOption('review');
  });

  // More complex tests require creating a report which needs a user account and a target content
});

/**
 * Admin Reports API Tests
 */
test.describe('Admin Reports API Tests', () => {
  test('should get reports list via API', async ({ request }) => {
    const token = await getApiToken(
      request,
      TEST_ACCOUNTS.superAdmin.username,
      TEST_ACCOUNTS.superAdmin.password
    );
    
    const response = await request.get(`${baseURL}admin/reports`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.data.items).toBeInstanceOf(Array);
  });
});

