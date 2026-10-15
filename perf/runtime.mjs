import { spawn } from "node:child_process";
import {
  readFileSync,
  existsSync,
  mkdirSync,
  writeFileSync,
  renameSync,
  rmSync,
  openSync,
  closeSync,
  unlinkSync,
} from "node:fs";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { resolve, dirname, isAbsolute } from "node:path";
export function cliEnv(argv, ambient = process.env) {
  let file, profile;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--env-file") file = argv[++i];
    else if (arg === "--profile") profile = argv[++i];
    else throw new Error(`Unknown argument: ${arg}`);
    if (!argv[i] || argv[i].startsWith("--"))
      throw new Error(`Missing value for ${arg}`);
  }
  const defaultFile = fileURLToPath(new URL(".env", import.meta.url));
  file = file
    ? resolve(file)
    : existsSync(defaultFile)
      ? defaultFile
      : undefined;
  const env = {
    ...(file ? parseEnv(readFileSync(resolve(file), "utf8")) : {}),
    ...ambient,
    ...(profile ? { PROFILE: profile } : {}),
  };
  if (file && env.FIXTURES_FILE && !isAbsolute(env.FIXTURES_FILE))
    env.FIXTURES_FILE = resolve(dirname(resolve(file)), env.FIXTURES_FILE);
  return env;
}
export function privateJson(path, value) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, JSON.stringify(value, null, 2) + "\n", {
      mode: 0o600,
      flag: "wx",
    });
    renameSync(temporary, path);
  } finally {
    rmSync(temporary, { force: true });
  }
}
export function acquireFixtureLock(path) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const lock = `${path}.lock`;
  const fd = openSync(lock, "wx", 0o600);
  try {
    writeFileSync(
      fd,
      JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }),
    );
  } catch (error) {
    unlinkSync(lock);
    throw error;
  } finally {
    closeSync(fd);
  }
  return Object.assign(() => unlinkSync(lock), { fixturePath: resolve(path) });
}
export function command(binary, args, options = {}) {
  const { signal, timeout = 300000, ...spawnOptions } = options;
  if (signal?.aborted) return Promise.reject(new Error("Command interrupted"));
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {
      ...spawnOptions,
      stdio: spawnOptions.stdio || ["ignore", "pipe", "pipe"],
    });
    let stdout = "",
      stderr = "",
      timedOut = false;
    child.stdout?.on("data", (chunk) => {
      stdout = (stdout + chunk).slice(-100000);
    });
    child.stderr?.on("data", (chunk) => {
      stderr = (stderr + chunk).slice(-100000);
    });
    const interrupt = () => void stopChild(child);
    signal?.addEventListener("abort", interrupt, { once: true });
    const timer = setTimeout(() => {
      timedOut = true;
      interrupt();
    }, timeout);
    const finished = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", interrupt);
    };
    child.once("error", (error) => {
      finished();
      reject(error);
    });
    child.once("close", (code, exitSignal) => {
      finished();
      if (signal?.aborted || timedOut)
        reject(
          new Error(timedOut ? "Command timed out" : "Command interrupted"),
        );
      else if (code === 0) resolve(stdout.trim());
      else
        reject(
          new Error(
            `${binary} ${args[0]} failed (${exitSignal || code}): ${(stderr || stdout).slice(-3000)}`,
          ),
        );
    });
  });
}
export async function stopChild(child) {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null)
    return;
  const closed = new Promise((resolve) => child.once("close", resolve));
  child.kill("SIGTERM");
  const timer = setTimeout(() => child.kill("SIGKILL"), 5000);
  await closed;
  clearTimeout(timer);
}
