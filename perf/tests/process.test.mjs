import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { setTimeout as delay } from "node:timers/promises";
import { command } from "../runtime.mjs";
test("preparation command abort waits for its child to exit", async () => {
  const dir = mkdtempSync(join(tmpdir(), "perf-command-"));
  const pidPath = join(dir, "pid");
  const abort = new AbortController();
  try {
    const running = command(
      process.execPath,
      [
        "-e",
        'require("node:fs").writeFileSync(process.argv[1],String(process.pid));setInterval(()=>{},1000)',
        pidPath,
      ],
      { signal: abort.signal },
    );
    const rejected = assert.rejects(running, /interrupted/);
    for (let i = 0; i < 100 && !existsSync(pidPath); i++) await delay(20);
    assert.ok(existsSync(pidPath));
    const pid = Number(readFileSync(pidPath, "utf8"));
    abort.abort();
    await rejected;
    assert.throws(() => process.kill(pid, 0), { code: "ESRCH" });
  } finally {
    abort.abort();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("hung preparation commands have a bounded timeout", async () => {
  await assert.rejects(
    command(process.execPath, ["-e", "setInterval(()=>{},1000)"], {
      timeout: 100,
    }),
    /timed out/,
  );
});
