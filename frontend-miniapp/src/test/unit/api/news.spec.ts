import { jest } from '@jest/globals';

describe('api/modules/news.ts', () => {
  const MODULE_PATH = '@/api/modules/news';

  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('getNewsList GETs /news with params', async () => {
    const mockReq = jest.fn() as unknown as jest.Mock<any, any>;
    mockReq.mockResolvedValue({ code: 200, data: { items: [] } });
    jest.doMock('@/utils/request', () => mockReq);

    const { getNewsList } = require(MODULE_PATH);
    await getNewsList({ page: 2, pageSize: 10 });

    expect(mockReq).toHaveBeenCalledTimes(1);
    expect(mockReq.mock.calls[0][0]).toMatchObject({
      url: '/news',
      method: 'GET',
      data: { page: 2, pageSize: 10 },
    });
  });

  test('getNewsById GETs /news/:id', async () => {
    const mockReq = jest.fn() as unknown as jest.Mock<any, any>;
    mockReq.mockResolvedValue({ code: 200, data: { id: 'n1' } });
    jest.doMock('@/utils/request', () => mockReq);

    const { getNewsById } = require(MODULE_PATH);
    await getNewsById('n1');

    expect(mockReq).toHaveBeenCalledTimes(1);
    expect(mockReq.mock.calls[0][0]).toMatchObject({
      url: '/news/n1',
      method: 'GET',
    });
  });
});