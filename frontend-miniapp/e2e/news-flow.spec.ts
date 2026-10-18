import { test, expect } from '@playwright/test';
import { installMockApi } from './helpers/mock-api';
import { defaultLoggedInSeed, gotoUniPage, seedUniStorage } from './helpers/uni';

test.describe('News', () => {
  test.beforeEach(async ({ page }) => {
    await installMockApi(page);
    await seedUniStorage(page, defaultLoggedInSeed);
  });

  test('lists news and opens detail', async ({ page }) => {
    await gotoUniPage(page, '/pages/index/index');
    await page.getByText('校园', { exact: true }).click();
    await page.getByRole('tab', { name: '资讯', exact: true }).click();

    const title = '食堂营业时间调整通知';
    await page.getByLabel(title, { exact: true }).click();

    await expect(page.getByText(title).first()).toBeVisible();
    await expect(page.getByText('本周起，一食堂晚餐结束时间调整为 20:00。')).toBeVisible();
  });
});
