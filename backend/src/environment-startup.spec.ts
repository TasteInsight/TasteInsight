import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { spawnSync } from 'child_process';
import { ConfigModule } from '@nestjs/config';
import { environmentFileOptions } from './environment';

describe('environment startup ordering', () => {
  let directory: string;
  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'tasteinsight-entrypoint-'));
  });
  afterEach(() => rmSync(directory, { recursive: true, force: true }));

  describe.each(['public', 'admin', 'worker', 'migrate'])(
    'production %s entrypoint',
    (role) => {
      it.each([0, 1])(
        'database URL generation exit %s controls role startup without hidden initialization',
        (status) => {
          const log = join(directory, 'calls');
          const entrypoint = `dist/src/main.${role}`;
          writeFileSync(
            join(directory, 'node'),
            `#!/bin/sh\nprintf 'node %s\\n' "$*" >> "$CALL_LOG"\ncase "$1" in\n*database-url.js) echo postgresql://fixture:fixture@db/app; exit ${status};;\nesac\n[ "$DATABASE_URL" = postgresql://fixture:fixture@db/app ]\n`,
            { mode: 0o755 },
          );
          const result = spawnSync(
            '/bin/sh',
            [resolve(__dirname, '../docker-entrypoint.sh'), 'node', entrypoint],
            {
              cwd: directory,
              env: {
                PATH: `${directory}:/usr/bin:/bin`,
                CALL_LOG: log,
                NODE_ENV: 'production',
              },
              encoding: 'utf8',
            },
          );
          expect(readFileSync(log, 'utf8').trim().split('\n')).toEqual([
            'node dist/src/database-url.js',
            ...(status === 0 ? [`node ${entrypoint}`] : []),
          ]);
          expect(result.status).toBe(status);
        },
      );
    },
  );

  it.each(['production', 'test'])(
    '%s configuration ignores a development .env',
    async (NODE_ENV) => {
      const file = join(directory, '.env');
      writeFileSync(
        file,
        'ENABLE_MOCK_AUTH=true\nJWT_SECRET=development-file-secret\n',
      );
      let loaded: Record<string, unknown> = {};
      await ConfigModule.forRoot({
        ...environmentFileOptions({ NODE_ENV }),
        envFilePath: file,
        validate: (values) => {
          loaded = values;
          return values;
        },
      });
      expect(loaded.JWT_SECRET).not.toBe('development-file-secret');
      expect(loaded.ENABLE_MOCK_AUTH).not.toBe('true');
    },
  );

  it.each(['development', 'test'])(
    'does not seed, import or migrate on %s startup when legacy switches are set',
    (NODE_ENV) => {
      const log = join(directory, 'calls');
      writeFileSync(
        join(directory, 'node'),
        '#!/bin/sh\nprintf "node %s\\n" "$*" >> "$CALL_LOG"\ncase "$1" in\n*database-url.js) echo postgresql://fixture:fixture@db/app;;\nesac\n',
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
        'node dist/src/main',
      ]);
    },
  );
});
