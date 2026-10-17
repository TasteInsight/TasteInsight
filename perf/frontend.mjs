import {
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash, randomUUID } from "node:crypto";
import {
  command,
  cliEnv,
  privateJson,
  acquireFixtureLock,
} from "./runtime.mjs";
import { readConfig, validateManifest } from "./config.mjs";
import {
  browserConfig,
  evaluateBrowserReport,
  CASES,
} from "./browser/config.mjs";
import { releaseServer } from "./browser/server.mjs";
import { run } from "./run.mjs";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export function frontendEnv(env) {
  return {
    ...env,
    PROFILE: env.PROFILE || "load",
    DURATION: env.DURATION || "3m",
    MAX_VUS: env.MAX_VUS || "10",
  };
}
export async function runFrontend(input, { signal } = {}) {
  const env = frontendEnv(input),
    config = readConfig(env),
    browser = browserConfig(env);
  if (browser.mode === "hybrid" && config.profile !== "load")
    throw new Error(
      "Hybrid browser testing requires PROFILE=load for a constant measurement window",
    );
  const manifest = validateManifest(
    JSON.parse(readFileSync(config.fixturesFile, "utf8")),
    { ...config, maxVUs: config.maxVUs + 1 },
  );
  const slot = manifest.slots[config.maxVUs];
  const output = resolve(
    env.RESULTS_DIR || resolve(root, "perf/results"),
    `browser-${manifest.runId}-${randomUUID().slice(0, 8)}`,
  );
  mkdirSync(output, { recursive: true, mode: 0o700 });
  const servers = [];
  let releaseLock, k6Promise, sessionFile;
  const abort = new AbortController();
  const interrupt = () => abort.abort();
  signal?.addEventListener("abort", interrupt, { once: true });
  if (signal?.aborted) abort.abort();
  const phaseResults = [];
  try {
    const release = resolve(output, "release");
    mkdirSync(release, { mode: 0o700 });
    const buildEnv = {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      NODE_ENV: "production",
      UNI_PLATFORM: "h5",
      VITE_API_BASE_URL: "/api/v1",
      VITE_ENABLE_TEST_LOGIN: "false",
    };
    for (const [name, entry, args] of [
      [
        "frontend-miniapp",
        "node_modules/@dcloudio/vite-plugin-uni/bin/uni.js",
        ["build", "-p", "h5"],
      ],
      ["frontend-web", "node_modules/vite/bin/vite.js", ["build"]],
    ]) {
      console.log(`Building release ${name}`);
      const destination = resolve(release, name);
      const log = await command(
        process.execPath,
        [resolve(root, name, entry), ...args, "--outDir", destination],
        { cwd: resolve(root, name), env: buildEnv, signal: abort.signal },
      );
      writeFileSync(resolve(output, `${name}-build.log`), log, { mode: 0o600 });
    }
    const hashes = {};
    function hashTree(dir) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = resolve(dir, entry.name);
        if (entry.isDirectory()) hashTree(path);
        else
          hashes[path.slice(release.length + 1)] = createHash("sha256")
            .update(readFileSync(path))
            .digest("hex");
      }
    }
    hashTree(release);
    privateJson(resolve(output, "build.json"), {
      sourceRevision: await command("git", ["rev-parse", "HEAD"], {
        cwd: root,
      }),
      sourceDirty: Boolean(
        await command("git", ["status", "--porcelain"], { cwd: root }),
      ),
      nodeVersion: process.version,
      hashes,
    });
    const client = await releaseServer(
      resolve(release, "frontend-miniapp"),
      config.publicBaseUrl,
    );
    servers.push(client);
    const admin = await releaseServer(
      resolve(release, "frontend-web"),
      config.adminBaseUrl,
    );
    servers.push(admin);
    sessionFile = resolve(output, "session.json");
    async function phase(name) {
      if (abort.signal.aborted) throw new Error("Browser run interrupted");
      const dir = resolve(output, name);
      mkdirSync(dir, { mode: 0o700 });
      privateJson(sessionFile, {
        slot,
        phase: name,
        samples: browser.samples,
        publicBaseUrl: config.publicBaseUrl,
        adminBaseUrl: config.adminBaseUrl,
        clientOrigin: client.origin,
        adminOrigin: admin.origin,
      });
      console.log(
        `Measuring ${name}: ${CASES.length * browser.samples} release browser samples`,
      );
      let error;
      try {
        const log = await command(
          process.execPath,
          [
            resolve(root, "perf/node_modules/@playwright/test/cli.js"),
            "test",
            "-c",
            resolve(root, "perf/browser/playwright.config.mjs"),
          ],
          {
            cwd: root,
            env: {
              PATH: process.env.PATH,
              HOME: process.env.HOME,
              BROWSER_SESSION_FILE: sessionFile,
              BROWSER_PHASE_DIR: dir,
            },
            signal: abort.signal,
            timeout: Math.max(300000, browser.samples * CASES.length * 65000),
          },
        );
        writeFileSync(resolve(dir, "runner.log"), log, { mode: 0o600 });
      } catch (failure) {
        error = failure.message;
        writeFileSync(resolve(dir, "runner.log"), error, { mode: 0o600 });
      }
      const samples = readdirSync(dir)
        .filter((f) => /^(client|admin)-.*-\d+\.json$/.test(f))
        .map((f) => JSON.parse(readFileSync(resolve(dir, f), "utf8")));
      return { name, samples, error };
    }
    releaseLock = acquireFixtureLock(resolve(config.fixturesFile));
    const baseline = await phase("baseline");
    const baselineVerdict = evaluateBrowserReport(
      baseline.samples,
      browser,
      "baseline",
    );
    if (baseline.error) baselineVerdict.failures.push(baseline.error);
    baselineVerdict.passed = baselineVerdict.failures.length === 0;
    phaseResults.push(baselineVerdict);
    privateJson(resolve(output, "baseline/verdict.json"), baselineVerdict);
    if (!baselineVerdict.passed)
      throw new Error(`Release baseline failed; inspect ${output}/baseline`);

    if (browser.mode === "hybrid") {
      let markReady;
      const ready = new Promise((resolve) => {
        markReady = resolve;
      });
      k6Promise = run(
        { ...env, RESULTS_DIR: resolve(output, "api") },
        {
          signal: abort.signal,
          onWorkloadStart: markReady,
          fixtureLease: releaseLock,
        },
      );
      // Handle rejection immediately, including failures while Playwright is still running.
      const outcome = k6Promise.then(
        (value) => ({ value }),
        (error) => ({ error }),
      );
      let timer;
      try {
        await Promise.race([
          ready,
          outcome.then((result) => {
            throw result.error || new Error("Load ended before readiness");
          }),
          new Promise((_, reject) => {
            timer = setTimeout(
              () =>
                reject(
                  new Error("No successful k6 workload within 90 seconds"),
                ),
              90000,
            );
          }),
        ]);
      } finally {
        clearTimeout(timer);
      }
      const loaded = await phase("loaded");
      if (loaded.error) abort.abort();
      console.log(
        "Browser phase finished; waiting for the configured API load window to complete",
      );
      const result = await outcome;
      const verdict = evaluateBrowserReport(
        loaded.samples,
        browser,
        "loaded",
        result.value?.load,
      );
      if (result.error) verdict.failures.push(result.error.message);
      if (loaded.error) verdict.failures.push(loaded.error);
      verdict.passed = verdict.failures.length === 0;
      verdict.load = result.value?.load;
      verdict.apiOutput = result.value?.output;
      phaseResults.push(verdict);
      privateJson(resolve(output, "loaded/verdict.json"), verdict);
      if (!verdict.passed)
        throw new Error(`Loaded browser run failed; inspect ${output}/loaded`);
    }
    privateJson(resolve(output, "verdict.json"), {
      passed: true,
      browser,
      phases: phaseResults,
      finishedAt: new Date().toISOString(),
    });
    console.log(`Release browser performance PASS: ${output}`);
    return { output };
  } catch (error) {
    privateJson(resolve(output, "verdict.json"), {
      passed: false,
      error: error.message,
      browser,
      phases: phaseResults,
    });
    throw error;
  } finally {
    abort.abort();
    if (k6Promise) await k6Promise.catch(() => {});
    releaseLock?.();
    for (const server of servers.reverse()) await server.close();
    if (sessionFile) rmSync(sessionFile, { force: true });
    signal?.removeEventListener("abort", interrupt);
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
    await runFrontend(cliEnv(process.argv.slice(2)), { signal: abort.signal });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
