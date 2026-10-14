import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { chromium } from "@playwright/test";
import { metricsScript } from "../browser/metrics.mjs";
test("production collector observes actual Chromium paints and zero layout shift", async () => {
  const server = createServer((req, res) => {
    res.setHeader("Content-Type", "text/html");
    res.end(
      "<!doctype html><html><body><h1>Measured paint</h1><button>Interact</button></body></html>",
    );
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await chromium.launch();
    const page = await browser.newPage();
    await page.addInitScript({ content: metricsScript });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.waitForFunction(() =>
      ["FCP", "LCP", "CLS"].every((k) =>
        Number.isFinite(window.__releaseVitals[k]),
      ),
    );
    await page.getByRole("button").click();
    const metrics = await page.evaluate(() => window.__releaseVitals);
    assert.ok(metrics.FCP > 0);
    assert.ok(metrics.LCP >= metrics.FCP);
    assert.equal(metrics.CLS, 0);
  } finally {
    await browser?.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("real browser tracking waits for a slow failing API response", async () => {
  const { observeTraffic } = await import("../browser/traffic.mjs");
  const server = createServer((req, res) => {
    if (req.url === "/api/v1/slow") {
      setTimeout(() => {
        res.writeHead(500, { "content-type": "application/json" });
        res.end('{"code":500}');
      }, 600);
    } else {
      res.setHeader("content-type", "text/html");
      res.end("<h1>Ready</h1>");
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await chromium.launch();
    const page = await browser.newPage();
    const origin = `http://127.0.0.1:${server.address().port}`;
    const traffic = observeTraffic(page, origin);
    await page.goto(origin);
    await page.evaluate(() => {
      void fetch("/api/v1/slow");
    });
    const start = Date.now(),
      result = await traffic.finish(2000);
    assert.ok(Date.now() - start >= 500);
    assert.equal(result.apiRequests, 1);
    assert.match(result.failures.join(), /HTTP 500/);
  } finally {
    await browser?.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
