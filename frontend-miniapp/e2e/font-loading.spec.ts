import { expect, test } from '@playwright/test';
import { installMockApi } from './helpers/mock-api';
import { gotoUniPage } from './helpers/uni';

test('application and Uni UI icon fonts load from the published assets', async ({ page }) => {
  await installMockApi(page);
  await gotoUniPage(page, '/pages/search/index');
  await expect(page.locator('.uni-icons').first()).toBeVisible();
  const fonts = await page.evaluate(async () => {
    const results = await Promise.all([
      document.fonts.load('16px iconfont'),
      document.fonts.load('20px uniicons'),
    ]);
    return results.map(faces => faces.map(face => ({ family: face.family, status: face.status })));
  });
  expect(fonts).toEqual([
    [expect.objectContaining({ family: 'iconfont', status: 'loaded' })],
    [expect.objectContaining({ family: 'uniicons', status: 'loaded' })],
  ]);
});
