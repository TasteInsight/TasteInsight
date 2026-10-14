import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
  readdirSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { run } from "../run.mjs";
import { readConfig, buildOptions } from "../config.mjs";
import { journeyNames } from "../k6/journeys.js";
import { cliEnv } from "../runtime.mjs";
import { manifest } from "./helpers.mjs";
function fixture(mode = "success") {
  const dir = mkdtempSync(join(tmpdir(), "api-perf-runner-"));
  const path = join(dir, "fixtures.json");
  writeFileSync(path, JSON.stringify(manifest()), { mode: 0o600 });
  const env = {
    PUBLIC_BASE_URL: "http://localhost:3000",
    ADMIN_BASE_URL: "http://localhost:3001",
    FIXTURES_FILE: path,
    RESULTS_DIR: dir,
    K6_BIN: join(dir, "fake-k6"),
    FIXTURE_JWT_SECRET: "must-not-reach-workload",
  };
  const config = readConfig(env);
  const summary = {
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
  if (mode === "threshold")
    summary.metrics.business_success.thresholds["rate>=1"].ok = false;
  const source = `#!${process.execPath}\nconst fs=require('node:fs');\nif(process.env.FIXTURE_JWT_SECRET) process.exit(88);\n${mode === "missing" ? "" : `fs.writeFileSync(process.env.SUMMARY_FILE,${JSON.stringify(JSON.stringify(summary))});`}\n${mode === "wait" ? "setInterval(()=>{},1000);" : `process.exit(${mode === "exit" ? 7 : 0});`}\n`;
  writeFileSync(env.K6_BIN, source, { mode: 0o755 });
  return {
    dir,
    path,
    env,
    dispose: () => rmSync(dir, { recursive: true, force: true }),
  };
}
test("runner accepts complete reports, isolates secrets and releases fixture lock", async () => {
  const f = fixture();
  try {
    const result = await run(f.env);
    assert.equal(
      JSON.parse(readFileSync(join(result.output, "verdict.json"))).passed,
      true,
    );
    assert.equal(existsSync(f.path + ".lock"), false);
  } finally {
    f.dispose();
  }
});
for (const mode of ["threshold", "exit", "missing"])
  test(`runner rejects ${mode} failure and releases lock`, async () => {
    const f = fixture(mode);
    try {
      await assert.rejects(run(f.env));
      assert.equal(existsSync(f.path + ".lock"), false);
    } finally {
      f.dispose();
    }
  });
test("a target mismatch never starts the workload", async () => {
  const f = fixture();
  try {
    await assert.rejects(
      run({ ...f.env, PUBLIC_BASE_URL: "http://localhost:9999" }),
      /target mismatch/,
    );
    assert.equal(readdirSync(f.dir).length, 2);
  } finally {
    f.dispose();
  }
});
test("concurrent use is refused and abort terminates the owned workload", async () => {
  const f = fixture("wait");
  const abort = new AbortController();
  try {
    const first = run(f.env, { signal: abort.signal });
    const rejected = assert.rejects(first);
    await assert.rejects(run(f.env), /EEXIST/);
    abort.abort();
    await rejected;
    assert.equal(existsSync(f.path + ".lock"), false);
  } finally {
    abort.abort();
    f.dispose();
  }
});
test("missing executable fails promptly and releases lock", async () => {
  const f = fixture();
  try {
    await assert.rejects(
      run({ ...f.env, K6_BIN: join(f.dir, "missing-binary") }),
      /ENOENT/,
    );
    assert.equal(existsSync(f.path + ".lock"), false);
  } finally {
    f.dispose();
  }
});
test("env file uses literal dotenv values, relative paths and explicit flag precedence", () => {
  const f = fixture();
  try {
    const path = join(f.dir, ".env");
    writeFileSync(
      path,
      'PROFILE=load\nFIXTURES_FILE=fixtures.json\nVALUE="$(touch should-not-execute)"\n',
    );
    const env = cliEnv(["--profile", "smoke", "--env-file", path], {
      PROFILE: "stress",
    });
    assert.equal(env.PROFILE, "smoke");
    assert.equal(env.FIXTURES_FILE, f.path);
    assert.equal(env.VALUE, "$(touch should-not-execute)");
    assert.throws(() => cliEnv(["--env-file"], {}), /Missing value/);
  } finally {
    f.dispose();
  }
});
