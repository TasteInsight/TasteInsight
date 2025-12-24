import { jest } from '@jest/globals';

describe('api/modules/review.ts', () => {
  const MODULE_PATH = '@/api/modules/review';

  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('getReviewsByDish GETs /dishes/:id/reviews with params', async () => {
    const mockReq = jest.fn().mockResolvedValue({ code: 200, data: { items: [] } });
    jest.doMock('@/utils/request', () => mockReq);

    const { getReviewsByDish } = require(MODULE_PATH);
    await getReviewsByDish('dish-1', { page: 1 });

    expect(mockReq).toHaveBeenCalledTimes(1);
    expect(mockReq.mock.calls[0][0]).toMatchObject({
      url: '/dishes/dish-1/reviews',
      method: 'GET',
      data: { page: 1 },
    });
  });

  test('createReview posts to /reviews and returns created data', async () => {
    const mockReq = jest.fn().mockResolvedValue({ code: 201, data: { id: 'r1' } });
    jest.doMock('@/utils/request', () => mockReq);

    const { createReview } = require(MODULE_PATH);
    const res = await createReview({ dishId: 'd1', rating: 5 } as any);

    expect(mockReq).toHaveBeenCalledTimes(1);
    expect(mockReq.mock.calls[0][0]).toMatchObject({ url: '/reviews', method: 'POST', data: { dishId: 'd1', rating: 5 } });
    expect(res.code).toBe(201);
  });

  test('reportReview posts to /reviews/:id/report', async () => {
    const mockReq = jest.fn().mockResolvedValue({ code: 200, data: null });
    jest.doMock('@/utils/request', () => mockReq);

    const { reportReview } = require(MODULE_PATH);
    const res = await reportReview('r1', { reason: 'spam' } as any);

    expect(mockReq).toHaveBeenCalledTimes(1);
    expect(mockReq.mock.calls[0][0]).toMatchObject({ url: '/reviews/r1/report', method: 'POST', data: { reason: 'spam' } });
    expect(res.code).toBe(200);
  });

  test('deleteReview calls DELETE /reviews/:id', async () => {
    const mockReq = jest.fn().mockResolvedValue({ code: 200, data: null });
    jest.doMock('@/utils/request', () => mockReq);

    const { deleteReview } = require(MODULE_PATH);
    await deleteReview('r1');

    expect(mockReq).toHaveBeenCalledTimes(1);
    expect(mockReq.mock.calls[0][0]).toMatchObject({ url: '/reviews/r1', method: 'DELETE' });
  });
});