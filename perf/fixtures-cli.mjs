import { readFileSync, existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { cliEnv, privateJson, acquireFixtureLock } from "./runtime.mjs";
import { readConfig, validateManifest, durationSeconds } from "./config.mjs";
import { fixtureDatabase, provision, cleanup } from "./fixtures.mjs";
const [action, ...args] = process.argv.slice(2);
let db, releaseLock;
const abort = new AbortController();
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => abort.abort());
try {
  if (!["prepare", "cleanup"].includes(action))
    throw new Error(
      "Usage: node perf/fixtures-cli.mjs prepare|cleanup --env-file <private config>",
    );
  const env = cliEnv(args);
  const config = readConfig(env);
  const path = resolve(config.fixturesFile);
  releaseLock = acquireFixtureLock(path);
  if (!env.FIXTURE_DATABASE_URL)
    throw new Error("FIXTURE_DATABASE_URL is required");
  const suffix = new URL(env.FIXTURE_DATABASE_URL).pathname.split("_").at(-1);
  const runId = `perf_${suffix}`;
  db = fixtureDatabase(env.FIXTURE_DATABASE_URL);
  if (action === "prepare") {
    if (existsSync(path))
      throw new Error(
        "Fixture manifest already exists; complete its cleanup first",
      );
    for (const key of ["FIXTURE_JWT_SECRET", "FIXTURE_JWT_REFRESH_SECRET"])
      if (!env[key] || Buffer.byteLength(env[key]) < 32)
        throw new Error(
          `${key} must match the isolated API signing secret (at least 32 bytes)`,
        );
    if (env.FIXTURE_JWT_SECRET === env.FIXTURE_JWT_REFRESH_SECRET)
      throw new Error("Access and refresh signing secrets must differ");
    if (
      (await db.user.count()) ||
      (await db.admin.count()) ||
      (await db.canteen.count())
    )
      throw new Error(
        "Fixture provisioning requires an empty dedicated test database",
      );
    const manifest = await provision(db, {
      ...config,
      runId,
      count: config.maxVUs,
      accessSecret: env.FIXTURE_JWT_SECRET,
      refreshSecret: env.FIXTURE_JWT_REFRESH_SECRET,
      dishesPerSlot: Number(env.DISHES_PER_SLOT || 20),
      lifetimeSeconds: Math.max(
        86400,
        durationSeconds(config.duration) * 3 + 3600,
      ),
      onProgress: (partial) => {
        if (abort.signal.aborted)
          throw new Error("Preparation interrupted; use cleanup to recover");
        privateJson(path, partial);
      },
    });
    if (abort.signal.aborted)
      throw new Error("Preparation interrupted; use cleanup to recover");
    privateJson(path, manifest);
    console.log(`Prepared ${manifest.slots.length} identity slots: ${path}`);
  } else {
    const manifest = JSON.parse(readFileSync(path, "utf8"));
    if (
      manifest.runId !== runId ||
      !["preparing", "ready"].includes(manifest.state)
    )
      throw new Error("Fixture database ownership mismatch");
    await cleanup(db, manifest);
    rmSync(path);
    console.log("Owned fixture data cleaned");
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (db) await db.$disconnect();
  if (releaseLock) releaseLock();
  if (abort.signal.aborted) process.exitCode = 1;
}
