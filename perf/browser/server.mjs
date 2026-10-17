import http from "node:http";
import https from "node:https";
import { createReadStream } from "node:fs";
import { stat, realpath } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";
import { pipeline } from "node:stream";
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".ico": "image/x-icon",
};
export async function releaseServer(directory, apiBaseUrl) {
  const root = await realpath(resolve(directory));
  const target = new URL(apiBaseUrl);
  if (
    !["http:", "https:"].includes(target.protocol) ||
    target.username ||
    target.password ||
    target.search ||
    target.hash
  )
    throw new Error("Invalid API proxy target");
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      if (url.pathname === "/api/v1" || url.pathname.startsWith("/api/v1/")) {
        const destination = new URL(
          target.toString().replace(/\/$/, "") +
            url.pathname.slice("/api/v1".length) +
            url.search,
        );
        const headers = { ...req.headers, host: destination.host };
        // The browser talks to its same-origin test gateway. Deployment CORS is tested separately.
        delete headers.origin;
        delete headers.referer;
        delete headers.connection;
        const upstream = (
          destination.protocol === "https:" ? https : http
        ).request(
          destination,
          { method: req.method, headers, timeout: 15000 },
          (reply) => {
            res.writeHead(reply.statusCode, reply.headers);
            pipeline(reply, res, () => {});
          },
        );
        upstream.on("timeout", () =>
          upstream.destroy(new Error("API proxy timeout")),
        );
        upstream.on("error", () => {
          if (!res.headersSent) res.writeHead(502);
          res.end("API proxy failed");
        });
        req.on("aborted", () => upstream.destroy());
        res.on("close", () => upstream.destroy());
        pipeline(req, upstream, () => {});
        return;
      }
      if (!["GET", "HEAD"].includes(req.method)) {
        res.writeHead(405);
        res.end();
        return;
      }
      const pathname = decodeURIComponent(url.pathname);
      if (pathname.split("/").some((part) => part.startsWith("."))) {
        res.writeHead(403);
        res.end();
        return;
      }
      let path = resolve(root, "." + pathname);
      if (path !== root && !path.startsWith(root + sep)) {
        res.writeHead(403);
        res.end();
        return;
      }
      let info = await stat(path).catch(() => null);
      if (!info || info.isDirectory()) {
        if (extname(pathname)) {
          res.writeHead(404);
          res.end();
          return;
        }
        path = resolve(root, "index.html");
        info = await stat(path);
      }
      const canonical = await realpath(path);
      if (!canonical.startsWith(root + sep)) {
        res.writeHead(403);
        res.end();
        return;
      }
      res.writeHead(200, {
        "Content-Type": types[extname(path)] || "application/octet-stream",
        "Content-Length": info.size,
        "Cache-Control":
          extname(path) === ".html"
            ? "no-cache"
            : "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      });
      if (req.method === "HEAD") res.end();
      else pipeline(createReadStream(path), res, () => {});
    } catch {
      if (!res.headersSent) res.writeHead(500);
      res.end("Static server failed");
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(resolve);
      }),
  };
}
