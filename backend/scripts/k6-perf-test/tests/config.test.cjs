const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, mkdtempSync, writeFileSync, mkdirSync, copyFileSync, rmSync, existsSync } = require('node:fs');
const { join, resolve } = require('node:path');
const { tmpdir } = require('node:os');
const { spawnSync } = require('node:child_process');
const vm = require('node:vm');
const root = resolve(__dirname, '..');

async function load(env, client = false) {
  const requests = [];
  const context = vm.createContext({ __ENV: env, console: { log() {}, warn() {}, error() {} } });
  const config = new vm.SourceTextModule(readFileSync(join(root, 'config.js'), 'utf8'), { context });
  await config.link(() => { throw new Error('Unexpected config dependency'); });
  await config.evaluate();
  if (!client) return config.namespace;
  const http = new vm.SyntheticModule(['default'], function () {
    this.setExport('default', { post(...args) { requests.push(args); return { status: 401, body: '{}' }; } });
  }, { context });
  const k6 = new vm.SyntheticModule(['check'], function () { this.setExport('check', () => false); }, { context });
  const auth = new vm.SourceTextModule(readFileSync(join(root, 'scenarios/client-auth.js'), 'utf8'), { context });
  await auth.link(specifier => ({ '../config.js': config, 'k6/http': http, k6 })[specifier]);
  await auth.evaluate();
  return { auth: auth.namespace, requests };
}

test('local defaults require explicit local environment', async () => {
  const config = await load({ ENV: 'local' });
  assert.equal(config.BASE_URL, 'http://localhost/api/v1');
  assert.equal(config.ADMIN_CREDENTIALS.username, 'testadmin');
  assert.equal(config.ADMIN_CREDENTIALS.password, 'password123');
  await assert.rejects(load({}), /BASE_URL is required/);
  await assert.rejects(load({ ENV: 'production', BASE_URL: '   ' }), /BASE_URL is required/);
  await assert.rejects(load({ ENV: 'prod', BASE_URL: 'https://api.example.invalid' }), /ENV must be/);
});

test('environment controls credentials independently of hostname', async () => {
  for (const env of [{ BASE_URL: 'http://localhost/api/v1' }, { ENV: 'production', BASE_URL: 'https://api.example.invalid' }]) {
    const config = await load(env);
    assert.equal(config.IS_PRODUCTION, true);
    assert.equal(config.ADMIN_CREDENTIALS.username, null);
    assert.equal(config.ADMIN_CREDENTIALS.password, null);
  }
  const config = await load({ ENV: 'local', BASE_URL: ' https://api.example.invalid/api/v1/// ' });
  assert.equal(config.BASE_URL, 'https://api.example.invalid/api/v1');
  assert.equal(config.IS_PRODUCTION, false);
  assert.equal(config.ADMIN_CREDENTIALS.username, 'testadmin');
});

test('explicit credentials retain initial-admin precedence and aliases', async () => {
  const env = { BASE_URL: 'https://api.example.invalid', ADMIN_USERNAME: 'alias', ADMIN_PASSWORD: 'alias-password' };
  let config = await load(env);
  assert.equal(config.ADMIN_CREDENTIALS.username, 'alias');
  assert.equal(config.ADMIN_CREDENTIALS.password, 'alias-password');
  config = await load({ ...env, INITIAL_ADMIN_USERNAME: 'configured', INITIAL_ADMIN_PASSWORD: 'configured-password' });
  assert.equal(config.ADMIN_CREDENTIALS.username, 'configured');
  assert.equal(config.ADMIN_CREDENTIALS.password, 'configured-password');
});

test('client production login requires the requested identity before sending HTTP', async () => {
  const { auth, requests } = await load({ BASE_URL: 'https://api.example.invalid' }, true);
  for (const identity of ['baseline', 'secondary']) {
    assert.throws(() => auth.clientLogin(identity), /K6_MOCK_USER_CODE_.* is required/);
  }
  assert.equal(requests.length, 0);
});

test('client login uses configured identity or explicit local defaults', async () => {
  for (const env of [{ ENV: 'local' }, { BASE_URL: 'https://api.example.invalid', K6_MOCK_USER_CODE_BASELINE: 'configured-code' }]) {
    const { auth, requests } = await load(env, true);
    auth.clientLogin('baseline');
    assert.equal(requests.length, 1);
    assert.equal(requests[0][0], `${env.BASE_URL || 'http://localhost/api/v1'}/auth/wechat/login`);
    assert.equal(JSON.parse(requests[0][1]).code, env.K6_MOCK_USER_CODE_BASELINE || 'baseline_user_code_placeholder');
  }
});

function runScript(args, baseUrl, exitCode = 0) {
  const dir = mkdtempSync(join(tmpdir(), 'k6-config-test-'));
  try {
    copyFileSync(join(root, 'run-prod-test.sh'), join(dir, 'run-prod-test.sh'));
    mkdirSync(join(dir, 'scenarios'));
    writeFileSync(join(dir, 'scenarios/dish-status.js'), '');
    writeFileSync(join(dir, 'perf.env'), `BASE_URL='${baseUrl}'\nINITIAL_ADMIN_USERNAME=test-admin\nINITIAL_ADMIN_PASSWORD=test-password\n`);
    writeFileSync(join(dir, 'k6'), '#!/bin/bash\nif [ "$1" = version ]; then echo stub; exit 0; fi\nprintf "%s\\n" "$@" > "$CAPTURE"\nexit "$K6_EXIT_CODE"\n', { mode: 0o755 });
    const result = spawnSync('bash', [join(dir, 'run-prod-test.sh'), ...args], {
      encoding: 'utf8', env: { PATH: `${dir}:${process.env.PATH}`, K6_ENV_FILE: join(dir, 'perf.env'), CAPTURE: join(dir, 'args'), K6_EXIT_CODE: String(exitCode) },
    });
    return { ...result, args: existsSync(join(dir, 'args')) ? readFileSync(join(dir, 'args'), 'utf8').trim().split('\n') : [] };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

for (const args of [['connectivity'], ['full'], ['scenario', 'dish-status']]) {
  test(`runner passes explicit target and credentials: ${args[0]}`, () => {
    const result = runScript(args, 'https://api.example.invalid/api/v1');
    assert.equal(result.status, 0, result.stderr);
    for (const value of ['ENV=production', 'BASE_URL=https://api.example.invalid/api/v1', 'INITIAL_ADMIN_USERNAME=test-admin', 'INITIAL_ADMIN_PASSWORD=test-password']) {
      assert.ok(result.args.includes(value), value);
    }
    assert.ok(!result.stdout.includes('test-password'));
  });
}

test('runner rejects missing target before calling k6', () => {
  const result = runScript(['connectivity'], '   ');
  assert.equal(result.status, 1);
  assert.deepEqual(result.args, []);
});

test('full runner propagates k6 failure through log capture', () => {
  const result = runScript(['full'], 'https://api.example.invalid/api/v1', 7);
  assert.equal(result.status, 7);
  assert.ok(!result.stdout.includes('测试完成！'));
});
