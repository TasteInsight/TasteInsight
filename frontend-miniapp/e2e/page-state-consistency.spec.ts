import { expect, test, type Locator, type Page, type Route } from '@playwright/test';
import { installMockApi } from './helpers/mock-api';
import { gotoUniPage } from './helpers/uni';

test.use({ actionTimeout: 10_000 });

const apiOrigin = 'http://127.0.0.1:4523';
const user = {
  id: 'e2e-user',
  nickname: '状态验证同学',
  avatar: '',
  capabilities: { canContribute: true },
  settings: { displaySettings: { sortBy: 'rating' }, showMealPlans: false },
  preferences: {},
  allergens: [],
  myFavoriteDishes: [],
  myReviews: [],
  myComments: [],
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};
const dish = {
  id: 'dish_001',
  name: '宫保鸡丁',
  price: 12.5,
  images: [],
  tags: ['川菜'],
  canteenId: 'canteen_001',
  canteenName: '一食堂',
  windowId: 'window_001',
  windowName: '川味窗口',
  ingredients: ['鸡肉'],
  allergens: [],
  availableMealTime: ['lunch'],
  averageRating: 0,
  reviewCount: 0,
};
const post = {
  id: 'state-post',
  userId: user.id,
  userNickname: user.nickname,
  userAvatar: '',
  content: '今天的午餐记录',
  images: [],
  status: 'approved',
  likeCount: 0,
  likedByMe: false,
  commentCount: 0,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
};
const paginated = (items: unknown[]) => ({
  items,
  meta: { page: 1, pageSize: 20, total: items.length, totalPages: items.length ? 1 : 0 },
});
const json = (route: Route, data: unknown, status = 200) =>
  route.fulfill({
    status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      code: status,
      message: status === 200 ? 'success' : '服务暂时不可用',
      data,
    }),
  });

async function fixtures(page: Page) {
  await installMockApi(page);
  await page.route(`${apiOrigin}/**`, async route => {
    const { pathname } = new URL(route.request().url());
    if (route.request().method() === 'OPTIONS') return route.fallback();
    if (pathname === '/auth/capabilities')
      return json(route, {
        phone: false,
        campusOAuth: false,
        campusEmail: false,
        wechatMiniapp: false,
        wechatApp: false,
        loginMethods: { phone: false, campusOAuth: false, wechatMiniapp: false, wechatApp: false },
        verificationMethods: { campusEmail: false, campusOAuth: false },
      });
    if (pathname === '/auth/wechat/login')
      return json(route, {
        user,
        token: { accessToken: 'e2e-token', refreshToken: 'e2e-refresh-token' },
      });
    if (pathname === '/user/profile') return json(route, user);
    if (pathname === '/notifications/unread-count') return json(route, { unreadCount: 0 });
    if (pathname === '/notifications') return json(route, paginated([]));
    if (pathname === '/dishes/dish_001') return json(route, dish);
    if (pathname === '/canteens/canteen_001')
      return json(route, {
        id: 'canteen_001',
        name: '一食堂',
        images: [],
        floors: [],
        windows: [],
      });
    if (pathname === '/windows/window_001')
      return json(route, {
        id: 'window_001',
        name: '川味窗口',
        canteenId: 'canteen_001',
        images: [],
        tags: [],
      });
    if (pathname === '/dishes' && route.request().method() === 'POST')
      return json(route, paginated([dish]));
    if (pathname === '/posts') return json(route, paginated([]));
    if (pathname === '/user/posts') return json(route, paginated([post]));
    return route.fallback();
  });
}

async function login(page: Page) {
  await expect(page).toHaveURL(/pages\/login\/index/);
  await page.locator('.agreement-toggle').click();
  await page.getByText('开发测试登录', { exact: true }).click();
}

async function refresh(page: Page) {
  await page.evaluate(() => (window as any).uni.startPullDownRefresh());
}

async function centeredState(state: Locator, viewport: { width: number; height: number }) {
  await expect(state).toBeVisible();
  const geometry = await state.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const parts = [
      ...element.querySelectorAll('.ui-icon, .empty-state__title, .empty-state__action'),
    ]
      .map(part => part.getBoundingClientRect())
      .filter(part => part.height > 0);
    const top = Math.min(...parts.map(part => part.top));
    const bottom = Math.max(...parts.map(part => part.bottom));
    return {
      height: rect.height,
      width: rect.width,
      left: rect.left,
      right: rect.right,
      center: (top + bottom) / 2,
      expected: (rect.top + rect.bottom) / 2,
      documentWidth: document.documentElement.scrollWidth,
      path: window.location.hash,
    };
  });
  expect.soft(geometry.height).toBeGreaterThan(viewport.height - 200);
  expect
    .soft(geometry.width, geometry.path)
    .toBeGreaterThanOrEqual(Math.min(viewport.width, 760) - 48);
  expect.soft(geometry.width, geometry.path).toBeLessThanOrEqual(760);
  expect.soft(Math.abs((geometry.left + geometry.right) / 2 - viewport.width / 2)).toBeLessThan(2);
  expect.soft(geometry.left).toBeGreaterThanOrEqual(0);
  expect.soft(geometry.right).toBeLessThanOrEqual(viewport.width + 1);
  expect.soft(Math.abs(geometry.center - geometry.expected)).toBeLessThan(3);
  expect.soft(geometry.documentWidth).toBeLessThanOrEqual(viewport.width);
}

