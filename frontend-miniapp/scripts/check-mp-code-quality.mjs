import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ci from 'miniprogram-ci';
import { findCrossPackageImports, measurePackages } from './mp-package-checks.mjs';

// Local compilation uses the SDK's standard platform limits without fetching account metadata.
class LocalProject extends ci.Project {
  async attr() {
    return ci.DefaultProjectAttr;
  }
}

function createProject(projectPath) {
  return new LocalProject({
    appid: 'touristappid',
    type: 'miniProgram',
    projectPath,
    privateKey: 'unused-by-local-checks',
  });
}

async function compile(projectPath, resultType) {
  const project = createProject(projectPath);
  // Devtools scans unminified development JS; configure this before creating its compiler.
  if (resultType === 'dev') {
    project.setting = { ...project.setting, minified: false, uglifyFileName: false };
  }
  process.env.COMPILE_THREADS = '2';
  const builder = new ci.Builder(project, {});
  try {
    await builder.ready();
    const compiler = await builder.getCompiler();
    return await compiler.compile({
      setting: project.setting,
      resultType,
      disableSpreadingUsingComponents: true,
    });
  } finally {
    builder.destroy();
  }
}

async function check() {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const projectPath = path.resolve(
    root,
    process.argv[2] || process.env.UNI_OUTPUT_DIR || 'dist/build/mp-weixin'
  );
  const sizeReportPath = path.join(root, 'dist/quality/mp-weixin-compiled-size.json');
  fs.rmSync(sizeReportPath, { force: true });
  // The local checker does not sign or upload; CI's constructor requires nonempty fields.
  const project = createProject(projectPath);
  const results = await ci.checkCodeQuality(project);
  const reportPath = path.join(root, 'dist/quality/mp-weixin.json');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(results, null, 2)}\n`);

  for (const result of results) {
    console.log(`${result.success ? 'PASS' : 'FAIL'} ${result.name}`);
    if (!result.success && result.detail) console.log(JSON.stringify(result.detail));
  }
  console.log(`Code quality report: ${reportPath}`);

  const imports = findCrossPackageImports(await ci.analyseCode(project));
  console.log(`${imports.length ? 'FAIL' : 'PASS'} PACKAGE_IMPORT_BOUNDARIES`);
  for (const dependency of imports) console.log(`${dependency.from} -> ${dependency.to}`);
  const app = JSON.parse(fs.readFileSync(path.join(projectPath, 'app.json'), 'utf8'));
  const packages = [];
  for (const mode of ['dev', 'prod']) {
    const compiled = await compile(projectPath, mode);
    packages.push(...measurePackages(compiled, app).map(pkg => ({ mode, ...pkg })));
  }
  fs.writeFileSync(sizeReportPath, `${JSON.stringify(packages, null, 2)}\n`);
  for (const pkg of packages) {
    console.log(
      `${pkg.success ? 'PASS' : 'FAIL'} COMPILED_PACKAGE_SIZE ${pkg.mode} ${pkg.name}: ` +
        `${pkg.size} bytes (${(pkg.size / 1024).toFixed(1)} KiB), ` +
        `limit ${(pkg.limit / 1024).toFixed(0)} KiB, ` +
        `headroom ${(pkg.headroom / 1024).toFixed(1)} KiB`
    );
  }
  console.log(`Compiled package size report: ${sizeReportPath}`);
  return results.every(result => result.success) &&
    !imports.length &&
    packages.every(pkg => pkg.success)
    ? 0
    : 1;
}

check().then(
  // The official analyzer retains file watchers after returning its report.
  code => process.exit(code),
  error => {
    console.error(error.message);
    process.exit(1);
  }
);
