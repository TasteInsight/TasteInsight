import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './utils';

test('Admin Login Flow', async ({ page }) => {
  await loginAsAdmin(page);

  // 6. Verify that we are on the correct page
  await expect(page).toHaveURL(/.*single-add/);
});
