import test from "node:test";
import assert from "node:assert/strict";
import {
  readConfig,
  validateManifest,
  joinUrl,
  buildOptions,
} from "../config.mjs";
const env = {
  PUBLIC_BASE_URL: "https://api.example.invalid/api/v1",
  ADMIN_BASE_URL: "https://admin.example.invalid/api/v1",
  FIXTURES_FILE: "fixtures.json",
};
test("targets are explicit, normalized, preserve prefixes and reject unsafe URL forms", () => {
  assert.throws(
    () => readConfig({ FIXTURES_FILE: "fixtures.json" }),
    /PUBLIC_BASE_URL/,
  );
  for (const bad of [
    "ftp://api.example.invalid",
    "https://a:b@api.example.invalid",
    "https://api.example.invalid?x=y",
    "https://api.example.invalid/#x",
  ])
    assert.throws(() => readConfig({ ...env, PUBLIC_BASE_URL: bad }));
  const c = readConfig({
    ...env,
    PUBLIC_BASE_URL: " https://api.example.invalid/api/v1/// ",
  });
  assert.equal(
    joinUrl(c.publicBaseUrl, "/auth/refresh"),
    "https://api.example.invalid/api/v1/auth/refresh",
  );
});
test("profiles validate bounds and account for arrival-rate drops", () => {
  assert.throws(() => readConfig({ ...env, PROFILE: "production" }), /PROFILE/);
  assert.throws(() => readConfig({ ...env, MAX_VUS: "0" }), /MAX_VUS/);
  assert.throws(() => readConfig({ ...env, DURATION: "garbage" }), /DURATION/);
  for (const profile of ["smoke", "load", "stress", "soak"]) {
    const options = buildOptions(readConfig({ ...env, PROFILE: profile }), [
      "browsing",
      "posting",
    ]);
    assert.ok(options.thresholds["journeys_completed{journey:browsing}"]);
    assert.ok(options.thresholds["checks{phase:workload}"]);
    if (profile !== "smoke")
      assert.deepEqual(options.thresholds.dropped_iterations, ["count==0"]);
  }
});
test("manifest mismatch, expiry and insufficient identities fail before requests", () => {
  const c = readConfig(env);
  const m = {
    version: 1,
    state: "ready",
    runId: "perf_0123456789abcdef",
    publicBaseUrl: c.publicBaseUrl,
    adminBaseUrl: c.adminBaseUrl,
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    slots: [],
  };
  assert.throws(() => validateManifest(m, c), /identity pool/);
  assert.throws(
    () =>
      validateManifest(
        { ...m, publicBaseUrl: "https://other.example.invalid" },
        c,
      ),
    /target/,
  );
  assert.throws(
    () => validateManifest({ ...m, expiresAt: "2000-01-01" }, c),
    /expired/,
  );
});
