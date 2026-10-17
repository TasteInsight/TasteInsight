import { buildOptions, activeJourneys } from "./config.mjs";
export function evaluateSummary(
  summary,
  config,
  exitCode,
  interrupted = false,
) {
  const journeyNames = activeJourneys(config);
  const required = buildOptions(config, journeyNames).thresholds;
  const failures = [];
  for (const [metric, thresholds] of Object.entries(required)) {
    const actual = summary?.metrics?.[metric];
    if (
      !actual ||
      !actual.values ||
      thresholds.some((rule) => actual.thresholds?.[rule]?.ok !== true)
    )
      failures.push(metric);
  }
  for (const journey of journeyNames) {
    if (
      !(
        summary?.metrics?.[`journeys_completed{journey:${journey}}`]?.values
          ?.count > 0
      )
    )
      failures.push(`${journey}: no completed business flow`);
  }
  if (
    summary?.metrics?.journeys_started?.values?.count !==
    summary?.metrics?.journeys_finished?.values?.count
  )
    failures.push("unfinished business iterations");
  return {
    passed: exitCode === 0 && !interrupted && failures.length === 0,
    exitCode,
    interrupted,
    failedMetrics: failures,
  };
}
