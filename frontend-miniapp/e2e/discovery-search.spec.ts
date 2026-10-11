import { expect, test, type Page } from '@playwright/test';
import { gotoUniPage } from './helpers/uni';

type SearchFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
  actionX: number;
  actionY: number;
  fontSize: string;
  focused: boolean;
  scrollY: number;
};

async function collectSearchArrival(page: Page) {
  await page.evaluate(() => {
    (window as any).searchArrival = new Promise(resolve => {
      const frames: SearchFrame[] = [];
      let attempts = 0;
      const sample = () => {
        attempts += 1;
        const bar = document.querySelector('.search-page .discovery-search');
        if (bar) {
          const box = bar.getBoundingClientRect();
          const action = bar.querySelector('.discovery-search__action')!.getBoundingClientRect();
          const input = bar.querySelector('input')!;
          frames.push({
            x: box.x,
            y: box.y,
            width: box.width,
            height: box.height,
            actionX: action.x,
            actionY: action.y,
            fontSize: getComputedStyle(input).fontSize,
            focused: document.activeElement === input,
            scrollY: window.scrollY,
          });
        }
        if (frames.length < 18 && attempts < 120) requestAnimationFrame(sample);
        else resolve(frames);
      };
      requestAnimationFrame(sample);
    });
  });
}

async function installSearchApi(page: Page) {
  const queries: any[] = [];
  const canteenReads: string[] = [];
  const dish = {
    id: 'search-dish',
    name: '宫保鸡丁',
    price: 12,
    images: [],
    tags: [],
    canteenId: 'canteen-search',
    canteenName: '第一食堂',
    windowId: 'window-search',
    windowName: '家常菜',
    averageRating: 0,
    reviewCount: 0,
  };
  await page.route(/\/(?:canteens|dishes)(?:[/?]|$)/, async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }
    const paginated = (items: unknown[]) => ({
      items,
      meta: { page: 1, pageSize: 20, total: items.length, totalPages: 1 },
    });
    let data: unknown = paginated([]);
    if (path.endsWith('/canteens')) canteenReads.push(request.url());
    if (path.endsWith('/dishes') && request.method() === 'POST') {
      const query = request.postDataJSON();
      queries.push(query);
      data = paginated(query.search?.keyword === '宫保' ? [dish] : []);
    } else if (path.endsWith('/dishes/search-dish')) {
      data = dish;
    }
    await route.fulfill({
      headers,
      contentType: 'application/json',
      body: JSON.stringify({ code: 200, data }),
    });
  });
  return { queries, canteenReads };
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1440, height: 1000 },
]) {
  test(`visitor Home → Search has stable first-frame geometry at ${viewport.width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await installSearchApi(page);
    await gotoUniPage(page, '/pages/index/index');
    const entry = page.locator('.home-search');
    await expect(entry).toBeVisible();
    await expect(page.locator('.home-community-links')).toHaveCount(0);
    const home = await entry.evaluate(el => {
      const box = el.getBoundingClientRect();
      const action = el.querySelector('.discovery-search__action')!.getBoundingClientRect();
      return {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        actionX: action.x,
        actionY: action.y,
        fontSize: getComputedStyle(el.querySelector('.discovery-search__label')!).fontSize,
      };
    });
    await collectSearchArrival(page);
    if (viewport.width > 1000) {
      await entry.focus();
      await entry.press('Enter');
    } else {
      await entry.click();
    }
    const frames: SearchFrame[] = await page.evaluate(() => (window as any).searchArrival);
    await testInfo.attach('search-arrival-frames', {
      body: JSON.stringify({ viewport, home, frames }, null, 2),
      contentType: 'application/json',
    });
    expect(frames).toHaveLength(18);
    for (const key of ['x', 'y', 'width', 'height', 'actionX', 'actionY'] as const) {
      const maxDelta = Math.max(...frames.map(frame => Math.abs(frame[key] - home[key])));
      expect.soft(maxDelta, `${key} must not jump on arrival`).toBeLessThanOrEqual(0.5);
    }
    expect(frames.every(frame => frame.fontSize === home.fontSize)).toBe(true);
    expect(frames.every(frame => frame.scrollY === 0)).toBe(true);
    await expect(page.getByRole('searchbox', { name: '搜索菜品或食堂' })).toBeFocused();
    await expect(page).toHaveURL(/\/pages\/search\/index$/);
  });
}

test('visitor search preserves IME, Enter submission, results on return and explicit clear focus', async ({
  page,
}) => {
  const { queries } = await installSearchApi(page);
  await gotoUniPage(page, '/pages/search/index');
  const field = page.getByRole('searchbox', { name: '搜索菜品或食堂' });
  await expect(field).toBeFocused();
  await field.evaluate(input => {
    input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    (input as HTMLInputElement).value = '宫保';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true })
    );
    input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
  });
  await expect(field).toHaveValue('宫保');
  expect(queries).toHaveLength(0);
  await field.press('Enter');
  await expect(page.locator('.search-results .dish-card')).toBeVisible();
  expect(queries).toHaveLength(1);
  expect(queries[0].search.keyword).toBe('宫保');
  await expect(field).not.toBeFocused();
  await page.locator('.search-results .dish-card').click();
  await expect(page).toHaveURL(/\/pages\/dish\/index\?id=search-dish/);
  await page.goBack();
  await expect(page).toHaveURL(/\/pages\/search\/index$/);
  await expect(field).toHaveValue('宫保');
  await expect(field).not.toBeFocused();
  await expect(page.locator('.search-results .dish-card')).toBeVisible();
  expect(queries).toHaveLength(1);
  await page.getByRole('button', { name: '清空搜索' }).click();
  await expect(field).toHaveValue('');
  await expect(field).toBeFocused();
});

for (const scope of ['canteenId', 'windowId'] as const) {
  test(`visitor search keeps ${scope} in the dish query`, async ({ page }) => {
    const { queries, canteenReads } = await installSearchApi(page);
    await gotoUniPage(
      page,
      `/pages/search/index?${scope}=scoped-place&scopeName=${encodeURIComponent('家常菜')}`
    );
    const field = page.getByRole('searchbox', { name: '搜索这里的菜品' });
    await expect(page.locator('.search-scope__name')).toHaveText('家常菜');
    await expect(field).toBeFocused();
    await field.fill('宫保');
    await page.locator('.discovery-search__submit').press('Space');
    await expect(page.locator('.search-results .dish-card')).toBeVisible();
    expect(queries).toHaveLength(1);
    expect(queries[0].filter).toEqual({ [scope]: ['scoped-place'] });
    expect(canteenReads).toHaveLength(0);
  });
}
