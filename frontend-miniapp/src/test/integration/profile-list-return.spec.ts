import { effectScope, reactive, type EffectScope } from 'vue';
import { useUserStore } from '@/store/modules/use-user-store';
import { getMyReviews, getMyFavorites, getBrowseHistory } from '@/api/modules/user';
import { useMyReviews } from '@/pages/profile/my-reviews/composables/use-my-reviews';
import { useFavorites } from '@/pages/profile/my-favorites/composables/use-favorites';
import { useHistory } from '@/pages/profile/history/composables/use-history';
import { unfavoriteDish } from '@/api/modules/dish';

jest.mock('@/store/modules/use-user-store', () => ({ useUserStore: jest.fn() }));
jest.mock('@/api/modules/user', () => ({
  getMyReviews: jest.fn(),
  getMyFavorites: jest.fn(),
  getBrowseHistory: jest.fn(),
}));
jest.mock('@/api/modules/dish', () => ({ unfavoriteDish: jest.fn() }));

const scopes: EffectScope[] = [];
const response = (items: any[], page = 1, totalPages = 3) => ({
  code: 200,
  data: { items, meta: { page, totalPages, total: 25, pageSize: 10 } },
});
let store: any;
const cases = [
  ['reviews', getMyReviews, useMyReviews, 'reviews', 'fetchReviews'],
  ['favorites', getMyFavorites, useFavorites, 'favoriteItems', 'fetchFavorites'],
  ['history', getBrowseHistory, useHistory, 'historyItems', 'fetchHistory'],
] as const;

beforeEach(() => {
  jest.clearAllMocks();
  for (const api of [getMyReviews, getMyFavorites, getBrowseHistory, unfavoriteDish]) {
    (api as jest.Mock).mockReset();
  }
  store = reactive({ sessionVersion: 0, isLoggedIn: true, userInfo: { id: 'a' } });
  (useUserStore as unknown as jest.Mock).mockReturnValue(store);
});
afterEach(() => scopes.splice(0).forEach(scope => scope.stop()));

