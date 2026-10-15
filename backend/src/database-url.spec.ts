import { resolveDatabaseUrl } from './database-url';

describe('resolveDatabaseUrl', () => {
  it.each(['database.internal', '10.2.0.8', '[fd00::8]'])(
    'supports an independently hosted database at %s',
    (host) => {
      const url = new URL(
        resolveDatabaseUrl({
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
      resolveDatabaseUrl({
        POSTGRES_USER: 'service',
        POSTGRES_PASSWORD: 'private-password',
        POSTGRES_DB: 'tasteinsight',
        [key]: value,
      }),
    ).toThrow(key);
  });

  it('encodes the raw PostgreSQL password for Prisma', () => {
    const url = new URL(
      resolveDatabaseUrl({
        POSTGRES_USER: 'tasteinsight',
        POSTGRES_PASSWORD: 'a/b?#@',
        POSTGRES_DB: 'tasteinsight',
      }),
    );

    expect(url.hostname).toBe('localhost');
    expect(url.port).toBe('5432');
    expect(decodeURIComponent(url.password)).toBe('a/b?#@');
    expect(url.pathname).toBe('/tasteinsight');
    expect(url.searchParams.get('schema')).toBe('public');
  });

  it('requires all database connection fields', () => {
    expect(() =>
      resolveDatabaseUrl({
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
        resolveDatabaseUrl({
          POSTGRES_USER: value,
          POSTGRES_PASSWORD: value,
          POSTGRES_DB: value,
        }),
      );

      expect(decodeURIComponent(url.username)).toBe(value);
      expect(decodeURIComponent(url.password)).toBe(value);
      expect(decodeURIComponent(url.pathname.slice(1))).toBe(value);
      expect(url.host).toBe('localhost:5432');
    },
  );

  it('honors an explicit DATABASE_URL over raw connection fields', () => {
    const explicit =
      'postgresql://override:secret@remote:6432/app?schema=custom&connection_limit=3';
    expect(
      resolveDatabaseUrl({
        POSTGRES_USER: 'local',
        POSTGRES_PASSWORD: 'local-secret',
        POSTGRES_DB: 'local',
        DATABASE_URL: explicit,
      }),
    ).toBe(explicit);
  });

  it('rejects an explicit blank URL instead of selecting another database', () => {
    expect(() =>
      resolveDatabaseUrl({
        POSTGRES_USER: 'local',
        POSTGRES_PASSWORD: 'secret',
        POSTGRES_DB: 'local',
        DATABASE_URL: '',
      }),
    ).toThrow('DATABASE_URL');
  });
});

describe('external PostgreSQL transport', () => {
  const settings = {
    POSTGRES_USER: 'service',
    POSTGRES_PASSWORD: 'private',
    POSTGRES_DB: 'database',
    POSTGRES_HOST: 'db.example.invalid',
  };
  it('preserves configured TLS mode in the generated Prisma URL', () => {
    expect(
      new URL(
        resolveDatabaseUrl({ ...settings, POSTGRES_SSLMODE: 'require' }),
      ).searchParams.get('sslmode'),
    ).toBe('require');
  });
  it('rejects invalid TLS modes', () => {
    expect(() =>
      resolveDatabaseUrl({ ...settings, POSTGRES_SSLMODE: 'typo' }),
    ).toThrow('POSTGRES_SSLMODE');
  });
});
