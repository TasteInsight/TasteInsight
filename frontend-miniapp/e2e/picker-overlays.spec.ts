import { expect, test, type Locator, type Page } from '@playwright/test';
import { defaultLoggedInSeed, gotoUniPage, seedUniStorage } from './helpers/uni';

async function installPlanningApi(page: Page, firstCanteenName = '第一食堂') {
  await seedUniStorage(page, defaultLoggedInSeed);
  const requests: { method: string; path: string; body: any }[] = [];
  const canteens = [
    { id: 'c1', name: firstCanteenName },
    { id: 'c2', name: '第二食堂' },
  ];
  const dishes = canteens.map((canteen, index) => ({
    id: `d${index + 1}`,
    name: index ? '香菇青菜' : '番茄炒蛋',
    price: 8,
    canteenId: canteen.id,
    canteenName: canteen.name,
    windowId: `w${index + 1}`,
    windowName: '家常菜窗口',
    images: [],
    tags: [],
    availableMealTime: ['lunch', 'dinner'],
  }));
  const plans: any[] = [];
  const paginated = (items: any[]) => ({
    items,
    meta: { page: 1, pageSize: 50, total: items.length, totalPages: 1 },
  });
  await page.route(
    /\/(?:meal-plans|canteens|windows|dishes|user\/profile)(?:[/?]|$)/,
    async route => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      const method = request.method();
      const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      };
      if (method === 'OPTIONS') return route.fulfill({ status: 204, headers });
      const body = request.postData() ? request.postDataJSON() : null;
      requests.push({ method, path, body });
      let data: any;
      let code = 200;
      if (path === '/user/profile') data = defaultLoggedInSeed.userInfo;
      else if (path === '/meal-plans') {
        if (method === 'POST') {
          code = 201;
          data = { id: 'new-plan', ...body, createdAt: new Date().toISOString() };
          plans.push(data);
        } else data = { items: plans };
      } else if (path === '/canteens') data = paginated(canteens);
      else if (/\/canteens\/c[12]$/.test(path))
        data = canteens.find(canteen => path.endsWith(`/${canteen.id}`));
      else if (/\/canteens\/c[12]\/windows$/.test(path)) {
        data = paginated([
          {
            id: path.includes('/c1/') ? 'w1' : 'w2',
            name: '家常菜窗口',
            floor: { level: '1', name: '一楼' },
          },
        ]);
      } else if (/\/windows\/w[12]$/.test(path)) {
        data = {
          id: path.split('/').pop(),
          name: '家常菜窗口',
          floor: { level: '1', name: '一楼' },
        };
      } else if (path === '/dishes')
        data = paginated(
          dishes.filter(
            dish =>
              (!body.filter?.canteenId?.length || body.filter.canteenId.includes(dish.canteenId)) &&
              (!body.filter?.windowId?.length || body.filter.windowId.includes(dish.windowId))
          )
        );
      else if (/\/dishes\/d[12]$/.test(path))
        data = dishes.find(dish => path.endsWith(`/${dish.id}`));
      else return route.fallback();
      await route.fulfill({
        headers,
        contentType: 'application/json',
        body: JSON.stringify({ code, data }),
      });
    }
  );
  return requests;
}

const popup = (page: Page) => page.locator('.uni-picker-container:visible');

async function selectChoice(page: Page, text: string, mobile: boolean) {
  const panel = popup(page);
  await expect(panel).toBeVisible();
  if (mobile) {
    const item = panel
      .locator('.uni-picker-content .uni-picker-item')
      .filter({ hasText: new RegExp(`^${text}$`) });
    await item.click();
    await expect
      .poll(async () => {
        const itemBox = (await item.boundingBox())!;
        const contentBox = (await panel.locator('.uni-picker-content').boundingBox())!;
        return Math.abs(itemBox.y + itemBox.height / 2 - contentBox.y - contentBox.height / 2);
      })
      .toBeLessThan(1);
    await panel.locator('.uni-picker-action-confirm').click();
  } else {
    await panel
      .locator('.uni-picker-select .uni-picker-item')
      .filter({ hasText: new RegExp(`^${text}$`) })
      .click();
  }
  await expect(panel).toHaveCount(0);
}

