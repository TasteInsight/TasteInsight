import { test, expect } from '@playwright/test';
import { installMockApi } from './helpers/mock-api';
import { defaultLoggedInSeed, gotoUniPage, seedUniStorage } from './helpers/uni';

test.describe('Profile -> Settings', () => {
  test.beforeEach(async ({ page }) => {
    await installMockApi(page);
    await seedUniStorage(page, defaultLoggedInSeed);
  });

  test('opens settings and personal page', async ({ page }) => {
    await gotoUniPage(page, '/pages/profile/index');

    await expect(page.getByText('更多设置').first()).toBeVisible();
    await page.getByText('更多设置').first().click();
    await expect(page.getByText('设置').first()).toBeVisible();

    await page.getByText('个人信息设置').first().click();
    await expect(page.getByText('昵称').first()).toBeVisible();
    const nicknameInput = page.getByRole('textbox').first();
    await expect(nicknameInput).toHaveValue('E2E用户');
  });
});
