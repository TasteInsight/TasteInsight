import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

test('the SDK compiler resolves Babel dependencies through pnpm symlinks', () => {
  const result = spawnSync(
    process.execPath,
    [
      '-e',
      `
    const { createRequire } = require('node:module');
    const sdkRequire = createRequire(require.resolve('miniprogram-ci'));
    require(sdkRequire.resolve('./utils/hackrequire/module'));
    const babel = sdkRequire('@babel/core');
    const preset = sdkRequire.resolve('@babel/preset-env');
    const result = babel.transformSync('const square = value => value ** 2;', {
      configFile: false, babelrc: false, presets: [[preset, { targets: { ie: '11' } }]],
    });
    require('node:assert/strict').match(result.code, /function/);
  `,
    ],
    { cwd: new URL('..', import.meta.url), encoding: 'utf8' }
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('compiled files are counted by package root and UTF-8 byte length', async () => {
  const { measurePackages } = await import('./mp-package-checks.mjs');
  const result = measurePackages(
    {
      'app.js': '食鉴',
      '/pages/dish/index.js': Buffer.alloc(10),
      'pages/dish/index.js.map': 'source map',
      'pages/dish-extra/index.js': 'main',
      'pages/settings/index.js': Buffer.alloc(3),
    },
    { subPackages: [{ root: 'pages/dish' }, { root: 'pages/settings' }] }
  );
  assert.deepEqual(
    result.map(({ name, size }) => ({ name, size })),
    [
      { name: '__APP__', size: 10 },
      { name: 'pages/dish/', size: 10 },
      { name: 'pages/settings/', size: 3 },
    ]
  );
});

test('the main package must stay below 1.5 MiB and subpackages may reach 2 MiB', async () => {
  const { measurePackages } = await import('./mp-package-checks.mjs');
  const mainLimit = 1.5 * 1024 * 1024;
  const subLimit = 2 * 1024 * 1024;
  const app = { subPackages: [{ root: 'pages/dish' }] };
  assert.equal(measurePackages({ 'app.js': Buffer.alloc(mainLimit - 1) }, app)[0].success, true);
  assert.equal(measurePackages({ 'app.js': Buffer.alloc(mainLimit) }, app)[0].success, false);
  assert.equal(
    measurePackages({ 'pages/dish/index.js': Buffer.alloc(subLimit) }, app)[1].success,
    true
  );
  assert.equal(
    measurePackages({ 'pages/dish/index.js': Buffer.alloc(subLimit + 1) }, app)[1].success,
    false
  );
});

test('rejects static imports into another subpackage while allowing shared main modules', async () => {
  const { findCrossPackageImports } = await import('./mp-package-checks.mjs');
  const graph = {
    files: [
      { path: 'common/vendor.js', subPackage: null },
      { path: 'pages/window/index.js', subPackage: 'pages/window/' },
      { path: 'pages/canteen/index.js', subPackage: 'pages/canteen/' },
    ],
    modules: [
      {
        path: 'pages/window/index.js',
        deps: [
          { from: 'file', type: 'Js', path: 'common/vendor.js' },
          { from: 'file', type: 'Js', path: 'pages/canteen/index.js' },
        ],
      },
    ],
  };
  assert.deepEqual(findCrossPackageImports(graph), [
    { from: 'pages/window/index.js', to: 'pages/canteen/index.js' },
  ]);
});

test('subpackage registration nodes do not represent runtime imports', async () => {
  const { findCrossPackageImports } = await import('./mp-package-checks.mjs');
  assert.deepEqual(findCrossPackageImports({
    files: [{ path: 'pages/search/index.json', subPackage: 'pages/search/' }],
    modules: [{
      path: 'pages/search/',
      deps: [{ from: 'json', type: 'Page', path: 'pages/search/index.json' }],
    }],
  }), []);
});
