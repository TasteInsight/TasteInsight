import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { runLocal } from "../local.mjs";
import { run } from "../run.mjs";
import { privateJson, command } from "../runtime.mjs";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const env = {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  K6_BIN: process.env.K6_BIN || "k6",
  MAX_VUS: "4",
  PROFILE: "smoke",
  DISHES_PER_SLOT: "20",
};

test(
  "real production-role APIs: repeatable smoke, arrival-rate profiles and invalid credentials",
  { timeout: 240000 },
  async () => {
    const results = [];
    const local = await runLocal(env, async (runtime, options) => {
      for (const profile of ["smoke", "smoke", "load", "stress", "soak"]) {
        const result = await run(
          {
            ...runtime,
            PROFILE: profile,
            DURATION:
              profile === "load" ? "10s" : profile === "stress" ? "3s" : "5s",
            RATE: "4",
          },
          options,
        );
        results.push(result.output);
        assert.equal(
          result.summary.metrics.journeys_started.values.count,
          result.summary.metrics.journeys_finished.values.count,
        );
      }
      const original = JSON.parse(readFileSync(runtime.FIXTURES_FILE, "utf8"));
      const invalid = structuredClone(original);
      invalid.slots[0].user.token = "invalid-fixture-token";
      try {
        privateJson(runtime.FIXTURES_FILE, invalid);
        await assert.rejects(run(runtime, options), /performance failed/);
      } finally {
        privateJson(runtime.FIXTURES_FILE, original);
      }
      return { output: results.at(-1) };
    });
    assert.equal(local.passed, true);
    assert.equal(existsSync(resolve(local.work, "fixtures.json")), false);
    assert.deepEqual(
      JSON.parse(readFileSync(resolve(local.work, "cleanup.json"))),
      { ownedCanteensRemaining: 0, foreignControlPreserved: true },
    );
    const containers = await command("docker", [
      "ps",
      "-a",
      "--filter",
      `label=tasteinsight.perf=${local.work.split("/").at(-1)}`,
      "--format",
      "{{.Names}}",
    ]);
    assert.equal(containers, "");
  },
);

test(
  "SIGTERM during real workload stops APIs and removes its containers",
  { timeout: 120000 },
  async () => {
    const child = spawn(
      process.execPath,
      [resolve(root, "perf/local.mjs"), "--profile", "load"],
      {
        cwd: root,
        env: { ...env, DURATION: "1m", RATE: "3" },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let output = "",
      sent = false;
    child.stdout.on("data", (chunk) => {
      output += chunk;
      if (!sent && output.includes("Starting load workload")) {
        sent = true;
        setTimeout(() => child.kill("SIGTERM"), 1000);
      }
    });
    child.stderr.on("data", (chunk) => {
      output += chunk;
    });
    const code = await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("close", resolve);
    });
    assert.equal(sent, true, output);
    assert.equal(code, 1, output);
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
  },
);
