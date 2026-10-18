export const CASES = [
  "client-home",
  "client-search",
  "client-detail",
  "admin-login",
  "admin-dishes",
  "admin-edit",
];
export function browserConfig(env) {
  const number = (key, fallback, zero = false) => {
    const value = Number(env[key] ?? fallback);
    if (!Number.isFinite(value) || (zero ? value < 0 : value <= 0))
      throw new Error(`Invalid ${key}`);
    return value;
  };
  const mode = env.FRONTEND_MODE || "hybrid";
  if (!["baseline", "hybrid"].includes(mode))
    throw new Error("FRONTEND_MODE must be baseline or hybrid");
  const samples = number("FRONTEND_SAMPLES", 3);
  if (!Number.isSafeInteger(samples))
    throw new Error("FRONTEND_SAMPLES must be an integer");
  return {
    mode,
    samples,
    budgets: {
      FCP: number("FRONTEND_FCP_MS", 3000),
      LCP: number("FRONTEND_LCP_MS", 4500),
      CLS: number("FRONTEND_CLS", 0.1, true),
      readyMs: number("FRONTEND_READY_MS", 10000),
      actionMs: number("FRONTEND_ACTION_MS", 8000),
    },
  };
}
export function evaluateBrowserReport(samples, config, phase, load) {
  const failures = [];
  const seen = new Set();
  for (const sample of samples) {
    const key = `${sample.case}:${sample.sample}`;
    if (
      sample.phase !== phase ||
      !CASES.includes(sample.case) ||
      !Number.isInteger(sample.sample) ||
      sample.sample < 0 ||
      sample.sample >= config.samples ||
      seen.has(key)
    )
      failures.push(`invalid/duplicate sample ${key}`);
    seen.add(key);
    for (const [metric, budget] of Object.entries(config.budgets)) {
      const value = sample.metrics?.[metric];
      if (
        !Number.isFinite(value) ||
        (metric === "CLS" ? value < 0 : value <= 0) ||
        value > budget
      )
        failures.push(`${key}: ${metric}=${value}, budget=${budget}`);
    }
    if (!(sample.apiRequests > 0)) failures.push(`${key}: no real API traffic`);
    if (!Array.isArray(sample.failures) || sample.failures.length)
      failures.push(`${key}: request or runtime errors`);
    if (
      !Number.isFinite(sample.startedAt) ||
      !Number.isFinite(sample.finishedAt) ||
      !(sample.finishedAt > sample.startedAt)
    )
      failures.push(`${key}: invalid measurement window`);
    if (
      phase === "loaded" &&
      (!load?.passed ||
        !Number.isFinite(load.startedAt) ||
        !Number.isFinite(load.finishedAt) ||
        sample.startedAt < load.startedAt ||
        sample.finishedAt > load.finishedAt)
    )
      failures.push(`${key}: load did not cover measurement window`);
  }
  for (const name of CASES)
    for (let i = 0; i < config.samples; i++)
      if (!seen.has(`${name}:${i}`)) failures.push(`missing ${name}:${i}`);
  const summary = Object.fromEntries(
    CASES.map((name) => [
      name,
      Object.fromEntries(
        Object.keys(config.budgets).map((metric) => {
          const values = samples
            .filter(
              (s) => s.case === name && Number.isFinite(s.metrics?.[metric]),
            )
            .map((s) => s.metrics[metric])
            .sort((a, b) => a - b);
          return [
            metric,
            {
              median: values.length
                ? (values[Math.floor((values.length - 1) / 2)] +
                    values[Math.floor(values.length / 2)]) /
                  2
                : null,
              max: values.length ? values.at(-1) : null,
            },
          ];
        }),
      ),
    ]),
  );
  return { passed: failures.length === 0, phase, failures, summary };
}
