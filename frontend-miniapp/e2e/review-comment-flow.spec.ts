import { test, expect } from '@playwright/test';
import type { Review } from '../src/types/api';
import { installMockApi } from './helpers/mock-api';
import { defaultLoggedInSeed, gotoUniPage, seedUniStorage } from './helpers/uni';

test('submits a review and displays the returned content', async ({ page }) => {
  await installMockApi(page);
  const userInfo = { ...defaultLoggedInSeed.userInfo, capabilities: { canContribute: true } };
  await seedUniStorage(page, { ...defaultLoggedInSeed, userInfo });
  await page.route('**/user/profile', route => {
    if (route.request().method() !== 'GET') return route.fallback();
    return route.fulfill({
      headers: { 'Access-Control-Allow-Origin': '*' },
      json: { code: 200, data: userInfo },
    });
  });
  let savedReview: Review | null = null;
  await page.route('**/dishes/dish_001/reviews/mine', route => {
    if (route.request().method() !== 'GET') return route.fallback();
    return route.fulfill({
      headers: { 'Access-Control-Allow-Origin': '*' },
      json: { code: 200, data: savedReview },
    });
  });
  await page.route('**/reviews', async route => {
    if (route.request().method() !== 'POST') return route.fallback();
    savedReview = {
      ...route.request().postDataJSON(),
      id: 'e2e-review',
      userId: 'e2e-user',
      userNickname: 'E2E用户',
      userAvatar: '',
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    await route.fulfill({
      headers: { 'Access-Control-Allow-Origin': '*' },
      status: 201,
      json: { code: 201, data: savedReview },
    });
  });
  await gotoUniPage(page, '/pages/dish/index?id=dish_001');
  await page.getByLabel('写评价', { exact: true }).click();
  const editor = page.getByRole('dialog', { name: '写评价', exact: true });
  await editor.getByLabel('总体评分 5 星', { exact: true }).click();
  await editor.getByLabel('用餐体验', { exact: true }).locator('textarea').fill('这道菜很好吃！');
  await editor.locator('.sheet-primary').click();
  await expect(editor).toBeHidden();
  await expect(page.getByText('这道菜很好吃！', { exact: true })).toBeVisible();
  expect(savedReview).toMatchObject({ dishId: 'dish_001', rating: 5, content: '这道菜很好吃！' });
});
