const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const backend = path.resolve(__dirname, '../../backend');
const source = fs.readFileSync(path.join(backend, 'docker-compose.yml'), 'utf8');
const credentials = {
  POSTGRES_USER: 'compose_fixture_user',
  POSTGRES_PASSWORD: 'compose-fixture-postgres-password',
  POSTGRES_DB: 'compose_fixture_database',
  REDIS_PASSWORD: 'compose-fixture-redis-password',
};
const configuration = {
  ...credentials,
  JWT_SECRET: 'fixture-access-secret-at-least-thirty-two-bytes',
  JWT_REFRESH_SECRET: 'fixture-refresh-secret-at-least-thirty-two-bytes',
  APP_URL: 'https://api.example.test',
  ADMIN_APP_URL: 'https://admin.example.test',
  COMPOSE_PROJECT_NAME: 'tasteinsight-fixture',
};
const roles = ['public-api', 'admin-api', 'worker', 'migrate'];
const runtimeRoles = ['public-api', 'admin-api', 'worker'];
const apiRoles = ['public-api', 'admin-api'];
const optionalGroups = {
  common: ['RUN_SEED', 'IMPORT_DATA', 'ENABLE_MOCK_AUTH', 'POSTGRES_SSLMODE', 'DATABASE_URL'],
  runtime: [
    'REDIS_REC_DB', 'EXTERNAL_EMBEDDING_SERVICE_ENABLED',
    'EXTERNAL_EMBEDDING_SERVICE_VERSION', 'EMBEDDING_SERVICE_BATCH_SIZE',
    'NOTIFICATION_WEBHOOK_URL',
    'WECHAT_APPID', 'WECHAT_SECRET',
    'MODERATION_ALIYUN_ACCESS_KEY_ID', 'MODERATION_ALIYUN_ACCESS_KEY_SECRET',
    'MODERATION_ALIYUN_REGION', 'MODERATION_ALIYUN_TEXT_SERVICE', 'MODERATION_ALIYUN_IMAGE_SERVICE',
    'MODERATION_WECHAT_TOKEN', 'MODERATION_WECHAT_AES_KEY',
    'MODERATION_MEDIA_SECRET', 'MODERATION_PUBLIC_BASE_URL',
    'WERSS_BASE_URL', 'WERSS_ADMIN_URL', 'WERSS_ACCESS_KEY', 'WERSS_SECRET_KEY',
  ],
  api: [
    'JWT_EXPIRATION_TIME', 'JWT_REFRESH_EXPIRATION_TIME',
    'CORS_ALLOWED_ORIGINS', 'TRUSTED_PROXY_CIDRS',
    'UPLOAD_BASE_URL', 'UPLOAD_MAX_FILE_SIZE',
  ],
  storage: [
    'UPLOAD_DEFAULT_STORAGE_ID', 'UPLOAD_STORAGE_INSTANCES',
    'S3_ENDPOINT', 'S3_REGION', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY',
    'S3_SESSION_TOKEN', 'S3_FORCE_PATH_STYLE', 'S3_PUBLIC_BASE_URL',
  ],
  public: [
    'AUTH_LOGIN_METHODS',
    'CAMPUS_VERIFICATION_METHODS',
    'WECHAT_APP_APPID', 'WECHAT_APP_SECRET',
    'WECHAT_OPEN_PLATFORM_ID', 'AUTH_CHALLENGE_SECRET', 'SMS_GATEWAY_URL', 'SMS_GATEWAY_TOKEN',
    'RESEND_API_KEY', 'EMAIL_FROM', 'CAMPUS_EMAIL_DOMAINS',
    'CAMPUS_OAUTH_AUTHORIZATION_URL', 'CAMPUS_OAUTH_TOKEN_URL', 'CAMPUS_OAUTH_USERINFO_URL',
    'CAMPUS_OAUTH_CLIENT_ID', 'CAMPUS_OAUTH_CLIENT_SECRET', 'CAMPUS_OAUTH_REDIRECT_URI',
    'CAMPUS_OAUTH_SCOPE', 'CAMPUS_OAUTH_ISSUER', 'CAMPUS_OAUTH_SUBJECT_CLAIM',
    'CAMPUS_OAUTH_STUDENT_CLAIM', 'CAMPUS_OAUTH_STUDENT_VALUES',
    'CAMPUS_OAUTH_TOKEN_AUTH_METHOD', 'CAMPUS_VERIFICATION_DAYS',
    'AI_PROVIDER', 'AI_API_KEY', 'AI_MODEL', 'AI_BASE_URL',
  ],
  worker: [
    'NOTIFICATION_WEBHOOK_SECRET', 'NOTIFICATION_WEBHOOK_POLL_MS',
    'NOTIFICATION_WEBHOOK_TIMEOUT_MS', 'NOTIFICATION_WEBHOOK_MAX_ATTEMPTS',
    'NOTIFICATION_WEBHOOK_BACKOFF_MS',
  ],
  migrate: ['INITIAL_ADMIN_USERNAME', 'INITIAL_ADMIN_PASSWORD'],
};
const optionalKeysFor = (role) => [
  ...optionalGroups.common,
  ...(runtimeRoles.includes(role) ? optionalGroups.runtime : []),
  ...(runtimeRoles.includes(role) ? optionalGroups.storage : []),
  ...(apiRoles.includes(role) ? optionalGroups.api : []),
  ...(role === 'public-api' ? optionalGroups.public : []),
  ...(role === 'worker' ? optionalGroups.worker : []),
  ...(role === 'migrate' ? optionalGroups.migrate : []),
];
const exampleKeys = (content) => [...content.matchAll(/^\s*(?:#\s*)?([A-Z][A-Z0-9_]*)=/gm)]
  .map((match) => match[1]);
const examples = [
  '.env.example', '.env.production.example', '.env.test.example', 'python-embedding-service/env.example',
].map((name) => {
  const content = fs.readFileSync(path.join(backend, name), 'utf8');
  return { name, content, keys: exampleKeys(content) };
});
const templates = examples.slice(0, 2).map((example) => example.content);
const configurationKeys = new Set([
  ...Object.keys(configuration), ...Object.values(optionalGroups).flat(),
  ...[...source.matchAll(/\$\{([A-Z][A-Z0-9_]*)/g)].map((match) => match[1]),
  ...templates.flatMap((template) =>
    [...template.matchAll(/^\s*(?:#\s*)?([A-Z][A-Z0-9_]*)=/gm)].map((match) => match[1])),
]);

function resolveCompose(fileValues = configuration, overrides = {}, fileName = '.env.production') {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tasteinsight-compose-config-'));
  try {
    fs.writeFileSync(path.join(directory, 'docker-compose.yml'), source);
    fs.copyFileSync(path.join(backend, 'docker-compose.local.yml'), path.join(directory, 'docker-compose.local.yml'));
    fs.writeFileSync(path.join(directory, fileName), typeof fileValues === 'string' ? fileValues :
      Object.entries(fileValues).map(([key, value]) => `${key}='${value}'`).join('\n'));
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
      !configurationKeys.has(key) && !key.startsWith('COMPOSE_')));
    const result = spawnSync('docker', [
      'compose', '--project-directory', directory, '--env-file', fileName,
      '-f', 'docker-compose.yml', 'config', '--format', 'json',
    ], { cwd: directory, env: { ...env, ...overrides }, encoding: 'utf8', timeout: 10000 });
    if (result.error) throw result.error;
    return { status: result.status, stderr: result.stderr,
      config: result.status === 0 ? JSON.parse(result.stdout) : undefined };
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function assertSharedCredentials(config, expected) {
  const { db, redis } = config.services;
  for (const key of ['POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_DB']) {
    assert.equal(db.environment[key], expected[key], `db ${key}`);
  }
  for (const role of roles) {
    const application = config.services[role];
    for (const key of ['POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_DB']) {
      assert.equal(application.environment[key], expected[key], `${role} ${key}`);
    }
    assert.equal(application.environment.NODE_ENV, 'production');
    assert.equal(application.ports, undefined);
  }
  for (const role of runtimeRoles) {
    const application = config.services[role];
    assert.equal(application.environment.REDIS_PASSWORD, expected.REDIS_PASSWORD);
    assert.equal(application.environment.REDIS_HOST, 'redis');
    assert.equal(application.environment.REDIS_PORT, '6379');
  }
  assert.equal(redis.command.at(-1), expected.REDIS_PASSWORD);
  assert.equal(redis.healthcheck.test.at(-2), expected.REDIS_PASSWORD);
  assert.equal(db.ports, undefined);
  assert.equal(redis.ports, undefined);
}

test('production services share credentials from the selected environment file', () => {
  const result = resolveCompose();
  assert.equal(result.status, 0, result.stderr);
  assertSharedCredentials(result.config, credentials);
});

test('only the selected operator env file is read and no role imports it wholesale', () => {
  assert.doesNotMatch(source, /^\s+env_file:/m);
  const result = resolveCompose({
    ...configuration, UNRELATED_DEPLOYMENT_SECRET: 'not-for-an-application',
  }, {}, 'operator.env');
  assert.equal(result.status, 0, result.stderr);
  for (const service of Object.values(result.config.services)) {
    assert.equal(service.environment?.UNRELATED_DEPLOYMENT_SECRET, undefined);
  }
});

test('each role receives only the settings consumed by its application root', () => {
  const optionalValues = Object.fromEntries(Object.values(optionalGroups).flat()
    .map((key) => [key, `fixture-${key.toLowerCase()}`]));
  const result = resolveCompose({ ...configuration, ...optionalValues });
  assert.equal(result.status, 0, result.stderr);
  for (const role of roles) {
    const environment = result.config.services[role].environment;
    const expectedKeys = [
      'NODE_ENV', 'POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_DB', 'POSTGRES_HOST', 'POSTGRES_PORT',
      ...optionalKeysFor(role),
      ...(runtimeRoles.includes(role)
        ? ['PORT', 'REDIS_HOST', 'REDIS_PORT', 'REDIS_PASSWORD', 'EXTERNAL_EMBEDDING_SERVICE_URL'] : []),
      ...(apiRoles.includes(role)
        ? ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'APP_URL', 'ADMIN_APP_URL'] : []),
      ...(runtimeRoles.includes(role) ? ['UPLOAD_LOCAL_PATH'] : []),
    ];
    assert.deepEqual(Object.keys(environment).sort(), expectedKeys.sort(), role);
    for (const key of optionalKeysFor(role)) {
      assert.equal(environment[key], optionalValues[key], `${role} ${key}`);
    }
    if (apiRoles.includes(role)) {
      assert.equal(environment.JWT_SECRET, configuration.JWT_SECRET);
      assert.equal(environment.JWT_REFRESH_SECRET, configuration.JWT_REFRESH_SECRET);
      assert.equal(environment.UPLOAD_LOCAL_PATH, '/app/uploads');
    }
  }
});

test('omitted optional values remain unresolved instead of overriding application defaults', () => {
  const result = resolveCompose();
  assert.equal(result.status, 0, result.stderr);
  for (const role of roles) {
    for (const key of optionalKeysFor(role)) {
      // Compose renders null for an unresolved pass-through and omits it from container env.
      assert.equal(result.config.services[role].environment[key], null, `${role} ${key}`);
    }
  }
});

test('optional settings preserve explicit blanks and shell precedence over file values', () => {
  const optionalValues = Object.fromEntries(Object.values(optionalGroups).flat()
    .map((key) => [key, `file-${key.toLowerCase()}`]));
  for (const overrides of [
    Object.fromEntries(Object.keys(optionalValues).map((key) => [key, ''])),
    Object.fromEntries(Object.keys(optionalValues).map((key) => [key, `shell-${key.toLowerCase()}`])),
  ]) {
    const result = resolveCompose({ ...configuration, ...optionalValues }, overrides);
    assert.equal(result.status, 0, result.stderr);
    for (const role of roles) {
      for (const key of optionalKeysFor(role)) {
        assert.equal(result.config.services[role].environment[key], overrides[key], `${role} ${key}`);
      }
    }
  }
  const blankFile = resolveCompose({
    ...configuration, ...Object.fromEntries(Object.keys(optionalValues).map((key) => [key, ''])),
  });
  assert.equal(blankFile.status, 0, blankFile.stderr);
  for (const role of roles) {
    for (const key of optionalKeysFor(role)) {
      assert.equal(blankFile.config.services[role].environment[key], '', `${role} ${key}`);
    }
  }
});

test('production example renders with only required credentials replaced', () => {
  const result = resolveCompose(templates[1], {
    ...credentials,
    JWT_SECRET: configuration.JWT_SECRET,
    JWT_REFRESH_SECRET: configuration.JWT_REFRESH_SECRET,
  });
  assert.equal(result.status, 0, result.stderr);
  assertSharedCredentials(result.config, credentials);
  for (const role of roles) {
    for (const key of optionalKeysFor(role)) {
      assert.equal(result.config.services[role].environment[key], null, `${role} ${key}`);
    }
  }
  assert.equal(result.config.name, 'tasteinsight-production');
  assert.equal(result.config.services['embedding-service'], undefined);
  const { nginx } = result.config.services;
  assert.equal(nginx.environment.APP_URL, 'https://api.example.com');
  assert.equal(nginx.environment.ADMIN_APP_URL, 'https://admin.example.com');
  assert.equal(nginx.environment.GATEWAY_TLS_MODE, 'on');
  assert.equal(nginx.ports.find((port) => port.target === 80).published, '80');
  assert.equal(nginx.ports.find((port) => port.target === 443).published, '443');
});

test('compact templates and the shared reference retain every optional capability', () => {
  const reference = fs.readFileSync(path.join(backend, '../docs/环境变量参考.md'), 'utf8');
  for (const [index, template] of templates.entries()) {
    const available = new Set([...(template + '\n' + reference).matchAll(/^\s*(?:#\s*)?([A-Z][A-Z0-9_]*)=/gm)]
      .map((match) => match[1]));
    const active = new Set([...template.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)]
      .map((match) => match[1]));
    for (const key of Object.values(optionalGroups).flat()) {
      assert.ok(available.has(key), `${index === 0 ? 'development' : 'production'} ${key}`);
      if (index === 0 && key === 'CORS_ALLOWED_ORIGINS') continue;
      assert.equal(active.has(key), false, `optional or default tuning remains commented: ${key}`);
    }
    for (const key of [
      'EXTERNAL_EMBEDDING_SERVICE_URL', 'PYTHON_EMBEDDING_TEXT_MODEL',
      'PYTHON_EMBEDDING_DEFAULT_VERSION', 'PYTHON_EMBEDDING_DEVICE',
      'PYTHON_EMBEDDING_PRELOAD_MODELS', 'HF_ENDPOINT',
    ]) {
      assert.ok(available.has(key), key);
    }
    for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET', ...Object.keys(credentials)]) {
      assert.ok(active.has(key), `required setting remains active: ${key}`);
    }
  }
  for (const setting of [
    'NODE_ENV=development', 'PORT=3001', 'POSTGRES_HOST=localhost', 'POSTGRES_PORT=5434',
    'REDIS_HOST=localhost', 'REDIS_PORT=6380',
    'UPLOAD_LOCAL_PATH=./uploads-dev',
  ]) {
    assert.ok(templates[0].split('\n').includes(setting), `development connection: ${setting}`);
  }
  assert.doesNotMatch(templates[0], /^(DATABASE_URL|POSTGRES_EXPOSE_PORT|REDIS_EXPOSE_PORT)=/m);
});

test('examples contain no duplicate assignments and keep test data isolated', () => {
  for (const example of examples) assert.equal(new Set(example.keys).size, example.keys.length, example.name);
  assert.match(examples[2].content, /^NODE_ENV=test$/m);
  assert.match(examples[2].content, /^DATABASE_URL=.*\/tasteinsight_test\?schema=public$/m);
  for (const template of templates) {
    assert.ok(template.split('\n').filter(line => /^[A-Z][A-Z0-9_]*=/.test(line)).length < 30);
  }
});

test('shell credential overrides apply to both the application and infrastructure', () => {
  const overrides = {
    POSTGRES_USER: 'shell_fixture_user',
    POSTGRES_PASSWORD: 'shell-fixture-postgres-password',
    POSTGRES_DB: 'shell_fixture_database',
    REDIS_PASSWORD: 'shell-fixture-redis-password',
  };
  const result = resolveCompose(configuration, overrides);
  assert.equal(result.status, 0, result.stderr);
  assertSharedCredentials(result.config, overrides);
});

test('raw passwords retain URL punctuation in file and shell configurations', () => {
  const fileValues = { ...configuration, POSTGRES_PASSWORD: 'p@ss:/?#%word', REDIS_PASSWORD: 'r@dis:/?#%word' };
  const overrides = { POSTGRES_PASSWORD: 'other:/?#%@word', REDIS_PASSWORD: 'other:/?#%@redis' };
  for (const [file, shell] of [[fileValues, {}], [fileValues, overrides]]) {
    const result = resolveCompose(file, shell);
    assert.equal(result.status, 0, result.stderr);
    assertSharedCredentials(result.config, { ...file, ...shell });
  }
});

test('application and gateway readiness probes gate public traffic', () => {
  const result = resolveCompose();
  assert.equal(result.status, 0, result.stderr);
  const { frontend, nginx, migrate } = result.config.services;
  for (const role of ['public-api', 'admin-api', 'worker']) {
    const application = result.config.services[role];
    assert.deepEqual(application.healthcheck.test.slice(0, 3), ['CMD', 'node', '-e']);
    assert.match(application.healthcheck.test[3], /http:\/\/127\.0\.0\.1:3000\/health/);
    assert.match(application.healthcheck.test[3], /AbortSignal\.timeout\(3000\)/);
    assert.match(application.healthcheck.test[3], /response\.ok/);
    assert.equal(application.depends_on.migrate.condition, 'service_completed_successfully');
  }
  assert.equal(migrate.restart, 'no');
  assert.equal(migrate.healthcheck.disable, true);
  assert.deepEqual(Object.keys(migrate.depends_on), ['db']);
  assert.equal(migrate.depends_on.db.condition, 'service_healthy');
  assert.deepEqual(frontend.healthcheck.test.slice(0, 2), ['CMD', 'wget']);
  assert.ok(frontend.healthcheck.test.includes('http://127.0.0.1/'));
  assert.equal(nginx.healthcheck.test[0], 'CMD-SHELL');
  for (const target of ['public', 'admin', 'frontend']) {
    assert.ok(nginx.healthcheck.test[1].includes(`http://127.0.0.1/health/${target}`));
  }
  assert.equal(nginx.depends_on['public-api'].condition, 'service_healthy');
  assert.equal(nginx.depends_on['admin-api'].condition, 'service_healthy');
  assert.equal(nginx.depends_on.frontend.condition, 'service_healthy');
  assert.equal(result.config.services['public-api'].stop_grace_period, '30s');
  assert.equal(result.config.services.worker.stop_grace_period, '1m30s');
});

test('four roles share one image and preserve project-scoped data volumes and networks', () => {
  const result = resolveCompose();
  assert.equal(result.status, 0, result.stderr);
  const { services, networks, volumes } = result.config;
  assert.equal(services.backend, undefined);
  assert.equal(new Set(roles.map((role) => services[role].image)).size, 1);
  for (const [role, entrypoint] of Object.entries({
    'public-api': 'public', 'admin-api': 'admin', worker: 'worker', migrate: 'migrate',
  })) {
    assert.deepEqual(services[role].command, ['node', `dist/src/main.${entrypoint}`]);
    assert.equal(services[role].container_name, undefined);
    assert.ok(services[role].volumes.some((volume) => volume.source === 'uploads_data'));
  }
  for (const key of ['db-data', 'redis-data', 'uploads_data']) {
    assert.equal(volumes[key].name, `tasteinsight-fixture_${key}`);
  }
  assert.equal(networks.tasteinsight_net.name, 'tasteinsight-fixture_tasteinsight_net');
  assert.equal(networks.db_net.internal, true);
  assert.equal(services.frontend.ports, undefined);
});

test('origins and certificate locations are shared deployment configuration', () => {
  const overrides = {
    APP_URL: 'https://food.other.test:9443', ADMIN_APP_URL: 'https://manage.other.test:9443',
    TLS_CERTS_PATH: '/srv/shared/tls', TLS_CERT_FILE: 'chain.pem', TLS_KEY_FILE: 'server.key',
    GATEWAY_TLS_MODE: 'on', WORKER_STOP_GRACE_PERIOD: '60s',
  };
  const result = resolveCompose(configuration, overrides);
  assert.equal(result.status, 0, result.stderr);
  for (const role of [...apiRoles, 'nginx']) {
    assert.equal(result.config.services[role].environment.APP_URL, overrides.APP_URL);
    assert.equal(result.config.services[role].environment.ADMIN_APP_URL, overrides.ADMIN_APP_URL);
  }
  const { nginx, worker } = result.config.services;
  assert.equal(nginx.environment.GATEWAY_TLS_MODE, 'on');
  assert.equal(nginx.environment.TLS_CERT_FILE, 'chain.pem');
  assert.equal(nginx.environment.TLS_KEY_FILE, 'server.key');
  assert.ok(nginx.volumes.some((volume) => volume.source === '/srv/shared/tls' && volume.read_only));
  assert.ok(nginx.volumes.some((volume) =>
    volume.target === '/etc/tasteinsight/nginx/nginx.https.conf.template' &&
    volume.source.endsWith('/nginx.https.conf.template') && volume.read_only));
  assert.equal(worker.stop_grace_period, '1m0s');
});

test('embedding remains opt-in and shares no application secrets', () => {
  const disabled = resolveCompose();
  assert.equal(disabled.status, 0, disabled.stderr);
  assert.equal(disabled.config.services['embedding-service'], undefined);
  const enabled = resolveCompose(configuration, { COMPOSE_PROFILES: 'embedding' });
  assert.equal(enabled.status, 0, enabled.stderr);
  const embedding = enabled.config.services['embedding-service'];
  assert.ok(embedding);
  assert.equal(embedding.environment.POSTGRES_PASSWORD, undefined);
  assert.equal(embedding.environment.REDIS_PASSWORD, undefined);
  assert.equal(embedding.environment.JWT_SECRET, undefined);
  assert.equal(embedding.environment.INITIAL_ADMIN_PASSWORD, undefined);
  assert.deepEqual(Object.keys(embedding.environment).sort(), [
    'PYTHON_EMBEDDING_TEXT_MODEL', 'PYTHON_EMBEDDING_DEFAULT_VERSION',
    'PYTHON_EMBEDDING_DEVICE', 'PYTHON_EMBEDDING_PRELOAD_MODELS', 'HF_ENDPOINT',
  ].sort());
  for (const key of ['PYTHON_EMBEDDING_TEXT_MODEL', 'PYTHON_EMBEDDING_DEFAULT_VERSION', 'PYTHON_EMBEDDING_DEVICE']) {
    assert.equal(embedding.environment[key], null, `application owns ${key} default`);
  }
  assert.equal(embedding.environment.PYTHON_EMBEDDING_PRELOAD_MODELS, '');
  assert.equal(embedding.environment.HF_ENDPOINT, 'https://huggingface.co');
  assert.ok(embedding.volumes.some((volume) => volume.target === '/app/saved_models' && volume.source === 'embedding_models'));
  assert.match(fs.readFileSync(path.join(backend, 'python-embedding-service/Dockerfile'), 'utf8'), /^WORKDIR \/app$/m);
  assert.equal(enabled.config.services.worker.depends_on['embedding-service'].condition, 'service_healthy');
});

test('embedding model choices preserve file values, shell overrides and disabled preloading', () => {
  const values = {
    PYTHON_EMBEDDING_TEXT_MODEL: 'organization/custom-encoder',
    PYTHON_EMBEDDING_DEFAULT_VERSION: 'v3', PYTHON_EMBEDDING_DEVICE: 'cpu',
    PYTHON_EMBEDDING_PRELOAD_MODELS: 'v3', HF_ENDPOINT: 'https://models.example.test',
  };
  const configured = resolveCompose({ ...configuration, COMPOSE_PROFILES: 'embedding', ...values });
  assert.equal(configured.status, 0, configured.stderr);
  assert.deepEqual(configured.config.services['embedding-service'].environment, values);
  const blank = resolveCompose({ ...configuration, COMPOSE_PROFILES: 'embedding', ...values },
    Object.fromEntries(Object.keys(values).map((key) => [key, ''])));
  assert.equal(blank.status, 0, blank.stderr);
  assert.deepEqual(blank.config.services['embedding-service'].environment, {
    PYTHON_EMBEDDING_TEXT_MODEL: '', PYTHON_EMBEDDING_DEFAULT_VERSION: '',
    PYTHON_EMBEDDING_DEVICE: '', PYTHON_EMBEDDING_PRELOAD_MODELS: '', HF_ENDPOINT: 'https://huggingface.co',
  });
});

test('role connection endpoints may target externally managed infrastructure', () => {
  const overrides = {
    POSTGRES_HOST: 'postgres.private.test', POSTGRES_PORT: '55432',
    REDIS_HOST: 'redis.private.test', REDIS_PORT: '56379',
    EXTERNAL_EMBEDDING_SERVICE_URL: 'http://embedding.private.test:5001',
  };
  const result = resolveCompose(configuration, overrides);
  assert.equal(result.status, 0, result.stderr);
  for (const role of roles) {
    for (const [key, value] of Object.entries(overrides)) {
      assert.equal(result.config.services[role].environment[key],
        role === 'migrate' && !key.startsWith('POSTGRES_') ? undefined : value, `${role} ${key}`);
    }
  }
});

for (const key of [...Object.keys(credentials), 'JWT_SECRET', 'JWT_REFRESH_SECRET', 'APP_URL', 'ADMIN_APP_URL']) {
  test(`production configuration rejects missing or empty ${key} before creating services`, () => {
    const fileValues = { ...configuration };
    delete fileValues[key];
    for (const overrides of [{}, { [key]: '' }]) {
      const result = resolveCompose(fileValues, overrides);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, new RegExp(key));
      for (const value of Object.values(fileValues)) assert.ok(!result.stderr.includes(value));
    }
  });
}
