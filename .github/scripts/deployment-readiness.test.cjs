const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const root = path.resolve(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const cd = read('.github/workflows/cd.yml');
const deploy = read('.github/scripts/deploy-release.sh');
const gatewayFiles = [
  'nginx.conf', 'nginx.https.conf.template', 'nginx.common.conf',
  'nginx.public.conf', 'nginx.admin.conf', 'gateway-render.sh',
];

for (const environment of ['dev', 'prod']) {
  test(`${environment} checks the legacy cutover before replacing configuration and deploys every gateway file`, () => {
    const job = cd.match(new RegExp(`  deploy-${environment}:([\\s\\S]*?)(?=\\n  deploy-|$)`))[1];
    assert.match(job, /sh deploy-release\.sh --check-legacy/);
    assert.match(job, /sh deploy-release\.sh\n/);
    const configurationCopy = job.indexOf('scp "$DEPLOY_TMP/docker-compose.yml"');
    assert.ok(configurationCopy > job.indexOf('sh deploy-release.sh --check-legacy'));
    for (const file of gatewayFiles) assert.ok(job.includes(file), file);
    assert.ok(job.indexOf('deployment completed') > job.lastIndexOf('sh deploy-release.sh'));
    assert.doesNotMatch(job, /--remove-orphans|image prune|down\s+-v/);
  });
}

test('deployment validates the gateway and gates roles on migration before exposing traffic', () => {
  const starts = [...deploy.matchAll(/^compose up ([^\n]+)/gm)];
  assert.equal(starts.length, 2);
  assert.match(starts[0][1], /--wait\b/);
  assert.match(starts[0][1], /--wait-timeout \d+/);
  assert.match(starts[0][1], /public-api admin-api worker frontend$/);
  assert.doesNotMatch(starts[0][1], /--no-deps/);
  assert.match(starts[1][1], /--no-deps\b/);
  assert.match(starts[1][1], /--force-recreate\b/);
  assert.match(starts[1][1], /--wait\b/);
  assert.match(starts[1][1], /--wait-timeout \d+/);
  assert.match(starts[1][1], /nginx$/);
  assert.ok(deploy.indexOf('compose run --rm --no-deps nginx nginx -t') < starts[0].index);
  assert.doesNotMatch(deploy, /--remove-orphans|image prune|down\s+-v|volume\s+(?:rm|prune)/);
});

function executeDeployment({ failTarget = '', legacy = false, checkOnly = false } = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tasteinsight-deploy-script-'));
  try {
    const log = path.join(directory, 'docker-calls');
    fs.writeFileSync(path.join(directory, '.env.production'), 'REDIS_PASSWORD=fixture\n');
    fs.writeFileSync(path.join(directory, 'docker-compose.yml'), 'services: {}\n');
    fs.writeFileSync(path.join(directory, 'gateway-render.sh'), '#!/bin/sh\n');
    fs.writeFileSync(path.join(directory, 'docker'), `#!/bin/sh
printf '%s\\n' "$*" >> "$MOCK_DOCKER_LOG"
for argument do last="$argument"; done
if [ "$4" = ps ]; then
  [ "$MOCK_LEGACY" != true ] || printf '%s\\n' backend
  exit 0
fi
if [ "$4" = config ] && [ "$MOCK_FAIL_TARGET" = config ]; then exit 1; fi
if [ "$4" = pull ] && [ "$MOCK_FAIL_TARGET" = pull ]; then exit 1; fi
if [ "$4" = run ] && [ "$MOCK_FAIL_TARGET" = gateway-validation ]; then exit 1; fi
if [ "$4" = up ] && [ "$last" = frontend ]; then
  case "$MOCK_FAIL_TARGET" in migrate|public-api|admin-api|worker|frontend) exit 1 ;; esac
fi
if [ "$4" = up ] && [ "$last" = nginx ] && [ "$MOCK_FAIL_TARGET" = nginx ]; then exit 1; fi
`, { mode: 0o755 });
    const result = spawnSync('/bin/sh', [
      path.join(root, '.github/scripts/deploy-release.sh'), ...(checkOnly ? ['--check-legacy'] : []),
    ], {
      cwd: directory,
      env: {
        PATH: `${directory}:/usr/bin:/bin`,
        MOCK_DOCKER_LOG: log,
        MOCK_FAIL_TARGET: failTarget,
        MOCK_LEGACY: String(legacy),
      },
      encoding: 'utf8',
      timeout: 10000,
    });
    if (result.error) throw result.error;
    return { ...result, calls: fs.readFileSync(log, 'utf8').trim().split('\n') };
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

for (const failTarget of ['', 'config', 'pull', 'gateway-validation', 'migrate', 'public-api', 'admin-api', 'worker', 'frontend', 'nginx']) {
  test(`deployment ${failTarget ? `fails closed when ${failTarget} fails` : 'reports success only after all readiness gates'}`, () => {
    const result = executeDeployment({ failTarget });
    assert.equal(result.status, failTarget ? 1 : 0, result.stderr);
    assert.equal(result.stdout.includes('deployment completed'), !failTarget);
    const gatewayStarted = result.calls.some((call) => call.includes('--force-recreate'));
    assert.equal(gatewayStarted, !failTarget || failTarget === 'nginx');
    assert.ok(result.calls[0].includes('ps --all --orphans'));
  });
}

test('a legacy backend blocks release before pulling or starting new consumers', () => {
  for (const checkOnly of [true, false]) {
    const result = executeDeployment({ legacy: true, checkOnly });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Legacy backend container detected/);
    assert.equal(result.calls.length, 1);
    assert.doesNotMatch(result.stdout, /deployment completed/);
  }
});

test('legacy preflight performs no release mutation', () => {
  const result = executeDeployment({ checkOnly: true });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.calls.length, 1);
  assert.match(result.calls[0], /ps --all --orphans/);
});

test('a newer workflow does not cancel a deployment in progress', () => {
  const concurrency = cd.match(/^concurrency:\n((?: {2}[^\n]*\n)+)/m)[1];
  assert.match(concurrency, /cancel-in-progress: false/);
});

test('embedding images do not download models during the default CD build', () => {
  assert.match(cd, /PRELOAD_MODEL=false/);
  assert.doesNotMatch(cd, /PRELOAD_MODEL=true/);
});
