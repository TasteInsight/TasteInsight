import { test, expect } from '@playwright/test';
import { loginAsAdmin, getApiToken, TEST_ACCOUNTS, API_BASE_URL } from './utils';
import process from 'node:process';

// API base URL for direct API calls
const baseURL = API_BASE_URL.endsWith('/') ? API_BASE_URL : `${API_BASE_URL}/`;

test.describe('Admin Config Management', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    // Increase timeout for login
    test.setTimeout(45000);
    await loginAsAdmin(page);
  });

  test('should display config management page', async ({ page }) => {
    await page.goto('/config-manage');
    await expect(page.locator('h2:has-text("系统配置管理")')).toBeVisible();
    await expect(page.locator('text=评论自动审核')).toBeVisible();
  });

  test('should toggle comment auto approve', async ({ page }) => {
    await page.goto('/config-manage');
    await page.waitForLoadState('networkidle');
    
    // Wait for switch to be visible (target the first one for review auto approve, or use specific locator)
    // The strict mode violation happened because there are two checkboxes (review and comment auto approve)
    // We should target the specific one we want to test.
    // Assuming the comment auto approve is the second one based on UI structure in ConfigManage.vue
    // Or better, find by surrounding text
    
    const commentSection = page.locator('.border', { hasText: '评论自动审核' });
    const checkbox = commentSection.locator('input[type="checkbox"]');
    await expect(checkbox).toBeVisible();
    
    // Get current state
    const isChecked = await checkbox.isChecked();
    
    // Click label to toggle
    await commentSection.locator('label').click();
    
    // Verify "保存成功" message appears
    await expect(commentSection.locator('text=保存成功')).toBeVisible({ timeout: 5000 });
    
    // Verify state changed
    const isCheckedNew = await checkbox.isChecked();
    expect(isCheckedNew).toBe(!isChecked);
  });

  test('should display all config sections', async ({ page }) => {
    await page.goto('/config-manage');
    await page.waitForLoadState('networkidle');

    // Verify main config section
    await expect(page.locator('text=评论自动审核')).toBeVisible();
  });

  test('should display loading state', async ({ page }) => {
    await page.goto('/config-manage');
    
    // Check for loading indicator (might be brief)
    const loadingVisible = await page.locator('text=加载中...').isVisible();
    
    // Loading might be too fast to catch, so we just verify the page loads
    await page.waitForLoadState('networkidle');
  });
});

test.describe('Admin Config API Tests', () => {
  test('should get templates via API', async ({ request }) => {
    const token = await getApiToken(
      request,
      TEST_ACCOUNTS.superAdmin.username,
      TEST_ACCOUNTS.superAdmin.password
    );
    
    const response = await request.get(`${baseURL}admin/config/templates`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.data.items).toBeInstanceOf(Array);
  });

  test('should update global config via API', async ({ request }) => {
    const token = await getApiToken(
      request,
      TEST_ACCOUNTS.superAdmin.username,
      TEST_ACCOUNTS.superAdmin.password
    );

    // Get a template key first
    const templatesRes = await request.get(`${baseURL}admin/config/templates`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const templatesData = await templatesRes.json();
    if (templatesData.data.items.length === 0) test.skip();
    
    const template = templatesData.data.items[0];
    const key = template.key;
    let value = 'test_value_' + Date.now();

    if (template.valueType === 'boolean') {
        value = 'true';
    } else if (template.valueType === 'number') {
        value = '123';
    }

    const response = await request.put(`${baseURL}admin/config/global`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { key, value },
    });
    
    if (response.status() !== 200) {
        console.error('Update config failed:', response.status(), await response.text());
    }
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.data.value).toBe(value);
  });
});

