const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { resolve } = require("node:path");
const backend = resolve(__dirname, "../../backend");
const base = {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  APP_URL: "http://api.localhost:8080",
  ADMIN_APP_URL: "http://admin.localhost:8080",
  POSTGRES_USER: "fixture",
  POSTGRES_PASSWORD: "compose-test-password",
  POSTGRES_DB: "compose_test",
  REDIS_PASSWORD: "compose-redis-password",
  JWT_SECRET: "compose-test-access-key-32-characters",
  JWT_REFRESH_SECRET: "compose-test-refresh-key-32-characters",
};
function config(files = ["docker-compose.yml"], values = {}) {
  const result = spawnSync(
    "docker",
    [
      "compose",
      "--env-file",
      "/dev/null",
      ...files.flatMap((file) => ["-f", resolve(backend, file)]),
      "config",
      "--format",
      "json",
    ],
    { cwd: backend, env: { ...base, ...values }, encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}
test("default deployment remains a complete single-machine stack with role-scoped secrets", () => {
  const { services: s } = config();
  for (const name of [
    "db",
    "redis",
    "public-api",
    "admin-api",
    "worker",
    "migrate",
    "frontend",
    "nginx",
  ])
    assert.ok(s[name], name);
  assert.equal(s["public-api"].depends_on.db.required, true);
  assert.equal(s.migrate.depends_on.db.condition, "service_healthy");
  assert.equal(s.worker.environment.JWT_SECRET, undefined);
  assert.equal(s.frontend.environment, undefined);
  assert.equal(s.migrate.environment.REDIS_PASSWORD, undefined);
  assert.equal(s.db.ports, undefined);
  assert.equal(s.redis.ports, undefined);
  assert.equal(config().networks.db_net.internal, true);
});
test("external mode omits local infrastructure while retaining migration and independent mixed choices", () => {
  const files = ["docker-compose.yml", "docker-compose.external.yml"];
  const { services: s } = config(files, {
    POSTGRES_HOST: "database.example.invalid",
    POSTGRES_PORT: "6432",
    POSTGRES_SSLMODE: "require",
    REDIS_HOST: "cache.example.invalid",
    REDIS_PORT: "6388",
  });
  assert.equal(s.db, undefined);
  assert.equal(s.redis, undefined);
  assert.equal(s["public-api"].depends_on.db.required, false);
  assert.equal(
    s["public-api"].depends_on.migrate.condition,
    "service_completed_successfully",
  );
  assert.equal(
    s["public-api"].environment.POSTGRES_HOST,
    "database.example.invalid",
  );
  assert.equal(s.worker.environment.REDIS_PORT, "6388");
  assert.equal(s.migrate.environment.POSTGRES_SSLMODE, "require");
  for (const [profile, present, absent] of [
    ["local-db", "db", "redis"],
    ["local-redis", "redis", "db"],
  ]) {
    const result = config(files, { COMPOSE_PROFILES: profile });
    assert.ok(result.services[present]);
    assert.equal(result.services[absent], undefined);
  }
});
test("embedding endpoint and bundled service selection remain independent", () => {
  const external = config(undefined, {
    EXTERNAL_EMBEDDING_SERVICE_ENABLED: "true",
    EXTERNAL_EMBEDDING_SERVICE_URL: "https://embedding.example.invalid",
  }).services;
  assert.equal(external["embedding-service"], undefined);
  assert.equal(
    external["public-api"].environment.EXTERNAL_EMBEDDING_SERVICE_URL,
    "https://embedding.example.invalid",
  );
  const bundled = config(undefined, {
    COMPOSE_PROFILES: "embedding",
    EXTERNAL_EMBEDDING_SERVICE_ENABLED: "true",
  }).services;
  assert.ok(bundled["embedding-service"]);
  assert.equal(bundled["embedding-service"].environment.JWT_SECRET, undefined);
});
test("host development reuses service definitions and keeps existing volume identity", () => {
  const result = config(["docker-compose.local.yml"]);
  assert.equal(result.name, "tasteinsight-dev");
  assert.deepEqual(Object.keys(result.services).sort(), ["db", "redis"]);
  assert.equal(result.volumes["db-data"].name, "tasteinsight-dev_db-data");
  assert.equal(result.services.db.ports[0].host_ip, "127.0.0.1");
  assert.notEqual(result.networks.db_net.internal, true);
});

test("private target files stay ignored while public templates remain trackable", () => {
  for (const directory of ["backend", "frontend-miniapp", "frontend-web"]) {
    const result = spawnSync(
      "git",
      [
        "check-ignore",
        "--no-index",
        `${directory}/.env.external`,
        `${directory}/.env.production.local`,
      ],
      { cwd: resolve(backend, ".."), encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim().split("\n").length, 2);
    assert.equal(
      spawnSync(
        "git",
        ["check-ignore", "--no-index", `${directory}/.env.example`],
        { cwd: resolve(backend, "..") },
      ).status,
      1,
    );
  }
});

test("host infrastructure starts with only its own credentials", () => {
  const result = spawnSync(
    "docker",
    [
      "compose",
      "--env-file",
      "/dev/null",
      "-f",
      resolve(backend, "docker-compose.local.yml"),
      "config",
      "--quiet",
    ],
    {
      cwd: backend,
      encoding: "utf8",
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        POSTGRES_USER: "fixture",
        POSTGRES_PASSWORD: "private",
        POSTGRES_DB: "fixture",
        REDIS_PASSWORD: "private",
      },
    },
  );
  assert.equal(result.status, 0, result.stderr);
});

test("host infrastructure maps the application's connection ports without duplicate settings", () => {
  const { services } = config(["docker-compose.local.yml"], { POSTGRES_PORT: "5544", REDIS_PORT: "6399" });
  assert.equal(services.db.ports[0].published, "5544");
  assert.equal(services.db.ports[0].target, 5432);
  assert.equal(services.redis.ports[0].published, "6399");
  assert.equal(services.redis.ports[0].target, 6379);
  const legacy = config(["docker-compose.local.yml"], { POSTGRES_EXPOSE_PORT: "5545", REDIS_EXPOSE_PORT: "6398" }).services;
  assert.equal(legacy.db.ports[0].published, "5545");
  assert.equal(legacy.redis.ports[0].published, "6398");
  const override = config(["docker-compose.local.yml"], { POSTGRES_PORT: "5544", POSTGRES_EXPOSE_PORT: "5545" }).services;
  assert.equal(override.db.ports[0].published, "5544");
});

test("database health checks preserve literal usernames and database names", () => {
  const { services } = config(["docker-compose.local.yml"], { POSTGRES_USER: "app user", POSTGRES_DB: "app data" });
  assert.deepEqual(services.db.healthcheck.test, ["CMD", "pg_isready", "-U", "app user", "-d", "app data"]);
});


test("WeRSS is optional and shares only connection configuration with API and worker", () => {
  const defaults = config().services;
  assert.equal(defaults.werss, undefined);
  assert.equal(defaults["admin-api"].environment.WERSS_BASE_URL, null);
  for (const name of ["public-api", "admin-api", "worker"]) {
    assert.equal(defaults[name].depends_on.werss.required, false);
    assert.equal(defaults[name].depends_on.werss.condition, "service_healthy");
  }
  const enabled = config(undefined, {
    COMPOSE_PROFILES: "werss", WERSS_BASE_URL: "http://werss:8001",
    WERSS_ADMIN_URL: "https://rss.school.example", WERSS_ACCESS_KEY: "ak",
    WERSS_SECRET_KEY: "sk", WERSS_PASSWORD: "fixture-password", WERSS_SESSION_SECRET: "fixture-session",
  });
  const service = enabled.services.werss;
  assert.equal(service.ports[0].host_ip, "127.0.0.1");
  assert.equal(service.ports[0].target, 8001);
  assert.equal(service.environment.DB, "sqlite:////app/data/db.db");
  assert.equal(service.environment.PASSWORD, "fixture-password");
  assert.equal(service.environment.SECRET_KEY, "fixture-session");
  assert.match(service.image, /tasteinsight-werss:/);
  assert.ok(service.build.context.endsWith("/backend/werss"));
  assert.equal(service.environment.JWT_SECRET, undefined);
  assert.equal(service.environment.POSTGRES_PASSWORD, undefined);
  assert.equal(service.environment.WERSS_SECRET_KEY, undefined);
  assert.equal(service.volumes[0].source, "werss_data");
  assert.ok(service.healthcheck);
  for (const name of ["admin-api", "worker"]) {
    assert.equal(enabled.services[name].environment.WERSS_BASE_URL, "http://werss:8001");
    assert.equal(enabled.services[name].environment.WERSS_ACCESS_KEY, "ak");
    assert.equal(enabled.services[name].environment.WERSS_PASSWORD, undefined);
    assert.equal(enabled.services[name].environment.WERSS_SESSION_SECRET, undefined);
  }
});

test("WeRSS supports bundled profiles, external infrastructure, and an external collector independently", () => {
  const both = config(undefined, {COMPOSE_PROFILES: "embedding,werss", WERSS_PORT: "18001"}).services;
  assert.ok(both.werss);
  assert.ok(both["embedding-service"]);
  assert.equal(both.werss.ports[0].published, "18001");
  const mixed = config(["docker-compose.yml", "docker-compose.external.yml"], {COMPOSE_PROFILES: "werss"}).services;
  assert.ok(mixed.werss);
  assert.equal(mixed.db, undefined);
  assert.equal(mixed.redis, undefined);
  const external = config(undefined, {WERSS_BASE_URL: "https://collector.example.invalid", WERSS_ACCESS_KEY: "ak", WERSS_SECRET_KEY: "sk"}).services;
  assert.equal(external.werss, undefined);
  assert.equal(external["admin-api"].environment.WERSS_BASE_URL, "https://collector.example.invalid");
});
