import { jest } from '@jest/globals';

describe('api/modules/dish.ts', () => {
  const MODULE_PATH = '@/api/modules/dish';

  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('getDishById GETs /dishes/:id', async () => {
    const mockReq = jest.fn() as unknown as jest.Mock<any, any>;
    mockReq.mockResolvedValue({ code: 200, data: { id: 'd1' } });
    jest.doMock('@/utils/request', () => mockReq);

    const { getDishById } = require(MODULE_PATH);
    await getDishById('d1');

    expect(mockReq).toHaveBeenCalledTimes(1);
    expect(mockReq.mock.calls[0][0]).toMatchObject({
      url: '/dishes/d1',
      method: 'GET',
    });
  });

  test('getDishes posts params', async () => {
    const mockReq = jest.fn() as unknown as jest.Mock<any, any>;
    mockReq.mockResolvedValue({ code: 200, data: { items: [] } });
    jest.doMock('@/utils/request', () => mockReq);

    const { getDishes } = require(MODULE_PATH);
    const params = { page: 1, pageSize: 10 } as any;
    await getDishes(params);

    expect(mockReq).toHaveBeenCalledTimes(1);
    expect(mockReq.mock.calls[0][0]).toMatchObject({ url: '/dishes', method: 'POST', data: params });
  });

  test('getDishesImages GETs /dishes/images', async () => {
    const mockReq = jest.fn() as unknown as jest.Mock<any, any>;
    mockReq.mockResolvedValue({ code: 200, data: {} });
    jest.doMock('@/utils/request', () => mockReq);

    const { getDishesImages } = require(MODULE_PATH);
    await getDishesImages();

    expect(mockReq).toHaveBeenCalledTimes(1);
    expect(mockReq.mock.calls[0][0]).toMatchObject({ url: '/dishes/images', method: 'GET' });
  });

  test('favoriteDish posts to favorite endpoint', async () => {
    const mockReq = jest.fn() as unknown as jest.Mock<any, any>;
    mockReq.mockResolvedValue({ code: 200, data: null });
    jest.doMock('@/utils/request', () => mockReq);

    const { favoriteDish, unfavoriteDish } = require(MODULE_PATH);
    await favoriteDish('d1');
    expect(mockReq.mock.calls[0][0]).toMatchObject({ url: '/dishes/d1/favorite', method: 'POST' });

    await unfavoriteDish('d1');
    expect(mockReq.mock.calls[1][0]).toMatchObject({ url: '/dishes/d1/favorite', method: 'DELETE' });
  });

  test('uploadDish posts to /dishes/upload', async () => {
    const mockReq = jest.fn() as unknown as jest.Mock<any, any>;
    mockReq.mockResolvedValue({ code: 201, data: { id: 'd2' } });
    jest.doMock('@/utils/request', () => mockReq);

    const { uploadDish } = require(MODULE_PATH);
    const payload = { name: 'N' } as any;
    const res = await uploadDish(payload);

    expect(mockReq).toHaveBeenCalledTimes(1);
    expect(mockReq.mock.calls[0][0]).toMatchObject({ url: '/dishes/upload', method: 'POST', data: payload });
    expect(res.code).toBe(201);
  });
});