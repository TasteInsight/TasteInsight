import { readFileSync } from "node:fs";
// Playwright scopes each init script. Keep the library and registration in one script.
export const metricsScript =
  readFileSync(
    new URL(
      "../node_modules/web-vitals/dist/web-vitals.iife.js",
      import.meta.url,
    ),
    "utf8",
  ) +
  `\n;
window.__releaseVitals = {};
for (const key of ['FCP', 'LCP', 'CLS', 'INP']) {
  webVitals['on' + key](metric => { window.__releaseVitals[key] = metric.value; }, { reportAllChanges: true });
}
`;
