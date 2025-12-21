import type { Page } from '@playwright/test';

const ONE_BY_ONE_PNG_BASE64 =
  // 透明 1x1 PNG
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/ax0f7cAAAAASUVORK5CYII=';

export type PerfThresholds = {
  fcpMs: number;
  lcpMs: number;
  cls: number;
  tbtMs: number;
};

export type PerfResults = {
  url: string;
  timing: {
    ttfbMs?: number;
    domContentLoadedMs?: number;
    loadMs?: number;
  };
  vitals: {
    fpMs?: number;
    fcpMs?: number;
    lcpMs?: number;
    cls?: number;
    tbtMs?: number;
    longTasks?: Array<{ startTime: number; duration: number }>;
  };
  resources: {
    count: number;
    totalTransferSize: number;
    totalEncodedBodySize: number;
  };
  memory?: {
    usedJSHeapSize?: number;
    totalJSHeapSize?: number;
    jsHeapSizeLimit?: number;
  };
};

export async function installPerfResourceStubs(page: Page): Promise<void> {
  // 避免外部网络波动影响性能数据（mock 数据里用到了 placeholder 图片）
  await page.route('https://via.placeholder.com/**', async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
      body: Buffer.from(ONE_BY_ONE_PNG_BASE64, 'base64'),
    });
  });
}

export async function installPerformanceObservers(page: Page): Promise<void> {
  // 需要在应用代码执行前注入
  await page.addInitScript(() => {
    const w = window as any;

    w.__perf = {
      fpMs: undefined as number | undefined,
      fcpMs: undefined as number | undefined,
      lcpMs: undefined as number | undefined,
      cls: 0,
      tbtMs: 0,
      longTasks: [] as Array<{ startTime: number; duration: number }>,
    };

    const safeObserver = (type: string, cb: (entries: PerformanceEntryList) => void) => {
      try {
        const obs = new PerformanceObserver((list) => cb(list));
        // @ts-expect-error: type is string at runtime
        obs.observe({ type, buffered: true });
        return obs;
      } catch {
        return null;
      }
    };

    // FP / FCP
    safeObserver('paint', (list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === 'first-paint') w.__perf.fpMs = entry.startTime;
        if (entry.name === 'first-contentful-paint') w.__perf.fcpMs = entry.startTime;
      }
    });

    // LCP
    safeObserver('largest-contentful-paint', (list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1] as any;
      if (last) w.__perf.lcpMs = last.startTime;
    });

    // CLS
    safeObserver('layout-shift', (list) => {
      for (const entry of list.getEntries() as any[]) {
        if (entry?.hadRecentInput) continue;
        w.__perf.cls += entry?.value ?? 0;
      }
    });

    // Long Tasks -> 近似 TBT（超过 50ms 的部分累加）
    safeObserver('longtask', (list) => {
      for (const entry of list.getEntries() as any[]) {
        const duration = Number(entry?.duration ?? 0);
        const startTime = Number(entry?.startTime ?? 0);
        w.__perf.longTasks.push({ startTime, duration });
        if (duration > 50) w.__perf.tbtMs += duration - 50;
      }
    });
  });
}

export async function collectPerfResults(page: Page): Promise<PerfResults> {
  const results = await page.evaluate(() => {
    const w = window as any;

    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;

    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const totalTransferSize = resources.reduce((sum, r) => sum + (r.transferSize || 0), 0);
    const totalEncodedBodySize = resources.reduce((sum, r) => sum + (r.encodedBodySize || 0), 0);

    const memory = (performance as any).memory
      ? {
          usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
          totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
          jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit,
        }
      : undefined;

    return {
      url: location.href,
      timing: {
        ttfbMs: nav ? nav.responseStart : undefined,
        domContentLoadedMs: nav ? nav.domContentLoadedEventEnd : undefined,
        loadMs: nav ? nav.loadEventEnd : undefined,
      },
      vitals: {
        fpMs: w.__perf?.fpMs,
        fcpMs: w.__perf?.fcpMs,
        lcpMs: w.__perf?.lcpMs,
        cls: w.__perf?.cls,
        tbtMs: w.__perf?.tbtMs,
        longTasks: w.__perf?.longTasks ?? [],
      },
      resources: {
        count: resources.length,
        totalTransferSize,
        totalEncodedBodySize,
      },
      memory,
    };
  });

  return results as PerfResults;
}

export function defaultPerfThresholds(): PerfThresholds {
  const num = (name: string, fallback: number) => {
    const raw = process.env[name];
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  return {
    // 默认阈值偏“稳健”，避免不同机器/CI 波动导致误报
    fcpMs: num('PERF_FCP_MS', 3000),
    lcpMs: num('PERF_LCP_MS', 4500),
    cls: num('PERF_CLS', 0.1),
    tbtMs: num('PERF_TBT_MS', 500),
  };
}
