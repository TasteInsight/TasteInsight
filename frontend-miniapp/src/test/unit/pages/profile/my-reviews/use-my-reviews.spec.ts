import { jest } from '@jest/globals';

describe('pages/profile/my-reviews/composables/use-my-reviews.ts', () => {
  const MODULE_PATH = '@/pages/profile/my-reviews/composables/use-my-reviews';

  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    delete (global as any).uni;
  });

  test('fetchReviews(reset) loads items and sets hasMore', async () => {
    const getMyReviews = jest.fn() as unknown as jest.Mock<any, any>;
    getMyReviews.mockResolvedValue({ code: 200, data: { items: [{ id: 'r1' }], meta: { totalPages: 2 } } });
    jest.doMock('@/api/modules/user', () => ({ getMyReviews }));

    const { useMyReviews } = require(MODULE_PATH);
    const inst = useMyReviews();

    await inst.fetchReviews(true);

    expect(getMyReviews).toHaveBeenCalledTimes(1);
    expect(inst.reviews.value).toEqual([{ id: 'r1' }]);
    expect(inst.hasMore.value).toBe(true);
  });

  test('loadMore appends correctly', async () => {
    const getMyReviews = jest.fn().mockImplementation(({ page }) => Promise.resolve({ code: 200, data: { items: [{ id: `r${page}` }], meta: { totalPages: 2 } } }));
    jest.doMock('@/api/modules/user', () => ({ getMyReviews }));

    const { useMyReviews } = require(MODULE_PATH);
    const inst = useMyReviews();

    await inst.fetchReviews(true);
    await inst.loadMore();

    expect(inst.reviews.value.length).toBe(2);
    expect(inst.hasMore.value).toBe(false);
  });

  test('fetchReviews handles errors and sets hasMore false', async () => {
    const getMyReviews = jest.fn() as unknown as jest.Mock<any, any>;
    getMyReviews.mockResolvedValue({ code: 500, message: 'err' });
    jest.doMock('@/api/modules/user', () => ({ getMyReviews }));

    (global as any).uni = { showToast: jest.fn() };

    const { useMyReviews } = require(MODULE_PATH);
    const inst = useMyReviews();

    await inst.fetchReviews(true);

    expect(inst.error.value).toBe('err');
    expect(inst.hasMore.value).toBe(false);
    expect((global as any).uni.showToast).toHaveBeenCalled();
  });
});