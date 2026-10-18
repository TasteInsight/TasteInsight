import { test, expect } from '@playwright/test';
import { installMockApi } from './helpers/mock-api';
import { defaultLoggedInSeed, gotoUniPage, seedUniStorage } from './helpers/uni';

test.describe('Search -> Dish detail', () => {
  test.beforeEach(async ({ page }) => {
    await installMockApi(page);
    await seedUniStorage(page, defaultLoggedInSeed);
  });

  test('keeps an empty query idle', async ({ page }) => {
    await gotoUniPage(page, '/pages/search/index');
    await expect(page).toHaveURL(/\/pages\/search\/index/);

    const searchButton = page.getByRole('button', { name: '搜索', exact: true });
    await searchButton.click();

    await expect(page.getByRole('searchbox', { name: '搜索菜品或食堂' })).toHaveValue('');
    await expect(page.getByText(/未找到.*相关结果/)).toHaveCount(0);
  });

  test('searches dishes and opens dish detail', async ({ page }) => {
    await gotoUniPage(page, '/pages/search/index');
    await expect(page).toHaveURL(/\/pages\/search\/index/);

    // 定位搜索输入框
    const searchInput = page.getByRole('searchbox', { name: '搜索菜品或食堂' });
    await expect(searchInput).toBeVisible();

    // 输入搜索关键词
    await searchInput.fill('宫保');

    // 点击搜索按钮
    const searchButton = page.getByRole('button', { name: '搜索', exact: true });
    await searchButton.click();

    // 等待搜索结果加载
    await page.waitForLoadState('networkidle');

    // 验证搜索结果出现
    const dishCard = page.locator('text=/宫保鸡丁/').first();
    await expect(dishCard).toBeVisible({ timeout: 5000 });

    // 点击菜品卡片进入详情页
    await dishCard.click();
    await expect(page).toHaveURL(/\/pages\/dish\/index\?id=dish_001/);

    // 详情页关键区域
    await expect(page.getByText('宫保鸡丁', { exact: true }).first()).toBeVisible();
    await expect(page.getByLabel('收藏此菜品', { exact: true })).toBeVisible();
  });
});
