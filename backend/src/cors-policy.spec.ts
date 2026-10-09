import { corsPolicy, validateEnvironment } from './environment';

describe('browser origin policy', () => {
  const environment = {
    APP_URL: 'http://localhost:3001',
    CORS_ALLOWED_ORIGINS: 'http://localhost:5173, https://portal.example.org',
  };
  it.each([
    [undefined, true],
    ['http://localhost:3001', true],
    ['http://localhost:5173', true],
    ['https://portal.example.org', true],
    ['https://evil.example.org', false],
    ['http://localhost:5174', false],
  ])('handles origin %s', (origin, allowed) => {
    const callback = jest.fn();
    corsPolicy(environment).origin(origin, callback);
    expect(callback).toHaveBeenCalledWith(null, allowed);
    expect(corsPolicy(environment).credentials).toBe(false);
  });
  it.each([
    '*',
    'https://a.example.org/path',
    'https://a.example.org/.',
    'https://a.example.org/../',
    'https://user:pass@a.example.org',
    'file:///tmp',
    'invalid',
    'https://a.example.org?x=1',
  ])('rejects invalid origin %s', (value) => {
    expect(() => validateEnvironment({ CORS_ALLOWED_ORIGINS: value })).toThrow(
      'CORS_ALLOWED_ORIGINS',
    );
  });
  it.each([
    'not-a-url-with-private-password',
    'http://user:private-password@api.example.org',
  ])('sanitizes APP_URL failures in development', (APP_URL) => {
    expect(() => validateEnvironment({ APP_URL })).toThrow('APP_URL');
    try {
      validateEnvironment({ APP_URL });
    } catch (error) {
      expect(String(error)).not.toContain('private-password');
    }
  });
});
