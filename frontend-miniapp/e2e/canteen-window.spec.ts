import { test, expect } from '@playwright/test';
import { installMockApi } from './helpers/mock-api';
import { defaultLoggedInSeed, gotoUniPage, seedUniStorage } from './helpers/uni';

test.describe('Canteen -> Window', () => {
  test.beforeEach(async ({ page }) => {
    await installMockApi(page);
    await seedUniStorage(page, defaultLoggedInSeed);
  });

  test('opens canteen, then window; window number is not shown', async ({ page }) => {
    await gotoUniPage(page, '/pages/canteen/index?id=canteen_001');
    await expect(page).toHaveURL(/\/pages\/canteen\/index\?id=canteen_001/);

    // 食堂页关键内容
    await expect(page.getByText('窗口列表')).toBeVisible();

    // 进入窗口页
    await page.getByText('川味窗口').first().click();
    await expect(page).toHaveURL(/\/pages\/window\/index\?id=window_001/);

    // 窗口页：显示窗口名
    await expect(page.getByText('川味窗口').first()).toBeVisible();

    // 你刚刚改的需求：不展示窗口编号（例如 #101）
    await expect(page.getByText('#101')).toHaveCount(0);
  });
});
