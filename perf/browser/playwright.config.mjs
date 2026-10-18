import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";
const output = process.env.BROWSER_PHASE_DIR;
if (!output)
  throw new Error("Run through perf/frontend.mjs or perf/frontend-local.mjs");
export default defineConfig({
  testDir: ".",
  testMatch: "release.spec.mjs",
  workers: 1,
  retries: 0,
  timeout: 60000,
  expect: { timeout: 15000 },
  outputDir: resolve(output, "artifacts"),
  reporter: [
    ["list"],
    ["json", { outputFile: resolve(output, "playwright.json") }],
  ],
  use: {
    browserName: "chromium",
    headless: true,
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai",
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },
});