async function fieldMetrics(field: Locator) {
  return field.evaluate(el => {
    const style = getComputedStyle(el);
    return {
      font: style.fontSize,
      lineHeight: style.lineHeight,
      padding: style.padding,
      radius: style.borderRadius,
    };
  });
}

test('date picker remains hidden and compact across desktop/mobile viewport changes', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await installPlanningApi(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await gotoUniPage(page, '/pages/planning/index');
  for (const width of [1280, 390, 1280, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator('.calendar-date-picker')).toHaveCSS('height', '44px');
    await expect(page.locator('.uni-picker-custom:visible')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true
    );
  }
  await page.locator('.calendar-date-picker').click();
  await expect(popup(page).locator('uni-picker-view-column')).toHaveCount(3);
  await popup(page).locator('.uni-picker-action-confirm').click();
  await expect(popup(page)).toHaveCount(0);
  await expect(page.locator('.calendar-date-picker')).toHaveCSS('height', '44px');
  expect(errors).toEqual([]);
});

for (const width of [390, 1280]) {
  test(`planning pickers stay above the editor and preserve selection at ${width}px`, async ({
    page,
  }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const requests = await installPlanningApi(page);
    await page.setViewportSize({ width, height: 900 });
    await gotoUniPage(page, '/pages/planning/index');
    await page.getByLabel('新建规划', { exact: true }).click();
    const editor = page.getByRole('dialog', { name: '新建规划', exact: true });
    const canteen = editor.getByLabel('选择食堂', { exact: true });
    await expect(canteen.locator('.plan-select')).toHaveCSS('border-top-width', '0px');
    await expect(canteen.locator('.plan-select')).toHaveCSS('height', '44px');
    expect((await canteen.boundingBox())!.width).toBeLessThan(
      (await editor.boundingBox())!.width / 2
    );
    await canteen.click();
    await expect(popup(page)).toHaveCSS('z-index', '11000');
    await expect(popup(page).locator('.uni-picker-custom')).toHaveCSS(
      'background-color',
      'rgb(255, 255, 255)'
    );
    await expect(popup(page).locator('.uni-picker-custom')).toHaveCSS('border-top-width', '0px');
    await selectChoice(page, '第二食堂', width < 500);
    await expect(canteen).toContainText('第二食堂');
    expect(requests.some(request => request.path === '/canteens/c2/windows')).toBe(true);
    await canteen.click();
    if (width >= 500)
      await expect(popup(page).locator('.uni-picker-select .selected')).toHaveText('第二食堂');
    else {
      await popup(page)
        .locator('.uni-picker-content .uni-picker-item')
        .getByText('第一食堂', { exact: true })
        .click();
      await popup(page).locator('.uni-picker-action-cancel').click();
      await expect(popup(page)).toHaveCount(0);
      await expect(canteen).toContainText('第二食堂');
      await canteen.click();
      const choice = popup(page)
        .locator('.uni-picker-content .uni-picker-item')
        .filter({ hasText: /^第二食堂$/ });
      await expect
        .poll(async () => {
          const item = (await choice.boundingBox())!;
          const wheel = (await popup(page).locator('.uni-picker-content').boundingBox())!;
          return Math.abs(item.y + item.height / 2 - wheel.y - wheel.height / 2);
        })
        .toBeLessThan(1);
    }
    await page.screenshot({
      path: testInfo.outputPath('canteen-picker.png'),
      animations: 'disabled',
    });
    await popup(page)
      .locator('.uni-picker-mask')
      .click({ position: { x: 5, y: 5 } });
    await expect(popup(page)).toHaveCount(0);
    await expect(editor).toBeVisible();
    await expect(canteen).toContainText('第二食堂');
    await editor.getByLabel('选择窗口', { exact: true }).click();
    await selectChoice(page, '家常菜窗口', width < 500);
    await expect(editor.locator('.plan-result')).toHaveCount(1);
    await expect(editor.locator('.plan-result')).toContainText('香菇青菜');
    await editor.locator('.plan-result').click();
    await expect(editor.locator('.plan-selected-dish')).toContainText('香菇青菜');
    await editor.getByLabel('关闭规划').click();
    await expect(page.locator('uni-modal')).toHaveCSS('z-index', '12000');
    await page.locator('uni-modal .uni-modal__btn_default').click();
    await expect(page.locator('uni-modal')).toBeHidden();
    await expect(editor).toBeVisible();
    await editor.getByTestId('plan-save').click();
    await expect(editor).toBeHidden();
    expect(
      requests
        .filter(request => request.path === '/meal-plans' && request.method === 'POST')
        .map(request => request.body.dishes)
    ).toEqual([['d2']]);
    expect(errors).toEqual([]);
  });
}

