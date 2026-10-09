describe('api/modules/user.ts', () => {
  const MODULE_PATH = '@/api/modules/user';

  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('wechatLogin posts code', async () => {
    const mockReq = jest.fn() as unknown as jest.Mock<any, any>;
    mockReq.mockResolvedValue({ code: 200, data: { accessToken: 'a' } });
    jest.doMock('@/utils/request', () => mockReq);

    const { wechatLogin } = require(MODULE_PATH);
    await wechatLogin('c1');

    expect(mockReq).toHaveBeenCalledTimes(1);
    expect(mockReq.mock.calls[0][0]).toMatchObject({
      url: '/auth/wechat/login',
      method: 'POST',
      data: { code: 'c1' },
    });
  });

  test('profile endpoints GET/PUT and collections', async () => {
    const mockReq = jest.fn() as unknown as jest.Mock<any, any>;
    mockReq.mockResolvedValue({ code: 200, data: { id: 'u1' } });
    jest.doMock('@/utils/request', () => mockReq);

    const {
      getUserProfile,
      updateUserProfile,
      getMyReviews,
      getMyFavorites,
      getBrowseHistory,
      clearBrowseHistory,
      getMyUploads,
      getMyReports,
    } = require(MODULE_PATH);

    await getUserProfile();
    expect(mockReq.mock.calls[0][0]).toMatchObject({ url: '/user/profile', method: 'GET' });

    await updateUserProfile({ name: 'N' } as any);
    expect(mockReq.mock.calls[1][0]).toMatchObject({
      url: '/user/profile',
      method: 'PUT',
      data: { name: 'N' },
    });

    await getMyReviews({ page: 1 });
    expect(mockReq.mock.calls[2][0]).toMatchObject({
      url: '/user/reviews',
      method: 'GET',
      data: { page: 1 },
    });

    await getMyFavorites({ page: 1 });
    expect(mockReq.mock.calls[3][0]).toMatchObject({ url: '/user/favorites', method: 'GET' });

    await getBrowseHistory({ page: 1 });
    expect(mockReq.mock.calls[4][0]).toMatchObject({ url: '/user/history', method: 'GET' });

    await clearBrowseHistory();
    expect(mockReq.mock.calls[5][0]).toMatchObject({ url: '/user/history', method: 'DELETE' });

    await getMyUploads({ page: 2, pageSize: 5 });
    expect(mockReq.mock.calls[6][0]).toMatchObject({
      url: '/user/uploads',
      method: 'GET',
      data: { page: 2, pageSize: 5 },
    });

    await getMyReports({ page: 3, pageSize: 10 });
    expect(mockReq.mock.calls[7][0]).toMatchObject({
      url: '/user/reports',
      method: 'GET',
      data: { page: 3, pageSize: 10 },
    });
  });
});
export {};
