import { effectScope, reactive, ref } from 'vue';
import { useContentLike } from '@/composables/use-content-like';
import { useUserStore } from '@/store/modules/use-user-store';
import { requireStudent } from '@/utils/student-access';

jest.mock('@/store/modules/use-user-store', () => ({ useUserStore: jest.fn() }));
jest.mock('@/utils/student-access', () => ({ requireStudent: jest.fn() }));

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const response = (liked: boolean, likeCount: number) => ({
  code: 200,
  message: 'success',
  data: { liked, likeCount },
});
let scope: ReturnType<typeof effectScope>;
let user: { sessionVersion: number };
beforeEach(() => {
  jest.clearAllMocks();
  scope = effectScope();
  user = reactive({ sessionVersion: 0 });
  (useUserStore as unknown as jest.Mock).mockReturnValue(user);
  (requireStudent as jest.Mock).mockReturnValue(true);
});
afterEach(() => scope.stop());
function setup() {
  const items = ref([{ id: 'one', status: 'approved', likeCount: 2, likedByMe: false }]);
  const api = jest.fn();
  const state = scope.run(() => useContentLike(() => items.value, api))!;
  return { items, api, state };
}

test('deduplicates an in-flight tap and applies the authoritative count', async () => {
  const { items, api, state } = setup();
  const pending = deferred<any>();
  api.mockReturnValue(pending.promise);
  const operation = state.toggleLike(items.value[0]);
  await state.toggleLike(items.value[0]);
  expect(api).toHaveBeenCalledTimes(1);
  expect(state.pending.value.one).toBe(true);
  expect(state.isLiked(items.value[0])).toBe(false);
  pending.resolve(response(true, 8));
  await operation;
  expect(state.isLiked(items.value[0])).toBe(true);
  expect(state.likeCount(items.value[0])).toBe(8);
  api.mockResolvedValue(response(false, 7));
  await state.toggleLike(items.value[0]);
  expect(api).toHaveBeenLastCalledWith('one', false);
  expect(state.likeCount(items.value[0])).toBe(7);
});

test('does not write for unapproved content or a visitor denied by the student gate', async () => {
  const { items, api, state } = setup();
  items.value[0].status = 'pending';
  await state.toggleLike(items.value[0]);
  expect(requireStudent).not.toHaveBeenCalled();
  items.value[0].status = 'approved';
  (requireStudent as jest.Mock).mockReturnValue(false);
  await state.toggleLike(items.value[0]);
  expect(api).not.toHaveBeenCalled();
});

test('a late success cannot follow a session switch into the next account', async () => {
  const { items, api, state } = setup();
  const pending = deferred<any>();
  api.mockReturnValue(pending.promise);
  const operation = state.toggleLike(items.value[0]);
  user.sessionVersion++;
  pending.resolve(response(true, 9));
  await operation;
  expect(state.isLiked(items.value[0])).toBe(false);
  expect(state.pending.value).toEqual({});
});

test('a stale content object cannot overwrite a refreshed server snapshot', async () => {
  const { items, api, state } = setup();
  const pending = deferred<any>();
  api.mockReturnValue(pending.promise);
  const operation = state.toggleLike(items.value[0]);
  items.value = [{ id: 'one', status: 'approved', likeCount: 12, likedByMe: true }];
  pending.resolve(response(true, 3));
  await operation;
  expect(state.likeCount(items.value[0])).toBe(12);
});

test('failure preserves the previous value and allows a manual retry', async () => {
  const { items, api, state } = setup();
  api.mockRejectedValue(new Error('连接中断'));
  await state.toggleLike(items.value[0]);
  expect(state.isLiked(items.value[0])).toBe(false);
  expect(state.pending.value).toEqual({});
  expect(uni.showToast).toHaveBeenCalledWith({ title: '连接中断', icon: 'none' });
  api.mockResolvedValue(response(true, 3));
  await state.toggleLike(items.value[0]);
  expect(state.likeCount(items.value[0])).toBe(3);
});

test('a disposed page does not show a late error', async () => {
  const { items, api, state } = setup();
  const pending = deferred<any>();
  api.mockReturnValue(pending.promise);
  const operation = state.toggleLike(items.value[0]);
  scope.stop();
  pending.reject(new Error('late'));
  await operation;
  expect(uni.showToast).not.toHaveBeenCalled();
});