describe.each(cases)('%s list', (_name, api, create, itemsKey, fetchKey) => {
  function setup(): any {
    const scope = effectScope();
    scopes.push(scope);
    return scope.run(() => create());
  }

  it('keeps data and retries the same page after an append failure', async () => {
    const mock = api as jest.Mock;
    mock.mockResolvedValueOnce(response([{ id: 'first', dishId: 'first' }]));
    const list = setup();
    expect(await list[fetchKey](true)).toBe(true);
    mock.mockRejectedValueOnce(new Error('第二页失败'));
    expect(await list.loadMore()).toBe(false);
    expect(list[itemsKey].value).toHaveLength(1);
    expect(list.hasMore.value).toBe(true);
    mock.mockResolvedValueOnce(response([{ id: 'next', dishId: 'next' }], 2));
    expect(await list.loadMore()).toBe(true);
    expect(mock.mock.calls.map(call => call[0].page)).toEqual([1, 2, 2]);
  });

  it('revalidates all loaded pages atomically and preserves them when refresh fails', async () => {
    const mock = api as jest.Mock;
    mock
      .mockResolvedValueOnce(response([{ id: 'first', dishId: 'first' }]))
      .mockResolvedValueOnce(response([{ id: 'second', dishId: 'second' }], 2));
    const list = setup();
    await list[fetchKey]();
    await list.loadMore();
    const before = [...list[itemsKey].value];
    mock
      .mockResolvedValueOnce(response([{ id: 'fresh', dishId: 'fresh' }]))
      .mockRejectedValueOnce(new Error('刷新失败'));
    expect(await list.refresh()).toBe(false);
    expect(list[itemsKey].value).toEqual(before);
    mock
      .mockResolvedValueOnce(response([{ id: 'fresh', dishId: 'fresh' }]))
      .mockResolvedValueOnce(response([], 2, 2));
    expect(await list.refresh()).toBe(true);
    expect(list[itemsKey].value.map((item: any) => item.id)).toEqual(['fresh']);
    expect(mock.mock.calls.slice(-2).map(call => call[0].page)).toEqual([1, 2]);
  });

  it('discards the old account response without clearing a new request', async () => {
    let resolveOld!: (value: any) => void;
    const mock = api as jest.Mock;
    mock.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          resolveOld = resolve;
        })
    );
    const list = setup();
    const old = list[fetchKey]();
    store.sessionVersion++;
    store.userInfo = { id: 'b' };
    mock.mockResolvedValueOnce(response([{ id: 'b', dishId: 'b' }]));
    expect(await list[fetchKey]()).toBe(true);
    resolveOld(response([{ id: 'a', dishId: 'a' }]));
    expect(await old).toBe(false);
    expect(list[itemsKey].value.map((item: any) => item.id)).toEqual(['b']);
  });

  it.each(['append-first', 'refresh-first'])(
    'return refresh supersedes an in-flight append: %s',
    async order => {
      let finishAppend!: (value: any) => void;
      let finishRefresh!: (value: any) => void;
      const mock = api as jest.Mock;
      mock
        .mockResolvedValueOnce(response([{ id: 'first', dishId: 'first' }]))
        .mockImplementationOnce(
          () =>
            new Promise(resolve => {
              finishAppend = resolve;
            })
        )
        .mockImplementationOnce(
          () =>
            new Promise(resolve => {
              finishRefresh = resolve;
            })
        );
      const list = setup();
      await list[fetchKey]();
      const append = list.loadMore();
      const refresh = list.refresh();
      expect(mock.mock.calls.map(call => call[0].page)).toEqual([1, 2, 1]);

      if (order === 'append-first') {
        finishAppend(response([{ id: 'stale', dishId: 'stale' }], 2));
        expect(await append).toBe(false);
        expect(list.loading.value).toBe(true);
        expect(list[itemsKey].value.map((item: any) => item.id)).toEqual(['first']);
        finishRefresh(response([{ id: 'fresh', dishId: 'fresh' }]));
        expect(await refresh).toBe(true);
      } else {
        finishRefresh(response([{ id: 'fresh', dishId: 'fresh' }]));
        expect(await refresh).toBe(true);
        finishAppend(response([{ id: 'stale', dishId: 'stale' }], 2));
        expect(await append).toBe(false);
      }
      expect(list.loading.value).toBe(false);
      expect(list[itemsKey].value.map((item: any) => item.id)).toEqual(['fresh']);
      mock.mockResolvedValueOnce(response([{ id: 'next', dishId: 'next' }], 2));
      expect(await list.loadMore()).toBe(true);
      expect(mock.mock.calls.map(call => call[0].page)).toEqual([1, 2, 1, 2]);
    }
  );

  it('discards both superseded append and current refresh responses after disposal', async () => {
    let finishAppend!: (value: any) => void;
    let finishRefresh!: (value: any) => void;
    const mock = api as jest.Mock;
    mock
      .mockResolvedValueOnce(response([{ id: 'first', dishId: 'first' }]))
      .mockImplementationOnce(
        () =>
          new Promise(resolve => {
            finishAppend = resolve;
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise(resolve => {
            finishRefresh = resolve;
          })
      );
    const list = setup();
    await list[fetchKey]();
    const append = list.loadMore();
    const refresh = list.refresh();
    expect(mock).toHaveBeenCalledTimes(3);
    scopes[scopes.length - 1].stop();
    finishAppend(response([{ id: 'stale', dishId: 'stale' }], 2));
    finishRefresh(response([{ id: 'fresh', dishId: 'fresh' }]));
    expect(await append).toBe(false);
    expect(await refresh).toBe(false);
    expect(list[itemsKey].value.map((item: any) => item.id)).toEqual(['first']);
  });
});

