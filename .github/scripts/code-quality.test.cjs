const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '../..');
const { scripts } = JSON.parse(fs.readFileSync(path.join(root, 'backend/package.json'), 'utf8'));
const workflow = fs.readFileSync(path.join(root, '.github/workflows/ci-backend.yml'), 'utf8');

test('backend quality checks report errors without rewriting source files', () => {
  assert.equal(typeof scripts['lint:check'], 'string');
  assert.match(scripts['lint:check'], /^eslint\s/);
  assert.doesNotMatch(scripts['lint:check'], /--fix\b/);
  assert.equal(typeof scripts['format:check'], 'string');
  assert.match(scripts['format:check'], /^prettier\s/);
  assert.match(scripts['format:check'], /--check\b/);
  assert.doesNotMatch(scripts['format:check'], /--write\b/);
});

test('backend CI uses the read-only quality checks', () => {
  assert.match(workflow, /run: pnpm lint:check\s/);
  assert.match(workflow, /run: pnpm format:check\s/);
  assert.doesNotMatch(workflow, /run: pnpm lint\s/);
  assert.doesNotMatch(workflow, /run: pnpm format --check/);
});

test('backend CI checks TypeScript including tests without emitting files', () => {
  assert.equal(scripts['type-check'], 'tsc --noEmit --incremental false');
  assert.match(workflow, /run: pnpm type-check\s/);
});

test('projects, CI and Docker pin the same pnpm version', () => {
  const projects = ['backend', 'frontend-web', 'frontend-miniapp'];
  const packageManagers = projects.map((project) =>
    JSON.parse(fs.readFileSync(path.join(root, project, 'package.json'), 'utf8')).packageManager,
  );
  assert.match(packageManagers[0] ?? '', /^pnpm@\d+\.\d+\.\d+$/);
  assert.equal(new Set(packageManagers).size, 1);
  const version = packageManagers[0].slice('pnpm@'.length);
  for (const name of ['ci-backend.yml', 'ci-frontend.yml']) {
    const ci = fs.readFileSync(path.join(root, '.github/workflows', name), 'utf8');
    assert.equal(ci.match(/PNPM_VERSION: '([^']+)'/)[1], version);
  }
  for (const project of ['backend', 'frontend-web']) {
    const docker = fs.readFileSync(path.join(root, project, 'Dockerfile'), 'utf8');
    const versions = [...docker.matchAll(/corepack prepare pnpm@([^ ]+) --activate/g)];
    assert.ok(versions.length > 0);
    for (const match of versions) assert.equal(match[1], version);
    assert.doesNotMatch(docker, /npm install -g pnpm\b/);
  }
});

test('frontend CI checks both applications within the existing five-job pipeline', () => {
  const readWorkflow = (name) => fs.readFileSync(path.join(root, '.github/workflows', name), 'utf8');
  const frontend = readWorkflow('ci-frontend.yml');
  const jobNames = (source) => [...source.split('\njobs:\n')[1].matchAll(/^  ([\w-]+):/gm)]
    .map((match) => match[1]);
  assert.deepEqual(jobNames(readWorkflow('ci.yml')), ['backend', 'frontend', 'workflow-checks']);
  assert.deepEqual(jobNames(workflow), ['lint-and-build', 'test', 'docker-build']);
  assert.deepEqual(jobNames(frontend), ['build-and-test']);

  const steps = frontend.split('      - name: ').slice(1);
  const miniapp = steps.filter((step) => step.includes('working-directory: ./frontend-miniapp')).join('\n');
  const management = steps.filter((step) => !step.includes('working-directory: ./frontend-miniapp')).join('\n');
  for (const command of ['pnpm type-check', 'pnpm lint', 'pnpm test:unit', 'pnpm build']) {
    assert.ok(management.includes(command), `management: ${command}`);
  }
  for (const command of ['pnpm type-check', 'pnpm lint', 'pnpm test --runInBand',
    'pnpm build:mp-weixin', 'pnpm build:h5', 'pnpm build:app']) {
    assert.ok(miniapp.includes(command), `miniapp: ${command}`);
  }
  for (const project of ['frontend-web', 'frontend-miniapp']) {
    assert.ok(frontend.includes(`${project}/pnpm-lock.yaml`), `${project} cache`);
  }
  assert.doesNotMatch(frontend, /continue-on-error:\s*true|--passWithNoTests/);
});
