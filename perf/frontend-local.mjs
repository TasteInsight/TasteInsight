import { cliEnv } from "./runtime.mjs";
import { runLocal } from "./local.mjs";
import { runFrontend, frontendEnv } from "./frontend.mjs";
try {
  const env = frontendEnv(cliEnv(process.argv.slice(2)));
  const maxVUs = Number(env.MAX_VUS);
  if (!Number.isSafeInteger(maxVUs) || maxVUs < 1)
    throw new Error("MAX_VUS must be a positive integer");
  // The browser owns one additional identity and resource set, outside the k6 VU pool.
  const result = await runLocal(
    { ...env, MAX_VUS: String(maxVUs + 1) },
    (runtime, options) =>
      runFrontend({ ...runtime, MAX_VUS: String(maxVUs) }, options),
  );
  if (!result.passed) process.exitCode = 1;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
