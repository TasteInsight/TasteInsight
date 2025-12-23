import type { Page } from '@playwright/test';

export type UniStorageSeed = {
  token: string;
  refreshToken?: string;
  userInfo?: Record<string, unknown>;
};

export function uniHashRoute(pagePath: string): string {
  // uni-app H5 常见路由：/#/pages/xxx/index
  const normalized = pagePath.startsWith('/') ? pagePath : `/${pagePath}`;
  return `/#${normalized}`;
}

export async function seedUniStorage(page: Page, seed: UniStorageSeed): Promise<void> {
  // 关键点：App.vue 会在 onLaunch 里检查登录态并可能 reLaunch 到登录页。
  // 因此必须在“首次加载应用代码之前”就把 token 写入 storage。
  await page.addInitScript((data: UniStorageSeed) => {
    localStorage.setItem('token', data.token);
    if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
    if (data.userInfo) localStorage.setItem('userInfo', JSON.stringify(data.userInfo));
  }, seed);
}

export async function gotoUniPage(page: Page, pagePath: string): Promise<void> {
  await page.goto(uniHashRoute(pagePath));
}

export const defaultLoggedInSeed: UniStorageSeed = {
  token: 'e2e-token',
  refreshToken: 'e2e-refresh-token',
  userInfo: {
    id: 'e2e-user',
    openId: 'e2e-openid',
    nickname: 'E2E用户',
    avatar: '/static/images/default-avatar.png',
    settings: {
      displaySettings: {
        sortBy: 'rating',
      },
    },
  },
};
