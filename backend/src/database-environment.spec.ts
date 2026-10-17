import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadDatabaseEnvironment } from './database-url';

describe('database configuration for Prisma and maintenance', () => {
  let directory: string;
  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'database-env-'));
  });
  afterEach(() => rmSync(directory, { recursive: true, force: true }));

  it('uses the selected development directory and preserves shell overrides', () => {
    writeFileSync(
      join(directory, '.env'),
      'POSTGRES_USER=fixture\nPOSTGRES_PASSWORD="file/@#%"\nPOSTGRES_DB=fixture\nPOSTGRES_HOST=localhost\nPOSTGRES_PORT=5544\n',
    );
    const env: NodeJS.ProcessEnv = {
      POSTGRES_PASSWORD: 'shell/@#%',
      POSTGRES_PORT: '5545',
    };
    loadDatabaseEnvironment(env, directory);
    const url = new URL(env.DATABASE_URL!);
    expect(url.port).toBe('5545');
    expect(decodeURIComponent(url.password)).toBe('shell/@#%');
  });

  it.each(['production', 'test'])(
    '%s never loads a development target',
    (NODE_ENV) => {
      writeFileSync(
        join(directory, '.env'),
        'DATABASE_URL=postgresql://dev:dev@localhost/dev\n',
      );
      const env: NodeJS.ProcessEnv = { NODE_ENV };
      loadDatabaseEnvironment(env, directory);
      expect(env.DATABASE_URL).toBeUndefined();
    },
  );

  it('permits credential-free client generation and preserves explicit connection options', () => {
    const empty: NodeJS.ProcessEnv = { NODE_ENV: 'production' };
    loadDatabaseEnvironment(empty, directory);
    expect(empty.DATABASE_URL).toBeUndefined();
    const explicit =
      'postgresql://fixture:secret@remote/fixture?schema=custom&connection_limit=3';
    const env = {
      NODE_ENV: 'production',
      DATABASE_URL: explicit,
      POSTGRES_USER: 'ignored',
    };
    loadDatabaseEnvironment(env, directory);
    expect(env.DATABASE_URL).toBe(explicit);
  });
});
