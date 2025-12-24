import { test, expect } from '@playwright/test';
import { installMockApi } from './helpers/mock-api';
import { defaultLoggedInSeed, gotoUniPage, seedUniStorage } from './helpers/uni';

test.describe('Auth (H5 + mock)', () => {
  test.beforeEach(async ({ page }) => {
    await installMockApi(page);
    await seedUniStorage(page, defaultLoggedInSeed);
  });

  test('can open index page when token exists', async ({ page }) => {
    await gotoUniPage(page, '/pages/index/index');

    // 等待页面加载完成
    await page.waitForLoadState('networkidle');

    // 检查 URL 是否正确跳转到首页
    await expect(page).toHaveURL(/.*\/pages\/index\/index/);

    // 检查页面有内容加载（例如食堂列表）
    await expect(page.getByText('一食堂').first()).toBeVisible();
  });
});
