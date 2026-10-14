import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { runLocal } from "../local.mjs";
import { runFrontend } from "../frontend.mjs";
import { command, stopChild } from "../runtime.mjs";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const env = {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  K6_BIN: process.env.K6_BIN || "k6",
  PROFILE: "load",
  MAX_VUS: "5",
  RATE: "4",
  DURATION: "30s",
  FRONTEND_SAMPLES: "1",
};
test(
  "release browser flows pass under real load and reject a shorter load window",
  { timeout: 300000 },
  async () => {
    const local = await runLocal(env, async (runtime, options) => {
      const result = await runFrontend({ ...runtime, MAX_VUS: "4" }, options);
      const verdict = JSON.parse(
        readFileSync(resolve(result.output, "verdict.json")),
      );
      assert.equal(verdict.passed, true);
      assert.equal(verdict.phases.length, 2);
      assert.equal(existsSync(resolve(result.output, "session.json")), false);
      assert.equal(existsSync(runtime.FIXTURES_FILE + ".lock"), false);
      await assert.rejects(
        runFrontend(
          {
            ...runtime,
            MAX_VUS: "4",
            DURATION: "2s",
            JOURNEY_WEIGHTS: '{"browsing":1}',
          },
          options,
        ),
        /Loaded browser run failed/,
      );
      assert.equal(existsSync(runtime.FIXTURES_FILE + ".lock"), false);
      return result;
    });
    assert.equal(local.passed, true);
    assert.deepEqual(
      JSON.parse(readFileSync(resolve(local.work, "cleanup.json"))),
      { ownedCanteensRemaining: 0, foreignControlPreserved: true },
    );
  },
);
test(
  "SIGTERM during loaded browser flows closes the stack and deletes temporary credentials",
  { timeout: 120000 },
  async () => {
    const child = spawn(
      process.execPath,
      [resolve(root, "perf/frontend-local.mjs")],
      {
        cwd: root,
        env: { ...env, MAX_VUS: "4", DURATION: "1m" },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let output = "",
      sent = false,
      origins = [];
    child.stdout.on("data", (chunk) => {
      output += chunk;
      if (!sent && output.includes("Measuring loaded:")) {
        sent = true;
        const runId = output.match(
          /Preparing isolated API performance run (perf_[a-f0-9]+)/,
        )?.[1];
        const directory = readdirSync(resolve(root, "perf/results")).find(
          (name) => name.startsWith("browser-" + runId + "-"),
        );
        const session = JSON.parse(
          readFileSync(
            resolve(root, "perf/results", directory, "session.json"),
          ),
        );
        origins = [session.clientOrigin, session.adminOrigin];
        setTimeout(() => child.kill("SIGTERM"), 1500);
      }
    });
    child.stderr.on("data", (chunk) => {
      output += chunk;
    });
    try {
      const code = await new Promise((resolve, reject) => {
        child.once("error", reject);
        child.once("close", resolve);
      });
      assert.equal(sent, true, output);
      assert.equal(code, 1, output);
      for (const origin of origins)
        await assert.rejects(
          fetch(origin, { signal: AbortSignal.timeout(1000) }),
        );
      const runId = output.match(
        /Preparing isolated API performance run (perf_[a-f0-9]+)/,
      )?.[1];
      assert.ok(runId, output);
      const work = resolve(root, "perf/results", runId);
      assert.equal(
        JSON.parse(readFileSync(resolve(work, "result.json"))).interrupted,
        true,
      );
      assert.equal(existsSync(resolve(work, "fixtures.json")), false);
      assert.equal(existsSync(resolve(work, "fixtures.json.lock")), false);
      const browserDir = readdirSync(resolve(root, "perf/results")).find(
        (name) => name.startsWith("browser-" + runId + "-"),
      );
      assert.ok(browserDir);
      assert.equal(
        existsSync(resolve(root, "perf/results", browserDir, "session.json")),
        false,
      );
      assert.equal(
        JSON.parse(
          readFileSync(
            resolve(root, "perf/results", browserDir, "verdict.json"),
          ),
        ).passed,
        false,
      );
      assert.equal(
        await command("docker", [
          "ps",
          "-a",
          "--filter",
          `label=tasteinsight.perf=${runId}`,
          "--format",
          "{{.Names}}",
        ]),
        "",
      );
    } finally {
      await stopChild(child);
    }
  },
);
