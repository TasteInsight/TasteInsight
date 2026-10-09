function integerSetting(
  value: unknown,
  key: string,
  fallback: number,
  minimum: number,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  const input = typeof value === 'string' ? value.trim() : value;
  const parsed = input === undefined || input === '' ? fallback : Number(input);

  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${key} must be an integer from ${minimum} to ${maximum}`);
  }

  return parsed;
}

export function booleanSetting(value: unknown, key: string): boolean {
  if (value === undefined || value === '') return false;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  throw new Error(`${key} must be true or false`);
}

export function mockAuthEnabled(environment: Record<string, unknown>): boolean {
  return (
    ['development', 'test'].includes(String(environment.NODE_ENV)) &&
    booleanSetting(environment.ENABLE_MOCK_AUTH, 'ENABLE_MOCK_AUTH')
  );
}

function origin(value: string, key: string): string {
  try {
    const url = new URL(value);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash ||
      value.includes('*') ||
      !/^https?:\/\/[^/?#\s]+\/?$/i.test(value)
    )
      throw new Error();
    return url.origin;
  } catch {
    throw new Error(
      `${key} must contain exact http(s) origins without paths or credentials`,
    );
  }
}

export function corsOrigins(environment: Record<string, unknown>): string[] {
  const allowed = String(environment.CORS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
    .map((v) => origin(v, 'CORS_ALLOWED_ORIGINS'));
  if (environment.APP_URL) {
    try {
      const appUrl = new URL(String(environment.APP_URL));
      if (appUrl.username || appUrl.password) throw new Error();
      allowed.push(origin(appUrl.origin, 'APP_URL'));
    } catch {
      throw new Error('APP_URL must be an http(s) URL without credentials');
    }
  }
  return [...new Set(allowed)];
}

export function corsPolicy(environment: Record<string, unknown>) {
  const allowed = corsOrigins(environment);
  return {
    origin: (
      requestOrigin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => callback(null, !requestOrigin || allowed.includes(requestOrigin)),
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: false,
  };
}

export function environmentFileOptions(environment: Record<string, unknown>) {
  return {
    ignoreEnvFile: environment.NODE_ENV === 'production',
    envFilePath: '.env',
  };
}

const placeholder = /^(?:change[-_]me|your[-_])|placeholder/i;

export function validateEnvironment(
  environment: Record<string, unknown>,
): Record<string, unknown> {
  const NODE_ENV = environment.NODE_ENV ?? 'development';
  if (!['development', 'test', 'production'].includes(String(NODE_ENV))) {
    throw new Error('NODE_ENV must be development, test or production');
  }
  const ENABLE_MOCK_AUTH = booleanSetting(
    environment.ENABLE_MOCK_AUTH,
    'ENABLE_MOCK_AUTH',
  );
  const RUN_SEED = booleanSetting(environment.RUN_SEED, 'RUN_SEED');
  const IMPORT_DATA = booleanSetting(environment.IMPORT_DATA, 'IMPORT_DATA');
  const required = (key: string) => {
    const value = environment[key];
    if (typeof value !== 'string' || !value.trim())
      throw new Error(`${key} is required`);
    return value;
  };
  if (NODE_ENV === 'production') {
    if (ENABLE_MOCK_AUTH)
      throw new Error('ENABLE_MOCK_AUTH is forbidden in production');
    if (RUN_SEED) throw new Error('RUN_SEED is forbidden in production');
    if (IMPORT_DATA) throw new Error('IMPORT_DATA is forbidden in production');
    for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET']) {
      const value = required(key);
      if (Buffer.byteLength(value) < 32 || placeholder.test(value))
        throw new Error(
          `${key} must be a non-placeholder secret of at least 32 bytes`,
        );
    }
    if (environment.JWT_SECRET === environment.JWT_REFRESH_SECRET)
      throw new Error('JWT_REFRESH_SECRET must differ from JWT_SECRET');
    for (const key of [
      'REDIS_HOST',
      'REDIS_PASSWORD',
      'WECHAT_APPID',
      'WECHAT_SECRET',
    ])
      required(key);
    if (placeholder.test(required('REDIS_PASSWORD')))
      throw new Error('REDIS_PASSWORD must not be a placeholder');
    try {
      const url = new URL(required('DATABASE_URL'));
      if (
        !['postgres:', 'postgresql:'].includes(url.protocol) ||
        !url.hostname ||
        !url.username ||
        !url.password ||
        !url.pathname ||
        url.pathname === '/' ||
        placeholder.test(decodeURIComponent(url.password))
      )
        throw new Error();
    } catch {
      throw new Error(
        'DATABASE_URL must be a PostgreSQL connection with non-placeholder credentials',
      );
    }
    try {
      const url = new URL(required('APP_URL'));
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password ||
        /your[-_]|change[-_]?me|placeholder/i.test(url.hostname)
      )
        throw new Error();
    } catch {
      throw new Error('APP_URL must be the public http(s) application URL');
    }
    if (
      environment.INITIAL_ADMIN_PASSWORD !== undefined &&
      environment.INITIAL_ADMIN_PASSWORD !== ''
    ) {
      const password = required('INITIAL_ADMIN_PASSWORD');
      if (
        password.length < 12 ||
        placeholder.test(password) ||
        /^(?:password|admin)\d*$/i.test(password)
      )
        throw new Error(
          'INITIAL_ADMIN_PASSWORD must be at least 12 characters and not a placeholder or obvious default',
        );
    }
  }
  const storage = environment.UPLOAD_STORAGE_TYPE ?? 'local';
  if (!['local', 'oss'].includes(String(storage)))
    throw new Error('UPLOAD_STORAGE_TYPE must be local or oss');
  if (storage === 'oss')
    for (const key of [
      'OSS_REGION',
      'OSS_ACCESS_KEY_ID',
      'OSS_ACCESS_KEY_SECRET',
      'OSS_BUCKET',
    ])
      required(key);
  corsOrigins(environment);
  return {
    ...environment,
    NODE_ENV,
    ENABLE_MOCK_AUTH,
    RUN_SEED,
    IMPORT_DATA,
    PORT: integerSetting(environment.PORT, 'PORT', 3000, 1, 65535),
    REDIS_PORT: integerSetting(
      environment.REDIS_PORT,
      'REDIS_PORT',
      6379,
      1,
      65535,
    ),
    REDIS_REC_DB: integerSetting(
      environment.REDIS_REC_DB,
      'REDIS_REC_DB',
      1,
      0,
    ),
    EMBEDDING_SERVICE_BATCH_SIZE: integerSetting(
      environment.EMBEDDING_SERVICE_BATCH_SIZE,
      'EMBEDDING_SERVICE_BATCH_SIZE',
      50,
      1,
    ),
    UPLOAD_MAX_FILE_SIZE: integerSetting(
      environment.UPLOAD_MAX_FILE_SIZE,
      'UPLOAD_MAX_FILE_SIZE',
      10485760,
      1,
    ),
  };
}

if (require.main === module) {
  try {
    validateEnvironment(process.env);
  } catch (error) {
    process.stderr.write(`${(error as Error).message}\n`);
    process.exitCode = 1;
  }
}
