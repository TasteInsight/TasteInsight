import { test, expect, request } from '@playwright/test';
import { loginAsAdmin } from './utils';

test.describe('Admin Dish Management', () => {
  let createdDishId: string;

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test.afterEach(async ({ request }) => {
    if (createdDishId) {
      try {
        const baseURL = process.env.VITE_API_BASE_URL || 'http://localhost:3000/';
        // Login to get token
        const loginResponse = await request.post(`${baseURL}auth/admin/login`, {
          data: {
            username: process.env.TEST_ADMIN_USERNAME || 'testadmin',
            password: process.env.TEST_ADMIN_PASSWORD || 'password123'
          }
        });

        if (loginResponse.ok()) {
          const loginData = await loginResponse.json();
          const token = loginData.data.token.accessToken;

          // Delete the dish
          await request.delete(`${baseURL}admin/dishes/${createdDishId}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
        }
      } catch (error) {
        console.warn('Failed to clean up test dish:', error);
      }
    }
  });

  test('Create, View, and Delete a Dish', async ({ page }) => {
    const dishName = `E2E Test Dish ${Date.now()}`;
    const dishPrice = '15.5';
    const dishDescription = 'This is a test dish created by Playwright E2E test.';

    // 1. Create a new dish
    await page.goto('/single-add');
    
    // Select Canteen
    await page.waitForSelector('select', { state: 'visible' });
    const canteenSelect = page.locator('select').first();
    
    // Try to select by label if possible, assuming "第一食堂" exists
    const canteenOptions = await canteenSelect.locator('option').allInnerTexts();
    if (canteenOptions.some(opt => opt.includes('第一食堂'))) {
        await canteenSelect.selectOption({ label: '第一食堂' });
    } else {
        await canteenSelect.selectOption({ index: 1 });
    }

    // Select Window
    const windowSelect = page.locator('select').nth(1);
    await expect(windowSelect).toBeEnabled();
    await windowSelect.selectOption({ index: 1 });

    // Fill Name
    await page.fill('input[placeholder="例如：水煮肉片"]', dishName);

    // Fill Price
    await page.fill('input[type="number"][placeholder*="15.00"]', dishPrice);

    // Fill Description
    await page.fill('textarea', dishDescription);

    // Handle success alert
    page.once('dialog', async dialog => {
      await dialog.accept();
    });

    // Submit
    await page.click('button:has-text("保存菜品信息")');

    // Wait for navigation to edit page which confirms creation
    await page.waitForURL(/\/edit-dish\/.*/);

    // 2. Approve the dish in ReviewDish page
    await page.goto('/review-dish');
    
    // Search for the dish
    await page.fill('input[placeholder="搜索菜品名称..."]', dishName);
    
    // Wait for the row to appear
    const reviewRow = page.locator('tr', { hasText: dishName });
    await expect(reviewRow).toBeVisible({ timeout: 10000 });

    // Click "审核" button
    const reviewButton = reviewRow.locator('button:has-text("审核")');
    await reviewButton.click();

    // Wait for navigation to detail page
    await page.waitForURL(/\/review-dish\/.*/);

    // Handle confirm dialog for approval
    page.once('dialog', async dialog => {
      await dialog.accept();
    });

    // Click "批准通过" button
    await page.click('button:has-text("批准通过")');

    // Wait for navigation back to review list
    await page.waitForURL(/\/review-dish/);

    // 3. Verify the dish exists in the ModifyDish list
    await page.goto('/modify-dish');
    
    // Search for the dish
    await page.fill('input[placeholder="搜索菜品名称、食堂、窗口..."]', dishName);
    
    // Wait for the table to contain the dish name
    await expect(page.locator('table')).toContainText(dishName, { timeout: 10000 });
    await expect(page.locator('table')).toContainText(dishPrice);

    // 4. Verify Edit Button works and capture ID
    const row = page.locator('tr', { hasText: dishName });
    const editButton = row.locator('button[title="编辑"]');
    await expect(editButton).toBeVisible();
    await editButton.click();

    // Verify navigation to edit page
    await page.waitForURL(/\/edit-dish\/.*/);
    
    // Extract ID from URL for cleanup
    const url = page.url();
    const match = url.match(/\/edit-dish\/(.+)/);
    if (match && match[1]) {
      createdDishId = match[1];
    }
  });
});
