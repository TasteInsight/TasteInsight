import { jest } from '@jest/globals';

describe('api/modules/auth.ts', () => {
  const MODULE_PATH = '@/api/modules/auth';

  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('wechatLogin posts code and returns data', async () => {
    const mockReq = jest.fn().mockResolvedValue({ code: 200, data: { accessToken: 'a' } });
    jest.doMock('@/utils/request', () => mockReq);

    const { wechatLogin } = require(MODULE_PATH);
    const res = await wechatLogin('code123');

    expect(mockReq).toHaveBeenCalledTimes(1);
    expect(mockReq.mock.calls[0][0]).toMatchObject({
      url: '/auth/wechat/login',
      method: 'POST',
      data: { code: 'code123' },
    });

    expect(res.code).toBe(200);
  });

  test('refreshToken posts to /auth/refresh', async () => {
    const mockReq = jest.fn().mockResolvedValue({ code: 200, data: { accessToken: 'b' } });
    jest.doMock('@/utils/request', () => mockReq);

    const { refreshToken } = require(MODULE_PATH);
    const res = await refreshToken();

    expect(mockReq).toHaveBeenCalledTimes(1);
    expect(mockReq.mock.calls[0][0]).toMatchObject({
      url: '/auth/refresh',
      method: 'POST',
    });

    expect(res.code).toBe(200);
  });
});