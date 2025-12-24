import { jest } from '@jest/globals';

describe('api/modules/admin.ts', () => {
  const MODULE_PATH = '@/api/modules/admin';

  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    delete (global as any).uni;
  });

  test('adminLogin posts username and password', async () => {
    const mockReq = jest.fn().mockResolvedValue({ code: 200, data: { token: 't' } });
    jest.doMock('@/utils/request', () => mockReq);

    const { adminLogin } = require(MODULE_PATH);
    const res = await adminLogin('u', 'p');

    expect(mockReq).toHaveBeenCalledTimes(1);
    expect(mockReq.mock.calls[0][0]).toMatchObject({
      url: '/auth/admin/login',
      method: 'POST',
      data: { username: 'u', password: 'p' },
    });

    expect(res).toHaveProperty('code', 200);
    expect(res.data).toHaveProperty('token', 't');
  });

  test('adminUpdateDishStatus posts status to status endpoint', async () => {
    const mockReq = jest.fn().mockResolvedValue({ code: 200, data: null });
    jest.doMock('@/utils/request', () => mockReq);

    const { adminUpdateDishStatus } = require(MODULE_PATH);
    const res = await adminUpdateDishStatus('dish-1', 'online');

    expect(mockReq).toHaveBeenCalledTimes(1);
    expect(mockReq.mock.calls[0][0]).toMatchObject({
      url: '/admin/dishes/dish-1/status',
      method: 'POST',
      data: { status: 'online' },
    });

    expect(res).toHaveProperty('code', 200);
  });

  test('adminGetReports calls GET /admin/reports', async () => {
    const mockReq = jest.fn().mockResolvedValue({ code: 200, data: { items: [] } });
    jest.doMock('@/utils/request', () => mockReq);

    const { adminGetReports } = require(MODULE_PATH);
    const res = await adminGetReports({ page: 2, pageSize: 10 });

    expect(mockReq).toHaveBeenCalledTimes(1);
    expect(mockReq.mock.calls[0][0]).toMatchObject({
      url: '/admin/reports',
      method: 'GET',
    });

    expect(res.code).toBe(200);
  });

  test('createCanteen posts to /admin/canteens', async () => {
    const mockReq = jest.fn().mockResolvedValue({ code: 201, data: { id: 'c1', name: 'C' } });
    jest.doMock('@/utils/request', () => mockReq);

    const { createCanteen } = require(MODULE_PATH);
    const payload = { name: 'C', address: 'A' };
    const res = await createCanteen(payload as any);

    expect(mockReq).toHaveBeenCalledTimes(1);
    expect(mockReq.mock.calls[0][0]).toMatchObject({
      url: '/admin/canteens',
      method: 'POST',
      data: payload,
    });

    expect(res.code).toBe(201);
    expect(res.data).toHaveProperty('id', 'c1');
  });

  test('adminGetCanteenList passes params as data', async () => {
    const mockReq = jest.fn().mockResolvedValue({ code: 200, data: { list: [] } });
    jest.doMock('@/utils/request', () => mockReq);

    const { adminGetCanteenList } = require(MODULE_PATH);
    const params = { page: 1, pageSize: 20 };
    await adminGetCanteenList(params as any);

    expect(mockReq).toHaveBeenCalledTimes(1);
    expect(mockReq.mock.calls[0][0]).toMatchObject({
      url: '/admin/canteens',
      method: 'GET',
      data: params,
    });
  });

  test('deleteWindow calls DELETE', async () => {
    const mockReq = jest.fn().mockResolvedValue({ code: 200, data: null });
    jest.doMock('@/utils/request', () => mockReq);

    const { deleteWindow } = require(MODULE_PATH);
    await deleteWindow('w1');

    expect(mockReq).toHaveBeenCalledTimes(1);
    expect(mockReq.mock.calls[0][0]).toMatchObject({
      url: '/admin/windows/w1',
      method: 'DELETE',
    });
  });
});