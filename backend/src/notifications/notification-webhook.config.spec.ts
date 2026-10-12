import { validateEnvironment } from '@/environment';
import { notificationWebhookConfiguration } from './notification-webhook.config';

describe('signed notification webhook configuration', () => {
  const secret = 's'.repeat(32);
  const configuration = (values: Record<string, unknown>) =>
    notificationWebhookConfiguration((key) => values[key]);

  it('keeps external delivery disabled without a URL', () => {
    expect(configuration({})).toMatchObject({
      url: '',
      pollMs: 5000,
      maxAttempts: 5,
    });
  });

  it.each([
    'https:hooks.example.test/events',
    '//hooks.example.test/events',
    'http://hooks.example.test/events',
    'https://user:password@hooks.example.test/events',
    'https://hooks.example.test/events#fragment',
  ])('rejects unsafe production URL %s', (url) => {
    expect(() =>
      configuration({
        NODE_ENV: 'production',
        NOTIFICATION_WEBHOOK_URL: url,
        NOTIFICATION_WEBHOOK_SECRET: secret,
      }),
    ).toThrow('NOTIFICATION_WEBHOOK_URL');
  });

  it.each([
    undefined,
    '',
    'short',
    'change-me-to-a-long-random-signing-secret',
  ])('rejects missing or placeholder signing secrets', (value) => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'test',
        NOTIFICATION_WEBHOOK_URL: 'https://hooks.example.test/events',
        NOTIFICATION_WEBHOOK_SECRET: value,
      }),
    ).toThrow('NOTIFICATION_WEBHOOK_SECRET');
  });

  it.each([
    'http://localhost:1234/events',
    'http://127.0.0.1:1234/events',
    'http://[::1]:1234/events',
  ])('allows explicit loopback HTTP only in development/test: %s', (url) => {
    const config = {
      NOTIFICATION_WEBHOOK_URL: url,
      NOTIFICATION_WEBHOOK_SECRET: secret,
    };
    expect(() =>
      validateEnvironment({ ...config, NODE_ENV: 'test' }),
    ).not.toThrow();
    expect(() =>
      configuration({ ...config, NODE_ENV: 'development' }),
    ).not.toThrow();
    expect(() => configuration({ ...config, NODE_ENV: 'production' })).toThrow(
      'NOTIFICATION_WEBHOOK_URL',
    );
  });

  it.each([
    ['NOTIFICATION_WEBHOOK_TIMEOUT_MS', '30001'],
    ['NOTIFICATION_WEBHOOK_TIMEOUT_MS', '99'],
    ['NOTIFICATION_WEBHOOK_POLL_MS', '0'],
    ['NOTIFICATION_WEBHOOK_MAX_ATTEMPTS', '21'],
    ['NOTIFICATION_WEBHOOK_BACKOFF_MS', 'NaN'],
  ])(
    'rejects invalid timing or retry configuration at startup: %s',
    (key, value) => {
      expect(() => validateEnvironment({ [key]: value })).toThrow(key);
    },
  );
});
