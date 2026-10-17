import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  statSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { privateJson, acquireFixtureLock } from "../runtime.mjs";
test("prepare, workload and cleanup share an exclusive fixture lock", () => {
  const dir = mkdtempSync(join(tmpdir(), "perf-lock-"));
  const path = join(dir, "fixtures.json");
  try {
    const release = acquireFixtureLock(path);
    assert.throws(() => acquireFixtureLock(path), /EEXIST/);
    release();
    acquireFixtureLock(path)();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("private manifest replacement preserves complete JSON and owner-only access", () => {
  const dir = mkdtempSync(join(tmpdir(), "perf-json-"));
  const path = join(dir, "fixtures.json");
  try {
    writeFileSync(path, "old", { mode: 0o644 });
    privateJson(path, { state: "ready" });
    assert.deepEqual(JSON.parse(readFileSync(path)), { state: "ready" });
    assert.equal(statSync(path).mode & 0o777, 0o600);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
