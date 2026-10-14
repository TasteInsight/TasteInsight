import { expect, test } from '@playwright/test';
import { installMockApi } from './helpers/mock-api';
import { gotoUniPage } from './helpers/uni';

for (const kind of ['canteen', 'window'] as const) {
  test(`${kind} retry restores the complete page and repeats a failed append without losing cards`, async ({
    page,
  }) => {
    await installMockApi(page);
    const resource = kind === 'canteen' ? '/canteens/canteen_001' : '/windows/window_001';
    const reads: number[] = [];
    let headerFailed = false;
    let appendFailed = false;
    await page.route(/\/(?:canteens|windows|dishes)(?:[/?]|$)/, async route => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (request.method() === 'OPTIONS') return route.fallback();
      if (path === resource && !headerFailed) {
        headerFailed = true;
        return route.abort('internetdisconnected');
      }
      if (path !== '/dishes' || request.method() !== 'POST') return route.fallback();
      const { pagination } = request.postDataJSON();
      const requestedPage = pagination.page;
      reads.push(requestedPage);
      if (requestedPage === 2 && !appendFailed) {
        appendFailed = true;
        return route.abort('internetdisconnected');
      }
      const items = Array.from({ length: pagination.pageSize }, (_, index) => ({
        id: `dish-${requestedPage}-${index}`,
        name: `测试菜品 ${requestedPage}-${index}`,
        price: 8,
        images: [],
        tags: [],
        canteenId: 'canteen_001',
        canteenName: '一食堂',
        windowName: '川味窗口',
      }));
      return route.fulfill({
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          code: 200,
          data: {
            items,
            meta: {
              page: requestedPage,
              pageSize: pagination.pageSize,
              total: pagination.pageSize * 3,
              totalPages: 3,
            },
          },
        }),
      });
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoUniPage(page, `/pages/${kind}/index?id=${kind}_001`);
    await expect(page.locator('.error-feedback__action')).toBeVisible();
    await expect(page.locator('.dish-list-heading')).toHaveCount(0);
    expect(reads).toEqual([]);
    await page.locator('.error-feedback__action').click();
    await expect(page.locator('.dish-list-heading')).toBeVisible();
    await expect(page.locator('.dish-card').first()).toContainText('测试菜品 1-0');
    await expect(page.locator('.error-feedback')).toHaveCount(0);
    const firstPageCount = await page.locator('.dish-card').count();
    await page.locator('.dish-list-action').filter({ hasText: '加载更多' }).click();
    await expect(page.locator('.error-feedback__action')).toBeVisible();
    await expect(page.locator('.dish-card')).toHaveCount(firstPageCount);
    await expect(page.locator('.dish-card').first()).toContainText('测试菜品 1-0');
    await page.locator('.error-feedback__action').click();
    await expect(page.locator('.dish-card')).toHaveCount(firstPageCount * 2);
    await expect(page.locator('.dish-card').last()).toContainText(
      `测试菜品 2-${firstPageCount - 1}`
    );
    await expect(page.locator('.error-feedback')).toHaveCount(0);
    expect(reads).toEqual([1, 2, 2]);
  });
}
