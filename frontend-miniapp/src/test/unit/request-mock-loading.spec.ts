export {};

const initialMode = process.env.VITE_BUILD_MODE;
const registered = jest.fn();
const intercepted = jest.fn();
const user = { sessionVersion: 0, token: null };

beforeEach(() => {
  jest.resetModules();
  user.sessionVersion = 0;
  registered.mockClear();
  intercepted.mockReset();
  jest.doMock('@/store/modules/use-user-store', () => ({
    useUserStore: () => user,
  }));
  jest.doMock('@/mock/mock-routes', () => {
    registered();
    return {};
  });
  jest.doMock('@/mock/mock-adapter', () => ({ mockInterceptor: intercepted }));
});

afterEach(() => {
  if (initialMode === undefined) delete process.env.VITE_BUILD_MODE;
  else process.env.VITE_BUILD_MODE = initialMode;
  jest.dontMock('@/store/modules/use-user-store');
  jest.dontMock('@/mock/mock-routes');
  jest.dontMock('@/mock/mock-adapter');
});

test.each(['production', 'development', 'e2e'])(
  '%s does not initialize the local mock data and route registry',
  async mode => {
    process.env.VITE_BUILD_MODE = mode;
    await import('@/utils/request');
    expect(registered).not.toHaveBeenCalled();
  }
);

test('mock mode registers routes once before simultaneous first requests', async () => {
  process.env.VITE_BUILD_MODE = 'mock';
  intercepted.mockImplementation(async () => {
    expect(registered).toHaveBeenCalledTimes(1);
    return { code: 200, data: 'mock result' };
  });
  const request = (await import('@/utils/request')).default;
  const result = await Promise.all([request({ url: '/one' }), request({ url: '/two' })]);
  expect(result).toEqual([
    { code: 200, data: 'mock result' },
    { code: 200, data: 'mock result' },
  ]);
  expect(registered).toHaveBeenCalledTimes(1);
});

test('a session change while mock routes initialize prevents the old request handler', async () => {
  process.env.VITE_BUILD_MODE = 'mock';
  intercepted.mockResolvedValue({ code: 200, data: 'stale write' });
  const request = (await import('@/utils/request')).default;
  const pending = request({ url: '/favorites', method: 'POST' });
  user.sessionVersion += 1;
  await expect(pending).rejects.toThrow('登录会话已变更');
  expect(intercepted).not.toHaveBeenCalled();
});
