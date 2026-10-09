import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  rmSync,
  mkdirSync,
} from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { spawnSync } from 'child_process';
import { ConfigModule } from '@nestjs/config';
import { environmentFileOptions, validateEnvironment } from './environment';

describe('environment startup ordering', () => {
  let directory: string;
  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'tasteinsight-preflight-'));
  });
  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });
  it.each([0, 1])('preflight exit %s controls migrations', (status) => {
    const log = join(directory, 'calls');
    writeFileSync(
      join(directory, 'node'),
      `#!/bin/sh\necho "node $*" >> "$CALL_LOG"\ncase "$1" in\n*database-url.js) echo postgresql://fixture:fixture@db/app;;\n*environment.js) exit ${status};;\nesac\n`,
      { mode: 0o755 },
    );
    writeFileSync(
      join(directory, 'npx'),
      '#!/bin/sh\necho "npx $*" >> "$CALL_LOG"\n',
      { mode: 0o755 },
    );
    const result = spawnSync(
      '/bin/sh',
      [resolve(__dirname, '../docker-entrypoint.sh'), 'node', 'dist/src/main'],
      {
        cwd: directory,
        env: {
          PATH: `${directory}:/usr/bin:/bin`,
          CALL_LOG: log,
          NODE_ENV: 'production',
          RUN_SEED: 'false',
        },
        encoding: 'utf8',
      },
    );
    const calls = readFileSync(log, 'utf8').trim().split('\n');
    expect(calls.slice(0, 2)).toEqual([
      'node dist/src/database-url.js',
      'node dist/src/environment.js',
    ]);
    expect(calls.some((call) => call.includes('migrate'))).toBe(status === 0);
    expect(calls.some((call) => call.includes('seed'))).toBe(false);
    expect(result.status).toBe(status);
  });
  it('production configuration ignores a development .env', async () => {
    const file = join(directory, '.env');
    writeFileSync(
      file,
      'ENABLE_MOCK_AUTH=true\nJWT_SECRET=development-file-secret\n',
    );
    let loaded: Record<string, unknown> = {};
    await ConfigModule.forRoot({
      ...environmentFileOptions({ NODE_ENV: 'production' }),
      envFilePath: file,
      validate: (values) => {
        loaded = values;
        return values;
      },
    });
    expect(loaded.JWT_SECRET).not.toBe('development-file-secret');
    expect(loaded.ENABLE_MOCK_AUTH).not.toBe('true');
  });
  it('preflight rejects production unsafe switches without connecting', () => {
    expect(() =>
      validateEnvironment({ NODE_ENV: 'production', ENABLE_MOCK_AUTH: 'true' }),
    ).toThrow('ENABLE_MOCK_AUTH');
    expect(() =>
      validateEnvironment({ NODE_ENV: 'production', RUN_SEED: 'true' }),
    ).toThrow('RUN_SEED');
  });
  it.each([
    { ENABLE_MOCK_AUTH: 'true' },
    { RUN_SEED: 'true' },
    { IMPORT_DATA: 'true' },
    { NODE_ENV: 'prodution' },
    { ENABLE_MOCK_AUTH: 'yes' },
    { JWT_SECRET: 'change-me-access-secret' },
    { JWT_REFRESH_SECRET: 'a'.repeat(40) },
  ])('actual preflight blocks unsafe input %j before migration', (override) => {
    const log = join(directory, 'calls');
    writeFileSync(
      join(directory, 'node'),
      `#!/bin/sh\necho "node $*" >> "$CALL_LOG"\ncase "$1" in\n*database-url.js) echo postgresql://fixture:fixture@db/app;;\n*environment.js) exec "${process.execPath}" -r "${require.resolve('ts-node/register')}" "${resolve(__dirname, 'environment.ts')}";;\nesac\n`,
      { mode: 0o755 },
    );
    writeFileSync(
      join(directory, 'npx'),
      '#!/bin/sh\necho "migration" >> "$CALL_LOG"\n',
      { mode: 0o755 },
    );
    const result = spawnSync(
      '/bin/sh',
      [resolve(__dirname, '../docker-entrypoint.sh'), 'node', 'dist/src/main'],
      {
        cwd: directory,
        encoding: 'utf8',
        env: {
          PATH: `${directory}:/usr/bin:/bin`,
          CALL_LOG: log,
          TS_NODE_PROJECT: resolve(__dirname, '../tsconfig.json'),
          NODE_ENV: 'production',
          JWT_SECRET: 'a'.repeat(40),
          JWT_REFRESH_SECRET: 'b'.repeat(40),
          REDIS_HOST: 'redis',
          REDIS_PASSWORD: 'dedicated-test-password',
          APP_URL: 'http://api.example.org',
          WECHAT_APPID: 'fixture-app',
          WECHAT_SECRET: 'fixture-secret',
          ...override,
        },
      },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(Object.keys(override)[0]);
    expect(readFileSync(log, 'utf8')).not.toContain('migration');
    expect(result.stderr).not.toContain('dedicated-test-password');
    expect(result.stderr).not.toContain('a'.repeat(40));
  });
  it.each(['development', 'test'])(
    'retains explicit maintenance switches in %s using stubs',
    (NODE_ENV) => {
      const log = join(directory, 'calls');
      mkdirSync(join(directory, 'node_modules/.bin'), { recursive: true });
      mkdirSync(join(directory, 'prisma'));
      writeFileSync(
        join(directory, 'prisma/DishesofZijingYuan.xlsx'),
        'fixture',
      );
      writeFileSync(
        join(directory, 'node'),
        '#!/bin/sh\necho "node $*" >> "$CALL_LOG"\ncase "$1" in\n*database-url.js) echo postgresql://fixture:fixture@db/app;;\nesac\n',
        { mode: 0o755 },
      );
      writeFileSync(
        join(directory, 'npx'),
        '#!/bin/sh\necho "migration" >> "$CALL_LOG"\n',
        { mode: 0o755 },
      );
      writeFileSync(
        join(directory, 'node_modules/.bin/ts-node'),
        '#!/bin/sh\necho "$*" >> "$CALL_LOG"\n',
        { mode: 0o755 },
      );
      const result = spawnSync(
        '/bin/sh',
        [
          resolve(__dirname, '../docker-entrypoint.sh'),
          'node',
          'dist/src/main',
        ],
        {
          cwd: directory,
          encoding: 'utf8',
          env: {
            PATH: `${directory}:/usr/bin:/bin`,
            CALL_LOG: log,
            NODE_ENV,
            RUN_SEED: 'true',
            IMPORT_DATA: 'true',
          },
        },
      );
      expect(result.status).toBe(0);
      expect(readFileSync(log, 'utf8').trim().split('\n')).toEqual([
        'node dist/src/database-url.js',
        'node dist/src/environment.js',
        'migration',
        'prisma/seed_docker.ts',
        'prisma/import_canteens.ts',
        'node dist/src/main',
      ]);
    },
  );
});
