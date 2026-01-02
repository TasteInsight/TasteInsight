import { test, expect } from '@playwright/test';
import { installMockApi } from './helpers/mock-api';
import { gotoUniPage, seedUniStorage, defaultLoggedInSeed } from './helpers/uni';

test.describe('Login flow', () => {
  test('completes login from login page to home', async ({ page }) => {
    // 先设置登录状态，然后安装 mock API
    await seedUniStorage(page, defaultLoggedInSeed);
    await installMockApi(page);

    // 进入登录页，应该自动跳转到首页
    await gotoUniPage(page, '/pages/login/index');

    // 等待跳转到首页
    await page.waitForLoadState('networkidle');

    // 检查 URL 是否正确跳转到首页
    await expect(page).toHaveURL(/.*\/pages\/index\/index/);

    // 检查页面有内容加载（例如食堂列表）
    await expect(page.getByText('一食堂').first()).toBeVisible();
  });
});