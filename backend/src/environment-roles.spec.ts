import { validateEnvironment, type RuntimeRole } from './environment';

const database = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://fixture:dedicated-password@db:5432/role_test',
};
const background = {
  ...database,
  REDIS_HOST: 'redis',
  REDIS_PASSWORD: 'dedicated-redis-password',
};
const api = {
  ...background,
  JWT_SECRET: 'role-access-secret'.repeat(3),
  JWT_REFRESH_SECRET: 'role-refresh-secret'.repeat(3),
  APP_URL: 'https://api.example.test',
  ADMIN_APP_URL: 'https://admin.example.test',
  WECHAT_APPID: 'fixture-wechat-appid',
  WECHAT_SECRET: 'fixture-wechat-secret',
};

describe('role-owned environment validation', () => {
  it('migration requires the database but no HTTP, authentication or queue configuration', () => {
    expect(() => validateEnvironment(database, 'migrate')).not.toThrow();
    expect(() =>
      validateEnvironment({ NODE_ENV: 'production' }, 'migrate'),
    ).toThrow('DATABASE_URL');
  });

  it('worker requires database and Redis without acquiring login secrets or origins', () => {
    expect(() => validateEnvironment(background, 'worker')).not.toThrow();
    expect(() => validateEnvironment(database, 'worker')).toThrow('REDIS_HOST');
  });

  it.each(['public-api', 'admin-api'] as const)(
    '%s still requires valid, distinct access and refresh keys',
    (role) => {
      expect(() => validateEnvironment(api, role)).not.toThrow();
      for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET']) {
        expect(() => validateEnvironment({ ...api, [key]: '' }, role)).toThrow(
          key,
        );
      }
      expect(() =>
        validateEnvironment(
          { ...api, JWT_REFRESH_SECRET: api.JWT_SECRET },
          role,
        ),
      ).toThrow('JWT_REFRESH_SECRET');
    },
  );

  it.each(['worker', 'migrate'] as const)(
    '%s ignores configuration belonging only to login, uploads and browser APIs',
    (role) => {
      expect(() =>
        validateEnvironment(
          {
            ...background,
            JWT_SECRET: 'unrelated-short-key',
            WECHAT_APPID: 'incomplete-wechat-integration',
            UPLOAD_STORAGE_TYPE: 'oss',
          },
          role,
        ),
      ).not.toThrow();
    },
  );

  it('migration ignores queue and recommendation tuning', () => {
    expect(() =>
      validateEnvironment(
        {
          ...database,
          REDIS_PORT: 'invalid',
          EMBEDDING_SERVICE_BATCH_SIZE: 'invalid',
        },
        'migrate',
      ),
    ).not.toThrow();
  });

  it('administrator authentication does not depend on third-party user integrations', () => {
    expect(() =>
      validateEnvironment(
        {
          ...api,
          WECHAT_APPID: 'incomplete',
          WECHAT_SECRET: '',
        },
        'admin-api',
      ),
    ).not.toThrow();
    expect(() =>
      validateEnvironment(
        { ...api, WECHAT_APPID: 'incomplete', WECHAT_SECRET: '' },
        'public-api',
      ),
    ).toThrow('WECHAT_SECRET');
  });

  it('bootstrap password validation belongs to initialization', () => {
    const configured = { ...api, INITIAL_ADMIN_PASSWORD: 'short' };
    expect(() => validateEnvironment(configured, 'migrate')).toThrow(
      'INITIAL_ADMIN_PASSWORD',
    );
    for (const role of ['public-api', 'admin-api', 'worker'] as const) {
      expect(() => validateEnvironment(configured, role)).not.toThrow();
    }
  });

  it.each<RuntimeRole>([
    'public-api',
    'admin-api',
    'worker',
    'migrate',
    'combined',
  ])(
    '%s rejects unsafe production switches regardless of role-specific requirements',
    (role) => {
      for (const key of ['ENABLE_MOCK_AUTH', 'RUN_SEED', 'IMPORT_DATA']) {
        expect(() =>
          validateEnvironment({ ...api, [key]: 'true' }, role),
        ).toThrow(key);
      }
    },
  );

  it('retains combined development defaults and complete integration validation', () => {
    expect(validateEnvironment({}, 'combined')).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3000,
      REDIS_PORT: 6379,
      EMBEDDING_SERVICE_BATCH_SIZE: 50,
      UPLOAD_MAX_FILE_SIZE: 10485760,
    });
    expect(() =>
      validateEnvironment({ WECHAT_APPID: 'incomplete' }, 'combined'),
    ).toThrow('WECHAT_SECRET');
  });
});
