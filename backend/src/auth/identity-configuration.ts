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

export function identityCapabilities(get: (key: string) => unknown) {
  const has = (...keys: readonly string[]) =>
    keys.every(
      (key) =>
        typeof get(key) === 'string' && (get(key) as string).trim().length > 0,
    );
  const secret = get('AUTH_CHALLENGE_SECRET');
  const verificationConfigured =
    typeof secret === 'string' && Buffer.byteLength(secret) >= 32;
  return {
    phone:
      verificationConfigured && has('SMS_GATEWAY_URL', 'SMS_GATEWAY_TOKEN'),
    wechatMiniapp: has('WECHAT_APPID', 'WECHAT_SECRET'),
    wechatApp: has('WECHAT_APP_APPID', 'WECHAT_APP_SECRET'),
    campusEmail:
      verificationConfigured &&
      has('RESEND_API_KEY', 'EMAIL_FROM', 'CAMPUS_EMAIL_DOMAINS'),
    campusOAuth: verificationConfigured && has(...CAMPUS_OAUTH_REQUIRED_KEYS),
  };
}
