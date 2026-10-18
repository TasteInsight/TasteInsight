import { journeyNames } from "./k6/journeys.js";
export const PROFILES = ["smoke", "load", "stress", "soak"];
function target(value, key) {
  try {
    const text = value.trim().replace(/\/+$/, "");
    const url = new URL(text);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error();
    return text;
  } catch {
    throw new Error(
      `${key} must be an explicit http(s) base URL without credentials, query or fragment`,
    );
  }
}
function positive(value, fallback, key) {
  const n = Number(value ?? fallback);
  if (!Number.isSafeInteger(n) || n < 1)
    throw new Error(`${key} must be a positive integer`);
  return n;
}
export function durationSeconds(value) {
  const match = /^([1-9]\d*)(s|m|h)$/.exec(value);
  if (!match)
    throw new Error("DURATION must be a positive duration in s, m or h");
  return Number(match[1]) * { s: 1, m: 60, h: 3600 }[match[2]];
}
export function readConfig(env) {
  const profile = env.PROFILE || "smoke";
  if (!PROFILES.includes(profile))
    throw new Error(`PROFILE must be ${PROFILES.join(", ")}`);
  const duration = env.DURATION || (profile === "soak" ? "1h" : "5m");
  durationSeconds(duration);
  const errorRate = Number(env.ERROR_RATE ?? (profile === "smoke" ? 0 : 0.01));
  if (!Number.isFinite(errorRate) || errorRate < 0 || errorRate >= 1)
    throw new Error("ERROR_RATE must be in [0, 1)");
  const weights = env.JOURNEY_WEIGHTS
    ? JSON.parse(env.JOURNEY_WEIGHTS)
    : {
        browsing: 60,
        social: 15,
        posting: 5,
        planning: 10,
        ...Object.fromEntries(
          journeyNames
            .filter(
              (name) =>
                !["browsing", "social", "posting", "planning"].includes(name),
            )
            .map((name) => [name, 1]),
        ),
      };
  if (
    !weights ||
    typeof weights !== "object" ||
    Array.isArray(weights) ||
    !Object.values(weights).some((value) => value > 0) ||
    Object.entries(weights).some(
      ([name, value]) =>
        !journeyNames.includes(name) ||
        !Number.isSafeInteger(value) ||
        value < 0,
    ) ||
    !Number.isSafeInteger(
      Object.values(weights).reduce((sum, value) => sum + value, 0),
    )
  )
    throw new Error(
      "JOURNEY_WEIGHTS must map known workflows to nonnegative integer weights with a positive total",
    );
  if (!env.FIXTURES_FILE) throw new Error("FIXTURES_FILE is required");
  return {
    publicBaseUrl: target(env.PUBLIC_BASE_URL, "PUBLIC_BASE_URL"),
    adminBaseUrl: target(env.ADMIN_BASE_URL, "ADMIN_BASE_URL"),
    fixturesFile: env.FIXTURES_FILE,
    profile,
    duration,
    errorRate,
    weights,
    rate: positive(env.RATE, 2, "RATE"),
    maxVUs: positive(env.MAX_VUS, profile === "smoke" ? 1 : 20, "MAX_VUS"),
    p95Ms: positive(env.P95_MS, 1500, "P95_MS"),
  };
}
export function joinUrl(base, path) {
  if (!path.startsWith("/") || path.startsWith("//"))
    throw new Error("API path must start with one slash");
  return base.replace(/\/+$/, "") + path;
}
export function validateManifest(manifest, config) {
  if (
    manifest.version !== 1 ||
    manifest.state !== "ready" ||
    !/^perf_[a-f0-9]{16}$/.test(manifest.runId)
  )
    throw new Error("Invalid fixture manifest version/runId");
  if (
    manifest.publicBaseUrl !== config.publicBaseUrl ||
    manifest.adminBaseUrl !== config.adminBaseUrl
  )
    throw new Error("Fixture target mismatch");
  const seconds =
    config.profile === "smoke"
      ? 600
      : durationSeconds(config.duration) *
          (config.profile === "stress" ? 3 : 1) +
        120;
  if (!(Date.parse(manifest.expiresAt) > Date.now() + seconds * 1000))
    throw new Error(
      "Fixture credentials expired or expire during the run; provision a fresh manifest",
    );
  if (!Array.isArray(manifest.slots) || manifest.slots.length < config.maxVUs)
    throw new Error("Fixture identity pool is smaller than MAX_VUS");
  validateOwnership(manifest);
  return manifest;
}
export function validateOwnership(manifest) {
  if (
    !/^perf_[a-f0-9]{16}$/.test(manifest.runId) ||
    !Array.isArray(manifest.slots)
  )
    throw new Error("Invalid fixture ownership manifest");
  const ids = new Set();
  for (const [index, slot] of manifest.slots.entries()) {
    for (const key of [
      "canteenId",
      "windowId",
      "dishId",
      "writeDishId",
      "reviewId",
      "newsId",
    ]) {
      const id = slot[key];
      if (
        typeof id !== "string" ||
        !id.startsWith(`${manifest.runId}_${index}_`) ||
        ids.has(id)
      )
        throw new Error(`Invalid or duplicate owned fixture: ${key}`);
      ids.add(id);
    }
    if (
      !Array.isArray(slot.dishIds) ||
      !slot.dishIds.includes(slot.dishId) ||
      new Set(slot.dishIds).size !== slot.dishIds.length ||
      slot.dishIds.some(
        (id) =>
          typeof id !== "string" ||
          !id.startsWith(`${manifest.runId}_${index}_`),
      )
    )
      throw new Error("Invalid owned read dataset");
    for (const key of ["user", "author", "admin"]) {
      const actor = slot[key];
      if (
        !actor?.id?.startsWith(`${manifest.runId}_${index}_`) ||
        ids.has(actor.id) ||
        typeof actor.token !== "string" ||
        !actor.token
      )
        throw new Error(`Invalid or duplicate identity: ${key}`);
      ids.add(actor.id);
    }
    if (!slot.admin.username || !slot.admin.password || !slot.user.refreshToken)
      throw new Error("Fixture login/refresh credentials missing");
  }
}
export function activeJourneys(config) {
  return config.profile === "smoke"
    ? journeyNames
    : journeyNames.filter((name) => config.weights[name] > 0);
}
export function selectJourney(config, iteration) {
  const names = activeJourneys(config);
  if (config.profile === "smoke") return names[iteration % names.length];
  const total = names.reduce((sum, name) => sum + config.weights[name], 0);
  let index = iteration % total;
  // Each cycle exercises every selected workflow before distributing repetitions.
  if (index < names.length) return names[index];
  index -= names.length;
  for (const name of names) {
    if (index < config.weights[name] - 1) return name;
    index -= config.weights[name] - 1;
  }
  throw new Error("Invalid workload selection");
}
export function buildOptions(config, journeys) {
  const thresholds = {
    journeys_started: ["count>0"],
    journeys_finished: ["count>0"],
    "checks{phase:workload}": [`rate>=${1 - config.errorRate}`],
    business_success: [`rate>=${1 - config.errorRate}`],
    "http_req_failed{phase:workload}": [`rate<=${config.errorRate}`],
    "http_req_duration{phase:workload}": [`p(95)<${config.p95Ms}`],
  };
  for (const journey of journeys) {
    thresholds[`journeys_completed{journey:${journey}}`] = ["count>0"];
    thresholds[`business_success{journey:${journey}}`] = [
      `rate>=${1 - config.errorRate}`,
    ];
  }
  let workload;
  if (config.profile === "smoke") {
    workload = {
      executor: "shared-iterations",
      vus: 1,
      iterations: journeys.length,
      maxDuration: "10m",
    };
  } else {
    thresholds.dropped_iterations = ["count==0"];
    workload = {
      executor: "constant-arrival-rate",
      rate: config.rate,
      timeUnit: "1s",
      duration: config.duration,
      preAllocatedVUs: config.maxVUs,
      maxVUs: config.maxVUs,
    };
    if (config.profile === "stress") {
      delete workload.rate;
      delete workload.duration;
      Object.assign(workload, {
        executor: "ramping-arrival-rate",
        startRate: config.rate,
        stages: [1, 2, 4].map((factor) => ({
          duration: config.duration,
          target: config.rate * factor,
        })),
      });
    }
  }
  return {
    scenarios: { workload },
    thresholds,
    discardResponseBodies: false,
    maxRedirects: 0,
    tags: { profile: config.profile },
    systemTags: ["status", "method", "name", "scenario", "expected_response"],
    summaryTrendStats: ["avg", "p(95)", "p(99)", "max"],
  };
}
