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

    await expect(page.getByText('新建对话').first()).toBeVisible();
    await expect(page.getByText('历史记录').first()).toBeVisible();
  });
});
