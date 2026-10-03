const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '../..');
const workflow = (name) => fs.readFileSync(path.join(root, '.github/workflows', name), 'utf8');

function fixture(overrides = {}) {
  const context = {
    eventName: 'workflow_run',
    repo: { owner: 'tasteinsight', repo: 'app' },
    payload: {
      workflow_run: {
        event: 'push',
        conclusion: 'success',
        head_branch: 'main',
        head_sha: 'tested-sha',
        head_repository: { full_name: 'tasteinsight/app' },
        ...overrides,
      },
    },
  };
  let branchCalls = 0;
  const github = {
    rest: {
      repos: {
        async getBranch(params) {
          branchCalls += 1;
          assert.deepEqual(params, { owner: 'tasteinsight', repo: 'app', branch: 'main' });
          return { data: { commit: { sha: 'tested-sha' } } };
        },
      },
    },
  };
  return { context, github, branchCalls: () => branchCalls };
}

test('automatic deployment is triggered only by the aggregate CI workflow', () => {
  const cd = workflow('cd.yml');
  assert.match(cd, /workflows: \["CI - Required Checks"\]/);
  assert.doesNotMatch(cd, /workflows: \["CI - Backend", "CI - Frontend"\]/);
  const ci = workflow('ci.yml');
  assert.match(ci, /uses: \.\/\.github\/workflows\/ci-backend\.yml/);
  assert.match(ci, /uses: \.\/\.github\/workflows\/ci-frontend\.yml/);
  for (const name of ['ci-backend.yml', 'ci-frontend.yml']) {
    assert.match(workflow(name), /workflow_call:/);
    assert.doesNotMatch(workflow(name), /^  (push|pull_request):/m);
  }
  assert.doesNotMatch(ci, /continue-on-error:\s*true/);
});

test('path filtering applies to the release as a whole, not individual required jobs', () => {
  const ci = workflow('ci.yml');
  assert.match(ci, /'backend\/\*\*'/);
  assert.match(ci, /'frontend-web\/\*\*'/);
  assert.match(ci, /'\.github\/workflows\/\*\*'/);
  assert.match(ci, /'\.github\/scripts\/\*\*'/);
  assert.doesNotMatch(ci, /\n    if:/);
});

test('a successful push CI run at the current branch head may deploy', async () => {
  const evaluate = require('./deployment-gate.cjs');
  const f = fixture();
  assert.equal(await evaluate(f), true);
  assert.equal(f.branchCalls(), 1);
});

for (const conclusion of ['failure', 'cancelled', 'skipped', null]) {
  test(`a ${conclusion} CI result cannot deploy`, async () => {
    const f = fixture({ conclusion });
    assert.equal(await require('./deployment-gate.cjs')(f), false);
    assert.equal(f.branchCalls(), 0);
  });
}

test('pull request checks, including a fork branch named main, cannot deploy', async () => {
  const f = fixture({ event: 'pull_request' });
  assert.equal(await require('./deployment-gate.cjs')(f), false);
  assert.equal(f.branchCalls(), 0);
});

test('a workflow from another repository cannot deploy', async () => {
  const f = fixture({ head_repository: { full_name: 'fork/app' } });
  assert.equal(await require('./deployment-gate.cjs')(f), false);
  assert.equal(f.branchCalls(), 0);
});

test('an older tested commit cannot roll back a newer branch head', async () => {
  const f = fixture({ head_sha: 'old-sha' });
  assert.equal(await require('./deployment-gate.cjs')(f), false);
});

test('a successful rerun at the same source SHA remains deployable', async () => {
  const f = fixture({ run_attempt: 2 });
  assert.equal(await require('./deployment-gate.cjs')(f), true);
});

test('branch lookup failure fails closed', async () => {
  const f = fixture();
  f.github.rest.repos.getBranch = async () => { throw new Error('API unavailable'); };
  await assert.rejects(require('./deployment-gate.cjs')(f), /API unavailable/);
});

test('explicit manual and version-tag deployments remain supported', async () => {
  const evaluate = require('./deployment-gate.cjs');
  const f = fixture();
  f.context.eventName = 'workflow_dispatch';
  assert.equal(await evaluate(f), true);
  f.context.eventName = 'push';
  f.context.ref = 'refs/tags/v1.2.3';
  assert.equal(await evaluate(f), true);
  f.context.ref = 'refs/heads/main';
  assert.equal(await evaluate(f), false);
  assert.equal(f.branchCalls(), 0);
});
