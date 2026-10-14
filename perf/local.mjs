import { randomBytes } from "node:crypto";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { createWriteStream, mkdirSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { setTimeout as delay } from "node:timers/promises";
import { readConfig, durationSeconds } from "./config.mjs";
import { fixtureDatabase, provision, cleanup } from "./fixtures.mjs";
import { cliEnv, command, privateJson, stopChild } from "./runtime.mjs";
import { run } from "./run.mjs";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const backend = resolve(root, "backend");
const require = createRequire(resolve(backend, "package.json"));
const { Queue } = require("bullmq");
async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}
export async function runLocal(env, workload = run) {
  const suffix = randomBytes(8).toString("hex");
  const runId = `perf_${suffix}`;
  const work = resolve(root, "perf/results", runId);
  mkdirSync(work, { recursive: true, mode: 0o700 });
  const containers = [];
  const children = [];
  const logs = [];
  const abort = new AbortController();
  const interrupt = () => abort.abort();
  for (const name of ["SIGINT", "SIGTERM"]) process.once(name, interrupt);
  let db,
    manifest,
    k6Output,
    sourceRevision,
    failed = false;
  const startedAt = new Date().toISOString();
  const checkAbort = () => {
    if (abort.signal.aborted)
      throw new Error("Local performance run interrupted");
  };
  async function container(kind, image, args) {
    checkAbort();
    const name = `tasteinsight-${runId}-${kind}`;
    containers.push(name);
    try {
      await command("docker", ["image", "inspect", image], {
        signal: abort.signal,
      });
    } catch (error) {
      checkAbort();
      await command("docker", ["pull", image], { signal: abort.signal });
    }
    await command(
      "docker",
      [
        "create",
        "--name",
        name,
        "--label",
        `tasteinsight.perf=${runId}`,
        ...args,
        image,
        ...(kind === "redis" ? ["redis-server", "--requirepass", secret] : []),
      ],
      { signal: abort.signal },
    );
    checkAbort();
    await command("docker", ["start", name], { signal: abort.signal });
    return name;
  }
  async function waitFor(test, label) {
    for (let i = 0; i < 120; i++) {
      checkAbort();
      if (await test()) return;
      await delay(250);
    }
    throw new Error(`Timed out waiting for ${label}`);
  }
  const secret = randomBytes(32).toString("hex");
  try {
    sourceRevision = await command("git", ["rev-parse", "HEAD"], { cwd: root });
    console.log(`Preparing isolated API performance run ${runId}`);
    // The harness owns fresh containers; no existing database or application .env is consumed.
    const pg = await container("pg", "pgvector/pgvector:pg15", [
      "--tmpfs",
      "/var/lib/postgresql/data",
      "-p",
      "127.0.0.1::5432",
      "-e",
      "POSTGRES_USER=perf",
      "-e",
      `POSTGRES_PASSWORD=${secret}`,
      "-e",
      `POSTGRES_DB=tasteinsight_perf_${suffix}`,
    ]);
    const redis = await container("redis", "redis:7-alpine", [
      "-p",
      "127.0.0.1::6379",
    ]);
    const pgPort = (
      await command("docker", ["port", pg, "5432/tcp"], {
        signal: abort.signal,
      })
    )
      .split(":")
      .at(-1);
    const redisPort = (
      await command("docker", ["port", redis, "6379/tcp"], {
        signal: abort.signal,
      })
    )
      .split(":")
      .at(-1);
    await waitFor(async () => {
      try {
        await command("docker", ["exec", pg, "pg_isready", "-U", "perf"], {
          signal: abort.signal,
        });
        return true;
      } catch {
        return false;
      }
    }, "PostgreSQL");
    const publicPort = await freePort(),
      adminPort = await freePort(),
      workerPort = await freePort();
    const databaseUrl = `postgresql://perf:${secret}@127.0.0.1:${pgPort}/tasteinsight_perf_${suffix}`;
    const accessSecret = randomBytes(32).toString("hex"),
      refreshSecret = randomBytes(32).toString("hex");
    const fixturePath = resolve(work, "fixtures.json");
    const config = readConfig({
      ...env,
      PUBLIC_BASE_URL: `http://127.0.0.1:${publicPort}`,
      ADMIN_BASE_URL: `http://127.0.0.1:${adminPort}`,
      FIXTURES_FILE: fixturePath,
    });
    const appEnv = {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      NODE_ENV: "production",
      DATABASE_URL: databaseUrl,
      REDIS_HOST: "127.0.0.1",
      REDIS_PORT: redisPort,
      REDIS_PASSWORD: secret,
      JWT_SECRET: accessSecret,
      JWT_REFRESH_SECRET: refreshSecret,
      APP_URL: config.publicBaseUrl,
      ADMIN_APP_URL: config.adminBaseUrl,
      ENABLE_MOCK_AUTH: "false",
      EXTERNAL_EMBEDDING_SERVICE_ENABLED: "false",
      UPLOAD_STORAGE_TYPE: "local",
      UPLOAD_LOCAL_PATH: resolve(work, "uploads"),
    };
    await command(
      process.execPath,
      [resolve(backend, "node_modules/@nestjs/cli/bin/nest.js"), "build"],
      { cwd: backend, env: appEnv, signal: abort.signal },
    );
    checkAbort();
    await command(
      process.execPath,
      [
        resolve(backend, "node_modules/prisma/build/index.js"),
        "migrate",
        "deploy",
        "--schema",
        resolve(backend, "prisma/schema.prisma"),
      ],
      { cwd: work, env: appEnv, signal: abort.signal },
    );
    db = fixtureDatabase(databaseUrl);
    manifest = await provision(db, {
      ...config,
      runId,
      count: config.maxVUs,
      onProgress: (partial) => {
        manifest = partial;
        checkAbort();
      },
      accessSecret,
      refreshSecret,
      dishesPerSlot: Number(env.DISHES_PER_SLOT || 20),
      lifetimeSeconds: Math.max(
        86400,
        durationSeconds(config.duration) * 3 + 3600,
      ),
    });
    privateJson(fixturePath, manifest);
    // A foreign control row proves fixture cleanup is scoped, before the disposable database is removed.
    await db.canteen.create({
      data: {
        id: "perf_control",
        name: "Control",
        description: "outside-run",
        images: [],
        openingHours: [],
      },
    });
    for (const [role, port] of [
      ["public", publicPort],
      ["admin", adminPort],
      ["worker", workerPort],
    ]) {
      checkAbort();
      const log = createWriteStream(resolve(work, `${role}.log`), {
        mode: 0o600,
      });
      logs.push(log);
      const child = spawn(
        process.execPath,
        [resolve(backend, `dist/src/main.${role}.js`)],
        {
          cwd: work,
          env: { ...appEnv, PORT: String(port) },
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      children.push(child);
      child.stdout.pipe(log, { end: false });
      child.stderr.pipe(log, { end: false });
      await waitFor(async () => {
        if (child.exitCode !== null)
          throw new Error(
            `${role} exited (${child.exitCode}); inspect ${work}/${role}.log`,
          );
        try {
          return (
            await fetch(`http://127.0.0.1:${port}/metrics`, {
              signal: AbortSignal.timeout(1000),
            })
          ).ok;
        } catch {
          return false;
        }
      }, role);
    }
    for (const [role, port] of [
      ["public", publicPort],
      ["admin", adminPort],
      ["worker", workerPort],
    ])
      privateJson(resolve(work, `${role}-metrics-before.json`), {
        text: await (await fetch(`http://127.0.0.1:${port}/metrics`)).text(),
      });
    const result = await workload(
      {
        ...env,
        PUBLIC_BASE_URL: config.publicBaseUrl,
        ADMIN_BASE_URL: config.adminBaseUrl,
        FIXTURES_FILE: fixturePath,
      },
      { signal: abort.signal },
    );
    const connection = {
      host: "127.0.0.1",
      port: Number(redisPort),
      password: secret,
    };
    for (const name of ["dish-sync", "dish-review-stats", "embedding-queue"]) {
      const queue = new Queue(name, { connection });
      try {
        await waitFor(async () => {
          const counts = await queue.getJobCounts(
            "waiting",
            "active",
            "delayed",
            "failed",
          );
          if (counts.failed)
            throw new Error(`Background queue ${name} has failed jobs`);
          return !counts.waiting && !counts.active && !counts.delayed;
        }, name);
      } finally {
        await queue.close();
      }
    }
    k6Output = result.output;
    for (const [role, port] of [
      ["public", publicPort],
      ["admin", adminPort],
      ["worker", workerPort],
    ])
      privateJson(resolve(work, `${role}-metrics-after.json`), {
        text: await (await fetch(`http://127.0.0.1:${port}/metrics`)).text(),
      });
    privateJson(resolve(work, "dataset-after.json"), {
      users: await db.user.count(),
      dishes: await db.dish.count(),
      reviews: await db.review.count(),
      comments: await db.comment.count(),
      uploads: await db.dishUpload.count(),
      admins: await db.admin.count(),
    });
  } catch (error) {
    failed = true;
    console.error(error.message);
  } finally {
    for (const child of children.reverse()) await stopChild(child);
    for (const log of logs) await new Promise((resolve) => log.end(resolve));
    if (db) {
      try {
        if (manifest) {
          await cleanup(db, manifest);
          const remaining = await db.canteen.count({
            where: { id: { startsWith: runId } },
          });
          const control = await db.canteen.count({
            where: { id: "perf_control" },
          });
          if (remaining !== 0 || control !== 1)
            throw new Error("Fixture cleanup verification failed");
          privateJson(resolve(work, "cleanup.json"), {
            ownedCanteensRemaining: remaining,
            foreignControlPreserved: control === 1,
          });
        }
      } catch (error) {
        failed = true;
        console.error(`Cleanup: ${error.message}`);
      } finally {
        await db.$disconnect();
      }
    }
    for (const name of containers.reverse()) {
      try {
        const label = await command("docker", [
          "inspect",
          "--format",
          '{{index .Config.Labels "tasteinsight.perf"}}',
          name,
        ]);
        if (label !== runId)
          throw new Error(`Container ownership mismatch: ${name}`);
        await command("docker", ["rm", "-f", name]);
      } catch (error) {
        failed = true;
        console.error(error.message);
      }
    }
    rmSync(resolve(work, "fixtures.json"), { force: true });
    privateJson(resolve(work, "result.json"), {
      sourceRevision,
      sourceDirty: Boolean(
        await command("git", ["status", "--porcelain"], { cwd: root }),
      ),
      startedAt,
      nodeVersion: process.version,
      passed: !failed && !abort.signal.aborted,
      interrupted: abort.signal.aborted,
      k6Output,
      backendRoles: ["public", "admin", "worker"],
      embedding: "local fallback",
      externalIdentityProviders: "excluded",
      finishedAt: new Date().toISOString(),
    });
    console.log(
      `Isolated run ${failed || abort.signal.aborted ? "FAIL" : "PASS"}; logs: ${work}`,
    );
    for (const name of ["SIGINT", "SIGTERM"])
      process.removeListener(name, interrupt);
  }

  return { passed: !failed && !abort.signal.aborted, work };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    const result = await runLocal(cliEnv(process.argv.slice(2)));
    if (!result.passed) process.exitCode = 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
