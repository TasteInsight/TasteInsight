import { test, expect } from '@playwright/test';
import { installMockApi } from './helpers/mock-api';
import { defaultLoggedInSeed, gotoUniPage, seedUniStorage } from './helpers/uni';

test.describe('News', () => {
  test.beforeEach(async ({ page }) => {
    await installMockApi(page);
    await seedUniStorage(page, defaultLoggedInSeed);
  });

  test('lists news and opens detail', async ({ page }) => {
    // 先进入首页，再通过 tabBar 进入“新闻”页（更贴近真实用户路径）
    await gotoUniPage(page, '/pages/index/index');
    await page.getByText('新闻').first().click();

    const timeoutOverlay = page.getByText('The connection timed out, click the screen to try again.').first();
    const latestNotice = page.getByText('最新公告').first();

    if (await timeoutOverlay.isVisible().catch(() => false)) {
      await timeoutOverlay.click().catch(() => undefined);
    }

    await expect(latestNotice).toBeVisible();

    const title = '食堂营业时间调整通知';
    await page.getByText(title).first().click();

    await expect(page.getByText(title).first()).toBeVisible();
    await expect(page.getByText('发布人：').first()).toBeVisible();
  });
});
