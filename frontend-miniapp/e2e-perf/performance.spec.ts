import { test, expect } from '@playwright/test';
import { installMockApi } from '../e2e/helpers/mock-api';
import { defaultLoggedInSeed, gotoUniPage, seedUniStorage } from '../e2e/helpers/uni';
import {
  collectPerfResults,
  defaultPerfThresholds,
  installPerformanceObservers,
  installPerfResourceStubs,
} from '../e2e/helpers/perf';

test.describe('H5 性能基线（uni-app）', () => {
  test('首页：Web Vitals + Navigation Timing', async ({ page }) => {
    const thresholds = defaultPerfThresholds();

    await installPerfResourceStubs(page);
    await seedUniStorage(page, defaultLoggedInSeed);
    await installMockApi(page);
    await installPerformanceObservers(page);

    await gotoUniPage(page, '/pages/index/index');

    await expect(page.getByText('搜索食堂、窗口或菜品').first()).toBeVisible();
    await page.waitForTimeout(500);

    const perf = await collectPerfResults(page);
    console.log('[perf] home', JSON.stringify(perf, null, 2));

    expect(perf.vitals.fcpMs).toBeGreaterThan(0);

    if (typeof perf.vitals.fcpMs === 'number') {
      expect(perf.vitals.fcpMs).toBeLessThan(thresholds.fcpMs);
    }
    if (typeof perf.vitals.lcpMs === 'number') {
      expect(perf.vitals.lcpMs).toBeLessThan(thresholds.lcpMs);
    }
    if (typeof perf.vitals.cls === 'number') {
      expect(perf.vitals.cls).toBeLessThan(thresholds.cls);
    }
    if (typeof perf.vitals.tbtMs === 'number') {
      expect(perf.vitals.tbtMs).toBeLessThan(thresholds.tbtMs);
    }

    expect(perf.resources.count).toBeGreaterThan(0);
  });

  test('登录页：加载性能', async ({ page }) => {
    const thresholds = defaultPerfThresholds();

    await installPerfResourceStubs(page);
    await installMockApi(page);
    await installPerformanceObservers(page);

    await gotoUniPage(page, '/pages/login/index');

    await expect(page.getByText('微信一键登录').first()).toBeVisible();
    await page.waitForTimeout(500);

    const perf = await collectPerfResults(page);
    console.log('[perf] login', JSON.stringify(perf, null, 2));

    expect(perf.vitals.fcpMs).toBeGreaterThan(0);
    if (typeof perf.vitals.fcpMs === 'number') {
      expect(perf.vitals.fcpMs).toBeLessThan(thresholds.fcpMs);
    }
  });

  test('菜品详情页：内容加载性能', async ({ page }) => {
    const thresholds = defaultPerfThresholds();

    await installPerfResourceStubs(page);
    await seedUniStorage(page, defaultLoggedInSeed);
    await installMockApi(page);
    await installPerformanceObservers(page);

    await gotoUniPage(page, '/pages/dish/index?id=dish_001');

    await expect(page.getByText('用户评价').first()).toBeVisible();
    await page.waitForTimeout(500);

    const perf = await collectPerfResults(page);
    console.log('[perf] dish-detail', JSON.stringify(perf, null, 2));

    expect(perf.vitals.fcpMs).toBeGreaterThan(0);
    if (typeof perf.vitals.lcpMs === 'number') {
      expect(perf.vitals.lcpMs).toBeLessThan(thresholds.lcpMs);
    }
  });

  test('AI 聊天页：交互性能', async ({ page }) => {
    const thresholds = defaultPerfThresholds();

    await installPerfResourceStubs(page);
    await seedUniStorage(page, defaultLoggedInSeed);
    await installMockApi(page);
    await installPerformanceObservers(page);

    await gotoUniPage(page, '/pages/ai-chat/index');

    await expect(page.getByText('新建对话').first()).toBeVisible();
    await page.waitForTimeout(500);

    const perf = await collectPerfResults(page);
    console.log('[perf] ai-chat', JSON.stringify(perf, null, 2));

    expect(perf.vitals.fcpMs).toBeGreaterThan(0);
    if (typeof perf.vitals.tbtMs === 'number') {
      expect(perf.vitals.tbtMs).toBeLessThan(thresholds.tbtMs);
    }
  });

  test('搜索页：交互前性能基线', async ({ page }) => {
    const thresholds = defaultPerfThresholds();

    await installPerfResourceStubs(page);
    await seedUniStorage(page, defaultLoggedInSeed);
    await installMockApi(page);
    await installPerformanceObservers(page);

    await gotoUniPage(page, '/pages/search/index');
    await expect(page).toHaveURL(/\/pages\/search\/index/);
    await expect(page.locator('input').first()).toBeVisible();

    await page.waitForTimeout(500);

    const perf = await collectPerfResults(page);
    console.log('[perf] search', JSON.stringify(perf, null, 2));

    if (typeof perf.vitals.fcpMs === 'number') {
      expect(perf.vitals.fcpMs).toBeLessThan(thresholds.fcpMs);
    }
    if (typeof perf.vitals.lcpMs === 'number') {
      expect(perf.vitals.lcpMs).toBeLessThan(thresholds.lcpMs);
    }
    if (typeof perf.vitals.cls === 'number') {
      expect(perf.vitals.cls).toBeLessThan(thresholds.cls);
    }
    if (typeof perf.vitals.tbtMs === 'number') {
      expect(perf.vitals.tbtMs).toBeLessThan(thresholds.tbtMs);
    }
  });

  test('新闻详情页：内容加载性能', async ({ page }) => {
    const thresholds = defaultPerfThresholds();

    await installPerfResourceStubs(page);
    await seedUniStorage(page, defaultLoggedInSeed);
    await installMockApi(page);
    await installPerformanceObservers(page);

    await gotoUniPage(page, '/pages/news/detail?id=news_001');

    await expect(page).toHaveURL(/\/pages\/news\/detail/);
    await page.waitForTimeout(500);

    const perf = await collectPerfResults(page);
    console.log('[perf] news-detail', JSON.stringify(perf, null, 2));

    // 页面可能内容简单，不一定触发所有 vitals
    if (typeof perf.vitals.fcpMs === 'number') {
      expect(perf.vitals.fcpMs).toBeGreaterThan(0);
    }
    if (typeof perf.vitals.lcpMs === 'number') {
      expect(perf.vitals.lcpMs).toBeLessThan(thresholds.lcpMs);
    }
  });

  test('个人资料页：加载性能', async ({ page }) => {
    const thresholds = defaultPerfThresholds();

    await installPerfResourceStubs(page);
    await seedUniStorage(page, defaultLoggedInSeed);
    await installMockApi(page);
    await installPerformanceObservers(page);

    await gotoUniPage(page, '/pages/profile/index');

    await expect(page).toHaveURL(/\/pages\/profile\/index/);
    await page.waitForTimeout(500);

    const perf = await collectPerfResults(page);
    console.log('[perf] profile', JSON.stringify(perf, null, 2));

    expect(perf.vitals.fcpMs).toBeGreaterThan(0);
    if (typeof perf.vitals.fcpMs === 'number') {
      expect(perf.vitals.fcpMs).toBeLessThan(thresholds.fcpMs);
    }
  });

  test('收藏列表页：内容加载性能', async ({ page }) => {
    const thresholds = defaultPerfThresholds();

    await installPerfResourceStubs(page);
    await seedUniStorage(page, defaultLoggedInSeed);
    await installMockApi(page);
    await installPerformanceObservers(page);

    await gotoUniPage(page, '/pages/favorites/index');

    await expect(page).toHaveURL(/\/pages\/favorites\/index/);
    await page.waitForTimeout(500);

    const perf = await collectPerfResults(page);
    console.log('[perf] favorites', JSON.stringify(perf, null, 2));

    // 页面可能内容简单，不一定触发所有 vitals
    if (typeof perf.vitals.fcpMs === 'number') {
      expect(perf.vitals.fcpMs).toBeGreaterThan(0);
    }
    if (typeof perf.vitals.lcpMs === 'number') {
      expect(perf.vitals.lcpMs).toBeLessThan(thresholds.lcpMs);
    }
  });
});
