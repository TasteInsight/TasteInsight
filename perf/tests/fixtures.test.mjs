import test from "node:test";
import assert from "node:assert/strict";
import { readConfig, validateManifest } from "../config.mjs";
import { cleanup, provision, fixtureDatabase } from "../fixtures.mjs";
import { manifest } from "./helpers.mjs";

const config = readConfig({
  PUBLIC_BASE_URL: "http://localhost:3000",
  ADMIN_BASE_URL: "http://localhost:3001",
  FIXTURES_FILE: "fixtures.json",
  MAX_VUS: "2",
});
test("identity pool rejects duplicate actors and another slot read targets", () => {
  assert.equal(validateManifest(manifest(2), config).slots.length, 2);
  const actors = manifest(2);
  actors.slots[1].user = actors.slots[0].user;
  assert.throws(() => validateManifest(actors, config));
  const reads = manifest(2);
  reads.slots[0].dishIds.push(reads.slots[1].dishId);
  assert.throws(() => validateManifest(reads, config));
});
test("partial preparation cannot be used to start a workload", () => {
  assert.throws(() =>
    validateManifest({ ...manifest(2), state: "preparing" }, config),
  );
});
test("fixture database name and dataset size are validated before writes", async () => {
  for (const url of [
    "postgresql://user:pass@localhost/production",
    "postgresql://user:pass@localhost/tasteinsight_dev",
  ])
    assert.throws(() => fixtureDatabase(url), /dedicated/);
  await assert.rejects(
    provision(
      {},
      { runId: "perf_0123456789abcdef", count: 1, dishesPerSlot: 0 },
    ),
    /dataset/,
  );
});
test("cleanup refuses a foreign canteen before entering a deletion transaction", async () => {
  let writes = 0;
  const db = {
    canteen: { findMany: async () => [{ description: "foreign-run" }] },
    $transaction: async () => {
      writes++;
    },
  };
  await assert.rejects(cleanup(db, manifest()), /ownership/);
  assert.equal(writes, 0);
});

test("manifest expiration is no later than the signed token expiration", async () => {
  const tx = Object.fromEntries(
    [
      "canteen",
      "adminConfig",
      "window",
      "user",
      "admin",
      "news",
      "dish",
      "review",
    ].map((name) => [name, { create: async () => ({}) }]),
  );
  const db = { $transaction: async (fn) => fn(tx) };
  const data = await provision(db, {
    runId: "perf_0123456789abcdef",
    publicBaseUrl: "http://localhost:3000",
    adminBaseUrl: "http://localhost:3001",
    count: 1,
    dishesPerSlot: 1,
    accessSecret: "a".repeat(32),
    refreshSecret: "b".repeat(32),
  });
  const token = data.slots[0].user.token;
  const expiry =
    JSON.parse(Buffer.from(token.split(".")[1], "base64url")).exp * 1000;
  assert.ok(Date.parse(data.expiresAt) <= expiry);
});
