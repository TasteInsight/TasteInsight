import { storageConfiguration } from './upload/storage.config';
import { booleanSetting } from './common/utils/boolean-setting';
import {
  CAMPUS_OAUTH_REQUIRED_KEYS,
  configuredLoginMethods,
  configuredVerificationMethods,
} from './auth/identity-configuration';
import { isIP } from 'net';
import { resolveDatabaseUrl } from './database-url';
import {
  notificationWebhookConfiguration,
  notificationWebhookUrl,
} from './notifications/notification-webhook.config';

export type RuntimeRole =
  | 'public-api'
  | 'admin-api'
  | 'worker'
  | 'migrate'
  | 'combined';

function stringSetting(value: unknown, key: string, fallback = ''): string {
  const input = value ?? fallback;
  if (typeof input !== 'string') throw new Error(`${key} must be a string`);
  return input;
}

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

export function mockAuthEnabled(environment: Record<string, unknown>): boolean {
  const NODE_ENV = environment.NODE_ENV;
  return (
    (NODE_ENV === 'development' || NODE_ENV === 'test') &&
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
  const allowed = stringSetting(
    environment.CORS_ALLOWED_ORIGINS,
    'CORS_ALLOWED_ORIGINS',
  )
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
    .map((v) => origin(v, 'CORS_ALLOWED_ORIGINS'));
  if (environment.APP_URL) {
    try {
      const appUrl = new URL(stringSetting(environment.APP_URL, 'APP_URL'));
      if (appUrl.username || appUrl.password) throw new Error();
      allowed.push(origin(appUrl.origin, 'APP_URL'));
    } catch {
      throw new Error('APP_URL must be an http(s) URL without credentials');
    }
  }
  if (environment.ADMIN_APP_URL) {
    allowed.push(
      origin(
        stringSetting(environment.ADMIN_APP_URL, 'ADMIN_APP_URL'),
        'ADMIN_APP_URL',
      ),
    );
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
    ignoreEnvFile:
      environment.NODE_ENV === 'production' || environment.NODE_ENV === 'test',
    envFilePath: '.env',
  };
}

const placeholder = /^(?:change[-_]me|your[-_])|placeholder/i;

export function validateEnvironment(
  environment: Record<string, unknown>,
  role: RuntimeRole = 'combined',
): Record<string, unknown> {
  if (
    environment.DATABASE_URL === undefined &&
    (environment.POSTGRES_USER !== undefined ||
      environment.POSTGRES_PASSWORD !== undefined ||
      environment.POSTGRES_DB !== undefined)
  ) {
    environment = {
      ...environment,
      DATABASE_URL: resolveDatabaseUrl(environment),
    };
  }
  const servesUsers = role === 'public-api' || role === 'combined';
  const servesApi = servesUsers || role === 'admin-api';
  const runsBackground = role === 'worker' || role === 'combined';
  const initializesDatabase = role === 'migrate' || role === 'combined';
  const NODE_ENV = stringSetting(
    environment.NODE_ENV,
    'NODE_ENV',
    'development',
  );
  if (!['development', 'test', 'production'].includes(NODE_ENV)) {
    throw new Error('NODE_ENV must be development, test or production');
  }
  const ENABLE_MOCK_AUTH = booleanSetting(
    environment.ENABLE_MOCK_AUTH,
    'ENABLE_MOCK_AUTH',
  );
  const RUN_SEED = booleanSetting(environment.RUN_SEED, 'RUN_SEED');
  const IMPORT_DATA = booleanSetting(environment.IMPORT_DATA, 'IMPORT_DATA');
  if (NODE_ENV === 'production') {
    if (ENABLE_MOCK_AUTH)
      throw new Error('ENABLE_MOCK_AUTH is forbidden in production');
    if (RUN_SEED) throw new Error('RUN_SEED is forbidden in production');
    if (IMPORT_DATA) throw new Error('IMPORT_DATA is forbidden in production');
  }
  const get = (key: string) =>
    key === 'NODE_ENV' ? NODE_ENV : environment[key];
  if (runsBackground) notificationWebhookConfiguration(get);
  else if (servesApi) notificationWebhookUrl(get);
  const required = (key: string) => {
    const value = environment[key];
    if (typeof value !== 'string' || !value.trim())
      throw new Error(`${key} is required`);
    return value;
  };
  const configured = (key: string) =>
    typeof environment[key] === 'string' && environment[key].trim().length > 0;
  if (servesUsers) {
    configuredLoginMethods(environment.AUTH_LOGIN_METHODS);
    configuredVerificationMethods(environment.CAMPUS_VERIFICATION_METHODS);
    for (const pair of [
      ['WECHAT_APPID', 'WECHAT_SECRET'],
      ['WECHAT_APP_APPID', 'WECHAT_APP_SECRET'],
      ['SMS_GATEWAY_URL', 'SMS_GATEWAY_TOKEN'],
      ['RESEND_API_KEY', 'EMAIL_FROM'],
      ['CAMPUS_OAUTH_STUDENT_CLAIM', 'CAMPUS_OAUTH_STUDENT_VALUES'],
    ]) {
      if (pair.some(configured)) pair.forEach(required);
    }
    const oauthEnabled = CAMPUS_OAUTH_REQUIRED_KEYS.some(configured);
    if (oauthEnabled) CAMPUS_OAUTH_REQUIRED_KEYS.forEach(required);
    if (
      configured('SMS_GATEWAY_URL') ||
      configured('RESEND_API_KEY') ||
      oauthEnabled
    ) {
      const secret = required('AUTH_CHALLENGE_SECRET');
      if (Buffer.byteLength(secret) < 32 || placeholder.test(secret)) {
        throw new Error(
          'AUTH_CHALLENGE_SECRET must be a non-placeholder secret of at least 32 bytes',
        );
      }
    }
    if (configured('RESEND_API_KEY')) required('CAMPUS_EMAIL_DOMAINS');
    for (const key of [
      'SMS_GATEWAY_URL',
      'CAMPUS_OAUTH_AUTHORIZATION_URL',
      'CAMPUS_OAUTH_TOKEN_URL',
      'CAMPUS_OAUTH_USERINFO_URL',
      'CAMPUS_OAUTH_REDIRECT_URI',
      'CAMPUS_OAUTH_ISSUER',
    ]) {
      if (!configured(key)) continue;
      try {
        const url = new URL(required(key));
        if (
          url.protocol !== 'https:' ||
          url.username ||
          url.password ||
          url.hash
        )
          throw new Error();
      } catch {
        throw new Error(
          `${key} must be an HTTPS URL without credentials or fragments`,
        );
      }
    }
    if (
      configured('CAMPUS_OAUTH_TOKEN_AUTH_METHOD') &&
      !['client_secret_basic', 'client_secret_post'].includes(
        required('CAMPUS_OAUTH_TOKEN_AUTH_METHOD'),
      )
    ) {
      throw new Error(
        'CAMPUS_OAUTH_TOKEN_AUTH_METHOD must be client_secret_basic or client_secret_post',
      );
    }
    if (
      configured('CAMPUS_EMAIL_DOMAINS') &&
      !required('CAMPUS_EMAIL_DOMAINS')
        .split(',')
        .every((domain) =>
          /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i.test(domain.trim()),
        )
    ) {
      throw new Error('CAMPUS_EMAIL_DOMAINS must contain exact email domains');
    }
  }
  if (role !== 'migrate') {
    const trustedProxies = stringSetting(
      environment.TRUSTED_PROXY_CIDRS,
      'TRUSTED_PROXY_CIDRS',
    );
    if (
      trustedProxies.trim() &&
      !trustedProxies.split(',').every((value) => {
        const parts = value.trim().split('/');
        const version = isIP(parts[0]);
        return (
          version !== 0 &&
          parts.length <= 2 &&
          (parts.length === 1 ||
            (/^\d+$/.test(parts[1]) &&
              Number(parts[1]) <= (version === 4 ? 32 : 128)))
        );
      })
    )
      throw new Error(
        'TRUSTED_PROXY_CIDRS must contain exact IP addresses or CIDR ranges',
      );
    corsOrigins(environment);
  }
  if (NODE_ENV === 'production') {
    if (servesApi) {
      for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET']) {
        const value = required(key);
        if (Buffer.byteLength(value) < 32 || placeholder.test(value))
          throw new Error(
            `${key} must be a non-placeholder secret of at least 32 bytes`,
          );
      }
      if (environment.JWT_SECRET === environment.JWT_REFRESH_SECRET)
        throw new Error('JWT_REFRESH_SECRET must differ from JWT_SECRET');
    }
    if (role !== 'migrate') {
      for (const key of ['REDIS_HOST', 'REDIS_PASSWORD']) required(key);
      if (placeholder.test(required('REDIS_PASSWORD')))
        throw new Error('REDIS_PASSWORD must not be a placeholder');
    }
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
    if (servesApi) {
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
    }
    if (
      initializesDatabase &&
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
  const validated: Record<string, unknown> = {
    ...environment,
    NODE_ENV,
    ENABLE_MOCK_AUTH,
    RUN_SEED,
    IMPORT_DATA,
  };
  if (servesApi || runsBackground) {
    const storage = storageConfiguration((key) => environment[key]);
    const s3 = storage.instances.s3;
    if (s3?.type === 's3') validated.S3_FORCE_PATH_STYLE = s3.forcePathStyle;
  }

  if (servesApi) {
    validated.UPLOAD_MAX_FILE_SIZE = integerSetting(
      environment.UPLOAD_MAX_FILE_SIZE,
      'UPLOAD_MAX_FILE_SIZE',
      10485760,
      1,
    );
  }
  if (servesUsers) {
    validated.CAMPUS_VERIFICATION_DAYS = integerSetting(
      environment.CAMPUS_VERIFICATION_DAYS,
      'CAMPUS_VERIFICATION_DAYS',
      30,
      1,
      366,
    );
  }
  if (role !== 'migrate') {
    validated.PORT = integerSetting(environment.PORT, 'PORT', 3000, 1, 65535);
    validated.REDIS_PORT = integerSetting(
      environment.REDIS_PORT,
      'REDIS_PORT',
      6379,
      1,
      65535,
    );
    validated.REDIS_REC_DB = integerSetting(
      environment.REDIS_REC_DB,
      'REDIS_REC_DB',
      1,
      0,
    );
    validated.EMBEDDING_SERVICE_BATCH_SIZE = integerSetting(
      environment.EMBEDDING_SERVICE_BATCH_SIZE,
      'EMBEDDING_SERVICE_BATCH_SIZE',
      50,
      1,
    );
  }
  return validated;
}
