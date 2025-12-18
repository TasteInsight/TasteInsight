import { Page, APIRequestContext } from '@playwright/test';
import * as dotenv from 'dotenv';
import process from 'node:process';

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
  adminManager: {
    username: process.env.TEST_ADMIN_MANAGER_USER || 'adminmanager',
    password: process.env.TEST_ADMIN_MANAGER_PASS || 'manager123'
  },  // admin:view, admin:create, admin:edit, admin:delete
};

export const API_BASE_URL = process.env.VITE_API_BASE_URL || 'http://localhost:3000/';

export async function loginAsAdmin(page: Page) {
  const username = process.env.TEST_ADMIN_USERNAME || 'testadmin';
  const password = process.env.TEST_ADMIN_PASSWORD || 'password123';

  console.log(`Logging in via UI at ${page.url()} with user: ${username}`);
  await page.goto('/login');
  await page.fill('input#username', username);
  await page.fill('input#password', password);
  await page.click('button[type="submit"]');
  // Wait for navigation to any page other than login
  await page.waitForURL(url => !url.href.includes('/login'));
}

/**
 * Get API token for a specific account
 */
export async function getApiToken(request: APIRequestContext, username: string, password: string): Promise<string | null> {
  // Ensure trailing slash
  const baseURL = API_BASE_URL.endsWith('/') ? API_BASE_URL : `${API_BASE_URL}/`;
  const loginUrl = `${baseURL}auth/admin/login`;
  
  console.log(`Getting API token from: ${loginUrl} for user: ${username}`);
  
  try {
    const response = await request.post(loginUrl, {
      data: { username, password }
    });
    
    console.log(`Login response status: ${response.status()}`);
    
    if (response.ok()) {
      const contentType = response.headers()['content-type'];
      if (!contentType || !contentType.includes('application/json')) {
        console.error(`Invalid content-type: ${contentType}. Likely received HTML instead of JSON. Check API_BASE_URL.`);
        const text = await response.text();
        console.error(`Response start: ${text.substring(0, 100)}`);
        return null;
      }

      const data = await response.json();
      const token = data.data?.token?.accessToken;
      if (!token) {
        console.error('Token not found in response data:', JSON.stringify(data).substring(0, 200));
      }
      return token || null;
    } else {
      console.error(`Login failed with status ${response.status()}`);
      console.error(await response.text());
    }
  } catch (error) {
    console.error('Failed to get API token (exception):', error);
  }
  return null;
}