const protectedPages = [
  ['/pages/planning/index', '规划', '登录后查看饮食规划'],
  ['/pages/ai-chat/index', 'AI 助手', '登录后使用 AI 助手'],
  ['/pages/profile/records/my-favorites/index', '我的收藏', '登录后查看个人记录'],
  ['/pages/profile/records/history/index', '历史浏览', '登录后查看个人记录'],
  ['/pages/profile/records/my-reviews/index', '我的评价', '登录后查看个人记录'],
  ['/pages/profile/records/my-uploads/index', '我的上传', '登录后查看上传记录'],
  ['/pages/notifications/index', '消息', '登录后查看消息'],
  ['/pages/notifications/weekly?week=2026-10-05', '本周推荐', '登录后查看本周推荐'],
  ['/pages/settings/components/display', '显示设置', '登录后管理个人设置'],
  ['/pages/add-dish/index', '申请新增菜品', '登录后申请新增菜品'],
] as const;

for (const viewport of [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 1440, height: 1000 },
]) {
  test.describe(`${viewport.width}px shared guest states`, () => {
    test.use({ viewport });
    test('center login feedback within available space and use the shared page title', async ({
      page,
    }, testInfo) => {
      test.setTimeout(120_000);
      await fixtures(page);
      const privateReads: string[] = [];
      page.on('request', request => {
        if (
          new URL(request.url()).origin === apiOrigin &&
          /\/(?:user\/(?:favorites|history|reviews|uploads)|meal-plans|ai\/sessions|notifications)(?:[/?]|$)/.test(
            request.url()
          )
        )
          privateReads.push(request.url());
      });
      for (const [path, title, prompt] of protectedPages) {
        await test.step(title, async () => {
          await gotoUniPage(page, path);
          const state = page.locator('.page-state-region:visible');
          await expect(state).toHaveCount(1);
          await expect(state).toContainText(prompt);
          await centeredState(state, viewport);
          if (viewport.width === 1440 && title === 'AI 助手')
            await page.screenshot({
              path: testInfo.outputPath('guest-ai-state.png'),
              fullPage: true,
            });
          const heading = page.locator('.uni-page-head__title:visible');
          await expect(heading).toHaveCount(1);
          if (title === 'AI 助手') {
            await expect(page.locator('.ai-chat-toolbar')).toHaveCount(0);
            await expect(page.locator('.ai-chat-title')).toHaveCount(0);
          }
          await expect(heading).toHaveText(title);
          const style = await heading.evaluate(element => {
            const value = getComputedStyle(element);
            return { size: value.fontSize, weight: value.fontWeight, lineHeight: value.lineHeight };
          });
          expect(style).toEqual({ size: '18px', weight: '600', lineHeight: '30px' });
          await expect(state.getByRole('button', { name: '登录', exact: true })).toHaveCount(1);
        });
      }
      expect(privateReads).toEqual([]);
      await page.screenshot({ path: testInfo.outputPath('guest-state.png'), fullPage: true });
    });
  });
}

for (const source of ['dish', 'canteen', 'window'] as const) {
  test(`${source} content recovers after explicit login through a dish action`, async ({
    page,
  }) => {
    await fixtures(page);
    await page.setViewportSize({ width: 390, height: 844 });
    const route = `/pages/${source}/index?id=${source}_001`;
    await gotoUniPage(page, route);
    if (source !== 'dish')
      await page.getByRole('button', { name: '查看宫保鸡丁', exact: true }).click();
    await expect(page.locator('.dish-title')).toHaveText('宫保鸡丁');
    await page.locator('[aria-label="收藏此菜品"]').click();
    await login(page);
    await expect(page).toHaveURL(/pages\/dish\/index\?id=dish_001/);
    await expect(page.locator('.dish-title')).toHaveText('宫保鸡丁');
    await expect(page.locator('.dish-content')).toHaveAttribute('aria-busy', 'false');
    await expect(page.locator('.dish-page .error-feedback:visible')).toHaveCount(0);
    if (source !== 'dish') {
      await page.locator('.uni-page-head-btn:visible').first().click();
      await expect(page).toHaveURL(new RegExp(`pages/${source}/index\\?id=${source}_001`));
      await expect(page.getByRole('button', { name: '查看宫保鸡丁', exact: true })).toBeVisible();
      await expect(page.locator('.dish-list-content:visible')).toHaveAttribute(
        'aria-busy',
        'false'
      );
      await expect(page.locator('.error-feedback:visible')).toHaveCount(0);
    }
  });
}

