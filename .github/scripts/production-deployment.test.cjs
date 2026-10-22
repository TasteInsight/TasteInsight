const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const repository = path.resolve(__dirname, '../..');
const scripts = path.join(repository, '.github/scripts');
const workflow = fs.readFileSync(path.join(repository, '.github/workflows/cd.yml'), 'utf8');

function fixture(options = {}) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'tasteinsight-production-')));
  const previous = path.join(root, 'releases/previous');
  const release = path.join(root, 'releases/deploy-tested-1');
  for (const directory of ['shared/tls', 'bin', 'staging', 'mock', 'releases/previous/backend', 'releases/previous/ops']) {
    fs.mkdirSync(path.join(root, directory), { recursive: true });
  }
  const environment = 'POSTGRES_PASSWORD=server-only\nIMAGE_REGISTRY=tasteinsight-local\nTAG=old\n';
  fs.writeFileSync(path.join(root, 'shared/.env.production'), environment, { mode: 0o600 });
  fs.writeFileSync(path.join(root, 'shared/tls/private.key'), 'server-private-key');
  fs.writeFileSync(path.join(previous, 'compose.production.yml'), 'services:\n  frontend:\n    image: pinned-old-frontend\n    mem_limit: 96m\n');
  fs.writeFileSync(path.join(previous, 'compose.status.json'), JSON.stringify({
    services: { nginx: { networks: ['tasteinsight_net', 'status-edge'] } },
    networks: { 'status-edge': { external: true, name: 'tasteinsight-status-edge' } },
  }));
  fs.writeFileSync(path.join(previous, 'status.nginx.conf'), 'server status route');
  fs.writeFileSync(path.join(previous, 'ops/compose.yml'), 'ops release source');
  fs.writeFileSync(path.join(previous, 'ops/compose.server.json'), 'server ops overrides');
  fs.writeFileSync(path.join(root, 'bin/compose.sh'), '#!/bin/sh\n# original helper\n');
  fs.symlinkSync(previous, path.join(root, 'current'));
  const source = path.join(root, 'source');
  fs.mkdirSync(path.join(source, 'backend'), { recursive: true });
  fs.mkdirSync(path.join(source, '.github/scripts'), { recursive: true });
  fs.writeFileSync(path.join(source, 'backend/docker-compose.yml'), 'services: {}\n');
  fs.writeFileSync(path.join(source, 'backend/gateway-render.sh'), '#!/bin/sh\n');
  if (fs.existsSync(path.join(scripts, 'compose-production.sh'))) {
    fs.copyFileSync(path.join(scripts, 'compose-production.sh'), path.join(source, '.github/scripts/compose-production.sh'));
  }
  const packed = spawnSync('tar', ['-czf', path.join(root, 'staging/deploy-tested-1.tar.gz'), '-C', source, '.']);
  assert.equal(packed.status, 0, String(packed.stderr));
  fs.writeFileSync(path.join(root, 'mock/docker'), `#!/bin/sh
printf '%s\\n' "$*" >> "$MOCK_LOG"
if [ "$1" = ps ]; then
  [ "$MOCK_LEGACY" != true ] || printf '%s\\n' legacy-container
  exit 0
fi
while [ "$#" -gt 0 ]; do
  case "$1" in config|pull|run|up) operation=$1; break ;; esac
  shift
done
case "$operation:$MOCK_FAILURE" in
  config:config|pull:pull|run:gateway) exit 1 ;;
esac
if [ "$operation" = up ]; then
  for argument do last=$argument; done
  case "$last:$MOCK_FAILURE" in
    frontend:migrate|frontend:public-api|frontend:admin-api|frontend:worker|frontend:frontend|nginx:nginx) exit 1 ;;
  esac
fi
`, { mode: 0o755 });
  return {
    root, previous, release, environment,
    run() {
      return spawnSync('/bin/sh', [path.join(scripts, 'deploy-production.sh'), root, 'deploy-tested-1', 'registry.example/tasteinsight', 'image-tested-1'], {
        env: { PATH: path.join(root, 'mock') + ':' + process.env.PATH, MOCK_LOG: path.join(root, 'calls'), MOCK_FAILURE: options.failure || '', MOCK_LEGACY: String(!!options.legacy) },
        encoding: 'utf8', timeout: 10000,
      });
    },
    calls() { return fs.existsSync(path.join(root, 'calls')) ? fs.readFileSync(path.join(root, 'calls'), 'utf8').trim().split('\n') : []; },
    dispose() { fs.rmSync(root, { recursive: true, force: true }); },
  };
}

