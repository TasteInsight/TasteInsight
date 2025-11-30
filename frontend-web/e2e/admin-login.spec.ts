import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './utils';

test.describe('Admin Login Page', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('should display login form correctly', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('管理员登录');
    await expect(page.locator('input#username')).toBeVisible();
    await expect(page.locator('input#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should show validation errors for empty fields', async ({ page }) => {
    // Fill with spaces to bypass browser 'required' validation but trigger Vue validation
    await page.fill('input#username', '   ');
    await page.fill('input#password', '   ');
    await page.click('button[type="submit"]');
    
    // Check for username error
    await expect(page.locator('text=请输入用户名')).toBeVisible();
    
  });

  test('should show validation error for short password', async ({ page }) => {
    await page.fill('input#username', 'testadmin');
    await page.fill('input#password', '123'); // Less than 6 chars
    await page.click('button[type="submit"]');
    
    await expect(page.locator('text=密码长度至少为6位')).toBeVisible();
  });


  test('should login successfully with correct credentials', async ({ page }) => {    
    const username = process.env.TEST_ADMIN_USERNAME || 'testadmin';
    const password = process.env.TEST_ADMIN_PASSWORD || 'password123';

    await page.fill('input#username', username);
    await page.fill('input#password', password);
    await page.click('button[type="submit"]');

    // Verify redirection to dashboard/single-add
    await expect(page).toHaveURL(/.*single-add/);
    
    // Verify that we are logged in (e.g., check for local storage or UI element)
    // Since Playwright runs in a separate context, we can check localStorage
    const token = await page.evaluate(() => {
      return sessionStorage.getItem('admin_token') || localStorage.getItem('admin_token');
    });
    expect(token).toBeTruthy();
  });
});
