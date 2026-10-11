import { createDockerDatabaseUrl } from './database-url';

describe('createDockerDatabaseUrl', () => {
  it.each(['database.internal', '10.2.0.8', '[fd00::8]'])(
    'supports an independently hosted database at %s',
    (host) => {
      const url = new URL(
        createDockerDatabaseUrl({
          POSTGRES_HOST: host,
          POSTGRES_PORT: '6432',
          POSTGRES_USER: 'service',
          POSTGRES_PASSWORD: 'private-password',
          POSTGRES_DB: 'tasteinsight',
        }),
      );
      expect(url.hostname).toBe(host);
      expect(url.port).toBe('6432');
      expect(url.searchParams.get('schema')).toBe('public');
    },
  );

  it.each([
    ['POSTGRES_HOST', 'db/path'],
    ['POSTGRES_HOST', 'user@db'],
    ['POSTGRES_HOST', 'db?secret=value'],
    ['POSTGRES_PORT', '65536'],
    ['POSTGRES_PORT', '-1'],
    ['POSTGRES_PORT', '5432/path'],
  ])('rejects invalid %s', (key, value) => {
    expect(() =>
      createDockerDatabaseUrl({
        POSTGRES_USER: 'service',
        POSTGRES_PASSWORD: 'private-password',
        POSTGRES_DB: 'tasteinsight',
        [key]: value,
      }),
    ).toThrow(key);
  });

  it('encodes the raw PostgreSQL password for Prisma', () => {
    const url = new URL(
      createDockerDatabaseUrl({
        POSTGRES_USER: 'tasteinsight',
        POSTGRES_PASSWORD: 'a/b?#@',
        POSTGRES_DB: 'tasteinsight',
      }),
    );

    expect(url.hostname).toBe('db');
    expect(url.port).toBe('5432');
    expect(decodeURIComponent(url.password)).toBe('a/b?#@');
    expect(url.pathname).toBe('/tasteinsight');
    expect(url.searchParams.get('schema')).toBe('public');
  });

  it('requires all database connection fields', () => {
    expect(() =>
      createDockerDatabaseUrl({
        POSTGRES_USER: 'tasteinsight',
        POSTGRES_PASSWORD: '',
        POSTGRES_DB: 'tasteinsight',
      }),
    ).toThrow('POSTGRES_PASSWORD');
  });

  it.each(['abc%40def', 'a%2Fb', 'pass%word', 'a/b?#@', '口令 % / ? #'])(
    'round-trips raw credentials containing %s',
    (value) => {
      const url = new URL(
        createDockerDatabaseUrl({
          POSTGRES_USER: value,
          POSTGRES_PASSWORD: value,
          POSTGRES_DB: value,
        }),
      );

      expect(decodeURIComponent(url.username)).toBe(value);
      expect(decodeURIComponent(url.password)).toBe(value);
      expect(decodeURIComponent(url.pathname.slice(1))).toBe(value);
      expect(url.host).toBe('db:5432');
    },
  );

  it('uses Docker credentials even when an old DATABASE_URL is present', () => {
    const url = new URL(
      createDockerDatabaseUrl({
        POSTGRES_USER: 'tasteinsight',
        POSTGRES_PASSWORD: 'new-password',
        POSTGRES_DB: 'tasteinsight',
        DATABASE_URL: 'postgresql://old:old@localhost:5434/old',
      }),
    );

    expect(url.host).toBe('db:5432');
    expect(url.pathname).toBe('/tasteinsight');
  });
});
