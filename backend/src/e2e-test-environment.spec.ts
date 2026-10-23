import { spawnSync } from 'child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { dirname, join, resolve } from 'path';
import { ConfigModule } from '@nestjs/config';
import { environmentFileOptions, validateEnvironment } from './environment';

const backendRoot = resolve(__dirname, '..');
const scripts: Record<string, string> = JSON.parse(
  readFileSync(join(backendRoot, 'package.json'), 'utf8'),
).scripts;
const testDatabase =
  'postgresql://fixture:fixture-only-password@localhost:5432/catalog_test?schema=public';
const recommendationDatabase =
  'postgresql://fixture:fixture-only-password@localhost:5432/recommendation_test?schema=public';
const developmentDatabase =
  'postgresql://fixture:fixture-only-password@localhost:5432/catalog';

describe('E2E test environment boundary', () => {
  let directory: string;
  let environment: NodeJS.ProcessEnv;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'tasteinsight-e2e-environment-'));
    for (const name of ['bin', 'scripts', 'test']) {
      mkdirSync(join(directory, name));
    }
    for (const name of [
      'scripts/setup-test.sh',
      'scripts/test-environment.cjs',
      'test/setup-environment.cjs',
      'test/jest-e2e.json',
      'tsconfig.json',
    ]) {
      copyFileSync(join(backendRoot, name), join(directory, name));
    }
    symlinkSync(
      join(backendRoot, 'node_modules'),
      join(directory, 'node_modules'),
    );
    symlinkSync(process.execPath, join(directory, 'bin/node'));
    writeFileSync(
      join(directory, 'bin/dotenv'),
      `#!/bin/sh\nexec "${process.execPath}" "${require.resolve('dotenv-cli/cli.js')}" "$@"\n`,
      { mode: 0o755 },
    );
    writeFileSync(
      join(directory, 'bin/jest'),
      `#!/bin/sh\nexec "${process.execPath}" "${require.resolve('jest/bin/jest')}" --runInBand --watchman=false "$@"\n`,
      { mode: 0o755 },
    );
    for (const name of ['docker', 'sleep']) {
      writeFileSync(
        join(directory, 'bin', name),
        `#!/bin/sh\necho "${name}" >> "$CALL_LOG"\n`,
        { mode: 0o755 },
      );
    }
    writeFileSync(
      join(directory, 'bin/pnpm'),
      `#!/bin/sh
if [ "$1 $2" = "run test:setup" ]; then
  exec /bin/sh -c '${scripts['test:setup']}'
fi
case "$1 $2" in
  'run test:embedding:start'|'exec prisma'|'exec ts-node') echo "pnpm $*" >> "$CALL_LOG" ;;
  *) exit 86 ;;
esac
`,
      { mode: 0o755 },
    );
    writeFileSync(
      join(directory, 'test/application.ts'),
      `require('fs').writeFileSync(process.env.SUITE_LOG, JSON.stringify({
  mode: process.env.NODE_ENV,
  database: process.env.DATABASE_URL,
  recommendationDatabase: process.env.RECOMMENDATION_DATABASE_URL,
  redisPassword: process.env.REDIS_PASSWORD,
  mock: process.env.USE_MOCK_AI_PROVIDER,
}));\n`,
    );
    writeFileSync(
      join(directory, 'test/auth.e2e-spec.ts'),
      "import './application';\ntest('fixture', () => expect(true).toBe(true));\n",
    );
    environment = {
      PATH: `${join(directory, 'bin')}:${dirname(process.execPath)}:/usr/bin:/bin`,
      CALL_LOG: join(directory, 'calls'),
      SUITE_LOG: join(directory, 'suite-import'),
    };
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  function run(command: string, values: NodeJS.ProcessEnv = {}) {
    return spawnSync('/bin/sh', ['-c', command], {
      cwd: directory,
      env: { ...environment, ...values },
      encoding: 'utf8',
      timeout: 20000,
    });
  }

  function writeTestEnvironment() {
    writeFileSync(
      join(directory, '.env.test'),
      `NODE_ENV=test\nDATABASE_URL=${testDatabase}\nRECOMMENDATION_DATABASE_URL=${recommendationDatabase}\nREDIS_PORT=6381\nREDIS_PASSWORD=fixture-redis-password\nUSE_MOCK_AI_PROVIDER=true\n`,
    );
  }

  function expectRejected(result: ReturnType<typeof run>, key: string) {
    expect(result.error).toBeUndefined();
    // POSIX shells use different positive exit codes for missing required variables.
    expect(result.signal).toBeNull();
    expect(result.status).toBeGreaterThan(0);
    expect(result.stderr).toContain(key);
    expect(result.stderr).not.toContain('fixture-only-password');
    expect(existsSync(environment.SUITE_LOG!)).toBe(false);
    expect(existsSync(environment.CALL_LOG!)).toBe(false);
  }

  const directJest = 'jest --config ./test/jest-e2e.json';

  it('does not fill test configuration from a development .env', async () => {
    const file = join(directory, '.env');
    writeFileSync(file, `DATABASE_URL=${developmentDatabase}\nRUN_SEED=true\n`);
    let loaded: Record<string, unknown> = {};
    await ConfigModule.forRoot({
      ...environmentFileOptions({ NODE_ENV: 'test' }),
      envFilePath: file,
      ignoreEnvVars: true,
      validate: (values) => {
        loaded = values;
        return {};
      },
    });
    expect(loaded.DATABASE_URL).toBeUndefined();
    expect(loaded.RUN_SEED).toBeUndefined();
    expect(() => validateEnvironment({ NODE_ENV: 'test' })).not.toThrow();
  });

  it.each([directJest, scripts['test:e2e'], scripts['test:e2e:cov']])(
    'rejects missing .env.test and missing injected database through %s',
    (command) => {
      writeFileSync(
        join(directory, '.env'),
        `DATABASE_URL=${developmentDatabase}\n`,
      );
      expectRejected(run(command), 'DATABASE_URL');
    },
  );

  it.each([
    ['development', testDatabase, 'NODE_ENV'],
    ['test', developmentDatabase, 'DATABASE_URL'],
    [
      'test',
      'mysql://fixture:fixture-only-password@localhost/catalog_test',
      'DATABASE_URL',
    ],
    ['test', 'postgresql://localhost/', 'DATABASE_URL'],
    ['test', 'postgresql://localhost/catalog/other_test', 'DATABASE_URL'],
    ['test', 'postgresql://localhost/%zz_test', 'DATABASE_URL'],
  ])(
    'blocks direct Jest with mode %s and database %s',
    (NODE_ENV, DATABASE_URL, key) => {
      expectRejected(run(directJest, { NODE_ENV, DATABASE_URL }), key);
    },
  );

  it('does not overwrite an inherited development database with .env.test', () => {
    writeTestEnvironment();
    expectRejected(
      run(directJest, { NODE_ENV: 'test', DATABASE_URL: developmentDatabase }),
      'DATABASE_URL',
    );
  });

  it.each([directJest, scripts['test:e2e:cov']])(
    'accepts explicit CI injection without any environment file through %s',
    (command) => {
      const result = run(command, {
        NODE_ENV: 'test',
        DATABASE_URL: testDatabase,
        RECOMMENDATION_DATABASE_URL: recommendationDatabase,
        REDIS_PASSWORD: 'ci-fixture-redis',
      });
      expect(result.status).toBe(0);
      expect(JSON.parse(readFileSync(environment.SUITE_LOG!, 'utf8'))).toEqual({
        mode: 'test',
        database: testDatabase,
        recommendationDatabase,
        redisPassword: 'ci-fixture-redis',
      });
    },
  );

  it.each([directJest, scripts['test:e2e']])(
    'loads local .env.test before imports through %s',
    (command) => {
      writeTestEnvironment();
      const result = run(command);
      expect(result.status).toBe(0);
      expect(JSON.parse(readFileSync(environment.SUITE_LOG!, 'utf8'))).toEqual({
        mode: 'test',
        database: testDatabase,
        recommendationDatabase,
        redisPassword: 'fixture-redis-password',
        mock: 'true',
      });
    },
  );

  it.each(['test:e2e', 'test:e2e:cov', 'test:e2e:auth'])(
    'rejects an inherited development database through %s',
    (name) => {
      writeTestEnvironment();
      expectRejected(
        run(scripts[name], { DATABASE_URL: developmentDatabase }),
        '_test',
      );
    },
  );

  it('rejects a non-test mode before single-suite setup side effects', () => {
    writeTestEnvironment();
    expectRejected(
      run(scripts['test:e2e:auth'], { NODE_ENV: 'development' }),
      'NODE_ENV',
    );
  });

  it('preserves dotenv-cli interpolation in the local E2E command', () => {
    writeTestEnvironment();
    writeFileSync(
      join(directory, '.env.test'),
      'FIXTURE_REDIS_TOKEN=expanded-fixture-password\nREDIS_PASSWORD=${FIXTURE_REDIS_TOKEN}\n',
      { flag: 'a' },
    );
    expect(run(scripts['test:e2e']).status).toBe(0);
    expect(
      JSON.parse(readFileSync(environment.SUITE_LOG!, 'utf8')).redisPassword,
    ).toBe('expanded-fixture-password');
  });

  it.each([
    ['development', testDatabase, 'NODE_ENV'],
    [
      'test',
      'mysql://fixture:fixture-only-password@localhost/catalog_test',
      'DATABASE_URL',
    ],
  ])(
    'blocks setup before side effects for mode %s and database %s',
    (NODE_ENV, DATABASE_URL, key) => {
      expectRejected(
        run('sh scripts/setup-test.sh', {
          NODE_ENV,
          DATABASE_URL,
          REDIS_PORT: '6381',
          REDIS_PASSWORD: 'fixture-redis-password',
        }),
        key,
      );
    },
  );

  describe.each([directJest, 'sh scripts/setup-test.sh'])(
    'recommendation database boundary through %s',
    (command) => {
      it.each([
        developmentDatabase,
        'mysql://fixture:fixture-only-password@localhost/recommendation_test',
        'postgresql://localhost/recommendation/other_test',
        'postgresql://localhost/%zz_test',
        testDatabase,
        'postgresql://other:fixture-only-password@127.0.0.1/catalog_test?schema=other',
      ])('rejects an unsafe recommendation database %s', (url) => {
        expectRejected(
          run(command, {
            NODE_ENV: 'test',
            DATABASE_URL: testDatabase,
            RECOMMENDATION_DATABASE_URL: url,
            REDIS_PORT: '6381',
            REDIS_PASSWORD: 'fixture-redis-password',
          }),
          'RECOMMENDATION_DATABASE_URL',
        );
      });
    },
  );

  it('requires the recommendation database before setup side effects', () => {
    expectRejected(
      run('sh scripts/setup-test.sh', {
        NODE_ENV: 'test',
        DATABASE_URL: testDatabase,
        REDIS_PORT: '6381',
        REDIS_PASSWORD: 'fixture-redis-password',
      }),
      'RECOMMENDATION_DATABASE_URL',
    );
  });

  it('retains setup environment loading with only stubbed Docker and Prisma commands', () => {
    writeTestEnvironment();
    const result = run(scripts['test:setup']);
    expect(result.status).toBe(0);
    expect(
      readFileSync(environment.CALL_LOG!, 'utf8').trim().split('\n'),
    ).toEqual([
      'docker',
      'docker',
      'pnpm run test:embedding:start',
      'sleep',
      'pnpm exec prisma migrate deploy',
      'pnpm exec prisma generate',
      'pnpm exec ts-node scripts/recommendation-store-migrate.ts',
      'pnpm exec ts-node prisma/seed.ts',
    ]);
  });
});
