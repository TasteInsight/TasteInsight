import {
  identityCapabilities,
  CAMPUS_OAUTH_REQUIRED_KEYS,
  configuredVerificationMethods,
} from './identity-configuration';

describe('login method configuration', () => {
  const configured = {
    AUTH_CHALLENGE_SECRET: 'challenge-secret'.repeat(4),
    SMS_GATEWAY_URL: 'https://sms.example/send',
    SMS_GATEWAY_TOKEN: 'sms-token',
    WECHAT_APPID: 'miniapp',
    WECHAT_SECRET: 'miniapp-secret',
    WECHAT_APP_APPID: 'mobile-app',
    WECHAT_APP_SECRET: 'mobile-secret',
    RESEND_API_KEY: 'email-key',
    EMAIL_FROM: 'campus@example.org',
    CAMPUS_EMAIL_DOMAINS: 'example.org',
  };
  const capabilities = (settings: Record<string, unknown> = configured) =>
    identityCapabilities((key) => settings[key]);

  it('keeps phone opt-in even when SMS credentials are present', () => {
    expect(capabilities()).toMatchObject({
      phone: false,
      wechatMiniapp: true,
      wechatApp: true,
    });
  });

  it('enables only selected and fully configured login methods', () => {
    expect(
      capabilities({ ...configured, AUTH_LOGIN_METHODS: 'phone' }),
    ).toMatchObject({
      phone: true,
      wechatMiniapp: false,
      wechatApp: false,
    });
    expect(
      capabilities({
        ...configured,
        AUTH_LOGIN_METHODS: 'phone',
        SMS_GATEWAY_TOKEN: '',
      }).phone,
    ).toBe(false);
  });

  it('allows an empty list without disabling campus email verification', () => {
    expect(
      capabilities({ ...configured, AUTH_LOGIN_METHODS: '' }),
    ).toMatchObject({
      phone: false,
      wechatMiniapp: false,
      wechatApp: false,
      campusEmail: true,
    });
  });

  it('reports unsupported methods instead of advertising unfinished login providers', () => {
    expect(() =>
      capabilities({ ...configured, AUTH_LOGIN_METHODS: 'email' }),
    ).toThrow('AUTH_LOGIN_METHODS');
  });
  it.each(['', 'campusEmail', 'campusOAuth', 'campusEmail,campusOAuth'])(
    'configures verification independently: %s',
    (verification) => {
      const oauth = Object.fromEntries(
        CAMPUS_OAUTH_REQUIRED_KEYS.map((key) => [key, 'configured']),
      );
      for (const login of ['', 'campusOAuth']) {
        const result = capabilities({
          ...configured,
          ...oauth,
          AUTH_LOGIN_METHODS: login,
          CAMPUS_VERIFICATION_METHODS: verification,
        });
        expect(result.loginMethods.campusOAuth).toBe(login === 'campusOAuth');
        expect(result.verificationMethods).toEqual({
          campusEmail: verification.includes('campusEmail'),
          campusOAuth: verification.includes('campusOAuth'),
        });
        expect(result.campusOAuth).toBe(result.verificationMethods.campusOAuth);
      }
    },
  );
  it('validates verification methods and removes duplicates', () => {
    expect(
      configuredVerificationMethods(' campusOAuth,campusEmail,campusOAuth '),
    ).toEqual(['campusOAuth', 'campusEmail']);
    expect(() => configuredVerificationMethods('phone')).toThrow(
      'CAMPUS_VERIFICATION_METHODS',
    );
    expect(() => configuredVerificationMethods(false)).toThrow(
      'CAMPUS_VERIFICATION_METHODS',
    );
  });
  it('requires provider credentials for both campus OAuth entry points', () => {
    expect(
      capabilities({ ...configured, AUTH_LOGIN_METHODS: 'campusOAuth' }),
    ).toMatchObject({
      loginMethods: { campusOAuth: false },
      verificationMethods: { campusOAuth: false },
    });
  });
});
