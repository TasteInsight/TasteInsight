import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  copyFileSync,
  writeFileSync,
  readFileSync,
  realpathSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseEnv } from "node:util";
import { pathToFileURL } from "node:url";
import { readConfig } from "../config.mjs";
import { frontendEnv } from "../frontend.mjs";

test("performance env defaults to its module directory and explicit files replace it", async () => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "perf-env-selection-")));
  try {
    copyFileSync(
      new URL("../runtime.mjs", import.meta.url),
      join(dir, "runtime.mjs"),
    );
    const { cliEnv } = await import(pathToFileURL(join(dir, "runtime.mjs")));
    assert.deepEqual(cliEnv([], {}), {});
    writeFileSync(
      join(dir, ".env"),
      "RATE=7\nFIXTURES_FILE=default.json\nDEFAULT_ONLY=present\n",
    );
    const defaults = cliEnv([], {});
    assert.equal(defaults.RATE, "7");
    assert.equal(defaults.FIXTURES_FILE, join(dir, "default.json"));
    const selected = join(dir, ".env.server");
    writeFileSync(
      selected,
      "RATE=9\nFIXTURES_FILE=selected.json\nPROFILE=stress\n",
    );
    const env = cliEnv(["--env-file", selected, "--profile", "load"], {
      RATE: "11",
    });
    assert.equal(env.RATE, "11");
    assert.equal(env.PROFILE, "load");
    assert.equal(env.FIXTURES_FILE, join(dir, "selected.json"));
    assert.equal(env.DEFAULT_ONLY, undefined);
    assert.throws(
      () => cliEnv(["--env-file", join(dir, "missing")], {}),
      /ENOENT/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("shared performance template leaves API and browser profile defaults independent", () => {
  const input = {
    ...parseEnv(
      readFileSync(new URL("../.env.example", import.meta.url), "utf8"),
    ),
    PUBLIC_BASE_URL: "http://localhost:3000",
    ADMIN_BASE_URL: "http://localhost:3001",
    FIXTURES_FILE: "fixtures.json",
  };
  assert.equal(readConfig(input).profile, "smoke");
  assert.equal(readConfig(frontendEnv(input)).profile, "load");
});