test('campus preserves the guest mine selection through login and reads owned posts', async ({
  page,
}) => {
  await fixtures(page);
  await gotoUniPage(page, '/pages/community/index');
  await page.getByRole('tab', { name: '我的', exact: true }).click();
  await expect(page.getByRole('tab', { name: '我的', exact: true })).toHaveAttribute(
    'aria-selected',
    'true'
  );
  await expect(page.locator('.page-state-region:visible')).toContainText('登录后查看我的动态');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  const ownedRead = page.waitForResponse(
    response => new URL(response.url()).pathname === '/user/posts'
  );
  await login(page);
  await ownedRead;
  await expect(page).toHaveURL(/pages\/community\/index/);
  await expect(page.getByRole('tab', { name: '我的', exact: true })).toHaveAttribute(
    'aria-selected',
    'true'
  );
  await expect(page.locator('.post-content:visible')).toHaveText(post.content);
  await expect(page.locator('.page-state-region:visible')).toHaveCount(0);
});

test('empty news refresh exposes one loading state then an actionable failure', async ({
  page,
}) => {
  await fixtures(page);
  let mode: 'empty' | 'pending' | 'failed' = 'empty';
  let release!: () => void;
  const pending = new Promise<void>(resolve => {
    release = resolve;
  });
  await page.route(`${apiOrigin}/news?**`, async route => {
    if (mode === 'pending') await pending;
    return json(route, mode === 'failed' ? null : paginated([]), mode === 'failed' ? 503 : 200);
  });
  await gotoUniPage(page, '/pages/news/index');
  await expect(page.getByText('暂无新闻', { exact: true })).toBeVisible();
  mode = 'pending';
  await refresh(page);
  await expect(page.getByText('正在加载新闻…', { exact: true })).toBeVisible();
  await expect(page.getByText('暂无新闻', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('status')).toHaveCount(1);
  mode = 'failed';
  release();
  await expect(page.getByRole('alert')).toContainText('新闻加载失败');
  mode = 'empty';
  await page.getByRole('button', { name: '重新加载', exact: true }).click();
  await expect(page.getByText('暂无新闻', { exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('a warm home page retains cards through browser offline refresh and online retry', async ({
  page,
  context,
}) => {
  await fixtures(page);
  let offline = false;
  await page.route(`${apiOrigin}/dishes`, route =>
    offline ? route.abort('internetdisconnected') : route.fallback()
  );
  await gotoUniPage(page, '/pages/index/index');
  const cards = page.locator('.dish-card');
  await expect(cards).toHaveCount(1);
  await expect(page.locator('.home-content')).toHaveAttribute('aria-busy', 'false');
  offline = true;
  await context.setOffline(true);
  try {
    await refresh(page);
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText('宫保鸡丁');
  } finally {
    offline = false;
    await context.setOffline(false);
  }
  await page.getByRole('alert').getByRole('button').click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.locator('.home-content')).toHaveAttribute('aria-busy', 'false');
  await expect(cards).toHaveCount(1);
});

test('a cold detail API outage renders one error and recovers without a page reload', async ({
  page,
}) => {
  await fixtures(page);
  let offline = true;
  await page.route(`${apiOrigin}/dishes/dish_001`, route =>
    offline ? route.abort('internetdisconnected') : route.fallback()
  );
  await gotoUniPage(page, '/pages/dish/index?id=dish_001');
  const error = page.getByRole('alert');
  await expect(error).toHaveCount(1);
  await expect(error).toBeVisible();
  await expect(page.locator('.dish-title')).toHaveCount(0);
  await expect(page.locator('.empty-state__spinner')).toHaveCount(0);
  offline = false;
  await error.getByRole('button', { name: '重试', exact: true }).click();
  await expect(page.locator('.dish-title')).toHaveText('宫保鸡丁');
  await expect(error).toHaveCount(0);
});

test('campus section switches retain the mine filter and reuse the first news result', async ({
  page,
}) => {
  await fixtures(page);
  let newsReads = 0;
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.origin === apiOrigin && url.pathname === '/news') newsReads++;
  });
  await gotoUniPage(page, '/pages/community/index');
  await expect(page.getByText('还没有校园动态', { exact: true })).toBeVisible();
  expect(newsReads).toBe(0);
  await page.getByRole('tab', { name: '我的', exact: true }).click();
  await expect(page.locator('.page-state-region:visible')).toContainText('登录后查看我的动态');
  await page.getByRole('tab', { name: '资讯', exact: true }).click();
  await expect(page.locator('.news-item:visible')).toHaveCount(1);
  expect(newsReads).toBe(1);
  await page.getByRole('tab', { name: '动态', exact: true }).click();
  await expect(page.getByRole('tab', { name: '我的', exact: true })).toHaveAttribute(
    'aria-selected',
    'true'
  );
  await expect(page.locator('.page-state-region:visible')).toContainText('登录后查看我的动态');
  await page.getByRole('tab', { name: '资讯', exact: true }).click();
  await expect(page.locator('.news-item:visible')).toHaveCount(1);
  expect(newsReads).toBe(1);
});

test('public profile shows each initial read while preserving its loaded identity', async ({
  page,
}) => {
  await fixtures(page);
  let releaseProfile!: () => void;
  let releasePosts!: () => void;
  const profileRead = new Promise<void>(resolve => {
    releaseProfile = resolve;
  });
  const postsRead = new Promise<void>(resolve => {
    releasePosts = resolve;
  });
  await page.route(`${apiOrigin}/users/public-student`, async route => {
    await profileRead;
    return json(route, {
      id: 'public-student',
      nickname: '公开主页同学',
      avatar: '',
      bio: '',
      isVerifiedStudent: true,
      postCount: 0,
    });
  });
  await page.route(`${apiOrigin}/posts?**`, async route => {
    await postsRead;
    return json(route, paginated([]));
  });
  await gotoUniPage(page, '/pages/profile/public?id=public-student');
  await expect(page.getByText('正在加载主页…', { exact: true })).toBeVisible();
  await expect(page.locator('.public-header')).toHaveCount(0);
  releaseProfile();
  await expect(page.locator('.public-name')).toHaveText('公开主页同学');
  await expect(page.getByText('正在加载动态…', { exact: true })).toBeVisible();
  await expect(page.getByRole('status')).toHaveCount(1);
  releasePosts();
  await expect(page.getByText('还没有公开动态', { exact: true })).toBeVisible();
  await expect(page.locator('.public-name')).toHaveText('公开主页同学');
});

test('logged-in AI keeps its title and toolbar above a usable message viewport', async ({
  page,
}, testInfo) => {
  await fixtures(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoUniPage(page, '/pages/ai-chat/index');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await login(page);
  await expect(page).toHaveURL(/pages\/ai-chat\/index/);
  await expect(page.getByText('你好，我是AI助手。', { exact: true })).toBeVisible();
  await expect(page.getByText('登录成功', { exact: true })).toBeHidden();
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1440, height: 1000 },
    { width: 390, height: 480 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(page.locator('.uni-page-head__title:visible')).toHaveText('AI 助手');
    await expect(page.locator('.ai-chat-title, .page-navigation-title')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '新对话', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '历史对话', exact: true })).toBeVisible();
    await expect(page.getByRole('textbox', { name: '消息输入', exact: true })).toBeVisible();
    const geometry = await page.locator('.ai-chat-messages').evaluate(element => {
      const rect = element.getBoundingClientRect();
      const toolbar = document.querySelector('.ai-chat-toolbar')!.getBoundingClientRect();
      const titleBar = document.querySelector('.uni-page-head')!.getBoundingClientRect();
      const viewport = document.querySelector('.ai-chat-page')!;
      const viewportRect = viewport.getBoundingClientRect();
      const footer = document.querySelector('.ai-chat-footer')!.getBoundingClientRect();
      return {
        height: rect.height,
        width: rect.width,
        top: rect.top,
        toolbarBottom: toolbar.bottom,
        toolbarTop: toolbar.top,
        titleBottom: titleBar.bottom,
        pageTop: viewportRect.top,
        pageBottom: viewportRect.bottom,
        footerBottom: footer.bottom,
        overflow: viewport.scrollHeight - viewport.clientHeight,
      };
    });
    expect(geometry.height).toBeGreaterThan(viewport.height > 500 ? 300 : 160);
    expect(Math.abs(geometry.pageTop - geometry.titleBottom)).toBeLessThan(2);
    expect(Math.abs(geometry.toolbarTop - geometry.pageTop)).toBeLessThan(2);
    expect(geometry.footerBottom).toBeLessThanOrEqual(geometry.pageBottom + 1);
    expect(geometry.overflow).toBeLessThanOrEqual(1);
    expect(geometry.width).toBeLessThanOrEqual(760);
    expect(geometry.top).toBeGreaterThanOrEqual(geometry.toolbarBottom - 1);
    await page.screenshot({
      path: testInfo.outputPath(`ai-logged-in-${viewport.width}x${viewport.height}.png`),
      fullPage: true,
    });
  }
});
