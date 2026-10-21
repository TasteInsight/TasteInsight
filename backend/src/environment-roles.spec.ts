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
};

describe('role-owned environment validation', () => {
  it('validates the login method allowlist only in user-facing roles', () => {
    const environment = { ...api, AUTH_LOGIN_METHODS: 'email' };
    expect(() => validateEnvironment(environment, 'public-api')).toThrow(
      'AUTH_LOGIN_METHODS',
    );
    expect(() => validateEnvironment(environment, 'combined')).toThrow(
      'AUTH_LOGIN_METHODS',
    );
    for (const role of ['admin-api', 'worker', 'migrate'] as const)
      expect(() => validateEnvironment(environment, role)).not.toThrow();
    expect(() =>
      validateEnvironment({ ...api, AUTH_LOGIN_METHODS: '' }, 'public-api'),
    ).not.toThrow();
  });

  it('validates verification policy only in user-facing roles', () => {
    const environment = { ...api, CAMPUS_VERIFICATION_METHODS: 'phone' };
    for (const role of ['public-api', 'combined'] as const)
      expect(() => validateEnvironment(environment, role)).toThrow(
        'CAMPUS_VERIFICATION_METHODS',
      );
    for (const role of ['admin-api', 'worker', 'migrate'] as const)
      expect(() => validateEnvironment(environment, role)).not.toThrow();
    expect(() =>
      validateEnvironment(
        { ...api, CAMPUS_VERIFICATION_METHODS: '' },
        'public-api',
      ),
    ).not.toThrow();
  });

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
    '%s ignores configuration belonging only to login and browser APIs',
    (role) => {
      expect(() =>
        validateEnvironment(
          {
            ...background,
            JWT_SECRET: 'unrelated-short-key',
            WECHAT_APPID: 'incomplete-wechat-integration',
            CAMPUS_OAUTH_TOKEN_URL: 'not-a-url',
            CAMPUS_VERIFICATION_DAYS: 'invalid',
          },
          role,
        ),
      ).not.toThrow();
    },
  );

  it('worker validates storage instances used by cleanup while migration ignores them', () => {
    const storage = {
      UPLOAD_DEFAULT_STORAGE_ID: 'cos-main',
      UPLOAD_STORAGE_INSTANCES: JSON.stringify({ 'cos-main': { type: 's3' } }),
    };
    expect(() =>
      validateEnvironment({ ...background, ...storage }, 'worker'),
    ).toThrow('UPLOAD_STORAGE_INSTANCES');
    expect(() =>
      validateEnvironment({ ...database, ...storage }, 'migrate'),
    ).not.toThrow();
  });

  it('worker validates generic S3 configuration while migration ignores it', () => {
    const storage = { UPLOAD_DEFAULT_STORAGE_ID: 's3' };
    expect(() =>
      validateEnvironment({ ...background, ...storage }, 'worker'),
    ).toThrow('S3_ENDPOINT');
    expect(() =>
      validateEnvironment({ ...database, ...storage }, 'migrate'),
    ).not.toThrow();
  });

  it('migration ignores queue, recommendation and delivery tuning', () => {
    expect(() =>
      validateEnvironment(
        {
          ...database,
          REDIS_PORT: 'invalid',
          EMBEDDING_SERVICE_BATCH_SIZE: 'invalid',
          NOTIFICATION_WEBHOOK_URL: 'invalid',
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
          SMS_GATEWAY_URL: 'invalid',
          CAMPUS_OAUTH_AUTHORIZATION_URL: 'invalid',
          CAMPUS_VERIFICATION_DAYS: 'invalid',
        },
        'admin-api',
      ),
    ).not.toThrow();
    expect(() =>
      validateEnvironment({ ...api, WECHAT_APPID: 'incomplete' }, 'public-api'),
    ).toThrow('WECHAT_SECRET');
  });

  it.each(['public-api', 'admin-api'] as const)(
    '%s validates the notification target without requiring the worker signing key',
    (role) => {
      expect(() =>
        validateEnvironment(
          { ...api, NOTIFICATION_WEBHOOK_URL: 'https://notify.example.test' },
          role,
        ),
      ).not.toThrow();
      expect(() =>
        validateEnvironment(
          { ...api, NOTIFICATION_WEBHOOK_URL: 'http://notify.example.test' },
          role,
        ),
      ).toThrow('NOTIFICATION_WEBHOOK_URL');
    },
  );

  it('worker enforces signing credentials when external delivery is enabled', () => {
    const delivery = {
      ...background,
      NOTIFICATION_WEBHOOK_URL: 'https://notify.example.test',
    };
    expect(() => validateEnvironment(delivery, 'worker')).toThrow(
      'NOTIFICATION_WEBHOOK_SECRET',
    );
    expect(() =>
      validateEnvironment(
        { ...delivery, NOTIFICATION_WEBHOOK_SECRET: 'signing-key'.repeat(4) },
        'worker',
      ),
    ).not.toThrow();
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
