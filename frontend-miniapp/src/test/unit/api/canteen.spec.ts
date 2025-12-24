import { jest } from '@jest/globals';

describe('api/modules/canteen.ts', () => {
  const MODULE_PATH = '@/api/modules/canteen';

  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('getCanteenList GETs /canteens with params', async () => {
    const mockReq = jest.fn().mockResolvedValue({ code: 200, data: { list: [] } });
    jest.doMock('@/utils/request', () => mockReq);

    const { getCanteenList } = require(MODULE_PATH);
    await getCanteenList({ page: 1 });

    expect(mockReq).toHaveBeenCalledTimes(1);
    expect(mockReq.mock.calls[0][0]).toMatchObject({
      url: '/canteens',
      method: 'GET',
      data: { page: 1 },
    });
  });

  test('getCanteenDetail GETs /canteens/:id', async () => {
    const mockReq = jest.fn().mockResolvedValue({ code: 200, data: { id: 'c1' } });
    jest.doMock('@/utils/request', () => mockReq);

    const { getCanteenDetail } = require(MODULE_PATH);
    await getCanteenDetail('c1');

    expect(mockReq).toHaveBeenCalledTimes(1);
    expect(mockReq.mock.calls[0][0]).toMatchObject({
      url: '/canteens/c1',
      method: 'GET',
    });
  });

  test('getWindowDishes GETs /windows/:id/dishes', async () => {
    const mockReq = jest.fn().mockResolvedValue({ code: 200, data: { items: [] } });
    jest.doMock('@/utils/request', () => mockReq);

    const { getWindowDishes } = require(MODULE_PATH);
    await getWindowDishes('w1');

    expect(mockReq).toHaveBeenCalledTimes(1);
    expect(mockReq.mock.calls[0][0]).toMatchObject({
      url: '/windows/w1/dishes',
      method: 'GET',
    });
  });

  test('getWindowList GETs /canteens/:id/windows', async () => {
    const mockReq = jest.fn().mockResolvedValue({ code: 200, data: { items: [], meta: { page: 1, totalPages: 1 } } });
    jest.doMock('@/utils/request', () => mockReq);

    const { getWindowList } = require(MODULE_PATH);
    await getWindowList('c1', { page: 2 });

    expect(mockReq).toHaveBeenCalledTimes(1);
    expect(mockReq.mock.calls[0][0]).toMatchObject({
      url: '/canteens/c1/windows',
      method: 'GET',
      data: { page: 2 },
    });
  });

  test('getWindowDishes rejects when request fails', async () => {
    const mockReq = jest.fn().mockRejectedValue(new Error('boom'));
    jest.doMock('@/utils/request', () => mockReq);

    const { getWindowDishes } = require(MODULE_PATH);
    await expect(getWindowDishes('w1')).rejects.toThrow('boom');
  });
});