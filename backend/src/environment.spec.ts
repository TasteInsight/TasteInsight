import {
  corsOrigins,
  mockAuthEnabled,
  validateEnvironment,
} from './environment';

describe('validateEnvironment', () => {
  const production = {
    NODE_ENV: 'production',
    JWT_SECRET: 'a'.repeat(40),
    JWT_REFRESH_SECRET: 'b'.repeat(40),
    DATABASE_URL: 'postgresql://service:secure-db-password@db:5432/app',
    REDIS_HOST: 'redis',
    REDIS_PASSWORD: 'secure-redis-password',
    APP_URL: 'http://api.example.org',
    WECHAT_APPID: 'wx-app',
    WECHAT_SECRET: 'wx-secret',
  };
  it.each([undefined, null])(
    'retains defaults for nullish text settings %s',
    (value) => {
      const environment = {
        NODE_ENV: value,
        UPLOAD_STORAGE_TYPE: value,
        CORS_ALLOWED_ORIGINS: value,
        APP_URL: value,
      };
      expect(validateEnvironment(environment)).toMatchObject({
        NODE_ENV: 'development',
      });
      expect(corsOrigins(environment)).toEqual([]);
    },
  );
  it.each(['NODE_ENV', 'UPLOAD_STORAGE_TYPE'])(
    'rejects an empty %s instead of using a default',
    (key) => {
      expect(() => validateEnvironment({ [key]: '' })).toThrow(key);
    },
  );
  it('accepts empty optional browser origin settings', () => {
    const environment = { CORS_ALLOWED_ORIGINS: '', APP_URL: '' };
    expect(() => validateEnvironment(environment)).not.toThrow();
    expect(corsOrigins(environment)).toEqual([]);
  });
  it.each([
    { key: 'NODE_ENV', value: ['production'] },
    { key: 'UPLOAD_STORAGE_TYPE', value: ['oss'] },
    { key: 'CORS_ALLOWED_ORIGINS', value: ['https://portal.example.org'] },
    { key: 'APP_URL', value: ['https://api.example.org'] },
  ])('rejects a non-string $key before coercion', ({ key, value }) => {
    expect(() => validateEnvironment({ [key]: value })).toThrow(key);
  });
  it('does not coerce a non-string environment to enable mock authentication', () => {
    expect(
      mockAuthEnabled({
        NODE_ENV: ['development'],
        ENABLE_MOCK_AUTH: true,
      }),
    ).toBe(false);
  });
  it.each([
    ['NODE_ENV', 'prodution'],
    ['ENABLE_MOCK_AUTH', 'true'],
    ['ENABLE_MOCK_AUTH', 'yes'],
    ['RUN_SEED', 'true'],
    ['IMPORT_DATA', 'true'],
    ['JWT_SECRET', 'change-me-to-a-long-random-access-token-secret'],
    ['JWT_REFRESH_SECRET', 'a'.repeat(40)],
    ['INITIAL_ADMIN_PASSWORD', 'password123'],
    ['CORS_ALLOWED_ORIGINS', 'https://example.org/path'],
  ])('rejects unsafe production %s', (key, value) => {
    expect(() => validateEnvironment({ ...production, [key]: value })).toThrow(
      key,
    );
  });
  it('accepts explicit production configuration without bootstrap credentials', () => {
    expect(validateEnvironment(production)).toMatchObject({
      NODE_ENV: 'production',
      ENABLE_MOCK_AUTH: false,
    });
  });
  it.each([
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'DATABASE_URL',
    'REDIS_HOST',
    'REDIS_PASSWORD',
    'APP_URL',
    'WECHAT_APPID',
    'WECHAT_SECRET',
  ])('requires production %s', (key) => {
    expect(() => validateEnvironment({ ...production, [key]: '' })).toThrow(
      key,
    );
  });
  it.each([
    ['DATABASE_URL', 'postgresql://service:password@db'],
    ['DATABASE_URL', 'postgresql://service:change-me-password@db/app'],
    ['REDIS_PASSWORD', 'change-me-redis-password'],
    ['INITIAL_ADMIN_PASSWORD', 'password123456789'],
    ['RUN_SEED', '1'],
    ['IMPORT_DATA', 'yes'],
    ['PORT', '65536'],
    ['UPLOAD_STORAGE_TYPE', 'invalid'],
  ])('rejects invalid production %s', (key, value) => {
    expect(() => validateEnvironment({ ...production, [key]: value })).toThrow(
      key,
    );
  });
  it('permits a valid bootstrap password and a public base path without requiring TLS', () => {
    expect(
      validateEnvironment({
        ...production,
        APP_URL: 'http://api.example.org/base',
        INITIAL_ADMIN_PASSWORD: 'dedicated-bootstrap-password',
      }),
    ).toMatchObject({ NODE_ENV: 'production' });
  });
  it('checks OSS configuration only when the OSS strategy consumes it', () => {
    expect(() =>
      validateEnvironment({ UPLOAD_STORAGE_TYPE: 'local' }),
    ).not.toThrow();
    expect(() => validateEnvironment({ UPLOAD_STORAGE_TYPE: 'oss' })).toThrow(
      'OSS_REGION',
    );
  });
  it('does not reject a long secret merely containing example', () => {
    expect(() =>
      validateEnvironment({
        ...production,
        JWT_SECRET: 'random-secret-with-example-inside-32bytes',
      }),
    ).not.toThrow();
  });
  it.each(['development', 'test'])(
    'permits explicit mock in %s',
    (NODE_ENV) => {
      expect(
        validateEnvironment({ NODE_ENV, ENABLE_MOCK_AUTH: 'true' }),
      ).toMatchObject({ ENABLE_MOCK_AUTH: true });
    },
  );
  it('never includes supplied secrets in validation errors', () => {
    expect(() =>
      validateEnvironment({ ...production, JWT_SECRET: 'private-short-value' }),
    ).toThrow('JWT_SECRET');
    try {
      validateEnvironment({ ...production, JWT_SECRET: 'private-short-value' });
    } catch (error) {
      expect(String(error)).not.toContain('private-short-value');
    }
  });
  it('parses numeric environment values before services consume them', () => {
    expect(
      validateEnvironment({
        REDIS_PORT: '6381',
        REDIS_REC_DB: '0',
        EMBEDDING_SERVICE_BATCH_SIZE: '50',
        UPLOAD_MAX_FILE_SIZE: '10485760',
        AI_PROVIDER: 'openai',
      }),
    ).toMatchObject({
      REDIS_PORT: 6381,
      REDIS_REC_DB: 0,
      EMBEDDING_SERVICE_BATCH_SIZE: 50,
      UPLOAD_MAX_FILE_SIZE: 10485760,
      AI_PROVIDER: 'openai',
    });
  });

  it('uses defaults for absent numeric settings', () => {
    expect(validateEnvironment({})).toMatchObject({
      REDIS_PORT: 6379,
      REDIS_REC_DB: 1,
      EMBEDDING_SERVICE_BATCH_SIZE: 50,
      UPLOAD_MAX_FILE_SIZE: 10485760,
    });
  });

  it.each([
    ['REDIS_PORT', '65536'],
    ['REDIS_REC_DB', '-1'],
    ['EMBEDDING_SERVICE_BATCH_SIZE', '0'],
    ['UPLOAD_MAX_FILE_SIZE', 'invalid'],
  ])('rejects invalid %s', (key, value) => {
    expect(() => validateEnvironment({ [key]: value })).toThrow(key);
  });
});
