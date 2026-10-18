import test from "node:test";
import assert from "node:assert/strict";
import {
  browserConfig,
  evaluateBrowserReport,
  CASES,
} from "../browser/config.mjs";
const config = browserConfig({ FRONTEND_SAMPLES: "1" });
function samples(phase) {
  return CASES.map((name) => ({
    case: name,
    sample: 0,
    phase,
    startedAt: 200,
    finishedAt: 300,
    metrics: { FCP: 100, LCP: 200, CLS: 0, readyMs: 400, actionMs: 500 },
    apiRequests: 1,
    failures: [],
  }));
}
test("page verdict requires complete samples, observed metrics and real API traffic", () => {
  const data = samples("baseline");
  assert.equal(evaluateBrowserReport(data, config, "baseline").passed, true);
  assert.equal(
    evaluateBrowserReport(data.slice(1), config, "baseline").passed,
    false,
  );
  for (const change of [
    (s) => delete s.metrics.LCP,
    (s) => (s.apiRequests = 0),
    (s) => (s.metrics.CLS = NaN),
    (s) => (s.metrics.LCP = 99999),
    (s) => s.failures.push("HTTP 500"),
  ]) {
    const bad = structuredClone(data);
    change(bad[0]);
    assert.equal(evaluateBrowserReport(bad, config, "baseline").passed, false);
  }
  assert.equal(
    evaluateBrowserReport([...data, data[0]], config, "baseline").passed,
    false,
  );
});
test("loaded measurements must lie entirely within a successful load window", () => {
  const data = samples("loaded");
  assert.equal(
    evaluateBrowserReport(data, config, "loaded", {
      startedAt: 100,
      finishedAt: 400,
      passed: true,
    }).passed,
    true,
  );
  for (const window of [
    null,
    { passed: true },
    { startedAt: 250, finishedAt: 400, passed: true },
    { startedAt: 100, finishedAt: 250, passed: true },
    { startedAt: 100, finishedAt: 400, passed: false },
  ])
    assert.equal(
      evaluateBrowserReport(data, config, "loaded", window).passed,
      false,
    );
});
test("browser configuration rejects missing observations and invalid budgets", () => {
  for (const env of [
    { FRONTEND_SAMPLES: "0" },
    { FRONTEND_LCP_MS: "NaN" },
    { FRONTEND_MODE: "mock" },
  ])
    assert.throws(() => browserConfig(env));
});

test("even sample summaries use the arithmetic middle pair", () => {
  const first = samples("baseline"),
    second = samples("baseline").map((s) => ({
      ...s,
      sample: 1,
      metrics: { ...s.metrics, FCP: 300 },
    }));
  const result = evaluateBrowserReport(
    [...first, ...second],
    browserConfig({ FRONTEND_SAMPLES: "2" }),
    "baseline",
  );
  assert.equal(result.passed, true);
  assert.equal(result.summary["client-home"].FCP.median, 200);
});
