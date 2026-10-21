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
        UPLOAD_DEFAULT_STORAGE_ID: value,
        CORS_ALLOWED_ORIGINS: value,
        APP_URL: value,
      };
      expect(validateEnvironment(environment)).toMatchObject({
        NODE_ENV: 'development',
      });
      expect(corsOrigins(environment)).toEqual([]);
    },
  );
  it.each(['NODE_ENV', 'UPLOAD_DEFAULT_STORAGE_ID'])(
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
  it('allows configurable public and administrator origins without duplicates', () => {
    expect(
      corsOrigins({
        APP_URL: 'https://api.example.net/base',
        ADMIN_APP_URL: 'https://admin.example.net:8443/',
        CORS_ALLOWED_ORIGINS:
          'https://web.example.net,https://admin.example.net:8443',
      }),
    ).toEqual([
      'https://web.example.net',
      'https://admin.example.net:8443',
      'https://api.example.net',
    ]);
  });
  it.each([
    'https://admin.example.net/path',
    'https://user:password@admin.example.net',
    'https://*.example.net',
    'file:///tmp/admin',
    ['https://admin.example.net'],
  ])('rejects an invalid administrator origin %s', (value) => {
    expect(() => validateEnvironment({ ADMIN_APP_URL: value })).toThrow(
      'ADMIN_APP_URL',
    );
  });
  it.each([
    { key: 'NODE_ENV', value: ['production'] },
    { key: 'UPLOAD_DEFAULT_STORAGE_ID', value: ['s3'] },
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
    ['UPLOAD_DEFAULT_STORAGE_ID', 'invalid'],
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

describe('identity integration configuration', () => {
  const oauth = {
    CAMPUS_OAUTH_AUTHORIZATION_URL: 'https://identity.example.org/authorize',
    CAMPUS_OAUTH_TOKEN_URL: 'https://identity.example.org/token',
    CAMPUS_OAUTH_USERINFO_URL: 'https://identity.example.org/userinfo',
    CAMPUS_OAUTH_CLIENT_ID: 'client',
    CAMPUS_OAUTH_CLIENT_SECRET: 'secret',
    CAMPUS_OAUTH_REDIRECT_URI:
      'https://api.example.org/api/v1/user/student-verification/oauth/callback',
    CAMPUS_OAUTH_SCOPE: 'profile',
    CAMPUS_OAUTH_ISSUER: 'https://identity.example.org',
    AUTH_CHALLENGE_SECRET: 'dedicated-challenge-secret'.repeat(2),
  };
  it('keeps every optional integration disabled with blank values', () => {
    expect(() =>
      validateEnvironment({
        SMS_GATEWAY_URL: '',
        SMS_GATEWAY_TOKEN: '',
        RESEND_API_KEY: '',
        EMAIL_FROM: '',
        CAMPUS_OAUTH_AUTHORIZATION_URL: '',
      }),
    ).not.toThrow();
  });
  it.each([
    ['WECHAT_APP_APPID', 'WECHAT_APP_SECRET'],
    ['SMS_GATEWAY_URL', 'SMS_GATEWAY_TOKEN'],
    ['RESEND_API_KEY', 'EMAIL_FROM'],
    ['CAMPUS_OAUTH_STUDENT_CLAIM', 'CAMPUS_OAUTH_STUDENT_VALUES'],
  ])('rejects partial %s configuration', (configuredKey, missingKey) => {
    expect(() => validateEnvironment({ [configuredKey]: 'value' })).toThrow(
      missingKey,
    );
  });
  it('requires complete approved OAuth endpoints and a dedicated challenge key', () => {
    expect(() =>
      validateEnvironment({
        CAMPUS_OAUTH_AUTHORIZATION_URL: 'https://identity.example.org/auth',
      }),
    ).toThrow('CAMPUS_OAUTH_TOKEN_URL');
    expect(() =>
      validateEnvironment({ ...oauth, AUTH_CHALLENGE_SECRET: 'short' }),
    ).toThrow('AUTH_CHALLENGE_SECRET');
    expect(() => validateEnvironment(oauth)).not.toThrow();
  });
  it.each([
    'http://identity.example.org/token',
    'https://user:password@identity.example.org/token',
    'https://identity.example.org/token#fragment',
  ])('rejects unsafe token endpoint %s', (value) => {
    expect(() =>
      validateEnvironment({ ...oauth, CAMPUS_OAUTH_TOKEN_URL: value }),
    ).toThrow('CAMPUS_OAUTH_TOKEN_URL');
  });
  it.each([
    'true',
    '1',
    'loopback',
    '10.0.0.1/33',
    '::1/129',
    '10.0.0.1/-1',
    '10.0.0.1/8/2',
    '127.0.0.1,',
  ])('rejects unsafe trusted proxy value %s', (value) => {
    expect(() => validateEnvironment({ TRUSTED_PROXY_CIDRS: value })).toThrow(
      'TRUSTED_PROXY_CIDRS',
    );
  });
  it.each(['', '127.0.0.1/32,::1/128', '172.18.0.0/24', '10.2.3.4'])(
    'accepts explicit trusted proxies %s',
    (value) => {
      expect(() =>
        validateEnvironment({ TRUSTED_PROXY_CIDRS: value }),
      ).not.toThrow();
    },
  );
  it.each(['0', '367', 'invalid'])(
    'bounds automatic student verification lifetime %s',
    (value) => {
      expect(() =>
        validateEnvironment({ CAMPUS_VERIFICATION_DAYS: value }),
      ).toThrow('CAMPUS_VERIFICATION_DAYS');
    },
  );
  it('does not accept wildcard campus-email domains', () => {
    expect(() =>
      validateEnvironment({ CAMPUS_EMAIL_DOMAINS: '*.tsinghua.edu.cn' }),
    ).toThrow('CAMPUS_EMAIL_DOMAINS');
  });
});

describe('S3 environment', () => {
  const s3 = {
    UPLOAD_DEFAULT_STORAGE_ID: 's3',
    S3_ENDPOINT: 'https://cos.ap-guangzhou.myqcloud.com',
    S3_REGION: 'ap-guangzhou',
    S3_BUCKET: 'photos-1250000000',
    S3_ACCESS_KEY_ID: 'fixture-key',
    S3_SECRET_ACCESS_KEY: 'fixture-secret',
  };
  it.each([
    'S3_ENDPOINT',
    'S3_REGION',
    'S3_BUCKET',
    'S3_ACCESS_KEY_ID',
    'S3_SECRET_ACCESS_KEY',
  ])('requires %s only for S3', (key) => {
    expect(() => validateEnvironment({ ...s3, [key]: '' })).toThrow(key);
    expect(() =>
      validateEnvironment({ UPLOAD_DEFAULT_STORAGE_ID: 'local', [key]: '' }),
    ).not.toThrow();
  });
  it.each(['S3_ENDPOINT', 'S3_PUBLIC_BASE_URL'])(
    'validates %s without echoing credentials',
    (key) => {
      for (const value of [
        'file:///tmp/objects',
        'https://private:secret@example.test',
        'https://example.test?key=secret',
        'https://example.test/#secret',
      ]) {
        expect(() => validateEnvironment({ ...s3, [key]: value })).toThrow(key);
        try {
          validateEnvironment({ ...s3, [key]: value });
        } catch (error) {
          expect(String(error)).not.toContain('secret');
        }
      }
    },
  );
  it.each([undefined, '', 'false', false])(
    'uses virtual-hosted addressing for %s',
    (value) => {
      expect(
        validateEnvironment({ ...s3, S3_FORCE_PATH_STYLE: value })
          .S3_FORCE_PATH_STYLE,
      ).toBe(false);
    },
  );
  it.each(['true', true])('parses path-style addressing for %s', (value) => {
    expect(
      validateEnvironment({ ...s3, S3_FORCE_PATH_STYLE: value })
        .S3_FORCE_PATH_STYLE,
    ).toBe(true);
  });
  it('accepts endpoint paths and public URL prefixes for compatible providers', () => {
    expect(() =>
      validateEnvironment({
        ...s3,
        S3_ENDPOINT: 'http://127.0.0.1:9000/storage/s3',
        S3_PUBLIC_BASE_URL: 'https://cdn.example.test/media/',
      }),
    ).not.toThrow();
    expect(() =>
      validateEnvironment({ ...s3, S3_FORCE_PATH_STYLE: 'yes' }),
    ).toThrow('S3_FORCE_PATH_STYLE');
  });
});
