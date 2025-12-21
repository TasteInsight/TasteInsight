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

    // 首页核心可见元素：搜索入口
    await expect(page.getByText('搜索食堂、窗口或菜品').first()).toBeVisible();
  });
});
