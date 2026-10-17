import test from "node:test";
import assert from "node:assert/strict";
import { readConfig, buildOptions } from "../config.mjs";
import { evaluateSummary } from "../verdict.mjs";
import { journeyNames } from "../k6/journeys.js";
const config = readConfig({
  PUBLIC_BASE_URL: "http://localhost:3000",
  ADMIN_BASE_URL: "http://localhost:3001",
  FIXTURES_FILE: "fixtures.json",
});
function successfulSummary() {
  return {
    metrics: Object.fromEntries(
      Object.entries(buildOptions(config, journeyNames).thresholds).map(
        ([metric, rules]) => [
          metric,
          {
            values: { count: 1 },
            thresholds: Object.fromEntries(
              rules.map((rule) => [rule, { ok: true }]),
            ),
          },
        ],
      ),
    ),
  };
}
test("all configured thresholds and completed workflows are required", () => {
  assert.equal(evaluateSummary(successfulSummary(), config, 0).passed, true);
  assert.equal(evaluateSummary({}, config, 0).passed, false);
  const missing = successfulSummary();
  delete missing.metrics.business_success;
  assert.equal(evaluateSummary(missing, config, 0).passed, false);
  const empty = successfulSummary();
  empty.metrics["journeys_completed{journey:uploads}"].values.count = 0;
  assert.equal(evaluateSummary(empty, config, 0).passed, false);
});
test("failed checks, runner exit and interruption override apparent success", () => {
  const failed = successfulSummary();
  failed.metrics["checks{phase:workload}"].thresholds["rate>=1"].ok = false;
  assert.equal(evaluateSummary(failed, config, 0).passed, false);
  assert.equal(evaluateSummary(successfulSummary(), config, 99).passed, false);
  assert.equal(
    evaluateSummary(successfulSummary(), config, 0, true).passed,
    false,
  );
});

test("interrupted iterations fail even when k6 exits zero and every threshold is green", () => {
  const report = successfulSummary();
  report.metrics.journeys_started.values.count = 5;
  report.metrics.journeys_finished.values.count = 1;
  const verdict = evaluateSummary(report, config, 0);
  assert.equal(verdict.passed, false);
  assert.ok(verdict.failedMetrics.includes("unfinished business iterations"));
});
