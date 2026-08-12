describe('api/modules/auth.ts', () => {
  const MODULE_PATH = '@/api/modules/auth';

  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('refreshToken posts to /auth/refresh', async () => {
    const mockReq = jest.fn() as unknown as jest.Mock<any, any>;
    mockReq.mockResolvedValue({ code: 200, data: { accessToken: 'b' } });
    jest.doMock('@/utils/request', () => mockReq);

    const { refreshToken } = require(MODULE_PATH);
    const res = await refreshToken('refresh-token');

    expect(mockReq).toHaveBeenCalledTimes(1);
    expect(mockReq.mock.calls[0][0]).toMatchObject({
      url: '/auth/refresh',
      method: 'POST',
      header: { Authorization: 'Bearer refresh-token' },
    });

    expect(res.code).toBe(200);
  });
});
export {};
