import { test, expect } from '@playwright/test';
import { campusOAuthPage } from '../../backend/src/campus-identity/campus-oauth-page';

const code = 'a'.repeat(43);
const csp =
  "default-src 'none'; script-src 'nonce-browser-test'; style-src 'nonce-browser-test'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

for (const width of [1280, 375]) {
  test(`callback confirmation preserves account identity and requires an explicit handoff at ${width}px`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await context.route('https://app.example/**', route =>
      route.fulfill({
        contentType: 'text/html; charset=utf-8',
        body: '<button id="open">校园认证</button><script>window.received = null; window.addEventListener("message", event => { window.received = { origin: event.origin, data: event.data }; }); document.getElementById("open").onclick = () => window.open("https://api.example/callback");</script>',
      })
    );
    await context.route('https://api.example/**', route =>
      route.fulfill({
        contentType: 'text/html',
        headers: {
          'Content-Security-Policy': csp,
          'Cache-Control': 'no-store',
          'Referrer-Policy': 'no-referrer',
        },
        body: campusOAuthPage('browser-test', {
          attemptId: 'attempt-a',
          handoffCode: code,
          handoffExpiresAt: new Date(Date.now() + 180000).toISOString(),
          clientOrigin: 'https://app.example',
          account: {
            id: 'account-alice-012345678901234567890',
            nickname: '同学 <script>alert(1)</script>',
            phone: '+86****5678',
          },
        }),
      })
    );
    await page.goto('https://app.example');
    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.getByRole('button', { name: '校园认证' }).click(),
    ]);
    await popup.setViewportSize({ width, height: 900 });
    await expect(popup.getByRole('heading', { name: '确认学生身份绑定' })).toBeVisible();
    await expect(
      popup.getByText('account-alice-012345678901234567890', { exact: true })
    ).toBeVisible();
    await expect(popup.getByLabel('一次性确认码')).not.toBeVisible();
    expect(await page.evaluate(() => (window as any).received)).toBeNull();
    await popup.getByRole('button', { name: '确认此账号，返回食鉴绑定' }).click();
    await expect(popup.getByLabel('一次性确认码')).toHaveValue(code);
    await expect
      .poll(() => page.evaluate(() => (window as any).received))
      .toEqual({
        origin: 'https://api.example',
        data: { type: 'tasteinsight:campus-oauth', attemptId: 'attempt-a', handoffCode: code },
      });
    expect(
      await popup.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    ).toBe(true);
    await popup.screenshot({
      path: test.info().outputPath(`callback-${width}.png`),
      fullPage: true,
    });
    await popup.close();
  });
}

test('forwarding the callback to a different opener origin cannot send the confirmation code to it', async ({
  page,
  context,
}) => {
  await context.route('https://attacker.example/**', route =>
    route.fulfill({
      contentType: 'text/html',
      body: '<button id="open">Open</button><script>window.received = null; window.addEventListener("message", event => window.received = event.data); document.getElementById("open").onclick = () => { window.authWindow = window.open("https://api.example/callback"); };</script>',
    })
  );
  await context.route('https://api.example/**', route =>
    route.fulfill({
      contentType: 'text/html',
      headers: { 'Content-Security-Policy': csp },
      body: campusOAuthPage('browser-test', {
        attemptId: 'attempt-a',
        handoffCode: code,
        handoffExpiresAt: new Date(Date.now() + 180000).toISOString(),
        clientOrigin: 'https://app.example',
        account: { id: 'attacker-account', nickname: '陌生账号' },
      }),
    })
  );
  await page.goto('https://attacker.example');
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('button', { name: 'Open', exact: true }).click(),
  ]);
  await popup.getByRole('button', { name: '确认此账号，返回食鉴绑定' }).click();
  await expect(popup.getByLabel('一次性确认码')).toBeVisible();
  expect(await page.evaluate(() => (window as any).received)).toBeNull();
  expect(
    await page.evaluate(() => {
      try {
        return (window as any).authWindow.document.getElementById('code').value;
      } catch (error) {
        return (error as Error).name;
      }
    })
  ).toBe('SecurityError');
});
