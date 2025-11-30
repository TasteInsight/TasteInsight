import { Page, APIRequestContext } from '@playwright/test';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config({ path: '.env' });

// Test accounts from seed_docker.ts
// Using environment variables with fallback to default test credentials
export const TEST_ACCOUNTS = {
  superAdmin: { 
    username: process.env.TEST_SUPER_ADMIN_USER || 'testadmin', 
    password: process.env.TEST_SUPER_ADMIN_PASS || 'password123' 
  },
  normalAdmin: { 
    username: process.env.TEST_NORMAL_ADMIN_USER || 'normaladmin', 
    password: process.env.TEST_NORMAL_ADMIN_PASS || 'admin123' 
  },  // dish:view only
  limitedAdmin: { 
    username: process.env.TEST_LIMITED_ADMIN_USER || 'limitedadmin', 
    password: process.env.TEST_LIMITED_ADMIN_PASS || 'limited123' 
  },  // dish:view + dish:edit
  canteenAdmin: { 
    username: process.env.TEST_CANTEEN_ADMIN_USER || 'canteenadmin', 
    password: process.env.TEST_CANTEEN_ADMIN_PASS || 'canteen123'
  },  // All dish perms but only for canteen1 (第一食堂)
  reviewerAdmin: {
    username: process.env.TEST_REVIEWER_ADMIN_USER || 'revieweradmin',
    password: process.env.TEST_REVIEWER_ADMIN_PASS || 'reviewer123'
  },  // upload:approve, review:approve, comment:approve
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
