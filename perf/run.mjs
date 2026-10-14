import { readFileSync, mkdirSync, createWriteStream } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { evaluateSummary } from "./verdict.mjs";
import { readConfig, validateManifest } from "./config.mjs";
import {
  cliEnv,
  privateJson,
  stopChild,
  acquireFixtureLock,
} from "./runtime.mjs";
const here = dirname(fileURLToPath(import.meta.url));
export async function run(env, { signal } = {}) {
  const config = readConfig(env);
  const fixturePath = resolve(config.fixturesFile);
  const releaseLock = acquireFixtureLock(fixturePath);
  let child;
  try {
    const manifest = validateManifest(
      JSON.parse(readFileSync(fixturePath, "utf8")),
      config,
    );
    const executionId = randomUUID();
    if (signal?.aborted) throw new Error("Run interrupted");
    const output = resolve(
      env.RESULTS_DIR || resolve(here, "results"),
      `${manifest.runId}-${Date.now()}`,
    );
    mkdirSync(output, { recursive: true, mode: 0o700 });
    const summaryFile = resolve(output, "summary.json");
    privateJson(resolve(output, "run.json"), {
      executionId,
      runId: manifest.runId,
      startedAt: new Date().toISOString(),
      config: { ...config, fixturesFile: undefined },
      identityCount: manifest.slots.length,
    });
    const log = createWriteStream(resolve(output, "k6.log"), { mode: 0o600 });
    console.log(
      `Starting ${config.profile} workload with ${config.maxVUs} independent identity slots`,
    );
    child = spawn(
      env.K6_BIN || "k6",
      ["run", "--quiet", "--no-color", resolve(here, "k6/main.js")],
      {
        env: {
          PATH: process.env.PATH,
          HOME: process.env.HOME,
          K6_NO_USAGE_REPORT: "true",
          EXECUTION_ID: executionId,
          PERF_CONFIG: JSON.stringify(config),
          FIXTURES_FILE: fixturePath,
          SUMMARY_FILE: summaryFile,
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    child.stdout.pipe(log, { end: false });
    child.stderr.pipe(log, { end: false });
    const interrupt = () => void stopChild(child);
    signal?.addEventListener("abort", interrupt, { once: true });
    let code;
    try {
      code = await new Promise((resolve, reject) => {
        child.once("error", reject);
        child.once("close", (code) => resolve(code));
      });
    } finally {
      signal?.removeEventListener("abort", interrupt);
      await new Promise((resolve) => log.end(resolve));
    }
    let summary;
    try {
      summary = JSON.parse(readFileSync(summaryFile, "utf8"));
    } catch {
      throw new Error(`k6 did not produce a summary; inspect ${output}/k6.log`);
    }
    const verdict = evaluateSummary(
      summary,
      config,
      code,
      Boolean(signal?.aborted),
    );
    privateJson(resolve(output, "verdict.json"), {
      ...verdict,
      finishedAt: new Date().toISOString(),
    });
    console.log(
      `API performance ${verdict.passed ? "PASS" : "FAIL"}: ${output}`,
    );
    if (!verdict.passed)
      throw new Error(
        `API performance failed: ${verdict.failedMetrics.join("; ") || `k6 exit ${code}`}`,
      );
    return { output, summary };
  } finally {
    if (child) await stopChild(child);
    releaseLock();
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const abort = new AbortController();
  for (const name of ["SIGINT", "SIGTERM"])
    process.once(name, () => abort.abort());
  try {
    await run(cliEnv(process.argv.slice(2)), { signal: abort.signal });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
