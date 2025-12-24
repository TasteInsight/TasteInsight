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

  test('adminCreateDish and adminUpdateDish and adminDeleteDish', async () => {
    const mockReq = jest.fn().mockResolvedValue({ code: 201, data: { id: 'd1' } });
    jest.doMock('@/utils/request', () => mockReq);

    const { adminCreateDish, adminUpdateDish, adminDeleteDish } = require(MODULE_PATH);
    const payload = { name: 'Dish' } as any;
    const created = await adminCreateDish(payload);
    expect(mockReq).toHaveBeenCalledWith(expect.objectContaining({ url: '/admin/dishes', method: 'POST', data: payload }));
    expect(created.code).toBe(201);

    mockReq.mockClear();
    mockReq.mockResolvedValue({ code: 200, data: { id: 'd1' } });
    const updated = await adminUpdateDish('d1', payload);
    expect(mockReq).toHaveBeenCalledWith(expect.objectContaining({ url: '/admin/dishes/d1', method: 'PUT', data: payload }));
    expect(updated.code).toBe(200);

    mockReq.mockClear();
    mockReq.mockResolvedValue({ code: 200, data: null });
    const deleted = await adminDeleteDish('d1');
    expect(mockReq).toHaveBeenCalledWith(expect.objectContaining({ url: '/admin/dishes/d1', method: 'DELETE' }));
    expect(deleted.code).toBe(200);
  });

  test('pending reviews and comments approval/reject', async () => {
    const mockReq = jest.fn().mockResolvedValue({ code: 200, data: { items: [] } });
    jest.doMock('@/utils/request', () => mockReq);

    const { adminGetPendingReviews, adminApproveReview, adminRejectReview, adminGetPendingComments, adminApproveComment, adminRejectComment } = require(MODULE_PATH);

    await adminGetPendingReviews();
    expect(mockReq).toHaveBeenCalledWith(expect.objectContaining({ url: '/admin/reviews/pending', method: 'GET' }));

    mockReq.mockClear();
    mockReq.mockResolvedValue({ code: 200, data: null });
    await adminApproveReview('r1');
    expect(mockReq).toHaveBeenCalledWith(expect.objectContaining({ url: '/admin/reviews/r1/approve', method: 'POST' }));

    mockReq.mockClear();
    await adminRejectReview('r2', 'no');
    expect(mockReq).toHaveBeenCalledWith(expect.objectContaining({ url: '/admin/reviews/r2/reject', method: 'POST', data: { reason: 'no' } }));

    mockReq.mockClear();
    mockReq.mockResolvedValue({ code: 200, data: { items: [] } });
    await adminGetPendingComments();
    expect(mockReq).toHaveBeenCalledWith(expect.objectContaining({ url: '/admin/comments/pending', method: 'GET' }));

    mockReq.mockClear();
    mockReq.mockResolvedValue({ code: 200, data: null });
    await adminApproveComment('c1');
    expect(mockReq).toHaveBeenCalledWith(expect.objectContaining({ url: '/admin/comments/c1/approve', method: 'POST' }));

    mockReq.mockClear();
    await adminRejectComment('c2', 'spam');
    expect(mockReq).toHaveBeenCalledWith(expect.objectContaining({ url: '/admin/comments/c2/reject', method: 'POST', data: { reason: 'spam' } }));
  });

  test('reports and uploads handling', async () => {
    const mockReq = jest.fn().mockResolvedValue({ code: 200, data: null });
    jest.doMock('@/utils/request', () => mockReq);

    const { adminGetReports, adminHandleReport, adminGetPendingUploads, adminApproveUpload, adminRejectUpload } = require(MODULE_PATH);

    await adminGetReports({ status: 'pending' });
    expect(mockReq).toHaveBeenCalledWith(expect.objectContaining({ url: '/admin/reports', method: 'GET' }));

    mockReq.mockClear();
    const handleData = { action: 'ban' } as any;
    await adminHandleReport('rep1', handleData);
    expect(mockReq).toHaveBeenCalledWith(expect.objectContaining({ url: '/admin/reports/rep1/handle', method: 'POST', data: handleData }));

    mockReq.mockClear();
    await adminGetPendingUploads();
    expect(mockReq).toHaveBeenCalledWith(expect.objectContaining({ url: '/admin/dishes/uploads/pending', method: 'GET' }));

    mockReq.mockClear();
    await adminApproveUpload('up1');
    expect(mockReq).toHaveBeenCalledWith(expect.objectContaining({ url: '/admin/dishes/uploads/up1/approve', method: 'POST' }));

    mockReq.mockClear();
    await adminRejectUpload('up2', 'bad');
    expect(mockReq).toHaveBeenCalledWith(expect.objectContaining({ url: '/admin/dishes/uploads/up2/reject', method: 'POST', data: { reason: 'bad' } }));
  });

  test('sub-admins, permissions, logs and news', async () => {
    const mockReq = jest.fn().mockResolvedValue({ code: 200, data: { items: [] } });
    jest.doMock('@/utils/request', () => mockReq);

    const { adminGetSubAdmins, adminCreateSubAdmin, adminDeleteSubAdmin, adminUpdatePermissions, adminGetLogs, adminGetNews, adminCreateNews, adminUpdateNews, adminDeleteNews, adminGetWindowList, updateCanteen, updateWindow } = require(MODULE_PATH);

    await adminGetSubAdmins();
    expect(mockReq).toHaveBeenCalledWith(expect.objectContaining({ url: '/admin/admins', method: 'GET' }));

    mockReq.mockClear();
    const adminData = { username: 'a' } as any;
    await adminCreateSubAdmin(adminData);
    expect(mockReq).toHaveBeenCalledWith(expect.objectContaining({ url: '/admin/admins', method: 'POST', data: adminData }));

    mockReq.mockClear();
    await adminDeleteSubAdmin('sa1');
    expect(mockReq).toHaveBeenCalledWith(expect.objectContaining({ url: '/admin/admins/sa1', method: 'DELETE' }));

    mockReq.mockClear();
    await adminUpdatePermissions('sa1', ['read']);
    expect(mockReq).toHaveBeenCalledWith(expect.objectContaining({ url: '/admin/admins/sa1/permissions', method: 'PUT', data: { permissions: ['read'] } }));

    mockReq.mockClear();
    await adminGetLogs();
    expect(mockReq).toHaveBeenCalledWith(expect.objectContaining({ url: '/admin/logs', method: 'GET' }));

    mockReq.mockClear();
    await adminGetNews();
    expect(mockReq).toHaveBeenCalledWith(expect.objectContaining({ url: '/admin/news', method: 'GET' }));

    mockReq.mockClear();
    const newsData = { title: 'n' } as any;
    await adminCreateNews(newsData);
    expect(mockReq).toHaveBeenCalledWith(expect.objectContaining({ url: '/admin/news', method: 'POST', data: newsData }));

    mockReq.mockClear();
    await adminUpdateNews('news1', newsData);
    expect(mockReq).toHaveBeenCalledWith(expect.objectContaining({ url: '/admin/news/news1', method: 'PUT', data: newsData }));

    mockReq.mockClear();
    await adminDeleteNews('news1');
    expect(mockReq).toHaveBeenCalledWith(expect.objectContaining({ url: '/admin/news/news1', method: 'DELETE' }));

    mockReq.mockClear();
    await adminGetWindowList('c1');
    expect(mockReq).toHaveBeenCalledWith(expect.objectContaining({ url: '/admin/canteens/c1/windows', method: 'GET' }));

    mockReq.mockClear();
    await updateCanteen('c1', { name: 'c' } as any);
    expect(mockReq).toHaveBeenCalledWith(expect.objectContaining({ url: '/admin/canteens/c1', method: 'PUT' }));

    mockReq.mockClear();
    await updateWindow('w1', { name: 'w' } as any);
    expect(mockReq).toHaveBeenCalledWith(expect.objectContaining({ url: '/admin/windows/w1', method: 'PUT' }));
  });
});