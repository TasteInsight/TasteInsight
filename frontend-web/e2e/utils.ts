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

/**
 * Wait for and close custom Modal dialog
 * This handles the custom Modal component used in the frontend
 */
export async function waitAndCloseModal(page: Page, buttonText: string = '确定', timeout: number = 5000) {
  try {
    // Wait for modal to appear - check for modal container with z-[10000]
    // Try multiple selectors to catch the modal
    const modalSelectors = [
      '.fixed.inset-0.z-\\[10000\\]',
      '.fixed.inset-0[style*="z-index: 10000"]',
      'div[class*="fixed"][class*="inset-0"][class*="z-"]',
      'div.fixed.inset-0',
    ];
    
    let modalFound = false;
    let modalSelector = '';
    
    // Try to find modal with longer timeout
    for (const selector of modalSelectors) {
      try {
        await page.waitForSelector(selector, { state: 'visible', timeout: 2000 });
        modalFound = true;
        modalSelector = selector;
        break;
      } catch {
        // Try next selector
      }
    }
    
    if (!modalFound) {
      // Modal might not appear, that's okay - check if it's already gone
      // Sometimes modal appears and disappears very quickly
      await page.waitForTimeout(200);
      return;
    }
    
    // Wait for animation to complete
    await page.waitForTimeout(400);
    
    // Find and click the button - try multiple approaches
    // First, try to find button within the modal container
    const buttonSelectors = [
      `${modalSelector} button:has-text("${buttonText}")`,
      `${modalSelector} button:text-is("${buttonText}")`,
      `button:has-text("${buttonText}")`,
      `button:text-is("${buttonText}")`,
      `button:has-text("确定")`,
      `button:has-text("确认")`,
      `button:has-text("OK")`,
    ];
    
    let buttonClicked = false;
    for (const btnSelector of buttonSelectors) {
      try {
        const button = page.locator(btnSelector).first();
        const isVisible = await button.isVisible({ timeout: 1000 });
        if (isVisible) {
          // Scroll button into view if needed
          await button.scrollIntoViewIfNeeded();
          await page.waitForTimeout(200);
          await button.click({ timeout: 2000 });
          buttonClicked = true;
          break;
        }
      } catch (e) {
        // Try next selector
        continue;
      }
    }
    
    if (buttonClicked) {
      // Wait for modal to disappear with animation
      try {
        // Wait for modal to be removed from DOM or become invisible
        await page.waitForSelector(modalSelector, { state: 'hidden', timeout: 2000 });
      } catch {
        // Modal might already be gone, that's fine
      }
      await page.waitForTimeout(300);
    } else {
      // If button not found, try clicking the modal backdrop or close button
      try {
        const closeButton = page.locator(`${modalSelector} button:has(.iconify[data-icon="carbon:close"])`).first();
        if (await closeButton.isVisible({ timeout: 500 })) {
          await closeButton.click();
          await page.waitForTimeout(300);
        }
      } catch {
        // No close button found, that's okay
      }
    }
  } catch (error) {
    // If modal doesn't appear or already closed, that's okay
    // Don't throw error, just log
    console.log('Modal handling note:', error instanceof Error ? error.message : 'Modal not found or already closed');
  }
}

/**
 * Handle both browser dialogs and custom modals after an action
 * Call this after clicking buttons that might trigger dialogs/modals
 * This function will handle multiple modals that might appear sequentially
 */
export async function handleDialogOrModal(page: Page, buttonText: string = '确定', timeout: number = 5000) {
  // Check if page is still valid
  if (page.isClosed()) {
    return;
  }

  // Set up handler for browser dialog (if any) - use on instead of once to catch multiple dialogs
  const dialogHandler = async (dialog: any) => {
    try {
      if (!page.isClosed()) {
        await dialog.accept();
      }
    } catch (e) {
      // Page might be closed, ignore
    }
  };
  page.on('dialog', dialogHandler);
  
  try {
    // Wait a bit for any modal to appear
    await page.waitForTimeout(600);
    
    // Try to close modals multiple times (in case there are multiple modals)
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts && !page.isClosed()) {
      try {
        const modalExists = await page.locator('.fixed.inset-0.z-\\[10000\\]').isVisible().catch(() => false) ||
                            await page.locator('.fixed.inset-0[style*="z-index: 10000"]').isVisible().catch(() => false);
        
        if (!modalExists) {
          // No modal found, we're done
          break;
        }
        
        // Try to close the modal
        await waitAndCloseModal(page, buttonText, timeout);
        
        // Check if page is still valid before waiting
        if (!page.isClosed()) {
          await page.waitForTimeout(300);
        } else {
          break;
        }
        attempts++;
      } catch (e) {
        // If page is closed or navigation happened, break
        if (page.isClosed() || (e instanceof Error && e.message.includes('closed'))) {
          break;
        }
        // Otherwise continue
        attempts++;
      }
    }
  } finally {
    // Remove dialog handler
    try {
      page.off('dialog', dialogHandler);
    } catch (e) {
      // Page might be closed, ignore
    }
  }
}