it('deduplicates favorite removals and revalidates shifted pagination after success', async () => {
  let finish!: (value: any) => void;
  (unfavoriteDish as jest.Mock).mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      })
  );
  (getMyFavorites as jest.Mock).mockResolvedValue(response([{ dishId: 'remaining' }], 1, 1));
  const scope = effectScope();
  scopes.push(scope);
  const list = scope.run(useFavorites)!;
  list.favoriteItems.value = [{ dishId: 'removed' }, { dishId: 'remaining' }] as any;
  const first = list.removeFavorite('removed');
  expect(await list.removeFavorite('removed')).toBe(false);
  expect(unfavoriteDish).toHaveBeenCalledTimes(1);
  expect(list.removingIds.value).toEqual(['removed']);
  finish({ code: 200 });
  expect(await first).toBe(true);
  expect(list.favoriteItems.value.map(item => item.dishId)).toEqual(['remaining']);
  expect(getMyFavorites).toHaveBeenCalledWith({ page: 1, pageSize: 10 });
  expect(list.removingIds.value).toEqual([]);
});

it('does not apply an old account favorite removal or feedback to the new account', async () => {
  let finish!: (value: any) => void;
  (unfavoriteDish as jest.Mock).mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      })
  );
  const scope = effectScope();
  scopes.push(scope);
  const list = scope.run(useFavorites)!;
  list.favoriteItems.value = [{ dishId: 'a' }] as any;
  const pending = list.removeFavorite('a');
  store.sessionVersion++;
  store.userInfo = { id: 'b' };
  list.favoriteItems.value = [{ dishId: 'b' }] as any;
  finish({ code: 200 });
  expect(await pending).toBe(false);
  expect(list.favoriteItems.value.map(item => item.dishId)).toEqual(['b']);
  expect(uni.showToast).not.toHaveBeenCalled();
});

it.each([200, 500])(
  'revalidates once after an onShow refresh arrives during a favorite removal returning %s',
  async code => {
    let finish!: (value: any) => void;
    (unfavoriteDish as jest.Mock).mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        })
    );
    (getMyFavorites as jest.Mock)
      .mockResolvedValueOnce(
        response([{ dishId: 'removed' }, { dishId: 'changed-in-detail' }], 1, 1)
      )
      .mockResolvedValueOnce(response([{ dishId: 'fresh' }], 1, 1));
    const scope = effectScope();
    scopes.push(scope);
    const list = scope.run(useFavorites)!;
    await list.fetchFavorites();
    const removal = list.removeFavorite('removed');
    expect(await list.refresh()).toBe(false);
    expect(await list.refresh()).toBe(false);
    expect(getMyFavorites).toHaveBeenCalledTimes(1);
    finish({ code, message: '取消收藏失败' });
    expect(await removal).toBe(code === 200);
    expect(getMyFavorites).toHaveBeenCalledTimes(2);
    expect(list.favoriteItems.value.map(item => item.dishId)).toEqual(['fresh']);
  }
);

it.each(['session', 'dispose'])(
  'does not replay a deferred favorite refresh after %s ownership ends',
  async change => {
    let finish!: (value: any) => void;
    (unfavoriteDish as jest.Mock).mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        })
    );
    (getMyFavorites as jest.Mock).mockResolvedValueOnce(response([{ dishId: 'a' }], 1, 1));
    const scope = effectScope();
    scopes.push(scope);
    const list = scope.run(useFavorites)!;
    await list.fetchFavorites();
    const removal = list.removeFavorite('a');
    await list.refresh();
    if (change === 'session') {
      store.sessionVersion++;
      store.userInfo = { id: 'b' };
      (getMyFavorites as jest.Mock).mockResolvedValueOnce(response([{ dishId: 'b' }], 1, 1));
      expect(await list.refresh()).toBe(true);
    } else scope.stop();
    finish({ code: 200 });
    expect(await removal).toBe(false);
    expect(getMyFavorites).toHaveBeenCalledTimes(change === 'session' ? 2 : 1);
    expect(uni.showToast).not.toHaveBeenCalled();
  }
);
