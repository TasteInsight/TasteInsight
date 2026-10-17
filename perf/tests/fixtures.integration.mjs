import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { command, privateJson, acquireFixtureLock } from "../runtime.mjs";
import { fixtureDatabase, provision } from "../fixtures.mjs";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
test(
  "dedicated deployment CLI prepares, excludes concurrent cleanup and recovers partial preparation",
  { timeout: 120000 },
  async () => {
    const suffix = randomBytes(8).toString("hex"),
      runId = `perf_${suffix}`;
    const name = `tasteinsight-fixture-cli-${suffix}`;
    const secret = randomBytes(32).toString("hex");
    const work = mkdtempSync(resolve(tmpdir(), "perf-fixture-cli-"));
    let db;
    try {
      await command("docker", [
        "run",
        "-d",
        "--name",
        name,
        "--label",
        `tasteinsight.perf=${runId}`,
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
        "pgvector/pgvector:pg15",
      ]);
      const port = (await command("docker", ["port", name, "5432/tcp"]))
        .split(":")
        .at(-1);
      let ready = false;
      for (let i = 0; i < 60; i++) {
        try {
          await command("docker", ["exec", name, "pg_isready", "-U", "perf"]);
          ready = true;
          break;
        } catch {
          await delay(100);
        }
      }
      assert.equal(ready, true);
      const url = `postgresql://perf:${secret}@127.0.0.1:${port}/tasteinsight_perf_${suffix}`;
      const env = {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        NODE_ENV: "production",
        DATABASE_URL: url,
        FIXTURE_DATABASE_URL: url,
        FIXTURE_JWT_SECRET: randomBytes(32).toString("hex"),
        FIXTURE_JWT_REFRESH_SECRET: randomBytes(32).toString("hex"),
        PUBLIC_BASE_URL: "http://127.0.0.1:3000",
        ADMIN_BASE_URL: "http://127.0.0.1:3001",
        FIXTURES_FILE: resolve(work, "fixtures.json"),
        MAX_VUS: "2",
        DISHES_PER_SLOT: "2",
      };
      await command(
        process.execPath,
        [
          resolve(root, "backend/node_modules/prisma/build/index.js"),
          "migrate",
          "deploy",
          "--schema",
          resolve(root, "backend/prisma/schema.prisma"),
        ],
        { cwd: work, env },
      );
      const cli = (action) =>
        command(
          process.execPath,
          [resolve(root, "perf/fixtures-cli.mjs"), action],
          { cwd: work, env },
        );
      await cli("prepare");
      db = fixtureDatabase(url);
      assert.equal(await db.user.count(), 4);
      await assert.rejects(cli("prepare"), /already exists/);
      const release = acquireFixtureLock(env.FIXTURES_FILE);
      try {
        await assert.rejects(cli("cleanup"), /EEXIST/);
      } finally {
        release();
      }
      await db.canteen.create({
        data: {
          id: "unrelated-control",
          name: "Control",
          description: "outside-run",
          images: [],
          openingHours: [],
        },
      });
      const expired = JSON.parse(readFileSync(env.FIXTURES_FILE, "utf8"));
      expired.expiresAt = "2000-01-01";
      privateJson(env.FIXTURES_FILE, expired);
      await cli("cleanup");
      assert.equal(await db.user.count(), 0);
      assert.equal(await db.admin.count(), 0);
      assert.equal(await db.canteen.count(), 1);
      assert.equal(existsSync(env.FIXTURES_FILE), false);
      await db.canteen.delete({ where: { id: "unrelated-control" } });
      await assert.rejects(
        provision(db, {
          runId,
          publicBaseUrl: env.PUBLIC_BASE_URL,
          adminBaseUrl: env.ADMIN_BASE_URL,
          count: 2,
          dishesPerSlot: 2,
          accessSecret: env.FIXTURE_JWT_SECRET,
          refreshSecret: env.FIXTURE_JWT_REFRESH_SECRET,
          onProgress: (partial) => {
            privateJson(env.FIXTURES_FILE, partial);
            if (partial.slots.length === 2)
              throw new Error("Injected preparation failure");
          },
        }),
        /Injected/,
      );
      assert.equal(await db.user.count(), 2);
      assert.equal(
        JSON.parse(readFileSync(env.FIXTURES_FILE, "utf8")).state,
        "preparing",
      );
      await cli("cleanup");
      assert.equal(await db.user.count(), 0);
      assert.equal(await db.canteen.count(), 0);
      assert.equal(existsSync(env.FIXTURES_FILE + ".lock"), false);
    } finally {
      if (db) await db.$disconnect();
      await command("docker", ["rm", "-f", name]);
      rmSync(work, { recursive: true, force: true });
    }
  },
);
