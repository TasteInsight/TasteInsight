import { test, expect } from '@playwright/test';
import { installMockApi } from './helpers/mock-api';
import { defaultLoggedInSeed, gotoUniPage, seedUniStorage } from './helpers/uni';

test.describe('Planning', () => {
  test.beforeEach(async ({ page }) => {
    await installMockApi(page);
    await seedUniStorage(page, defaultLoggedInSeed);
  });

  test('shows empty states for current/history tabs', async ({ page }) => {
    await gotoUniPage(page, '/pages/planning/index');

    await expect(page.getByText('当前规划').first()).toBeVisible();
    await expect(page.getByText('暂无当前规划').first()).toBeVisible();
    await expect(page.getByText('创建第一个规划').first()).toBeVisible();

    await page.getByText('历史规划').first().click();
    await expect(page.getByText('暂无历史规划').first()).toBeVisible();
  });
});
