import { test, expect } from '@playwright/test';

test('Admin Login Flow', async ({ page }) => {
  // 1. Navigate to the login page
  await page.goto('/login');

  // 2. Fill in the username
  await page.fill('input#username', 'testadmin');

  // 3. Fill in the password
  await page.fill('input#password', 'password123');

  // 4. Click the login button
  await page.click('button[type="submit"]');

  // 5. Wait for navigation to the dashboard (or the default redirect page)
  // Based on router config, '/' redirects to '/single-add'
  await page.waitForURL('**/single-add');

  // 6. Verify that we are on the correct page
  await expect(page).toHaveURL(/.*single-add/);
  
  // Optional: Check for a specific element on the dashboard to confirm successful login
  // For example, a logout button or a welcome message.
  // Since I haven't seen the dashboard code, I'll stick to URL verification for now.
});
