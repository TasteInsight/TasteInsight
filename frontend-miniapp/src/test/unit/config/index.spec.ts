export {};

describe('config index', () => {
  const originalApiBaseUrl = process.env.VITE_API_BASE_URL;

  afterEach(() => {
    if (originalApiBaseUrl === undefined) {
      delete process.env.VITE_API_BASE_URL;
    } else {
      process.env.VITE_API_BASE_URL = originalApiBaseUrl;
    }
    jest.resetModules();
  });

  test('uses the API URL injected for the current build mode', () => {
    process.env.VITE_API_BASE_URL = 'http://localhost:3001';
    const cfg = require('@/config').default;
    expect(cfg.baseUrl).toBe('http://localhost:3001');
  });

  test('normalizes whitespace and trailing slashes', () => {
    process.env.VITE_API_BASE_URL = ' https://api.example.invalid/api/v1/// ';
    const cfg = require('@/config').default;
    expect(cfg.baseUrl).toBe('https://api.example.invalid/api/v1');
  });

  test('fails fast when the build did not provide an API URL', () => {
    delete process.env.VITE_API_BASE_URL;
    expect(() => require('@/config')).toThrow('VITE_API_BASE_URL');
  });
});
