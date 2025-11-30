import { Page, expect, APIRequestContext } from '@playwright/test';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config({ path: '.env' });

// Test accounts from seed_docker.ts
export const TEST_ACCOUNTS = {
  superAdmin: { username: 'testadmin', password: 'password123' },
  normalAdmin: { username: 'normaladmin', password: 'admin123' },  // dish:view only
  limitedAdmin: { username: 'limitedadmin', password: 'limited123' },  // dish:view + dish:edit
  canteenAdmin: { username: 'canteenadmin', password: 'canteen123' },  // All dish perms but only for canteen1
  reviewerAdmin: { username: 'revieweradmin', password: 'reviewer123' },  // upload:approve, review:approve, comment:approve
};

export async function loginAsAdmin(page: Page) {
  const username = process.env.TEST_ADMIN_USERNAME || 'testadmin';
  const password = process.env.TEST_ADMIN_PASSWORD || 'password123';

  await page.goto('/login');
  await page.fill('input#username', username);
  await page.fill('input#password', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/single-add');
}

/**
 * Login with a specific account
 */
export async function loginWithAccount(page: Page, username: string, password: string) {
  await page.goto('/login');
  await page.fill('input#username', username);
  await page.fill('input#password', password);
  await page.click('button[type="submit"]');
  // Wait for redirect - may go to single-add or stay on login if failed
  await page.waitForTimeout(2000);
}

/**
 * Get API token for a specific account
 */
export async function getApiToken(request: APIRequestContext, username: string, password: string): Promise<string | null> {
  const baseURL = process.env.VITE_API_BASE_URL || 'http://localhost:3000/';
  try {
    const response = await request.post(`${baseURL}auth/admin/login`, {
      data: { username, password }
    });
    if (response.ok()) {
      const data = await response.json();
      return data.data?.token?.accessToken || null;
    }
  } catch (error) {
    console.error('Failed to get API token:', error);
  }
  return null;
}

/**
 * Logout current user
 */
export async function logout(page: Page) {
  // Clear session storage
  await page.evaluate(() => {
    sessionStorage.clear();
    localStorage.clear();
  });
  await page.goto('/login');
}
