import { jest } from '@jest/globals';

describe('api/modules/comment.ts', () => {
  const MODULE_PATH = '@/api/modules/comment';

  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('getCommentsByReview GETs /comments/:reviewId with params', async () => {
    const mockReq = jest.fn().mockResolvedValue({ code: 200, data: { items: [] } });
    jest.doMock('@/utils/request', () => mockReq);

    const { getCommentsByReview } = require(MODULE_PATH);
    await getCommentsByReview('r1', { page: 1 });

    expect(mockReq).toHaveBeenCalledTimes(1);
    expect(mockReq.mock.calls[0][0]).toMatchObject({
      url: '/comments/r1',
      method: 'GET',
      data: { page: 1 },
    });
  });

  test('createComment posts to /comments', async () => {
    const mockReq = jest.fn().mockResolvedValue({ code: 201, data: { id: 'c1' } });
    jest.doMock('@/utils/request', () => mockReq);

    const { createComment } = require(MODULE_PATH);
    const payload = { reviewId: 'r1', content: 'hi' } as any;
    const res = await createComment(payload);

    expect(mockReq).toHaveBeenCalledTimes(1);
    expect(mockReq.mock.calls[0][0]).toMatchObject({
      url: '/comments',
      method: 'POST',
      data: payload,
    });
    expect(res.code).toBe(201);
  });

  test('reportComment posts to /comments/:id/report', async () => {
    const mockReq = jest.fn().mockResolvedValue({ code: 200, data: null });
    jest.doMock('@/utils/request', () => mockReq);

    const { reportComment } = require(MODULE_PATH);
    const res = await reportComment('c1', { reason: 'spam' } as any);

    expect(mockReq).toHaveBeenCalledTimes(1);
    expect(mockReq.mock.calls[0][0]).toMatchObject({
      url: '/comments/c1/report',
      method: 'POST',
      data: { reason: 'spam' },
    });
    expect(res.code).toBe(200);
  });

  test('deleteComment calls DELETE /comments/:id', async () => {
    const mockReq = jest.fn().mockResolvedValue({ code: 200, data: null });
    jest.doMock('@/utils/request', () => mockReq);

    const { deleteComment } = require(MODULE_PATH);
    await deleteComment('c1');

    expect(mockReq).toHaveBeenCalledTimes(1);
    expect(mockReq.mock.calls[0][0]).toMatchObject({
      url: '/comments/c1',
      method: 'DELETE',
    });
  });
});