import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { observeTraffic } from "../browser/traffic.mjs";
import { readinessReader } from "../browser/readiness.mjs";
test("readiness requires the exact execution marker, handles split chunks and notifies once", () => {
  const results = [],
    read = readinessReader("run-id", (value) => results.push(value));
  read("__PERF_READY__other:1792000000000!");
  read("__PERF_READY__run-");
  read("id:1792000");
  read("000000!");
  read("__PERF_READY__run-id:1792000000000!");
  assert.equal(results.length, 1);
  assert.equal(results[0].scheduledEndAt, 1792000000000);
  assert.ok(results[0].startedAt > 0);
});
test("unfinished requests and deferred business failures cannot produce a green sample", async () => {
  const page = new EventEmitter(),
    request = { url: () => "http://localhost/api/v1/dishes" };
  const traffic = observeTraffic(page, "http://localhost");
  page.emit("request", request);
  assert.match((await traffic.finish(30)).failures.join(), /unfinished/);
  const next = new EventEmitter(),
    other = observeTraffic(next, "http://localhost");
  let body;
  const pending = new Promise((resolve) => (body = resolve));
  next.emit("request", request);
  next.emit("response", {
    url: request.url,
    status: () => 200,
    json: () => pending,
  });
  next.emit("requestfinished", request);
  const done = other.finish(1000);
  setTimeout(() => body({ code: 500 }), 40);
  const result = await done;
  assert.equal(result.apiRequests, 1);
  assert.match(result.failures.join(), /business 500/);
});
