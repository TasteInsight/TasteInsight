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
