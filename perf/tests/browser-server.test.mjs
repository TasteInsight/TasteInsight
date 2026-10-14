import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import http from "node:http";
import { releaseServer } from "../browser/server.mjs";
test("release server serves built assets and SPA routes, forwards real API prefixes, blocks private files", async () => {
  const dir = mkdtempSync(join(tmpdir(), "perf-release-"));
  writeFileSync(join(dir, "index.html"), "<html>release</html>");
  writeFileSync(join(dir, "app.js"), 'console.log("release")');
  writeFileSync(join(dir, ".env"), "private");
  const api = http.createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        path: req.url,
        authorization: req.headers.authorization,
      }),
    );
  });
  await new Promise((resolve) => api.listen(0, "127.0.0.1", resolve));
  const server = await releaseServer(
    dir,
    `http://127.0.0.1:${api.address().port}/prefix`,
  );
  try {
    assert.match(
      await (await fetch(server.origin + "/modify-dish")).text(),
      /release/,
    );
    assert.match(
      (await fetch(server.origin + "/app.js")).headers.get("content-type"),
      /javascript/,
    );
    assert.equal((await fetch(server.origin + "/missing.js")).status, 404);
    assert.equal((await fetch(server.origin + "/.env")).status, 403);
    symlinkSync("/etc/hosts", join(dir, "outside.txt"));
    assert.equal((await fetch(server.origin + "/outside.txt")).status, 403);
    const body = await (
      await fetch(server.origin + "/api/v1/dishes?a=1", {
        headers: { authorization: "Bearer fixture" },
      })
    ).json();
    assert.deepEqual(body, {
      path: "/prefix/dishes?a=1",
      authorization: "Bearer fixture",
    });
  } finally {
    await server.close();
    api.closeAllConnections();
    await new Promise((resolve) => api.close(resolve));
    rmSync(dir, { recursive: true, force: true });
  }
});
