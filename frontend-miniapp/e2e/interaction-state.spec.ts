import { test, expect, type Page, type Route } from '@playwright/test';
import { installMockApi } from './helpers/mock-api';
import { gotoUniPage } from './helpers/uni';

const json = (route: Route, data: unknown, status = 200) =>
  route.fulfill({
    status,
    headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: status, data }),
  });
async function guest(page: Page) {
  await installMockApi(page);
  await page.route('**/auth/capabilities', route =>
    json(route, {
      loginMethods: { phone: false, campusOAuth: false, wechatMiniapp: false, wechatApp: false },
    })
  );
}

for (const viewport of [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
]) {
  test.describe(`${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });
    test('guest private tabs wait for login and cancellation returns to the same tab', async ({
      page,
    }) => {
      await guest(page);
      const privateReads: string[] = [];
      page.on('request', request => {
        if (/\/(meal-plans|ai\/sessions)(?:\?|$)/.test(request.url()))
          privateReads.push(request.url());
      });
      for (const route of ['planning', 'ai-chat']) {
        await gotoUniPage(page, `/pages/${route}/index`);
        const state = page.locator('.page-state-region');
        await expect(state).toContainText('登录后');
        const box = await state.boundingBox();
        expect(box!.height).toBeGreaterThan(viewport.height - 150);
        await state.getByRole('button', { name: '登录', exact: true }).click();
        await expect(page).toHaveURL(/pages\/login\/index/);
        await page.getByText('先逛逛', { exact: true }).click();
        await expect(page).toHaveURL(new RegExp(`pages/${route}/index`));
        await expect(page.getByText('登录后', { exact: false })).toBeVisible();
      }
      expect(privateReads).toEqual([]);
    });
    test('news empty and failed states fill the available page without horizontal overflow', async ({
      page,
    }) => {
      await guest(page);
      await page.route('**/news?**', route =>
        json(route, { items: [], meta: { page: 1, totalPages: 0 } })
      );
      await gotoUniPage(page, '/pages/news/index');
      await expect(page.getByText('暂无新闻', { exact: true })).toBeVisible();
      const empty = page.locator('.page-state-region');
      const box = await empty.boundingBox();
      expect(box!.height).toBeGreaterThan(viewport.height - 160);
      const geometry = await empty.evaluate(element => {
        const root = element.getBoundingClientRect();
        const icon = element.querySelector('.ui-icon')!.getBoundingClientRect();
        const title = element.querySelector('.empty-state__title')!.getBoundingClientRect();
        return {
          center: (icon.top + title.bottom) / 2,
          expected: (root.top + root.bottom) / 2,
          width: document.documentElement.scrollWidth,
        };
      });
      expect(Math.abs(geometry.center - geometry.expected)).toBeLessThan(3);
      expect(geometry.width).toBeLessThanOrEqual(viewport.width);
      await page.route('**/news?**', route => json(route, null, 503));
      await page.reload();
      const failure = page.getByRole('alert');
      await expect(failure).toContainText('重试');
      expect((await failure.boundingBox())!.height).toBeGreaterThan(viewport.height - 160);
    });
    test('home centers the empty result below actual filters and leaves room for navigation', async ({
      page,
    }) => {
      await guest(page);
      await page.route('**/dishes', route =>
        json(route, { items: [], meta: { page: 1, totalPages: 0 } })
      );
      await gotoUniPage(page, '/pages/index/index');
      const state = page.locator('.page-state-region');
      await expect(state).toContainText('暂无推荐菜品');
      const result = await state.evaluate(element => {
        const root = element.getBoundingClientRect();
        const filters = document.querySelector('.filters')!.getBoundingClientRect();
        const icon = element.querySelector('.ui-icon')!.getBoundingClientRect();
        const title = element.querySelector('.empty-state__title')!.getBoundingClientRect();
        return {
          top: root.top,
          filterBottom: filters.bottom,
          center: (icon.top + title.bottom) / 2,
          expected: (root.top + root.bottom) / 2,
          width: document.documentElement.scrollWidth,
        };
      });
      expect(result.top).toBeGreaterThanOrEqual(result.filterBottom - 1);
      expect(Math.abs(result.center - result.expected)).toBeLessThan(3);
      expect(result.width).toBeLessThanOrEqual(viewport.width);
    });
  });
}

test('cancelling during credential exchange ignores the late response and keeps the source page', async ({
  page,
}) => {
  await guest(page);
  let release!: () => void;
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  let started!: () => void;
  const inFlight = new Promise<void>(resolve => {
    started = resolve;
  });
  await page.route('**/auth/wechat/login', async route => {
    started();
    await gate;
    await json(route, { token: { accessToken: 'late-token', refreshToken: 'late-refresh' } });
  });
  await gotoUniPage(page, '/pages/planning/index');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await page.locator('.agreement-toggle').click();
  await page.getByText('开发测试登录', { exact: true }).click();
  await inFlight;
  await page.getByText('先逛逛', { exact: true }).click();
  await expect(page).toHaveURL(/pages\/planning\/index/);
  const response = page.waitForResponse('**/auth/wechat/login');
  release();
  await response;
  await expect(page.locator('.page-state-region')).toContainText('登录后');
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();
  await expect(page).toHaveURL(/pages\/planning\/index/);
});

test('successful login returns to its original tab', async ({ page }) => {
  await guest(page);
  await gotoUniPage(page, '/pages/planning/index');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await page.locator('.agreement-toggle').click();
  await page.getByText('开发测试登录', { exact: true }).click();
  await expect(page).toHaveURL(/pages\/planning\/index/);
  await expect(page.getByRole('tab', { name: '周', exact: true })).toBeVisible();
});

test('direct login cancellation has a home fallback', async ({ page }) => {
  await guest(page);
  await gotoUniPage(page, '/pages/login/index');
  await page.getByText('先逛逛', { exact: true }).click();
  await expect(page).toHaveURL(/#\/(?:pages\/index\/index)?$/);
  await expect(page.getByText('今日推荐', { exact: true })).toBeVisible();
});

test('profile login cancellation and viewing the agreement preserve the source', async ({
  page,
}) => {
  await guest(page);
  await gotoUniPage(page, '/pages/profile/index');
  await page.getByRole('button', { name: '登录食鉴', exact: true }).click();
  await page.waitForFunction(
    () => (window as any).getCurrentPages().at(-1)?.route === 'pages/login/index'
  );
  await page.getByText('《用户协议》', { exact: true }).click();
  await expect(page).toHaveURL(/pages\/settings\/privacy/);
  await expect(page.locator('.privacy-page')).toBeVisible();
  await page.waitForFunction(
    () => (window as any).getCurrentPages().at(-1)?.route === 'pages/settings/privacy'
  );
  await page.goBack();
  await page.waitForFunction(
    () => (window as any).getCurrentPages().at(-1)?.route === 'pages/login/index'
  );
  await expect(page).toHaveURL(/pages\/login\/index/);
  await page.getByText('先逛逛', { exact: true }).click();
  await expect(page).toHaveURL(/pages\/profile\/index/);
});

test('expired private reads change the page to a login state without navigation', async ({
  page,
}) => {
  await guest(page);
  await page.addInitScript(() => localStorage.setItem('token', 'expired-token'));
  await page.route('**/meal-plans', route => json(route, null, 401));
  await gotoUniPage(page, '/pages/planning/index');
  await expect(page.locator('.page-state-region')).toContainText('登录后');
  await expect(page).toHaveURL(/pages\/planning\/index/);
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();
});

test('native refresh completes without a success toast', async ({ page }) => {
  await guest(page);
  await gotoUniPage(page, '/pages/index/index');
  await expect(page.locator('.dish-card').first()).toBeVisible();
  await expect(page.locator('.home-content')).toHaveAttribute('aria-busy', 'false');
  const response = page.waitForResponse(response => new URL(response.url()).pathname === '/dishes');
  await page.evaluate(() => (window as any).uni.startPullDownRefresh());
  await response;
  await expect(page.locator('.home-content')).toHaveAttribute('aria-busy', 'false');
  await expect(page.getByText('刷新成功', { exact: true })).toHaveCount(0);
});

test('failed native refresh preserves loaded cards and uses the inline retry', async ({ page }) => {
  await guest(page);
  await gotoUniPage(page, '/pages/index/index');
  const cards = page.locator('.dish-card');
  await expect(cards.first()).toBeVisible();
  await expect(page.locator('.home-content')).toHaveAttribute('aria-busy', 'false');
  const count = await cards.count();
  await page.route('**/dishes', route => json(route, null, 503));
  const failed = page.waitForResponse(
    response => new URL(response.url()).pathname === '/dishes' && response.status() === 503
  );
  await page.evaluate(() => (window as any).uni.startPullDownRefresh());
  await failed;
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(cards).toHaveCount(count);
  await expect(page.getByText('刷新失败', { exact: true })).toHaveCount(0);
});

test('settings returns from explicit login and loads its editable form', async ({ page }) => {
  await guest(page);
  await gotoUniPage(page, '/pages/settings/components/display');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await page.locator('.agreement-toggle').click();
  await page.getByText('开发测试登录', { exact: true }).click();
  await expect(page).toHaveURL(/pages\/settings\/components\/display/);
  await expect(page.getByText('显示选项', { exact: true })).toBeVisible();
  await expect(page.locator('.settings-form-body')).toHaveAttribute('aria-busy', 'false');
});
