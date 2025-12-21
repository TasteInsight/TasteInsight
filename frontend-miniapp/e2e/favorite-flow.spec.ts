import { test, expect } from '@playwright/test';
import { installMockApi } from './helpers/mock-api';
import { defaultLoggedInSeed, gotoUniPage, seedUniStorage } from './helpers/uni';

test.describe('Favorite flow', () => {
  test.beforeEach(async ({ page }) => {
    await installMockApi(page);
    await seedUniStorage(page, defaultLoggedInSeed);
  });

  test('favorite a dish then see it in my favorites', async ({ page }) => {
    await gotoUniPage(page, '/pages/dish/index?id=dish_001');

    await expect(page.getByText('宫保鸡丁').first()).toBeVisible();

    await page.getByRole('button', { name: '收藏此菜品' }).click();
    await expect(page.getByText('已收藏').first()).toBeVisible();

    await gotoUniPage(page, '/pages/profile/index');
    await page.getByText('我的收藏').first().click();

    await expect(page.getByText('我的收藏').first()).toBeVisible();
    await expect(page.getByText('宫保鸡丁').first()).toBeVisible();
  });
});
