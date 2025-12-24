import { jest } from '@jest/globals';

describe('pages/profile/history/composables/use-history.ts', () => {
  const MODULE_PATH = '@/pages/profile/history/composables/use-history';

  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    delete (global as any).uni;
  });

  test('fetchHistory(reset) loads items and sets hasMore based on meta', async () => {
    const mock = jest.fn().mockResolvedValue({ code: 200, data: { items: [{ id: 'h1' }], meta: { totalPages: 2 } } });
    jest.doMock('@/api/modules/user', () => ({ getBrowseHistory: mock }));

    const { useHistory } = require(MODULE_PATH);
    const inst = useHistory();

    await inst.fetchHistory(true);

    expect(mock).toHaveBeenCalledTimes(1);
    expect(inst.historyItems.value).toEqual([{ id: 'h1' }]);
    expect(inst.hasMore.value).toBe(true);
    expect(inst.loading.value).toBe(false);
  });

  test('loadMore appends items and increments page', async () => {
    const getBrowseHistory = jest.fn().mockImplementation(({ page }) =>
      Promise.resolve({ code: 200, data: { items: [{ id: `h${page}` }], meta: { totalPages: 2 } } })
    );
    jest.doMock('@/api/modules/user', () => ({ getBrowseHistory }));

    const { useHistory } = require(MODULE_PATH);
    const inst = useHistory();

    await inst.fetchHistory(true);
    expect(inst.historyItems.value.length).toBe(1);

    await inst.loadMore();
    expect(getBrowseHistory).toHaveBeenCalled();
    expect(inst.historyItems.value.length).toBe(2);
    expect(inst.hasMore.value).toBe(false);
  });

  test('fetchHistory handles errors and sets hasMore false', async () => {
    const getBrowseHistory = jest.fn().mockResolvedValue({ code: 400, message: 'bad' });
    jest.doMock('@/api/modules/user', () => ({ getBrowseHistory }));

    (global as any).uni = { showToast: jest.fn() };

    const { useHistory } = require(MODULE_PATH);
    const inst = useHistory();

    await inst.fetchHistory(true);

    expect(inst.error.value).toBe('bad');
    expect(inst.hasMore.value).toBe(false);
    expect((global as any).uni.showToast).toHaveBeenCalled();
  });

  test('fetchHistory returns early when already loading', async () => {
    const getBrowseHistory = jest.fn();
    jest.doMock('@/api/modules/user', () => ({ getBrowseHistory }));

    const { useHistory } = require(MODULE_PATH);
    const inst = useHistory();
    inst.loading.value = true;

    await inst.fetchHistory(true);
    expect(getBrowseHistory).not.toHaveBeenCalled();
  });
});