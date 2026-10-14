import { ForbiddenException } from '@nestjs/common';

export const CAMPUS_OAUTH_REQUIRED_KEYS = [
  'CAMPUS_OAUTH_AUTHORIZATION_URL',
  'CAMPUS_OAUTH_TOKEN_URL',
  'CAMPUS_OAUTH_USERINFO_URL',
  'CAMPUS_OAUTH_CLIENT_ID',
  'CAMPUS_OAUTH_CLIENT_SECRET',
  'CAMPUS_OAUTH_REDIRECT_URI',
  'CAMPUS_OAUTH_SCOPE',
  'CAMPUS_OAUTH_ISSUER',
] as const;

const LOGIN_METHOD_REQUIREMENTS = {
  phone: {
    keys: ['SMS_GATEWAY_URL', 'SMS_GATEWAY_TOKEN'],
    requiresChallenge: true,
  },
  wechatMiniapp: {
    keys: ['WECHAT_APPID', 'WECHAT_SECRET'],
    requiresChallenge: false,
  },
  campusOAuth: { keys: CAMPUS_OAUTH_REQUIRED_KEYS, requiresChallenge: true },
  wechatApp: {
    keys: ['WECHAT_APP_APPID', 'WECHAT_APP_SECRET'],
    requiresChallenge: false,
  },
} as const;

export type LoginMethod = keyof typeof LOGIN_METHOD_REQUIREMENTS;
type ConfigurationGetter = (key: string) => unknown;

const VERIFICATION_METHOD_REQUIREMENTS = {
  campusEmail: ['RESEND_API_KEY', 'EMAIL_FROM', 'CAMPUS_EMAIL_DOMAINS'],
  campusOAuth: CAMPUS_OAUTH_REQUIRED_KEYS,
} as const;
export type CampusVerificationMethod =
  keyof typeof VERIFICATION_METHOD_REQUIREMENTS;

function configuredMethods<T extends string>(
  value: unknown,
  key: string,
  supported: Record<T, unknown>,
  defaults: T[],
): T[] {
  if (value === undefined || value === null) return defaults;
  if (typeof value !== 'string')
    throw new Error(`${key} must be a comma-separated string`);
  const methods = value
    .split(',')
    .map((method) => method.trim())
    .filter(Boolean);
  for (const method of methods) {
    if (!Object.hasOwn(supported, method))
      throw new Error(`${key} contains an unsupported method: ${method}`);
  }
  return [...new Set(methods)] as T[];
}
export function configuredLoginMethods(value: unknown): LoginMethod[] {
  return configuredMethods(
    value,
    'AUTH_LOGIN_METHODS',
    LOGIN_METHOD_REQUIREMENTS,
    ['wechatMiniapp', 'wechatApp'],
  );
}
export function configuredVerificationMethods(
  value: unknown,
): CampusVerificationMethod[] {
  return configuredMethods(
    value,
    'CAMPUS_VERIFICATION_METHODS',
    VERIFICATION_METHOD_REQUIREMENTS,
    ['campusEmail', 'campusOAuth'],
  );
}
export function assertVerificationMethodEnabled(
  method: CampusVerificationMethod,
  get: ConfigurationGetter,
): void {
  if (
    !configuredVerificationMethods(get('CAMPUS_VERIFICATION_METHODS')).includes(
      method,
    )
  ) {
    throw new ForbiddenException({
      code: 'VERIFICATION_METHOD_DISABLED',
      message: '该校园认证方式暂不可用',
    });
  }
}

export function assertLoginMethodEnabled(
  method: LoginMethod,
  get: ConfigurationGetter,
): void {
  if (!configuredLoginMethods(get('AUTH_LOGIN_METHODS')).includes(method)) {
    throw new ForbiddenException({
      code: 'LOGIN_METHOD_DISABLED',
      message: '该登录方式暂不可用',
    });
  }
}

export function identityCapabilities(get: (key: string) => unknown) {
  const has = (...keys: readonly string[]) =>
    keys.every(
      (key) =>
        typeof get(key) === 'string' && (get(key) as string).trim().length > 0,
    );
  const secret = get('AUTH_CHALLENGE_SECRET');
  const verificationConfigured =
    typeof secret === 'string' && Buffer.byteLength(secret) >= 32;
  const enabled = new Set(configuredLoginMethods(get('AUTH_LOGIN_METHODS')));
  const loginAvailable = (method: LoginMethod) => {
    const requirements = LOGIN_METHOD_REQUIREMENTS[method];
    return (
      enabled.has(method) &&
      has(...requirements.keys) &&
      (!requirements.requiresChallenge || verificationConfigured)
    );
  };
  const verificationEnabled = new Set(
    configuredVerificationMethods(get('CAMPUS_VERIFICATION_METHODS')),
  );
  const verificationAvailable = (method: CampusVerificationMethod) =>
    verificationEnabled.has(method) &&
    verificationConfigured &&
    has(...VERIFICATION_METHOD_REQUIREMENTS[method]);
  const loginMethods = {
    phone: loginAvailable('phone'),
    wechatMiniapp: loginAvailable('wechatMiniapp'),
    wechatApp: loginAvailable('wechatApp'),
    campusOAuth: loginAvailable('campusOAuth'),
  };
  const verificationMethods = {
    campusEmail: verificationAvailable('campusEmail'),
    campusOAuth: verificationAvailable('campusOAuth'),
  };
  // Flat fields retain the contract used by installed clients.
  return {
    phone: loginMethods.phone,
    wechatMiniapp: loginMethods.wechatMiniapp,
    wechatApp: loginMethods.wechatApp,
    ...verificationMethods,
    loginMethods,
    verificationMethods,
  };
}
