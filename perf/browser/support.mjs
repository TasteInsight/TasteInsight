import { readFileSync } from "node:fs";
import { observeTraffic } from "./traffic.mjs";
import { metricsScript } from "./metrics.mjs";
import { privateJson } from "../runtime.mjs";
import { resolve } from "node:path";
export const session = JSON.parse(
  readFileSync(process.env.BROWSER_SESSION_FILE, "utf8"),
);
export async function api(base, path, token, method = "GET", body) {
  const res = await fetch(base + path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
    redirect: "error",
  });
  const json = await res.json();
  if (
    !res.ok ||
    json.code < 200 ||
    json.code >= 300 ||
    !Number.isFinite(json.code)
  )
    throw new Error(
      `${method} ${path}: HTTP ${res.status}, business ${json.code}`,
    );
  return json.data;
}
export async function seed(context, admin) {
  const { slot, publicBaseUrl, adminBaseUrl } = session;
  let storage;
  if (admin) {
    const data = await api(
      adminBaseUrl,
      "/auth/admin/login",
      slot.admin.token,
      "POST",
      { username: slot.admin.username, password: slot.admin.password },
    );
    if (data.admin.id !== slot.admin.id)
      throw new Error("Unexpected administrator identity");
    storage = {
      admin_token: data.token.accessToken,
      admin_refresh_token: data.token.refreshToken,
      admin_user: JSON.stringify(data.admin),
      admin_permissions: JSON.stringify(data.permissions),
    };
  } else {
    const profile = await api(publicBaseUrl, "/user/profile", slot.user.token);
    if (profile.id !== slot.user.id)
      throw new Error("Unexpected user identity");
    storage = {
      token: slot.user.token,
      refreshToken: slot.user.refreshToken,
      userInfo: JSON.stringify(profile),
    };
  }
  await context.addInitScript(
    ({ storage, origin }) => {
      if (location.origin === origin)
        for (const [key, value] of Object.entries(storage))
          localStorage.setItem(key, value);
    },
    { storage, origin: admin ? session.adminOrigin : session.clientOrigin },
  );
}
export async function observe(page, name, index) {
  await page.addInitScript({ content: metricsScript });
  const traffic = observeTraffic(
    page,
    new URL(
      name.startsWith("admin") ? session.adminOrigin : session.clientOrigin,
    ).origin,
  );
  const startedAt = Date.now();
  return {
    startedAt,
    async finish(readyMs, actionMs) {
      // Fixed observation tail includes paints and the CLS session window through the completed interaction.
      await page.waitForTimeout(500);
      await page.waitForFunction(
        () =>
          ["FCP", "LCP", "CLS"].every((key) =>
            Number.isFinite(window.__releaseVitals?.[key]),
          ),
        {},
        { timeout: 5000 },
      );
      const requests = await traffic.finish();
      await page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          ),
      );
      const metrics = await page.evaluate(() => ({
        ...window.__releaseVitals,
      }));
      const sample = {
        case: name,
        sample: index,
        phase: session.phase,
        startedAt,
        finishedAt: Date.now(),
        metrics: { ...metrics, readyMs, actionMs },
        ...requests,
        viewport: page.viewportSize(),
        browserVersion: page.context().browser().version(),
      };
      privateJson(
        resolve(process.env.BROWSER_PHASE_DIR, `${name}-${index}.json`),
        sample,
      );
      if (requests.failures.length)
        throw new Error(requests.failures.join("; "));
    },
  };
}
export function waitApi(page, path, method = "GET") {
  return page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === `/api/v1${path}` &&
      response.request().method() === method,
  );
}