test('production CD uploads a source release and consumes server-owned configuration', () => {
  const production = workflow.split('  deploy-prod:')[1];
  assert.doesNotMatch(production, /PROD_ENV_FILE|PROD_SSL_CERT|PROD_SSL_KEY|PROD_NGINX_CONF/);
  assert.match(production, /git archive/);
  assert.match(production, /deploy-production\.sh/);
  assert.match(production, /\/srv\/tasteinsight/);
  assert.doesNotMatch(production, /scp[^\n]*\.env|scp[^\n]*cert/);
  assert.match(production, /REGISTRY_PASSWORD" \| ssh/);
  assert.doesNotMatch(workflow.match(/DEPLOY_IMAGE_TAG:[^\n]*/)[0], /run_attempt/);
  assert.match(production, /RELEASE_ID:.*github.run_attempt/);
});

test('successful production deployment preserves shared files and publishes one release', () => {
  const f = fixture();
  try {
    const result = f.run();
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Production deployment completed/);
    assert.equal(fs.realpathSync(path.join(f.root, 'current')), f.release);
    assert.equal(fs.readFileSync(path.join(f.root, 'shared/.env.production'), 'utf8'), f.environment);
    assert.equal(fs.readFileSync(path.join(f.root, 'shared/tls/private.key'), 'utf8'), 'server-private-key');
    assert.equal(fs.existsSync(path.join(f.release, 'backend/.env.production')), false);
    for (const file of ['compose.production.yml', 'compose.status.json', 'status.nginx.conf', 'ops/compose.server.json', 'ops/compose.yml']) {
      assert.equal(fs.readFileSync(path.join(f.release, file), 'utf8'), fs.readFileSync(path.join(f.previous, file), 'utf8'), file);
    }
    const images = JSON.parse(fs.readFileSync(path.join(f.release, 'compose.release.json'))).services;
    for (const role of ['public-api', 'admin-api', 'worker', 'migrate']) {
      assert.equal(images[role].image, 'registry.example/tasteinsight/tasteinsight-backend:image-tested-1');
    }
    assert.equal(images.frontend.image, 'registry.example/tasteinsight/tasteinsight-frontend:image-tested-1');
    assert.equal(images['embedding-service'].image, 'registry.example/tasteinsight/tasteinsight-embedding:image-tested-1');
    assert.equal(images.werss.image, 'registry.example/tasteinsight/tasteinsight-werss:image-tested-1');
    assert.equal(fs.readFileSync(path.join(f.root, 'bin/compose.sh'), 'utf8'), fs.readFileSync(path.join(scripts, 'compose-production.sh'), 'utf8'));
    const calls = f.calls();
    const composeCalls = calls.filter((call) => call.startsWith('compose '));
    for (const call of composeCalls) {
      assert.ok(call.includes('--project-name tasteinsight-production'));
      assert.ok(call.includes('--env-file ' + path.join(f.root, 'shared/.env.production')));
      assert.ok(call.indexOf('compose.release.json') > call.indexOf('compose.production.yml'));
      assert.ok(call.indexOf('compose.release.json') > call.indexOf('compose.status.json'));
    }
    assert.ok(calls.findIndex((call) => call.includes('nginx nginx -t')) < calls.findIndex((call) => call.includes(' up ')));
    assert.match(calls.at(-1), /up .*--no-deps .*--force-recreate .*--wait.*nginx$/);
    assert.doesNotMatch(calls.join('\n'), /--remove-orphans|down -v|prune/);
  } finally { f.dispose(); }
});

for (const failure of ['config', 'pull', 'gateway', 'migrate', 'public-api', 'admin-api', 'worker', 'frontend', 'nginx']) {
  test('production failure at ' + failure + ' retains the previous release and shared configuration', () => {
    const f = fixture({ failure });
    try {
      const result = f.run();
      assert.notEqual(result.status, 0, result.stderr);
      assert.ok(f.calls().some((call) => call.includes('compose.release.json')), 'release reached Compose validation');
      assert.equal(fs.realpathSync(path.join(f.root, 'current')), f.previous);
      assert.doesNotMatch(result.stdout, /Production deployment completed/);
      assert.equal(fs.readFileSync(path.join(f.root, 'shared/.env.production'), 'utf8'), f.environment);
      assert.equal(fs.readFileSync(path.join(f.root, 'bin/compose.sh'), 'utf8'), '#!/bin/sh\n# original helper\n');
    } finally { f.dispose(); }
  });
}

test('legacy backend blocks production before extracting a new release', () => {
  const f = fixture({ legacy: true });
  try {
    const result = f.run();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Legacy backend/);
    assert.equal(fs.existsSync(f.release), false);
  } finally { f.dispose(); }
});

