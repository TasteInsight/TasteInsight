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
});
