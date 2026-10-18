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

    await page.getByRole('button', { name: '设置', exact: true }).click();
    await expect(page.getByText('设置').first()).toBeVisible();

    await page.getByRole('button', { name: '个人信息', exact: true }).click();
    await expect(page.getByText('昵称').first()).toBeVisible();
    const nicknameInput = page.getByRole('textbox').first();
    await expect(nicknameInput).toHaveValue('E2E用户');
  });
});
