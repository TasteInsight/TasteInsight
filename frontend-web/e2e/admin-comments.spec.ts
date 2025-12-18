import { test, expect } from '@playwright/test';
import { loginAsAdmin, getApiToken, TEST_ACCOUNTS, API_BASE_URL } from './utils';
import process from 'node:process';

// API base URL for direct API calls
const baseURL = API_BASE_URL.endsWith('/') ? API_BASE_URL : `${API_BASE_URL}/`;

test.describe('Admin Comments Management', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('should display comment management page', async ({ page }) => {
    await page.goto('/comment-manage');

    await expect(page.locator('h2:has-text("评论和评价管理")')).toBeVisible();
    await expect(page.locator('input[placeholder="搜索菜品名称..."]')).toBeVisible();
  });

  test('should list dishes in sidebar', async ({ page }) => {
    await page.goto('/comment-manage');
    
    // Wait for dish list
    await page.waitForSelector('div.overflow-auto > div');
    
    // Check if there are dishes or "No dishes" message
    const hasDishes = await page.locator('div.font-medium').count() > 0;
    const noDishes = await page.locator('text=暂无菜品数据').isVisible();
    
    expect(hasDishes || noDishes).toBeTruthy();
  });

  test('should select a dish and show reviews', async ({ page }) => {
    await page.goto('/comment-manage');
    
    // Wait for dish list
    // Wait for at least one dish item
    const dishItems = page.locator('.p-4.mb-2.border.rounded-lg');
    await expect(dishItems.first()).toBeVisible({ timeout: 10000 });

    const count = await dishItems.count();
    let targetDishIndex = 0;
    
    // Try to find a dish with reviews/comments to click
    for (let i = 0; i < count; i++) {
        const dish = dishItems.nth(i);
        const text = await dish.textContent();
        // Check for "评价数: X" where X > 0
        if (text && /评价数:\s*[1-9]\d*/.test(text)) {
            targetDishIndex = i;
            console.log(`Found dish with reviews at index ${i}`);
            break;
        }
    }

    if (count > 0) {
      // Click the target dish
      await dishItems.nth(targetDishIndex).click();
      
      // Right side should show reviews or "No reviews"
      // Verify "评价和评论" header appears
      await expect(page.locator('h3:has-text("评价和评论")')).toBeVisible();
      
      // Check if we can see reviews
      const hasReviews = await page.locator('text=暂无评价').isVisible();
      if (!hasReviews) {
         // If there are reviews, we might see comments
         // This test is about comments, so ideally we check for comments
         // But verifying the review list is visible is a good proxy for "showing reviews"
         await expect(page.locator('.bg-white.border.rounded-xl').first()).toBeVisible();
      } else {
         console.log('Selected dish has no reviews, verified empty state');
      }
    }
  });
});

test.describe('Admin Comments API Tests', () => {
  test('should get pending comments via API', async ({ request }) => {
    const token = await getApiToken(
      request,
      TEST_ACCOUNTS.superAdmin.username,
      TEST_ACCOUNTS.superAdmin.password
    );
    
    // Note: The UI uses dish-centric view, but API might expose pending comments separately
    const response = await request.get(`${baseURL}admin/comments/pending`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.data.items).toBeInstanceOf(Array);
  });
});