test('catalogue filter keeps long canteen names and arrow within a narrow editor', async ({
  page,
}) => {
  const longName = '第一食堂北区学生餐厅清淡家常菜与时令蔬菜供应专区';
  await installPlanningApi(page, longName);
  await page.setViewportSize({ width: 320, height: 844 });
  await gotoUniPage(page, '/pages/planning/index');
  await page.getByLabel('新建规划', { exact: true }).click();
  const editor = page.getByRole('dialog', { name: '新建规划', exact: true });
  const canteen = editor.getByLabel('选择食堂', { exact: true });
  await canteen.click();
  await expect(popup(page).locator('.uni-picker-action-confirm')).toBeVisible();
  await popup(page).locator('.uni-picker-action-confirm').click();
  await expect(popup(page)).toHaveCount(0);
  await expect(canteen.locator('.plan-select-label')).toHaveText(longName);
  await expect(canteen.locator('.plan-select-label')).toHaveCSS('text-overflow', 'ellipsis');
  const bounds = await canteen.boundingBox();
  const arrow = await canteen.locator('.plan-select-icon').boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
  expect(arrow!.x + arrow!.width).toBeLessThanOrEqual(bounds!.x + bounds!.width);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const width of [390, 1280]) {
  test(`window browsing and input focus keep their different affordances at ${width}px`, async ({
    page,
  }, testInfo) => {
    const requests = await installPlanningApi(page);
    await page.setViewportSize({ width, height: 844 });
    await gotoUniPage(page, '/pages/canteen/index?id=c1');
    const windowEntry = page.getByLabel('浏览家常菜窗口', { exact: true });
    await expect(windowEntry).toBeVisible();
    await expect(windowEntry).toHaveCSS('border-top-width', '0px');
    expect(await windowEntry.evaluate(el => getComputedStyle(el, '::after').borderTopWidth)).toBe(
      '0px'
    );
    expect((await windowEntry.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await expect(windowEntry.locator('.canteen-window-floor')).toHaveText('一楼');
    await page.screenshot({
      path: testInfo.outputPath('window-entries.png'),
      animations: 'disabled',
    });
    await windowEntry.click();
    await expect(page).toHaveURL(/\/pages\/window\/index\?id=w1$/);
    await expect(page.locator('.window-header')).toContainText('家常菜窗口');
    await gotoUniPage(page, '/pages/settings/components/preferences');
    const field = page.locator('#price-min');
    const input = field.locator('input');
    await expect(input).toBeVisible();
    const before = await field.boundingBox();
    const value = await input.inputValue();
    await input.focus();
    await expect(field).toHaveCSS('border-top-color', 'rgb(102, 8, 116)');
    await expect(field).toHaveCSS('outline-width', '2px');
    await expect(field).toHaveCSS('outline-offset', '-2px');
    expect(await field.boundingBox()).toEqual(before);
    await page.screenshot({ path: testInfo.outputPath('field-focus.png'), animations: 'disabled' });
    await page.getByText('价格范围', { exact: true }).click();
    await expect(field).toHaveCSS('outline-style', 'none');
    await expect(field).toHaveCSS('border-top-width', '1px');
    expect(await input.inputValue()).toBe(value);
    expect(await field.boundingBox()).toEqual(before);
    expect(
      requests.some(request => request.path === '/user/profile' && request.method === 'PUT')
    ).toBe(false);
  });
}

test('list filter stays lightweight while sharing typography and selector colors with settings', async ({
  page,
}) => {
  await installPlanningApi(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoUniPage(page, '/pages/planning/index');
  await page.getByRole('tab', { name: '列表', exact: true }).click();
  const filter = page.locator('.planning-filter');
  const metrics = await fieldMetrics(filter);
  await expect(filter).toHaveCSS('border-top-width', '0px');
  await expect(filter).toHaveCSS('min-height', '44px');
  await expect(filter).toHaveCSS('font-weight', '600');
  await page.getByLabel('选择列表范围').click();
  await selectChoice(page, '历史规划', true);
  await expect(page.locator('.planning-filter')).toContainText('历史规划');
  await gotoUniPage(page, '/pages/settings/components/display');
  const field = page.locator('.settings-field');
  await expect(field).toBeVisible();
  expect(await fieldMetrics(field)).toMatchObject({
    font: metrics.font,
    lineHeight: metrics.lineHeight,
  });
  const save = page.locator('.settings-save-bar .settings-button');
  await expect(save).toHaveAttribute('aria-disabled', 'true');
  await expect(save).toHaveCSS('background-color', 'rgb(244, 244, 245)');
  await expect(page.getByText('暂无修改', { exact: true })).toHaveCount(0);
  await field.click();
  await expect(popup(page).locator('.uni-picker-action-confirm')).toHaveCSS(
    'color',
    'rgb(102, 8, 116)'
  );
  await selectChoice(page, '评价最多', true);
  await expect(save).toHaveAttribute('aria-disabled', 'false');
  await expect(save).toHaveCSS('background-color', 'rgb(102, 8, 116)');
});

test('home retry uses the shared error action and reloads recommendations', async ({
  page,
}, testInfo) => {
  let dishReads = 0;
  await page.route(/\/(?:canteens|dishes)(?:[/?]|$)/, async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const isDishes = path === '/dishes';
    if (isDishes) dishReads += 1;
    const code = isDishes && dishReads === 1 ? 503 : 200;
    const items =
      isDishes && code === 200
        ? [
            {
              id: 'retry-dish',
              name: '番茄炒蛋',
              price: 8,
              images: [],
              tags: [],
              canteenId: 'c1',
              canteenName: '第一食堂',
              windowName: '家常菜窗口',
            },
          ]
        : [];
    await route.fulfill({
      status: code,
      headers,
      contentType: 'application/json',
      body: JSON.stringify({
        code,
        message: code === 503 ? '暂时不可用' : 'success',
        data: { items, meta: { page: 1, pageSize: 20, total: items.length, totalPages: 1 } },
      }),
    });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoUniPage(page, '/pages/index/index');
  const retry = page.locator('.error-feedback__action').filter({ hasText: '重新加载' });
  await expect(retry).toBeVisible();
  await expect(retry).toHaveCSS('border-top-width', '0px');
  expect(await retry.evaluate(el => getComputedStyle(el, '::after').borderTopWidth)).toBe('0px');
  expect((await retry.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await page.screenshot({ path: testInfo.outputPath('home-retry.png'), animations: 'disabled' });
  await retry.click();
  await expect(page.locator('.dish-card').filter({ hasText: '番茄炒蛋' })).toBeVisible();
  await expect(retry).toHaveCount(0);
  expect(dishReads).toBe(2);
});
