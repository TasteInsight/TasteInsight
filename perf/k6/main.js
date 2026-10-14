import crypto from "k6/crypto";
import exec from "k6/execution";
import { Rate, Counter } from "k6/metrics";
import {
  buildOptions,
  validateManifest,
  activeJourneys,
  selectJourney,
} from "../config.mjs";
import { api } from "./api.js";
import { journeys } from "./journeys.js";
const config = JSON.parse(__ENV.PERF_CONFIG);
const names = activeJourneys(config);
const manifest = validateManifest(
  JSON.parse(open(__ENV.FIXTURES_FILE)),
  config,
);
const started = new Counter("journeys_started");
const finished = new Counter("journeys_finished");
const success = new Rate("business_success");
const completed = new Counter("journeys_completed");
export const options = {
  ...buildOptions(config, names),
  setupTimeout: "5m",
  teardownTimeout: "1m",
};
export function setup() {
  for (const slot of manifest.slots) {
    const call = api(config, slot, "preflight", "setup");
    call(
      "public",
      "GET",
      `/canteens/${slot.canteenId}`,
      null,
      "fixture_canary",
      (d) => d?.id === slot.canteenId && d?.name === slot.canteenId,
    );
    for (const actor of [slot.user, slot.author])
      call(
        "public",
        "GET",
        "/user/profile",
        null,
        "fixture_identity",
        (d) => d?.id === actor.id,
        [200],
        actor,
      );
    call(
      "admin",
      "POST",
      "/auth/admin/login",
      { username: slot.admin.username, password: slot.admin.password },
      "fixture_admin_login",
      (d) =>
        d?.admin?.id === slot.admin.id &&
        typeof d?.token?.accessToken === "string",
    );
    call(
      "public",
      "POST",
      "/auth/refresh",
      null,
      "fixture_refresh",
      (d) => typeof d?.token?.accessToken === "string",
      [200],
      { token: slot.user.refreshToken },
    );
  }
}
export default function () {
  const slot = manifest.slots[exec.vu.idInTest - 1];
  if (!slot) exec.test.abort("Insufficient independent fixture identities");
  const name = selectJourney(config, exec.scenario.iterationInTest);
  started.add(1);
  let passed = false;
  try {
    journeys[name](
      api(config, slot, name),
      slot,
      `${manifest.runId}_${crypto.sha256(`${__ENV.EXECUTION_ID}:${exec.vu.idInTest}:${exec.scenario.iterationInTest}`, "hex").slice(0, 19)}`,
      exec.scenario.iterationInTest,
    );
    completed.add(1, { journey: name });
    passed = true;
  } catch (error) {
    console.error(`${name}: ${error.message}`);
  } finally {
    success.add(passed, { journey: name });
    finished.add(1);
  }
}
export function handleSummary(data) {
  return { [__ENV.SUMMARY_FILE]: JSON.stringify(data, null, 2) };
}
