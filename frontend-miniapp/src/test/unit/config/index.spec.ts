export {};

describe('config index', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    jest.resetModules();
  });

  test('selects mock config when NODE_ENV is mock', () => {
    process.env.NODE_ENV = 'mock';
    const cfg = require('@/config').default;
    expect(cfg.baseUrl).toContain('127.0.0.1');
  });

  test('selects development config when NODE_ENV is development', () => {
    process.env.NODE_ENV = 'development';
    const cfg = require('@/config').default;
    expect(cfg.baseUrl).toContain('www.zens.top');
  });

  test('selects production config otherwise', () => {
    process.env.NODE_ENV = 'production';
    const cfg = require('@/config').default;
    expect(cfg.baseUrl).toContain('prod.api');
  });
});
