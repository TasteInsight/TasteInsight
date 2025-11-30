import { Page, expect } from '@playwright/test';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config({ path: '.env' });

export async function loginAsAdmin(page: Page) {
  const username = process.env.TEST_ADMIN_USERNAME || 'testadmin';
  const password = process.env.TEST_ADMIN_PASSWORD || 'password123';

  await page.goto('/login');
  await page.fill('input#username', username);
  await page.fill('input#password', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/single-add');
}
