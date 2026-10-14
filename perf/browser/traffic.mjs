import { setTimeout as delay } from "node:timers/promises";
export function observeTraffic(page, origin) {
  const failures = [],
    inFlight = new Set(),
    bodies = new Set(),
    external = new Set();
  let apiRequests = 0,
    active = true;
  const owned = (request) => new URL(request.url()).origin === origin;
  page.on("request", (request) => {
    if (active && owned(request)) inFlight.add(request);
  });
  page.on("requestfinished", (request) => inFlight.delete(request));
  page.on("pageerror", (error) => {
    if (active) failures.push(`runtime: ${error.message}`);
  });
  page.on("requestfailed", (request) => {
    inFlight.delete(request);
    if (!active) return;
    const url = new URL(request.url());
    if (owned(request))
      failures.push(
        `request failed: ${url.pathname} ${request.failure()?.errorText}`,
      );
    else external.add(url.origin);
  });
  page.on("response", (response) => {
    if (!active) return;
    const url = new URL(response.url());
    if (url.origin !== origin) {
      external.add(url.origin);
      return;
    }
    if (response.status() >= 400)
      failures.push(`HTTP ${response.status()}: ${url.pathname}`);
    if (url.pathname.startsWith("/api/v1/")) {
      apiRequests++;
      const pending = response
        .json()
        .then((body) => {
          if (
            !Number.isFinite(body.code) ||
            body.code < 200 ||
            body.code >= 300
          )
            failures.push(`business ${body.code}: ${url.pathname}`);
        })
        .catch(() => failures.push(`invalid API response: ${url.pathname}`))
        .finally(() => bodies.delete(pending));
      bodies.add(pending);
    }
  });
  return {
    async finish(timeout = 15000) {
      const deadline = Date.now() + timeout;
      let quietSince;
      while (Date.now() < deadline) {
        if (inFlight.size || bodies.size) quietSince = undefined;
        else {
          quietSince ??= Date.now();
          if (Date.now() - quietSince >= 200) break;
        }
        await delay(25);
      }
      if (inFlight.size || bodies.size)
        failures.push(
          `unfinished requests: ${inFlight.size}, response bodies: ${bodies.size}`,
        );
      active = false;
      return { apiRequests, failures, externalOrigins: [...external] };
    },
  };
}
