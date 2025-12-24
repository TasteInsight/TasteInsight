import type { Page, Route, Request } from '@playwright/test';

type ApiResponse<T> = { code: number; message?: string; data: T };

type PaginationMeta = {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

type Paginated<T> = {
  items: T[];
  meta: PaginationMeta;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json<T>(route: Route, body: ApiResponse<T>, status = 200) {
  return route.fulfill({
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(body),
  });
}

function ok<T>(data: T, message = 'success'): ApiResponse<T> {
  return { code: 200, message, data };
}

// 仅覆盖 e2e 用到的最小字段集（保证页面能正常渲染）
const fixtures = {
  user: {
    id: 'e2e-user',
    openId: 'e2e-openid',
    nickname: 'E2E用户',
    avatar: '/static/images/default-avatar.png',
    settings: {
      displaySettings: {
        sortBy: 'rating',
      },
    },
    preferences: {},
    allergens: [],
    myFavoriteDishes: [],
    myReviews: [],
    myComments: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  news: [
    {
      id: 'news_001',
      title: '食堂营业时间调整通知',
      summary: '近期食堂营业时间将做临时调整，请同学们留意。',
      content: '<p>本周起，一食堂晚餐结束时间调整为 20:00。</p>',
      canteenName: '一食堂',
      publishedAt: new Date().toISOString(),
      createdBy: '管理员',
    },
  ],
  canteens: [
    {
      id: 'canteen_001',
      name: '一食堂',
      position: '校园东区',
      description: '学校最大的综合性食堂，提供多种风味美食',
      images: ['https://via.placeholder.com/400x300'],
      averageRating: 4.5,
      reviewCount: 1280,
      floors: [{ level: '1', name: '一楼' }],
      windows: [],
    },
  ],
  windowsByCanteen: {
    canteen_001: [
      {
        id: 'window_001',
        name: '川味窗口',
        number: '101',
        position: '一食堂1楼',
        description: '正宗川菜，麻辣鲜香',
        tags: ['川菜', '辣味', '热门'],
        floor: { level: '1', name: '一楼' },
        floorName: '一楼',
      },
    ],
  } as Record<string, any[]>,
  dishes: [
    {
      id: 'dish_001',
      name: '宫保鸡丁',
      tags: ['川菜', '辣味', '经典'],
      price: 12.5,
      description: '鸡丁嫩滑，花生酥脆，辣而不燥',
      images: ['https://via.placeholder.com/300'],
      ingredients: ['鸡肉', '花生', '干辣椒', '花椒'],
      allergens: ['花生'],
      canteenId: 'canteen_001',
      canteenName: '一食堂',
      windowNumber: '101',
      windowName: '川味窗口',
      availableMealTime: ['lunch', 'dinner'],
      averageRating: 4.5,
      reviewCount: 128,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  dishImages: {
    images: ['https://via.placeholder.com/600x300'],
  },
};

function asPaginated<T>(items: T[], page = 1, pageSize = 50): Paginated<T> {
  return {
    items,
    meta: {
      total: items.length,
      page,
      pageSize,
      totalPages: 1,
    },
  };
}

function getPath(req: Request): string {
  try {
    const url = new URL(req.url());
    return url.pathname;
  } catch {
    return req.url();
  }
}

function tryParseJson(text: string | null): any {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function installMockApi(page: Page): Promise<void> {
  // 为每个 page 持有独立状态，避免并发测试互相污染
  const favoriteDishIds = new Set<string>();

  const handleBackend = async (route: Route) => {
    const req = route.request();
    const method = req.method().toUpperCase();

    // 处理 CORS 预检
    if (method === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: corsHeaders });
    }

    const path = getPath(req);

    // 用户信息
    if (method === 'GET' && path.endsWith('/user/profile')) {
      const user = {
        ...fixtures.user,
        myFavoriteDishes: Array.from(favoriteDishIds),
      };
      return json(route, ok(user));
    }

    // 用户设置
    if (method === 'GET' && path.endsWith('/user/settings')) {
      return json(route, ok({
        displaySettings: { sortBy: 'rating' },
        notifications: { enabled: true },
      }));
    }
    if (method === 'PUT' && path.endsWith('/user/settings')) {
      const body = tryParseJson(req.postData());
      return json(route, ok(body));
    }

    // 通知
    if (method === 'GET' && path.endsWith('/notifications')) {
      return json(route, ok({ items: [] }));
    }

    // 登录 / 刷新 token（避免意外触发 401 逻辑导致跳转）
    if (method === 'POST' && path.endsWith('/auth/wechat/login')) {
      return json(route, ok({
        token: {
          accessToken: 'e2e-token',
          refreshToken: 'e2e-refresh-token',
        },
        user: fixtures.user,
      } as any));
    }

    if (method === 'POST' && path.endsWith('/auth/refresh')) {
      return json(route, ok({
        token: {
          accessToken: 'e2e-token',
          refreshToken: 'e2e-refresh-token',
        },
      } as any));
    }

    // 更新用户信息（设置页保存等）
    if (method === 'PUT' && path.endsWith('/user/profile')) {
      const body = tryParseJson(req.postData());
      const user = {
        ...fixtures.user,
        ...body,
        myFavoriteDishes: Array.from(favoriteDishIds),
        updatedAt: new Date().toISOString(),
      };
      return json(route, ok(user));
    }

    // 我的收藏列表
    if (method === 'GET' && path.endsWith('/user/favorites')) {
      const items = Array.from(favoriteDishIds).map((dishId, index) => {
        const dish = fixtures.dishes.find(d => d.id === dishId);
        return {
          id: `fav_${index + 1}`,
          dishId,
          dishName: dish?.name || '未知菜品',
          dishImages: dish?.images || [],
          dishPrice: dish?.price || 0,
          canteenName: dish?.canteenName || '',
          windowName: dish?.windowName || '',
          tags: dish?.tags || [],
          averageRating: dish?.averageRating || 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      });
      return json(route, ok(asPaginated(items, 1, 10)));
    }

    // 浏览历史（当前 e2e 不深测，返回空即可）
    if (method === 'GET' && path.endsWith('/user/history')) {
      return json(route, ok(asPaginated([], 1, 10)));
    }

    if (method === 'DELETE' && path.endsWith('/user/history')) {
      return json(route, ok(null));
    }

    // 我的评价（当前 e2e 不深测，返回空即可）
    if (method === 'GET' && path.endsWith('/user/reviews')) {
      return json(route, ok(asPaginated([], 1, 10)));
    }

    // 我的上传/举报（不深测，返回空）
    if (method === 'GET' && path.endsWith('/user/uploads')) {
      return json(route, ok(asPaginated([], 1, 10)));
    }

    if (method === 'GET' && path.endsWith('/user/reports')) {
      return json(route, ok(asPaginated([], 1, 10)));
    }

    // 食堂列表
    if (method === 'GET' && path.endsWith('/canteens')) {
      return json(route, ok(asPaginated(fixtures.canteens, 1, 10)));
    }

    // 食堂详情
    const canteenDetailMatch = path.match(/\/canteens\/([^/]+)$/);
    if (method === 'GET' && canteenDetailMatch) {
      const id = canteenDetailMatch[1];
      const canteen = fixtures.canteens.find((c) => c.id === id);
      if (!canteen) return json(route, { code: 404, message: 'not found', data: null as any }, 404);
      return json(route, ok(canteen));
    }

    // 窗口列表（食堂下）
    const windowsMatch = path.match(/\/canteens\/([^/]+)\/windows$/);
    if (method === 'GET' && windowsMatch) {
      const canteenId = windowsMatch[1];
      const windows = fixtures.windowsByCanteen[canteenId] || [];
      return json(route, ok(asPaginated(windows, 1, 50)));
    }

    // 窗口详情
    const windowDetailMatch = path.match(/\/windows\/([^/]+)$/);
    if (method === 'GET' && windowDetailMatch) {
      const windowId = windowDetailMatch[1];
      const allWindows = Object.values(fixtures.windowsByCanteen).flat();
      const win = allWindows.find((w) => w.id === windowId);
      if (!win) return json(route, { code: 404, message: 'not found', data: null as any }, 404);
      return json(route, ok(win));
    }

    // 窗口菜品
    const windowDishesMatch = path.match(/\/windows\/([^/]+)\/dishes$/);
    if (method === 'GET' && windowDishesMatch) {
      const windowId = windowDishesMatch[1];
      const list = fixtures.dishes.filter((d) => d.windowName === '川味窗口' && windowId === 'window_001');
      return json(route, ok(asPaginated(list, 1, 50)));
    }

    // 菜品图片
    if (method === 'GET' && path.endsWith('/dishes/images')) {
      return json(route, ok(fixtures.dishImages));
    }

    // 菜品详情
    const dishDetailMatch = path.match(/\/dishes\/([^/]+)$/);
    if (method === 'GET' && dishDetailMatch) {
      const dishId = dishDetailMatch[1];
      const dish = fixtures.dishes.find((d) => d.id === dishId);
      if (!dish) return json(route, { code: 404, message: 'not found', data: null as any }, 404);
      return json(route, ok(dish));
    }

    // 菜品收藏/取消收藏
    const dishFavoriteMatch = path.match(/\/dishes\/([^/]+)\/favorite$/);
    if (dishFavoriteMatch) {
      const dishId = dishFavoriteMatch[1];
      if (method === 'POST') {
        favoriteDishIds.add(dishId);
        return json(route, ok(null));
      }
      if (method === 'DELETE') {
        favoriteDishIds.delete(dishId);
        return json(route, ok(null));
      }
    }

    // 菜品评价列表（详情页会拉取；e2e 里默认空）
    const dishReviewsMatch = path.match(/\/dishes\/([^/]+)\/reviews$/);
    if (method === 'GET' && dishReviewsMatch) {
      return json(route, ok({ items: [], meta: { total: 0, page: 1, pageSize: 10, totalPages: 1 } } as any));
    }

    // 评论列表（默认空）
    const commentsByReviewMatch = path.match(/\/comments\/([^/]+)$/);
    if (method === 'GET' && commentsByReviewMatch) {
      return json(route, ok(asPaginated([], 1, 10)));
    }

    // 评论创建（默认成功）
    if (method === 'POST' && path.endsWith('/comments')) {
      return json(route, ok(null));
    }

    // 评价列表/创建（默认空/成功）
    if (method === 'GET' && path.endsWith('/reviews')) {
      return json(route, ok(asPaginated([], 1, 10)));
    }

    if (method === 'POST' && path.endsWith('/reviews')) {
      return json(route, ok(null));
    }

    // 新闻列表
    if (method === 'GET' && /\/news\/?$/.test(path)) {
      return json(route, ok(asPaginated(fixtures.news, 1, 10)));
    }

    // 新闻详情
    const newsDetailMatch = path.match(/\/news\/([^/]+)$/);
    if (method === 'GET' && newsDetailMatch) {
      const id = newsDetailMatch[1];
      const item = fixtures.news.find((n: any) => n.id === id);
      if (!item) return json(route, { code: 404, message: 'not found', data: null as any }, 404);
      return json(route, ok(item));
    }

    // 饮食规划列表（规划页首次加载用；e2e 里默认空）
    if (method === 'GET' && path.endsWith('/meal-plans')) {
      return json(route, ok({ items: [] }));
    }

    // 创建规划
    if (method === 'POST' && path.endsWith('/meal-plans')) {
      const body = tryParseJson(req.postData());
      const newPlan = {
        id: `plan_${Date.now()}`,
        name: body?.name || '新规划',
        description: body?.description || '',
        startDate: body?.startDate || new Date().toISOString().split('T')[0],
        endDate: body?.endDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        meals: body?.meals || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return json(route, ok(newPlan));
    }

    // 删除规划
    const deletePlanMatch = path.match(/\/meal-plans\/([^/]+)$/);
    if (method === 'DELETE' && deletePlanMatch) {
      return json(route, ok(null));
    }

    // AI：创建会话
    if (method === 'POST' && path.endsWith('/ai/sessions')) {
      return json(route, ok({ sessionId: 'e2e-ai-session', welcomeMessage: '你好，我是AI助手。' }));
    }

    // AI：建议词
    if (method === 'GET' && path.endsWith('/ai/suggestions')) {
      return json(route, ok({ suggestions: ['今天吃什么？', '帮我制定午餐计划'] }));
    }

    // AI：推荐 & 反馈（当前 e2e 不深测，返回占位）
    if (method === 'POST' && path.endsWith('/ai/recommend')) {
      return json(route, ok({ recommendation: '建议：宫保鸡丁（示例）' } as any));
    }

    if (method === 'POST' && path.endsWith('/ai/recommend/feedback')) {
      return json(route, ok(null));
    }

    // 菜品上传（默认成功）
    if (method === 'POST' && path.endsWith('/dishes/upload')) {
      return json(route, ok({ url: 'https://via.placeholder.com/300' } as any));
    }

    // 菜品列表/搜索（POST /dishes）
    if (method === 'POST' && path.endsWith('/dishes')) {
      const body = tryParseJson(req.postData());
      const keyword = body?.search?.keyword ? String(body.search.keyword) : '';
      const canteenId = Array.isArray(body?.filter?.canteenId) ? body.filter.canteenId[0] : null;

      let items = fixtures.dishes;
      if (keyword) {
        items = fixtures.dishes.filter((d) => String(d.name).includes(keyword));
      } else if (canteenId) {
        items = fixtures.dishes.filter((d) => d.canteenId === canteenId);
      }

      return json(route, ok(asPaginated(items, 1, body?.pagination?.pageSize || 50)));
    }

    // 兜底：后端请求但未覆盖时，返回“空成功”避免网络超时导致页面遮罩
    if (method === 'GET') {
      return json(route, ok(asPaginated([], 1, 10) as any));
    }
    return json(route, ok(null as any));
  };

  // 仅拦截后端域名/端口，避免影响 Vite/uni-app 的模块与静态资源加载
  await page.route('**://127.0.0.1:4523/**', handleBackend);
  await page.route('**://localhost:4523/**', handleBackend);
  await page.route('**://www.zens.top/**', handleBackend);
}
