import { test, expect } from '@playwright/test';
import { installMockApi } from './helpers/mock-api';
import { defaultLoggedInSeed, gotoUniPage, seedUniStorage } from './helpers/uni';

test.describe('Search -> Dish detail', () => {
  test.beforeEach(async ({ page }) => {
    await installMockApi(page);
    await seedUniStorage(page, defaultLoggedInSeed);
  });

  test('searches dishes and opens dish detail', async ({ page }) => {
    await gotoUniPage(page, '/pages/search/index');
    await expect(page).toHaveURL(/\/pages\/search\/index/);

    // uni-app H5 下 input 的语义/placeholder 可能被包装，优先用原生 input 定位
    const searchInput = page.locator('input').first();
    await expect(searchInput).toBeVisible();

    // 触发搜索：使用 mock 数据关键字
    await searchInput.fill('宫保');
    await searchInput.press('Enter');

    // 断言搜索结果出现
    const dishName = page.getByText('宫保鸡丁');
    await expect(dishName).toBeVisible();

    // 点击结果进入详情页
    await dishName.click();
    await expect(page).toHaveURL(/\/pages\/dish\/index\?id=dish_001/);

    // 详情页关键区域
    await expect(page.getByRole('heading', { name: '详细信息' })).toBeVisible();
    await expect(page.getByText('宫保鸡丁')).toBeVisible();
  });
});