test('production helper supports a previous release without a release image override', () => {
  const f = fixture();
  try {
    fs.copyFileSync(path.join(scripts, 'compose-production.sh'), path.join(f.root, 'bin/compose.sh'));
    const result = spawnSync('/bin/sh', [path.join(f.root, 'bin/compose.sh'), 'config', '--quiet'], {
      env: { PATH: path.join(f.root, 'mock') + ':' + process.env.PATH, MOCK_LOG: path.join(f.root, 'calls'), MOCK_FAILURE: '' }, encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    assert.doesNotMatch(f.calls().join('\n'), /compose.release.json/);
    assert.ok(f.calls()[0].includes(path.join(f.previous, 'backend/docker-compose.yml')));
  } finally { f.dispose(); }
});

test('real Compose resolves release images after server overrides and preserves deployment contracts', () => {
  const f = fixture();
  try {
    const result = f.run();
    assert.equal(result.status, 0, result.stderr);
    fs.copyFileSync(path.join(repository, 'backend/docker-compose.yml'), path.join(f.release, 'backend/docker-compose.yml'));
    fs.copyFileSync(path.join(repository, 'backend/docker-compose.local.yml'), path.join(f.release, 'backend/docker-compose.local.yml'));
    fs.appendFileSync(path.join(f.root, 'shared/.env.production'), [
      'POSTGRES_USER=fixture', 'POSTGRES_DB=fixture', 'REDIS_PASSWORD=fixture-redis-password',
      'JWT_SECRET=fixture-access-secret-at-least-thirty-two-bytes',
      'JWT_REFRESH_SECRET=fixture-refresh-secret-at-least-thirty-two-bytes',
      'APP_URL=https://api.example.test', 'ADMIN_APP_URL=https://admin.example.test',
      'TLS_CERTS_PATH=' + path.join(f.root, 'shared/tls'), '',
    ].join('\n'));
    const resolved = spawnSync('/bin/sh', [path.join(f.root, 'bin/compose.sh'), 'config', '--format', 'json'], {
      env: { PATH: process.env.PATH }, encoding: 'utf8', timeout: 10000,
    });
    assert.equal(resolved.status, 0, resolved.stderr);
    const config = JSON.parse(resolved.stdout);
    assert.equal(config.name, 'tasteinsight-production');
    for (const role of ['public-api', 'admin-api', 'worker', 'migrate']) {
      assert.equal(config.services[role].image, 'registry.example/tasteinsight/tasteinsight-backend:image-tested-1');
    }
    assert.equal(config.services.frontend.image, 'registry.example/tasteinsight/tasteinsight-frontend:image-tested-1');
    assert.equal(Number(config.services.frontend.mem_limit), 96 * 1024 * 1024);
    assert.equal(config.services['public-api'].depends_on.migrate.condition, 'service_completed_successfully');
    assert.equal(config.volumes['db-data'].name, 'tasteinsight-production_db-data');
    assert.equal(config.volumes.uploads_data.name, 'tasteinsight-production_uploads_data');
    assert.equal(config.networks['status-edge'].name, 'tasteinsight-status-edge');
    assert.ok(Object.hasOwn(config.services.nginx.networks, 'status-edge'));
    assert.ok(config.services.nginx.volumes.some((mount) => mount.source === path.join(f.root, 'shared/tls')));
    const optional = spawnSync('/bin/sh', [path.join(f.root, 'bin/compose.sh'), '--profile', 'embedding', '--profile', 'werss', 'config', '--format', 'json'], {
      env: { PATH: process.env.PATH }, encoding: 'utf8', timeout: 10000,
    });
    assert.equal(optional.status, 0, optional.stderr);
    const services = JSON.parse(optional.stdout).services;
    assert.equal(services.werss.image, 'registry.example/tasteinsight/tasteinsight-werss:image-tested-1');
    assert.equal(services['embedding-service'].image, 'registry.example/tasteinsight/tasteinsight-embedding:image-tested-1');
  } finally { f.dispose(); }
});

test('a newer workflow does not cancel a deployment in progress', () => {
  const concurrency = workflow.match(/^concurrency:\n((?: {2}[^\n]*\n)+)/m)[1];
  assert.match(concurrency, /cancel-in-progress: false/);
});

test('embedding images do not download models during the default CD build', () => {
  assert.match(workflow, /PRELOAD_MODEL=false/);
  assert.doesNotMatch(workflow, /PRELOAD_MODEL=true/);
});


test('release publishes the subpath-aware WeRSS image with the web UI matrix', () => {
  const job = workflow.match(/  build-frontend:([\s\S]*?)(?=\n  # 构建嵌入|$)/)[1];
  assert.match(job, /context: \.\/backend\/werss/);
  assert.match(job, /aliyun_repo: tasteinsight-werss/);
  assert.match(job, /context: \$\{\{ matrix\.context \}\}/);
  assert.match(job, /github\.repository \}\}-\$\{\{ matrix\.suffix/);
});
