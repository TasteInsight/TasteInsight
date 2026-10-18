import test from "node:test";
import assert from "node:assert/strict";
import { readConfig, selectJourney, activeJourneys } from "../config.mjs";
const env = {
  PUBLIC_BASE_URL: "http://localhost:3000",
  ADMIN_BASE_URL: "http://localhost:3001",
  FIXTURES_FILE: "fixtures.json",
  PROFILE: "load",
};
test("configured weights determine traffic and disabled workflows have no coverage threshold", () => {
  const c = readConfig({
    ...env,
    JOURNEY_WEIGHTS: '{"browsing":8,"posting":2}',
  });
  assert.deepEqual(activeJourneys(c), ["browsing", "posting"]);
  const counts = {};
  for (let i = 0; i < 100; i++) {
    const name = selectJourney(c, i);
    counts[name] = (counts[name] || 0) + 1;
  }
  assert.deepEqual(counts, { browsing: 80, posting: 20 });
  assert.equal(new Set([selectJourney(c, 0), selectJourney(c, 1)]).size, 2);
});
test("invalid workload weights fail during configuration, smoke always covers all workflows", () => {
  for (const value of [
    "{}",
    '{"unknown":1}',
    '{"browsing":-1}',
    '{"browsing":0}',
    '{"browsing":0.5}',
  ])
    assert.throws(() => readConfig({ ...env, JOURNEY_WEIGHTS: value }));
  const c = readConfig({
    ...env,
    PROFILE: "smoke",
    JOURNEY_WEIGHTS: '{"browsing":1}',
  });
  assert.equal(activeJourneys(c).length, 14);
});
