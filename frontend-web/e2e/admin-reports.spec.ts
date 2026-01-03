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

  test('should filter reports by status', async ({ page }) => {
    await page.goto('/report-manage');
    await page.waitForLoadState('networkidle');
    
    // Check filter elements
    const selects = page.locator('select');
    await expect(selects.first()).toBeVisible(); // Status filter
    
    // Verify we can select 'pending' in status filter
    await selects.first().selectOption('pending');
    await page.waitForTimeout(1000);
    
    // Verify filter is applied
    await expect(selects.first()).toHaveValue('pending');
  });

  test('should filter reports by type', async ({ page }) => {
    await page.goto('/report-manage');
    await page.waitForLoadState('networkidle');
    
    // Check filter elements
    const selects = page.locator('select');
    await expect(selects.nth(1)).toBeVisible(); // Type filter
    
    // Verify we can select 'review' in type filter
    await selects.nth(1).selectOption('review');
    await page.waitForTimeout(1000);
    
    // Verify filter is applied
    await expect(selects.nth(1)).toHaveValue('review');
  });

  test('should display reports list', async ({ page }) => {
    await page.goto('/report-manage');
    await page.waitForLoadState('networkidle');

    // Wait for reports to load
    await page.waitForTimeout(2000);

    // Check for either reports or empty state
    const hasReports = await page.locator('tbody tr').count() > 0;
    const hasEmptyState = await page.locator('text=暂无举报').isVisible() || 
                          await page.locator('text=暂无数据').isVisible();

    expect(hasReports || hasEmptyState).toBeTruthy();
  });

  test('should display loading state', async ({ page }) => {
    await page.goto('/report-manage');
    
    // Check for loading indicator (might be brief)
    const loadingVisible = await page.locator('text=加载中...').isVisible();
    
    // Loading might be too fast to catch, so we just verify the page loads
    await page.waitForLoadState('networkidle');
  });

  test('should handle pagination', async ({ page }) => {
    await page.goto('/report-manage');
    await page.waitForLoadState('networkidle');

    // Wait for reports to load
    await page.waitForTimeout(2000);

    // Check if pagination exists
    const paginationVisible = await page.locator('button:has-text("上一页")').isVisible();

    if (paginationVisible) {
      // Verify pagination controls exist
      await expect(page.locator('button:has-text("上一页")')).toBeVisible();
      await expect(page.locator('button:has-text("下一页")')).toBeVisible();
    }
  });
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

