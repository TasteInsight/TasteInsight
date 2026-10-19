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

for (const width of [320, 375]) {
  test(`profile utilities fit one row at ${width}px and avatar keeps profile editing`, async ({
    page,
  }) => {
    await installMockApi(page);
    await seedUniStorage(page, defaultLoggedInSeed);
    await page.setViewportSize({ width, height: 667 });
    await gotoUniPage(page, '/pages/profile/index');
    const utilities = page.locator('.profile-utilities').getByRole('button');
    await expect(utilities).toHaveText(['收藏', '历史', '上传']);
    const boxes = await utilities.evaluateAll(elements =>
      elements.map(element => {
        const box = element.getBoundingClientRect();
        return { top: box.top, right: box.right };
      })
    );
    expect(
      Math.max(...boxes.map(box => box.top)) - Math.min(...boxes.map(box => box.top))
    ).toBeLessThan(1);
    expect(Math.max(...boxes.map(box => box.right))).toBeLessThanOrEqual(width);
    await page.getByRole('button', { name: /^管理个人资料/ }).click();
    await page.getByRole('button', { name: '头像与昵称', exact: true }).click();
    await expect(page.getByText('昵称', { exact: true })).toBeVisible();
  });
}
