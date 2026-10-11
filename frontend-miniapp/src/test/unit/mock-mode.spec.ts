import type * as MockAdapter from '@/mock/mock-adapter';

const originalMode = process.env.VITE_BUILD_MODE;
let adapter: typeof MockAdapter;

function loadMode(mode?: string) {
  if (mode === undefined) delete process.env.VITE_BUILD_MODE;
  else process.env.VITE_BUILD_MODE = mode;
  jest.isolateModules(() => {
    adapter = require('@/mock/mock-adapter');
  });
  const handler = jest.fn().mockResolvedValue({ code: 200, data: { id: 'mock-dish' } });
  adapter.registerMockRoute('GET', '/mock-mode-probe', handler);
  return handler;
}

afterEach(() => {
  if (originalMode === undefined) delete process.env.VITE_BUILD_MODE;
  else process.env.VITE_BUILD_MODE = originalMode;
});

test('the development mock entry point enables registered local mock routes', async () => {
  const handler = loadMode('mock');
  expect(adapter.USE_MOCK).toBe(true);
  await expect(adapter.mockInterceptor({ url: '/mock-mode-probe' })).resolves.toEqual({
    code: 200,
    data: { id: 'mock-dish' },
  });
  expect(handler).toHaveBeenCalledTimes(1);
});

test.each([undefined, 'production', 'development', 'e2e', 'staging'])(
  'mode %s never intercepts production requests with local mock data',
  async mode => {
    const handler = loadMode(mode);
    expect(adapter.USE_MOCK).toBe(false);
    await expect(adapter.mockInterceptor({ url: '/mock-mode-probe' })).resolves.toBeNull();
    expect(handler).not.toHaveBeenCalled();
  }
);
