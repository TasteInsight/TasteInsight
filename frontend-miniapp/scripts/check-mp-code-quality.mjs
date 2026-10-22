import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ci from 'miniprogram-ci';

async function check() {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const projectPath = path.resolve(
    root,
    process.argv[2] || process.env.UNI_OUTPUT_DIR || 'dist/build/mp-weixin'
  );
  // The local checker does not sign or upload; CI's constructor requires nonempty fields.
  const project = new ci.Project({
    appid: 'touristappid',
    type: 'miniProgram',
    projectPath,
    privateKey: 'unused-by-local-code-quality-scan',
  });
  const results = await ci.checkCodeQuality(project);
  const reportPath = path.join(root, 'dist/quality/mp-weixin.json');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(results, null, 2)}\n`);

  for (const result of results) {
    console.log(`${result.success ? 'PASS' : 'FAIL'} ${result.name}`);
    if (!result.success && result.detail) console.log(JSON.stringify(result.detail));
  }
  console.log(`Code quality report: ${reportPath}`);
  return results.every(result => result.success) ? 0 : 1;
}

check().then(
  // The official analyzer retains file watchers after returning its report.
  code => process.exit(code),
  error => {
    console.error(error.message);
    process.exit(1);
  }
);
