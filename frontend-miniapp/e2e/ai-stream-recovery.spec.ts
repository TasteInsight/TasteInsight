import { expect, test, type Page } from '@playwright/test';
import { defaultLoggedInSeed, gotoUniPage, seedUniStorage } from './helpers/uni';

async function installChat(
  page: Page,
  mode: 'refresh' | 'expired' | 'partial' | 'complete' | 'provider-error'
) {
  await seedUniStorage(page, {
    ...defaultLoggedInSeed,
    ...(mode === 'expired' ? { refreshToken: undefined } : {}),
  });
  const authorizations: string[] = [];
  let refreshes = 0;
  await page.route('http://127.0.0.1:4523/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (path.endsWith('/chat/stream')) {
      authorizations.push(request.headers().authorization || '');
      if (mode === 'expired' || (mode === 'refresh' && authorizations.length === 1)) {
        return route.fulfill({
          status: 401,
          headers,
          contentType: 'application/json',
          body: JSON.stringify({ code: 401 }),
        });
      }
      if (mode === 'provider-error') {
        return route.fulfill({
          headers,
          contentType: 'text/event-stream',
          body: 'event: error\ndata: {"error":"AI 服务暂时不可用"}\n\n',
        });
      }
      const reply = mode === 'partial' ? '已经生成的部分内容' : '完整回答内容';
      return route.fulfill({
        headers,
        contentType: 'text/event-stream',
        body:
          'event: message_received\ndata: {"messageId":"received"}\n\n' +
          `event: text_chunk\ndata: ${reply}\n\n` +
          (mode === 'partial' ? '' : 'event: reply_complete\ndata: {"messageId":"reply"}\n\n'),
      });
    }
    let data: any = { items: [] };
    if (path === '/auth/refresh') {
      refreshes++;
      expect(request.headers().authorization).toBe('Bearer e2e-refresh-token');
      data = { token: { accessToken: 'rotated-access', refreshToken: 'rotated-refresh' } };
    } else if (path === '/user/profile') data = defaultLoggedInSeed.userInfo;
    else if (path === '/ai/sessions') data = { sessionId: 'chat', welcomeMessage: '欢迎提问' };
    else if (path === '/ai/suggestions') data = { suggestions: [] };
    return route.fulfill({
      headers,
      contentType: 'application/json',
      body: JSON.stringify({ code: 200, data }),
    });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoUniPage(page, '/pages/ai-chat/index');
  await expect(page.getByText('欢迎提问', { exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: '消息输入', exact: true }).fill('午餐');
  await page.getByRole('button', { name: '发送消息', exact: true }).click();
  return { authorizations, getRefreshCount: () => refreshes };
}

test('a stream refreshes credentials once and displays one complete answer', async ({ page }) => {
  const result = await installChat(page, 'refresh');
  await expect(page.getByText('完整回答内容', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '发送消息', exact: true })).toBeVisible();
  expect(result.authorizations).toEqual(['Bearer e2e-token', 'Bearer rotated-access']);
  expect(result.getRefreshCount()).toBe(1);
  await expect(page.locator('.chat-message-status')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBe('rotated-access');
});

test('an expired stream returns to its guest state without navigating away', async ({ page }) => {
  const result = await installChat(page, 'expired');
  await expect(page.getByText('登录后使用 AI 助手', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/#\/pages\/ai-chat\/index$/);
  expect(result.authorizations).toHaveLength(1);
  expect(result.getRefreshCount()).toBe(0);
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();
});

test('premature EOF preserves the reply with an interrupted status', async ({ page }) => {
  await installChat(page, 'partial');
  await expect(page.getByText('已经生成的部分内容', { exact: true })).toBeVisible();
  await expect(page.getByText('回复已中断', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '发送消息', exact: true })).toBeVisible();
  await expect(page.locator('.chat-bubble-ai').last()).toHaveText('已经生成的部分内容');
});

test('an explicit completion keeps the answer free of interruption feedback', async ({ page }) => {
  await installChat(page, 'complete');
  await expect(page.getByText('完整回答内容', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '发送消息', exact: true })).toBeVisible();
  await expect(page.locator('.chat-message-status')).toHaveCount(0);
});

test('a provider stream error preserves the user login and never refreshes it', async ({
  page,
}) => {
  const result = await installChat(page, 'provider-error');
  await expect(page.getByText('回复失败，请稍后重试', { exact: true })).toBeVisible();
  expect(result.authorizations).toHaveLength(1);
  expect(result.getRefreshCount()).toBe(0);
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBe('e2e-token');
  await expect(page.getByText('登录后使用 AI 助手', { exact: true })).toHaveCount(0);
});
