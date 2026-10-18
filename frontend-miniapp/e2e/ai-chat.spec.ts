import { test, expect } from '@playwright/test';
import { installMockApi } from './helpers/mock-api';
import { defaultLoggedInSeed, gotoUniPage, seedUniStorage } from './helpers/uni';

test.describe('AI Chat', () => {
  test.beforeEach(async ({ page }) => {
    await installMockApi(page);
    await seedUniStorage(page, defaultLoggedInSeed);
  });

  test('loads chat page with top actions', async ({ page }) => {
    await gotoUniPage(page, '/pages/ai-chat/index');

    await expect(page.getByRole('button', { name: '新对话', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '历史对话', exact: true })).toBeVisible();
  });
});
