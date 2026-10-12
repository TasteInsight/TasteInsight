import { effectScope, reactive } from 'vue';
import { usePostFeed } from '@/pages/community/composables/use-post-feed';
import { getPosts } from '@/api/modules/social';
import { useUserStore } from '@/store/modules/use-user-store';
jest.mock('@/api/modules/social', () => ({ getPosts: jest.fn() }));
jest.mock('@/store/modules/use-user-store', () => ({ useUserStore: jest.fn() }));
const page = (ids: string[], number = 1, totalPages = 2) => ({
  code: 200,
  data: { items: ids.map(id => ({ id, content: id })), meta: { page: number, totalPages } },
});
const deferred = () => {
  let resolve!: (value: any) => void;
  const promise = new Promise<any>(yes => {
    resolve = yes;
  });
  return { promise, resolve };
};
let scope: ReturnType<typeof effectScope>;
let user: { sessionVersion: number; isLoggedIn: boolean };
beforeEach(() => {
  jest.clearAllMocks();
  scope = effectScope();
  user = reactive({ sessionVersion: 0, isLoggedIn: true });
  (useUserStore as unknown as jest.Mock).mockReturnValue(user);
});
afterEach(() => scope.stop());
test('loads the public author feed and preserves a failed next page for retry', async () => {
  const feed = scope.run(() => usePostFeed(() => ({ authorId: 'author' })))!;
  (getPosts as jest.Mock)
    .mockResolvedValueOnce(page(['one']))
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(page(['two'], 2));
  await feed.load();
  await feed.load(true);
  expect(feed.posts.value.map(item => item.id)).toEqual(['one']);
  expect(feed.error.value).toBe('offline');
  await feed.load(true);
  expect(getPosts).toHaveBeenLastCalledWith(
    { page: 2, pageSize: 20, authorId: 'author' },
    undefined
  );
  expect(feed.posts.value.map(item => item.id)).toEqual(['one', 'two']);
  expect(feed.hasMore.value).toBe(false);
});
test('newer refresh wins and duplicate page entries are merged once', async () => {
  const feed = scope.run(() => usePostFeed())!;
  const late = deferred();
  (getPosts as jest.Mock).mockReturnValueOnce(late.promise).mockResolvedValueOnce(page(['new']));
  const first = feed.load();
  await feed.load();
  late.resolve(page(['old']));
  await first;
  expect(feed.posts.value[0].id).toBe('new');
  (getPosts as jest.Mock).mockResolvedValueOnce(page(['new', 'next'], 2));
  await feed.load(true);
  expect(feed.posts.value.map(item => item.id)).toEqual(['new', 'next']);
});
test('switching accounts clears owned content before a stale response settles', async () => {
  const feed = scope.run(() => usePostFeed(() => ({ mine: true })))!;
  const late = deferred();
  (getPosts as jest.Mock).mockReturnValueOnce(late.promise);
  const first = feed.load();
  user.sessionVersion++;
  late.resolve(page(['private']));
  await first;
  expect(feed.posts.value).toEqual([]);
  expect(feed.initialized.value).toBe(false);
  expect(feed.loading.value).toBe(false);
});
test('does not request private content without a session', async () => {
  user.isLoggedIn = false;
  const feed = scope.run(() => usePostFeed(() => ({ mine: true })))!;
  await feed.load();
  expect(getPosts).not.toHaveBeenCalled();
});
test('hiding a page invalidates in-flight reads', async () => {
  const feed = scope.run(() => usePostFeed())!;
  const late = deferred();
  (getPosts as jest.Mock).mockReturnValue(late.promise);
  const first = feed.load();
  feed.invalidate();
  late.resolve(page(['hidden']));
  await first;
  expect(feed.posts.value).toEqual([]);
});

test('retry repeats a failed refresh instead of appending after the retained content', async () => {
  const feed = scope.run(() => usePostFeed())!;
  (getPosts as jest.Mock)
    .mockResolvedValueOnce(page(['old']))
    .mockRejectedValueOnce(new Error('refresh failed'))
    .mockResolvedValueOnce(page(['fresh']));
  await feed.load();
  await feed.load();
  await feed.retry();
  expect(getPosts).toHaveBeenLastCalledWith({ page: 1, pageSize: 20 }, undefined);
  expect(feed.posts.value.map(item => item.id)).toEqual(['fresh']);
});
